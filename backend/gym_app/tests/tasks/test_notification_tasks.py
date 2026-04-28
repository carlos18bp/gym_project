"""Tests for the notification snooze reactivation Huey task."""

from datetime import timedelta

import pytest
from django.utils import timezone

from gym_app.models import Notification
from gym_app.notification_tasks import reactivate_snoozed_notifications


def _run_task():
    """Execute the Huey task synchronously and return the result."""
    return reactivate_snoozed_notifications.call_local()


@pytest.mark.django_db
def test_reactivates_expired_snoozed_notifications(client_user):
    """Notifications whose snoozed_until is in the past are set back to unread."""
    notif = Notification.objects.create(
        user=client_user,
        title="Expired snooze",
        message="Body",
        is_read=True,
        snoozed_until=timezone.now() - timedelta(minutes=5),
    )
    count = _run_task()
    assert count == 1
    notif.refresh_from_db()
    assert notif.snoozed_until is None
    assert notif.is_read is False


@pytest.mark.django_db
def test_ignores_still_snoozed_notifications(client_user):
    """Notifications whose snoozed_until is in the future are not touched."""
    notif = Notification.objects.create(
        user=client_user,
        title="Still snoozed",
        message="Body",
        is_read=True,
        snoozed_until=timezone.now() + timedelta(hours=2),
    )
    count = _run_task()
    assert count == 0
    notif.refresh_from_db()
    assert notif.snoozed_until is not None
    assert notif.is_read is True


@pytest.mark.django_db
def test_ignores_deleted_notifications(client_user):
    """Soft-deleted notifications are not reactivated."""
    Notification.objects.create(
        user=client_user,
        title="Deleted and snoozed",
        message="Body",
        is_read=True,
        is_deleted=True,
        snoozed_until=timezone.now() - timedelta(minutes=5),
    )
    count = _run_task()
    assert count == 0


@pytest.mark.django_db
def test_returns_zero_when_nothing_to_reactivate(client_user):
    """Returns 0 when no snoozed notifications exist."""
    Notification.objects.create(
        user=client_user,
        title="Normal",
        message="Body",
    )
    count = _run_task()
    assert count == 0
