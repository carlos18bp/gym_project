"""Tests for the notification_service module."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import Notification
from gym_app.services.notification_service import (
    create_bulk_notifications,
    create_notification,
    get_unread_count,
)


@pytest.mark.django_db
def test_create_notification_returns_instance(client_user):
    """create_notification returns a persisted Notification."""
    notif = create_notification(
        user=client_user,
        title="Hello",
        message="World",
        category="general",
        priority="low",
    )
    assert isinstance(notif, Notification)
    assert notif.pk is not None
    assert notif.title == "Hello"
    assert notif.user == client_user


@pytest.mark.django_db
def test_create_notification_stores_link_type_and_link_id(client_user):
    """link_type and link_id fields are stored correctly."""
    notif = create_notification(
        user=client_user,
        title="Process update",
        message="Stage changed",
        category="process_alert",
        priority="high",
        link_type="process",
        link_id=42,
    )
    assert notif.link_type == "process"
    assert notif.link_id == 42


@pytest.mark.django_db
def test_create_notification_returns_none_on_error(client_user):
    """Returns None when the DB write fails."""
    with patch.object(
        Notification.objects, "create", side_effect=Exception("DB error")
    ):
        result = create_notification(
            user=client_user, title="Fail", message="Body"
        )
    assert result is None


@pytest.mark.django_db
def test_create_bulk_notifications(client_user, lawyer_user):
    """create_bulk_notifications creates one notification per user."""
    results = create_bulk_notifications(
        users=[client_user, lawyer_user],
        title="Bulk",
        message="Body",
        category="general",
        priority="medium",
    )
    assert len(results) == 2
    assert Notification.objects.filter(user=client_user, title="Bulk").count() == 1
    assert Notification.objects.filter(user=lawyer_user, title="Bulk").count() == 1


@freeze_time('2026-01-15 10:00:00')
@pytest.mark.django_db
def test_get_unread_count_excludes_archived_deleted_snoozed(client_user):
    """get_unread_count only counts visible, unread, non-snoozed notifications."""
    # Visible unread
    Notification.objects.create(
        user=client_user, title="Unread", message="Body"
    )
    # Read — should not count
    Notification.objects.create(
        user=client_user, title="Read", message="Body", is_read=True
    )
    # Archived — should not count
    Notification.objects.create(
        user=client_user, title="Archived", message="Body", is_archived=True
    )
    # Deleted — should not count
    Notification.objects.create(
        user=client_user, title="Deleted", message="Body", is_deleted=True
    )
    # Snoozed (future) — should not count
    Notification.objects.create(
        user=client_user,
        title="Snoozed",
        message="Body",
        snoozed_until=timezone.now() + timedelta(hours=1),
    )

    assert get_unread_count(client_user) == 1


@freeze_time('2026-01-15 10:00:00')
@pytest.mark.django_db
def test_get_unread_count_includes_expired_snooze(client_user):
    """Notifications whose snooze expired count as unread."""
    Notification.objects.create(
        user=client_user,
        title="Past snooze",
        message="Body",
        snoozed_until=timezone.now() - timedelta(hours=1),
    )
    assert get_unread_count(client_user) == 1
