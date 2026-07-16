"""Tests for the Notification Center REST API views."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from gym_app.models import Notification


@pytest.fixture
@pytest.mark.django_db
def notification(client_user):
    """Single unread notification for client_user."""
    return Notification.objects.create(
        user=client_user,
        title="Test notification",
        message="Body text",
        category="general",
        priority="medium",
    )


@pytest.fixture
@pytest.mark.django_db
def read_notification(client_user):
    """Read notification for client_user."""
    return Notification.objects.create(
        user=client_user,
        title="Already read",
        message="Read body",
        category="general",
        priority="low",
        is_read=True,
    )


@pytest.fixture
@pytest.mark.django_db
def archived_notification(client_user):
    """Archived notification for client_user."""
    return Notification.objects.create(
        user=client_user,
        title="Archived note",
        message="Archived body",
        category="general",
        priority="low",
        is_read=True,
        is_archived=True,
    )


@pytest.fixture
@pytest.mark.django_db
def snoozed_notification(client_user):
    """Currently-snoozed notification for client_user."""
    return Notification.objects.create(
        user=client_user,
        title="Snoozed note",
        message="Snoozed body",
        category="general",
        priority="low",
        snoozed_until=timezone.now() + timedelta(hours=2),
        is_read=True,
    )


@pytest.fixture
@pytest.mark.django_db
def deleted_notification(client_user):
    """Soft-deleted notification for client_user."""
    return Notification.objects.create(
        user=client_user,
        title="Deleted note",
        message="Deleted body",
        category="general",
        priority="low",
        is_deleted=True,
    )


@pytest.fixture
@pytest.mark.django_db
def other_user_notification(lawyer_user):
    """Notification belonging to a different user."""
    return Notification.objects.create(
        user=lawyer_user,
        title="Other user note",
        message="Other body",
        category="general",
        priority="low",
    )


# ── List endpoint ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_notification_list_requires_auth(api_client):
    """Unauthenticated request returns 401."""
    response = api_client.get("/api/notifications/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_notification_list_returns_own_notifications(
    api_client, client_user, notification, other_user_notification
):
    """User sees only their own notifications."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/")
    assert response.status_code == status.HTTP_200_OK
    ids = [n["id"] for n in response.data["results"]]
    assert notification.id in ids
    assert other_user_notification.id not in ids


@pytest.mark.django_db
def test_notification_list_excludes_deleted(
    api_client, client_user, notification, deleted_notification
):
    """Deleted notifications are not returned."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/")
    ids = [n["id"] for n in response.data["results"]]
    assert notification.id in ids
    assert deleted_notification.id not in ids


@pytest.mark.django_db
def test_notification_list_excludes_snoozed(
    api_client, client_user, notification, snoozed_notification
):
    """Currently-snoozed notifications are hidden from the active list."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/")
    ids = [n["id"] for n in response.data["results"]]
    assert notification.id in ids
    assert snoozed_notification.id not in ids


@pytest.mark.django_db
def test_notification_list_tab_unread(
    api_client, client_user, notification, read_notification
):
    """Tab=unread returns only unread, non-archived notifications."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/?tab=unread")
    ids = [n["id"] for n in response.data["results"]]
    assert notification.id in ids
    assert read_notification.id not in ids


@pytest.mark.django_db
def test_notification_list_tab_archived(
    api_client, client_user, notification, archived_notification
):
    """Tab=archived returns only archived notifications."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/?tab=archived")
    ids = [n["id"] for n in response.data["results"]]
    assert archived_notification.id in ids
    assert notification.id not in ids


@pytest.mark.django_db
def test_notification_list_pagination(api_client, client_user):
    """Pagination returns correct page_size and count."""
    for i in range(25):
        Notification.objects.create(
            user=client_user,
            title=f"Note {i}",
            message=f"Body {i}",
        )
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/?page=1")
    assert response.data["count"] == 25
    assert len(response.data["results"]) == 20
    assert response.data["page"] == 1

    response2 = api_client.get("/api/notifications/?page=2")
    assert len(response2.data["results"]) == 5


# ── Unread count endpoint ─────────────────────────────────────────

@pytest.mark.django_db
def test_unread_count_excludes_archived_deleted_snoozed(
    api_client,
    client_user,
    notification,
    read_notification,
    archived_notification,
    snoozed_notification,
    deleted_notification,
):
    """Unread count only counts visible unread notifications."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/unread-count/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["unread_count"] == 1


# ── Mark read endpoint ────────────────────────────────────────────

@pytest.mark.django_db
def test_mark_read_single_notification(api_client, client_user, notification):
    """Mark a single notification as read."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(f"/api/notifications/{notification.id}/read/")
    assert response.status_code == status.HTTP_200_OK
    notification.refresh_from_db()
    assert notification.is_read is True


