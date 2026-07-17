"""Tests for the daily signature reminder Huey task."""

from unittest.mock import patch

from gym_app.signature_reminder_task import send_daily_signature_reminders


def test_send_daily_signature_reminders_invokes_service():
    """The task delegates to notify_daily_pending_reminders."""
    with patch(
        "gym_app.services.signature_notification_service.notify_daily_pending_reminders"
    ) as mock_notify:
        send_daily_signature_reminders.call_local()

    assert mock_notify.call_count == 1


def test_send_daily_signature_reminders_swallows_service_error():
    """A failure in the underlying service does not propagate out of the task."""
    with patch(
        "gym_app.services.signature_notification_service.notify_daily_pending_reminders",
        side_effect=Exception("boom"),
    ):
        result = send_daily_signature_reminders.call_local()

    assert result is None
