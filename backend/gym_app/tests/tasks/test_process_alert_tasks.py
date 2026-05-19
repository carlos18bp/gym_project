"""Tests for the daily process-alert reminder task."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from gym_app.models import Case, Notification, Process, Stage, StageAlert, User
from gym_app.process_alert_tasks import send_process_alerts


@pytest.fixture
def case_type():
    return Case.objects.create(type='Civil')


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='alert.lawyer@test.com',
        password='x',
        first_name='Alert',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.fixture
def process_client():
    return User.objects.create_user(
        email='alert.client@test.com',
        password='x',
        first_name='Alert',
        last_name='Client',
        role='client',
    )


@pytest.fixture
def second_client():
    return User.objects.create_user(
        email='alert.client2@test.com',
        password='x',
        first_name='Alert2',
        last_name='Client2',
        role='client',
    )


def _make_process(lawyer, clients, case_type, ref='ALERT-1'):
    process = Process.objects.create(
        authority='Court',
        plaintiff='P',
        defendant='D',
        ref=ref,
        lawyer=lawyer,
        case=case_type,
        subcase='Sub',
    )
    process.clients.set(clients)
    return process


def _add_stage(process, status_label='Audiencia', days_from_today=3):
    today = timezone.now().date()
    stage = Stage.objects.create(
        status=status_label,
        date=today + timedelta(days=days_from_today),
    )
    process.stages.add(stage)
    return stage


@pytest.mark.django_db
class TestProcessAlertTaskReminders:
    """Triggering of 3-day and 1-day reminders."""

    def test_sends_3_day_reminder_for_stage_in_3_days(
        self, lawyer, process_client, case_type
    ):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, days_from_today=3)
        alert = StageAlert.objects.create(stage=stage)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        alert.refresh_from_db()
        assert alert.notified_3_days is True
        assert alert.notified_1_day is False
        mock_email.assert_called_once()

    def test_sends_1_day_reminder_for_stage_in_1_day(
        self, lawyer, process_client, case_type
    ):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, days_from_today=1)
        alert = StageAlert.objects.create(stage=stage)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        alert.refresh_from_db()
        assert alert.notified_1_day is True
        assert alert.notified_3_days is False
        mock_email.assert_called_once()

    def test_does_not_send_when_no_matching_day(
        self, lawyer, process_client, case_type
    ):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, days_from_today=5)
        StageAlert.objects.create(stage=stage)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        assert mock_email.called is False

    def test_does_not_resend_already_notified_3_day(
        self, lawyer, process_client, case_type
    ):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, days_from_today=3)
        StageAlert.objects.create(stage=stage, notified_3_days=True)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        assert mock_email.called is False


@pytest.mark.django_db
class TestProcessAlertTaskSkips:
    """Cases where the task must NOT send a reminder."""

    def test_skips_inactive_alert(self, lawyer, process_client, case_type):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, days_from_today=3)
        StageAlert.objects.create(stage=stage, is_active=False)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        assert mock_email.called is False

    def test_skips_finished_process_with_fallo_status(
        self, lawyer, process_client, case_type
    ):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, status_label='Fallo', days_from_today=3)
        StageAlert.objects.create(stage=stage)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        assert mock_email.called is False

    def test_skips_stage_without_date(self, lawyer, process_client, case_type):
        process = _make_process(lawyer, [process_client], case_type)
        stage = Stage.objects.create(status='Audiencia', date=None)
        process.stages.add(stage)
        StageAlert.objects.create(stage=stage)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        assert mock_email.called is False

    def test_skips_stage_without_alert(self, lawyer, process_client, case_type):
        process = _make_process(lawyer, [process_client], case_type)
        _add_stage(process, days_from_today=3)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        assert mock_email.called is False

    def test_only_processes_last_stage(self, lawyer, process_client, case_type):
        process = _make_process(lawyer, [process_client], case_type)
        old_stage = _add_stage(process, status_label='Apertura', days_from_today=3)
        old_alert = StageAlert.objects.create(stage=old_stage)
        last_stage = _add_stage(process, status_label='Audiencia', days_from_today=5)
        StageAlert.objects.create(stage=last_stage)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        old_alert.refresh_from_db()
        assert old_alert.notified_3_days is False
        assert mock_email.called is False


@pytest.mark.django_db
class TestProcessAlertRecipients:
    """Recipient configuration via notify_clients."""

    def test_notify_clients_true_sends_to_lawyer_and_clients(
        self, lawyer, process_client, second_client, case_type
    ):
        process = _make_process(lawyer, [process_client, second_client], case_type)
        stage = _add_stage(process, days_from_today=3)
        StageAlert.objects.create(stage=stage, notify_clients=True)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        kwargs = mock_email.call_args.kwargs
        recipient_emails = kwargs['to_emails']
        assert lawyer.email in recipient_emails
        assert process_client.email in recipient_emails
        assert second_client.email in recipient_emails

        notif_users = set(
            Notification.objects.filter(category='process_alert').values_list(
                'user_id', flat=True
            )
        )
        assert lawyer.id in notif_users
        assert process_client.id in notif_users
        assert second_client.id in notif_users

    def test_notify_clients_false_sends_only_to_lawyer(
        self, lawyer, process_client, case_type
    ):
        process = _make_process(lawyer, [process_client], case_type)
        stage = _add_stage(process, days_from_today=3)
        StageAlert.objects.create(stage=stage, notify_clients=False)

        with patch(
            'gym_app.process_alert_tasks.send_template_email'
        ) as mock_email:
            send_process_alerts.call_local()

        recipient_emails = mock_email.call_args.kwargs['to_emails']
        assert recipient_emails == [lawyer.email]

        notif_users = set(
            Notification.objects.filter(category='process_alert').values_list(
                'user_id', flat=True
            )
        )
        assert notif_users == {lawyer.id}