@pytest.mark.django_db
def test_mark_read_returns_404_for_other_user(
    api_client, client_user, other_user_notification
):
    """Cannot mark another user's notification as read."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(f"/api/notifications/{other_user_notification.id}/read/")
    assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Mark all read endpoint ────────────────────────────────────────

@pytest.mark.django_db
def test_mark_all_read(api_client, client_user):
    """Mark all visible unread notifications as read."""
    for _ in range(3):
        Notification.objects.create(
            user=client_user, title="Unread", message="Body"
        )
    api_client.force_authenticate(user=client_user)
    response = api_client.post("/api/notifications/mark-all-read/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["updated"] == 3
    assert Notification.objects.filter(user=client_user, is_read=False).count() == 0


# ── Archive endpoint ──────────────────────────────────────────────

@pytest.mark.django_db
def test_archive_notification(api_client, client_user, notification):
    """Archiving sets is_archived=True and is_read=True."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(f"/api/notifications/{notification.id}/archive/")
    assert response.status_code == status.HTTP_200_OK
    notification.refresh_from_db()
    assert notification.is_archived is True
    assert notification.is_read is True


@pytest.mark.django_db
def test_archive_returns_404_for_other_user(
    api_client, client_user, other_user_notification
):
    """Cannot archive another user's notification."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        f"/api/notifications/{other_user_notification.id}/archive/"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Snooze endpoint ───────────────────────────────────────────────

@pytest.mark.django_db
def test_snooze_valid_duration(api_client, client_user, notification):
    """Snooze with valid duration sets snoozed_until."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        f"/api/notifications/{notification.id}/snooze/",
        {"duration": "1h"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert "snoozed_until" in response.data
    notification.refresh_from_db()
    assert notification.snoozed_until is not None
    assert notification.is_read is True


@pytest.mark.django_db
def test_snooze_invalid_duration(api_client, client_user, notification):
    """Snooze with invalid duration returns 400."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        f"/api/notifications/{notification.id}/snooze/",
        {"duration": "2h"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_snooze_returns_404_for_other_user(
    api_client, client_user, other_user_notification
):
    """Cannot snooze another user's notification."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        f"/api/notifications/{other_user_notification.id}/snooze/",
        {"duration": "1h"},
        format="json",
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Delete endpoint ───────────────────────────────────────────────

@pytest.mark.django_db
def test_delete_notification(api_client, client_user, notification):
    """Soft-delete sets is_deleted=True and returns 204."""
    api_client.force_authenticate(user=client_user)
    response = api_client.delete(f"/api/notifications/{notification.id}/delete/")
    assert response.status_code == status.HTTP_204_NO_CONTENT
    notification.refresh_from_db()
    assert notification.is_deleted is True


@pytest.mark.django_db
def test_delete_returns_404_for_other_user(
    api_client, client_user, other_user_notification
):
    """Cannot delete another user's notification."""
    api_client.force_authenticate(user=client_user)
    response = api_client.delete(
        f"/api/notifications/{other_user_notification.id}/delete/"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


# ── page fallback, mark-unread and unarchive (coverage batch 2026-07-16) ──

@pytest.mark.django_db
def test_notification_list_falls_back_to_page_one_on_invalid_page(
    api_client, client_user, notification
):
    """A non-numeric page param falls back to the first page instead of crashing."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get("/api/notifications/", {"page": "abc"})
    assert response.status_code == status.HTTP_200_OK
    ids = [n["id"] for n in response.data["results"]]
    assert notification.id in ids


@pytest.mark.django_db
def test_mark_unread_single_notification(api_client, client_user, notification):
    """Mark a read notification back as unread."""
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    api_client.force_authenticate(user=client_user)

    response = api_client.post(f"/api/notifications/{notification.id}/unread/")

    assert response.status_code == status.HTTP_200_OK
    notification.refresh_from_db()
    assert notification.is_read is False


@pytest.mark.django_db
def test_mark_unread_returns_404_for_other_user(
    api_client, client_user, other_user_notification
):
    """Cannot mark another user's notification as unread."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        f"/api/notifications/{other_user_notification.id}/unread/"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_unarchive_notification(api_client, client_user, notification):
    """Restore an archived notification back to the active list."""
    notification.is_archived = True
    notification.save(update_fields=["is_archived"])
    api_client.force_authenticate(user=client_user)

    response = api_client.post(f"/api/notifications/{notification.id}/unarchive/")

    assert response.status_code == status.HTTP_200_OK
    notification.refresh_from_db()
    assert notification.is_archived is False


@pytest.mark.django_db
def test_unarchive_returns_404_for_other_user(
    api_client, client_user, other_user_notification
):
    """Cannot unarchive another user's notification."""
    api_client.force_authenticate(user=client_user)
    response = api_client.post(
        f"/api/notifications/{other_user_notification.id}/unarchive/"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND
