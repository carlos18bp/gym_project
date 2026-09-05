"""Tests for the health_check endpoint."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.django_db
def test_health_check_returns_200_when_all_services_reachable(client):
    """Return HTTP 200 with app/database/redis ok when everything is reachable."""
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url:
        response = client.get("/api/health/")

    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "ok"
    assert data["database"] == "ok"
    assert "database_ms" in data
    assert data["redis"] == "ok"
    assert "redis_ms" in data
    mock_from_url.assert_called_once()
    mock_redis_instance.ping.assert_called_once()


@pytest.mark.django_db
def test_health_check_returns_503_when_database_fails(client):
    """Return HTTP 503 when the database connection raises an exception."""
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.connection") as mock_conn,
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance),
    ):
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(side_effect=Exception("DB unreachable"))
        mock_conn.cursor.return_value = mock_cursor

        response = client.get("/api/health/")

    assert response.status_code == 503
    data = response.json()
    assert data["app"] == "ok"
    assert "DB unreachable" in data["database"]
    mock_conn.cursor.assert_called_once()


@pytest.mark.django_db
def test_health_check_returns_503_when_redis_fails(client):
    """Return HTTP 503 when Redis ping raises an exception."""
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.side_effect = Exception("Redis connection refused")

    with patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url:
        response = client.get("/api/health/")

    assert response.status_code == 503
    data = response.json()
    assert data["app"] == "ok"
    assert data["database"] == "ok"
    assert "Redis connection refused" in data["redis"]
    mock_from_url.assert_called_once()
    mock_redis_instance.ping.assert_called_once()


@pytest.mark.django_db
def test_health_check_uses_configured_redis_url(client, settings):
    """Use the Redis URL shared by the health check and Huey."""
    settings.REDIS_URL = "redis://configured-host:6379/0"

    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url:
        response = client.get("/api/health/")

    assert response.status_code == 200
    mock_from_url.assert_called_once_with("redis://configured-host:6379/0")


@pytest.mark.django_db
def test_health_check_falls_back_to_decouple_when_setting_missing(client, settings):
    """Fall back to decouple when REDIS_URL is absent from settings."""
    fake_settings = SimpleNamespace(
        BASE_DIR=settings.BASE_DIR,
        DJANGO_ENV=settings.DJANGO_ENV,
    )

    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.settings", fake_settings),
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url,
        patch("decouple.config", return_value="redis://decouple-host:6379/1") as mock_decouple,
    ):
        response = client.get("/api/health/")

    assert response.status_code == 200
    mock_decouple.assert_called_once_with("REDIS_URL", default="redis://localhost:6379/1")
    mock_from_url.assert_called_once_with("redis://decouple-host:6379/1")


@pytest.mark.django_db
def test_health_check_does_not_depend_on_huey_storage_internals(client, settings):
    """Keep the health check independent from Huey's storage attributes."""
    settings.REDIS_URL = "redis://configured-host:6379/1"
    settings.HUEY = MagicMock(spec=[])

    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url,
    ):
        response = client.get("/api/health/")

    assert response.status_code == 200
    data = response.json()
    assert data["redis"] == "ok"
    mock_from_url.assert_called_once_with("redis://configured-host:6379/1")


@pytest.mark.django_db
def test_health_check_returns_503_when_both_db_and_redis_fail(client):
    """Return HTTP 503 with both error messages when DB and Redis both fail."""
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.side_effect = Exception("Redis down")

    with (
        patch("gym_app.views.health.connection") as mock_conn,
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url,
    ):
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(side_effect=Exception("DB down"))
        mock_conn.cursor.return_value = mock_cursor

        response = client.get("/api/health/")

    assert response.status_code == 503
    data = response.json()
    assert "DB down" in data["database"]
    assert "Redis down" in data["redis"]
    mock_conn.cursor.assert_called_once()
    mock_from_url.assert_called_once()


@pytest.mark.django_db
def test_health_check_reports_raw_django_env_as_environment(client, settings):
    """Expose the raw DJANGO_ENV value, not the IS_PRODUCTION boolean.

    Catches a probe that cannot tell staging from production: settings collapses
    both into IS_PRODUCTION=True, so publishing the boolean would make the two
    environments indistinguishable to an external monitor.
    """
    settings.DJANGO_ENV = "staging"
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance):
        response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json()["environment"] == "staging"
    mock_redis_instance.ping.assert_called_once()


@pytest.mark.django_db
def test_health_check_environment_falls_back_to_process_env(client, monkeypatch):
    """Fall back to the process environment when the setting is not defined.

    Catches an AttributeError crashing the endpoint on a deployment whose
    settings module never defines DJANGO_ENV: the probe would get a 500 instead
    of a health report.
    """
    monkeypatch.setenv("DJANGO_ENV", "sandbox")
    fake_settings = SimpleNamespace(BASE_DIR=Path("/opt/deploys/gym_project/backend"), HUEY=None)
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.settings", fake_settings),
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance),
    ):
        response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json()["environment"] == "sandbox"
    mock_redis_instance.ping.assert_called_once()


@pytest.mark.django_db
def test_health_check_reports_project_from_repo_directory_name(client, settings):
    """Derive 'project' from the directory holding BASE_DIR, not from BASE_DIR itself.

    Catches the off-by-one path bug: BASE_DIR points at <repo>/backend, so using
    its own name would answer 'backend' for every project in the fleet.
    """
    settings.BASE_DIR = Path("/opt/deploys/gym_project_staging/backend")
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance):
        response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json()["project"] == "gym_project_staging"
    mock_redis_instance.ping.assert_called_once()


@pytest.mark.django_db
def test_health_check_keeps_identity_fields_when_database_fails(client, settings):
    """Keep project/environment in the 503 payload when the database is down.

    Catches identity fields being appended after the checks: a degraded probe
    would then answer 503 without saying which deployment is degraded.
    """
    settings.DJANGO_ENV = "production"
    settings.BASE_DIR = Path("/opt/deploys/gym_project/backend")
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.connection") as mock_conn,
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance),
    ):
        mock_cursor = MagicMock()
        mock_cursor.__enter__ = MagicMock(side_effect=Exception("DB unreachable"))
        mock_conn.cursor.return_value = mock_cursor

        response = client.get("/api/health/")

    assert response.status_code == 503
    data = response.json()
    assert data["environment"] == "production"
    assert data["project"] == "gym_project"
    mock_conn.cursor.assert_called_once()
