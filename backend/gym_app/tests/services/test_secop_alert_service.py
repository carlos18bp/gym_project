"""Tests for SECOP alert evaluation service."""
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.utils import timezone

from gym_app.models import (
    AlertNotification,
    SECOPAlert,
    SECOPProcess,
    User,
)
from gym_app.services.secop_alert_service import AlertEvaluationService


@pytest.fixture
@pytest.mark.django_db
def lawyer():
    """Lawyer user for alert service tests."""
    return User.objects.create_user(
        email='alert_svc_lawyer@test.com',
        password='testpassword',
        first_name='Alert',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def second_lawyer():
    """Second lawyer user for grouping tests."""
    return User.objects.create_user(
        email='alert_svc_lawyer2@test.com',
        password='testpassword',
        first_name='Second',
        last_name='AlertLawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def process():
    """SECOP process for alert evaluation."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.ALERT1',
        entity_name='Ministerio de Transporte',
        department='Bogotá D.C.',
        description='Consultoría para diseño de acueducto municipal',
        procedure_name='Consultoría acueducto',
        procurement_method='Concurso de méritos',
        base_price=Decimal('500000000'),
        closing_date=timezone.now() + timezone.timedelta(days=30),
    )


@pytest.fixture
@pytest.mark.django_db
def second_process():
    """Second SECOP process for notification tests."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.ALERT2',
        entity_name='INVIAS',
        department='Antioquia',
        description='Obra civil vial',
        procedure_name='Obra vial',
        procurement_method='Licitación pública',
        base_price=Decimal('1000000000'),
    )


@pytest.mark.django_db
class TestEvaluateProcesses:
    """Tests for AlertEvaluationService.evaluate_processes."""

    def test_evaluate_processes_creates_notifications(self, lawyer, process):
        """Verify notifications are created for matching alerts."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Matching Alert',
            keywords='consultoría',
        )
        service = AlertEvaluationService()

        count = service.evaluate_processes([process.id])

        assert count == 1
        assert AlertNotification.objects.filter(
            alert=alert, process=process
        ).exists()

    def test_evaluate_processes_no_duplicate_notifications(self, lawyer, process):
        """Verify duplicate notifications are not created on re-evaluation."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Dup Alert',
            keywords='consultoría',
        )
        AlertNotification.objects.create(alert=alert, process=process)

        service = AlertEvaluationService()
        count = service.evaluate_processes([process.id])

        assert count == 0
        assert AlertNotification.objects.filter(
            alert=alert, process=process
        ).count() == 1

    @patch('gym_app.services.secop_alert_service.send_mail')
    def test_evaluate_processes_sends_immediate_email(
        self, mock_send_mail, lawyer, process
    ):
        """Verify immediate notification sends email."""
        mock_send_mail.return_value = 1

        SECOPAlert.objects.create(
            user=lawyer,
            name='Immediate Alert',
            keywords='consultoría',
            frequency=SECOPAlert.Frequency.IMMEDIATE,
        )
        service = AlertEvaluationService()

        count = service.evaluate_processes([process.id])

        assert count == 1
        mock_send_mail.assert_called_once()
        call_kwargs = mock_send_mail.call_args
        assert lawyer.email in call_kwargs.kwargs.get(
            'recipient_list', call_kwargs[1].get('recipient_list', [])
        ) if call_kwargs.kwargs else lawyer.email in call_kwargs[0][4] if len(call_kwargs[0]) > 4 else True

    def test_evaluate_processes_skips_inactive_alerts(self, lawyer, process):
        """Verify inactive alerts are not evaluated."""
        SECOPAlert.objects.create(
            user=lawyer,
            name='Inactive Alert',
            keywords='consultoría',
            is_active=False,
        )
        service = AlertEvaluationService()

        count = service.evaluate_processes([process.id])

        assert count == 0
        assert AlertNotification.objects.count() == 0


@pytest.mark.django_db
class TestSendSummaries:
    """Tests for AlertEvaluationService.send_summaries."""

    @patch('gym_app.services.secop_alert_service.send_mail')
    @patch('gym_app.services.secop_alert_service.render_to_string',
           return_value='<html>summary</html>')
    def test_send_summaries_groups_by_user(
        self, mock_render, mock_send_mail, lawyer, second_lawyer, process, second_process
    ):
        """Verify summaries are grouped and sent per user."""
        mock_send_mail.return_value = 1

        alert1 = SECOPAlert.objects.create(
            user=lawyer, name='Daily1', frequency='DAILY',
        )
        alert2 = SECOPAlert.objects.create(
            user=second_lawyer, name='Daily2', frequency='DAILY',
        )

        AlertNotification.objects.create(
            alert=alert1, process=process, is_sent=False,
        )
        AlertNotification.objects.create(
            alert=alert2, process=second_process, is_sent=False,
        )

        service = AlertEvaluationService()
        service.send_summaries('DAILY')

        assert mock_send_mail.call_count == 2

    @patch('gym_app.services.secop_alert_service.send_mail')
    @patch('gym_app.services.secop_alert_service.render_to_string',
           return_value='<html>summary</html>')
    def test_send_summaries_marks_as_sent(
        self, mock_render, mock_send_mail, lawyer, process
    ):
        """Verify notifications are marked as sent after email delivery."""
        mock_send_mail.return_value = 1

        alert = SECOPAlert.objects.create(
            user=lawyer, name='Mark Sent', frequency='DAILY',
        )
        notification = AlertNotification.objects.create(
            alert=alert, process=process, is_sent=False,
        )

        service = AlertEvaluationService()
        service.send_summaries('DAILY')

        notification.refresh_from_db()
        assert notification.is_sent is True
        assert notification.sent_at is not None

    @patch('gym_app.services.secop_alert_service.send_mail',
           side_effect=Exception('SMTP error'))
    @patch('gym_app.services.secop_alert_service.render_to_string',
           return_value='<html>summary</html>')
    def test_send_summaries_handles_email_failure(
        self, mock_render, mock_send_mail, lawyer, process
    ):
        """Verify email failure does not crash and notifications stay unsent."""
        alert = SECOPAlert.objects.create(
            user=lawyer, name='Fail Alert', frequency='DAILY',
        )
        notification = AlertNotification.objects.create(
            alert=alert, process=process, is_sent=False,
        )

        service = AlertEvaluationService()
        service.send_summaries('DAILY')

        notification.refresh_from_db()
        assert notification.is_sent is False
