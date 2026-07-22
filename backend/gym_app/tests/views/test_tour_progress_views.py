"""Tests for the guided-tour progress REST API views."""

from datetime import timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status

from gym_app.models import TourProgress

STATUS_URL = "/api/tour-progress/"
COMPLETE_URL = "/api/tour-progress/complete/"
MODULE = "dynamic_documents"


# ── GET /api/tour-progress/ ─────────────────────────────────────────

@pytest.mark.django_db
def test_status_requires_auth(api_client):
    """Unauthenticated requests are rejected."""
    response = api_client.get(STATUS_URL, {"module": MODULE})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_status_missing_module_returns_400(api_client, client_user):
    """A missing module query param is a bad request."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(STATUS_URL)
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_status_invalid_module_returns_400(api_client, client_user):
    """An unknown module identifier is a bad request."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(STATUS_URL, {"module": "unknown_module"})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_status_never_when_no_record(api_client, client_user):
    """Without a record the status is 'never' with a null timestamp."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(STATUS_URL, {"module": MODULE})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["module_name"] == MODULE
    assert response.data["status"] == "never"
    assert response.data["completed_at"] is None


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_status_recent_for_fresh_completion(api_client, client_user):
    """A completion within 30 days reports 'recent'."""
    TourProgress.objects.create(
        user=client_user,
        module_name=MODULE,
        completed_at=timezone.now() - timedelta(days=5),
    )
    api_client.force_authenticate(user=client_user)
    response = api_client.get(STATUS_URL, {"module": MODULE})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "recent"
    assert response.data["completed_at"] is not None


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_status_stale_for_old_completion(api_client, client_user):
    """A completion older than 30 days reports 'stale'."""
    TourProgress.objects.create(
        user=client_user,
        module_name=MODULE,
        completed_at=timezone.now() - timedelta(days=31),
    )
    api_client.force_authenticate(user=client_user)
    response = api_client.get(STATUS_URL, {"module": MODULE})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "stale"


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_status_is_user_scoped(api_client, client_user, lawyer_user):
    """Another user's completion does not leak into the requester's status."""
    TourProgress.objects.create(
        user=client_user,
        module_name=MODULE,
        completed_at=timezone.now(),
    )
    api_client.force_authenticate(user=lawyer_user)
    response = api_client.get(STATUS_URL, {"module": MODULE})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "never"


# ── POST /api/tour-progress/complete/ ───────────────────────────────

@pytest.mark.django_db
def test_complete_requires_auth(api_client):
    """Unauthenticated completion attempts are rejected."""
    response = api_client.post(COMPLETE_URL, {"module_name": MODULE})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_complete_invalid_module_returns_400(api_client, client_user):
    """An unknown module identifier is a bad request."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(COMPLETE_URL, {"module_name": "unknown_module"})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_complete_creates_record(api_client, client_user):
    """First completion creates the record and returns 'recent'."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(COMPLETE_URL, {"module_name": MODULE})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "recent"
    assert TourProgress.objects.filter(user=client_user, module_name=MODULE).count() == 1


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_complete_twice_updates_without_duplicating(api_client, client_user):
    """A second completion refreshes completed_at on the same row."""
    old_time = timezone.now() - timedelta(days=40)
    TourProgress.objects.create(
        user=client_user,
        module_name=MODULE,
        completed_at=old_time,
    )
    api_client.force_authenticate(user=client_user)
    response = api_client.post(COMPLETE_URL, {"module_name": MODULE})

    assert response.status_code == status.HTTP_200_OK
    assert TourProgress.objects.filter(user=client_user, module_name=MODULE).count() == 1
    progress = TourProgress.objects.get(user=client_user, module_name=MODULE)
    assert progress.completed_at > old_time


@pytest.mark.django_db
def test_complete_is_user_scoped(api_client, client_user, lawyer_user):
    """Completing a tour only affects the authenticated user."""
    api_client.force_authenticate(user=client_user)
    api_client.post(COMPLETE_URL, {"module_name": MODULE})

    assert TourProgress.objects.filter(user=lawyer_user).count() == 0
    assert TourProgress.objects.filter(user=client_user).count() == 1
