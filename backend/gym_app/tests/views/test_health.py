"""Tests for the health_check endpoint."""

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
def test_health_check_uses_huey_storage_url_when_available(client, settings):
    """Use HUEY.storage.url for Redis connection when available."""
    huey_conf = MagicMock()
    huey_conf.storage.url = "redis://huey-host:6379/0"
    settings.HUEY = huey_conf

    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url:
        response = client.get("/api/health/")

    assert response.status_code == 200
    mock_from_url.assert_called_once_with("redis://huey-host:6379/0")


@pytest.mark.django_db
def test_health_check_falls_back_to_decouple_when_no_huey(client, settings):
    """Fall back to decouple config when HUEY is not configured."""
    settings.HUEY = None

    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url,
        patch("decouple.config", return_value="redis://decouple-host:6379/1") as mock_decouple,
    ):
        response = client.get("/api/health/")

    assert response.status_code == 200
    mock_decouple.assert_called_once_with("REDIS_URL", default="redis://localhost:6379/1")
    mock_from_url.assert_called_once_with("redis://decouple-host:6379/1")


@pytest.mark.django_db
def test_health_check_falls_back_to_decouple_when_huey_lacks_storage(client, settings):
    """Fall back to decouple when HUEY exists but has no storage.url."""
    huey_conf = MagicMock(spec=[])  # No attributes at all
    settings.HUEY = huey_conf

    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True

    with (
        patch("gym_app.views.health.Redis.from_url", return_value=mock_redis_instance) as mock_from_url,
        patch("decouple.config", return_value="redis://fallback:6379/1") as mock_decouple,
    ):
        response = client.get("/api/health/")

    assert response.status_code == 200
    data = response.json()
    assert data["redis"] == "ok"
    mock_decouple.assert_called_once()
    mock_from_url.assert_called_once()


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
