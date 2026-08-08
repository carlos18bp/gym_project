"""Tests for the notification_service module."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import Notification, Process
from gym_app.services.notification_service import (
    build_process_recipients,
    create_bulk_notifications,
    create_notification,
    get_unread_count,
    notify_process_stakeholders,
)


def _make_process(case, lawyer, *clients):
    """Create a persisted Process with the given lawyer and clients."""
    process = Process.objects.create(
        authority="Juzgado 1",
        plaintiff="Demandante",
        defendant="Demandado",
        ref="RAD-1",
        subcase="Contractual",
        case=case,
        lawyer=lawyer,
    )
    process.clients.add(*clients)
    return process


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


@pytest.mark.django_db
def test_build_process_recipients_lists_lawyer_then_clients(
    case_type, lawyer_user, client_user
):
    """The lawyer is returned first, followed by the process clients."""
    process = _make_process(case_type, lawyer_user, client_user)

    recipients = build_process_recipients(process)

    assert recipients[0] == lawyer_user
    assert client_user in recipients
    assert len(recipients) == 2


@pytest.mark.django_db
def test_build_process_recipients_omits_clients_when_notify_clients_false(
    case_type, lawyer_user, client_user
):
    """With notify_clients disabled, only the lawyer is returned."""
    process = _make_process(case_type, lawyer_user, client_user)

    recipients = build_process_recipients(process, notify_clients=False)

    assert recipients == [lawyer_user]


@pytest.mark.django_db
def test_build_process_recipients_omits_actor(case_type, lawyer_user, client_user):
    """The acting user is excluded from the recipient list."""
    process = _make_process(case_type, lawyer_user, client_user)

    recipients = build_process_recipients(process, actor=client_user)

    assert client_user not in recipients
    assert recipients == [lawyer_user]


@pytest.mark.django_db
def test_build_process_recipients_deduplicates_repeated_user(case_type, lawyer_user):
    """A user who is both lawyer and client appears only once."""
    process = _make_process(case_type, lawyer_user, lawyer_user)

    recipients = build_process_recipients(process)

    assert recipients == [lawyer_user]


@pytest.mark.django_db
def test_build_process_recipients_without_lawyer_returns_clients_only(client_user):
    """When the process has no lawyer, only the clients are returned."""
    process_like = SimpleNamespace(
        lawyer=None,
        clients=SimpleNamespace(all=lambda: [client_user]),
    )

    recipients = build_process_recipients(process_like)

    assert recipients == [client_user]


@pytest.mark.django_db
def test_notify_process_stakeholders_creates_one_notification_per_recipient(
    case_type, lawyer_user, client_user
):
    """One process-linked notification is created for each recipient."""
    process = _make_process(case_type, lawyer_user, client_user)

    created = notify_process_stakeholders(process, "Etapa nueva", "Se agregó una etapa")

    assert len(created) == 2
    assert (
        Notification.objects.filter(link_type="process", link_id=process.id).count()
        == 2
    )


@pytest.mark.django_db
def test_notify_process_stakeholders_returns_empty_without_recipients(
    case_type, lawyer_user
):
    """No notifications are created when the recipient list is empty."""
    process = _make_process(case_type, lawyer_user)

    created = notify_process_stakeholders(process, "Etapa nueva", "Body", recipients=[])

    assert created == []
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_notify_process_stakeholders_uses_explicit_recipients(
    case_type, lawyer_user, client_user
):
    """An explicit recipients list is used instead of re-resolving from the process."""
    process = _make_process(case_type, lawyer_user, client_user)

    created = notify_process_stakeholders(
        process, "Etapa nueva", "Body", recipients=[client_user]
    )

    assert len(created) == 1
    assert Notification.objects.filter(user=lawyer_user).count() == 0
    assert Notification.objects.filter(user=client_user).count() == 1


@pytest.mark.django_db
def test_create_bulk_notifications_skips_failed_creations(client_user, lawyer_user):
    """Users whose notification creation returns None are dropped from the result."""
    survivor = Notification(user=lawyer_user, title="ok", message="body")
    with patch(
        "gym_app.services.notification_service.create_notification",
        side_effect=[None, survivor],
    ):
        result = create_bulk_notifications(
            users=[client_user, lawyer_user], title="t", message="m"
        )

    assert result == [survivor]
