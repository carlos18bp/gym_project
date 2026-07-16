"""Tests for StageAlert auto-creation in create_process / update_process views."""
import json

import pytest
from django.urls import reverse
from rest_framework import status

from gym_app.models import Case, Process, Stage, StageAlert, User


@pytest.fixture
def lawyer_user():
    """Lawyer user."""
    return User.objects.create_user(
        email='alerts.lawyer@test.com',
        password='x',
        role='Lawyer',
    )


@pytest.fixture
def admin_user():
    """Admin user."""
    return User.objects.create_user(
        email='alerts.admin@test.com',
        password='x',
        role='Admin',
    )


@pytest.fixture
def client_user():
    """Client user."""
    return User.objects.create_user(
        email='alerts.client@test.com',
        password='x',
        role='Client',
    )


@pytest.fixture
def case_type():
    """Case type."""
    return Case.objects.create(type='Civil')


def _make_payload(client_ids, lawyer_id, case_type_id, stages, **overrides):
    base = {
        'authority': 'Court',
        'plaintiff': 'P',
        'defendant': 'D',
        'ref': 'CASE-ALERT-1',
        'clientIds': client_ids,
        'lawyerId': lawyer_id,
        'caseTypeId': case_type_id,
        'subcase': 'Sub',
        'stages': stages,
    }
    base.update(overrides)
    return base


@pytest.mark.django_db
class TestCreateProcessAlerts:
    """StageAlert is auto-created for every stage on create_process."""

    def test_create_creates_alert_for_every_stage(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Create creates alert for every stage."""
        api_client.force_authenticate(user=admin_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[
                {'status': 'Apertura', 'date': '2099-06-01'},
                {'status': 'Audiencia', 'date': '2099-06-15'},
                {'status': 'Sentencia', 'date': '2099-06-30'},
            ],
        )
        url = reverse('create-process')
        response = api_client.post(
            url, {'mainData': json.dumps(payload)}, format='multipart'
        )

        assert response.status_code == status.HTTP_201_CREATED
        process = Process.objects.get(ref='CASE-ALERT-1')
        stages = list(process.stages.order_by('id'))
        assert len(stages) == 3
        assert all(StageAlert.objects.filter(stage=s).exists() for s in stages)

    def test_last_stage_alert_uses_payload_config(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Last stage alert uses payload config."""
        api_client.force_authenticate(user=admin_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[
                {'status': 'Apertura', 'date': '2026-06-01'},
                {'status': 'Audiencia', 'date': '2026-06-15'},
            ],
            alertDescription='Llevar documentos originales',
            alertIsActive=False,
            alertNotifyClients=False,
        )
        url = reverse('create-process')
        response = api_client.post(
            url, {'mainData': json.dumps(payload)}, format='multipart'
        )

        assert response.status_code == status.HTTP_201_CREATED
        process = Process.objects.get(ref='CASE-ALERT-1')
        last_stage = process.stages.order_by('id').last()
        last_alert = last_stage.alert
        assert last_alert.description == 'Llevar documentos originales'
        assert last_alert.is_active is False
        assert last_alert.notify_clients is False

    def test_non_last_stages_get_default_alert_config(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Non last stages get default alert config."""
        api_client.force_authenticate(user=admin_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[
                {'status': 'Apertura', 'date': '2026-06-01'},
                {'status': 'Audiencia', 'date': '2026-06-15'},
            ],
            alertDescription='Custom for last only',
            alertIsActive=False,
            alertNotifyClients=False,
        )
        url = reverse('create-process')
        api_client.post(url, {'mainData': json.dumps(payload)}, format='multipart')

        process = Process.objects.get(ref='CASE-ALERT-1')
        first_stage = process.stages.order_by('id').first()
        first_alert = first_stage.alert
        assert first_alert.description == ''
        assert first_alert.is_active is True
        assert first_alert.notify_clients is True


@pytest.mark.django_db
class TestUpdateProcessAlerts:
    """update_process replaces stages cleanly without orphan rows."""

    def test_update_deletes_old_stage_rows(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Update deletes old stage rows."""
        api_client.force_authenticate(user=admin_user)
        process = Process.objects.create(
            authority='C', plaintiff='P', defendant='D', ref='UPD-1',
            lawyer=lawyer_user, case=case_type, subcase='Sub',
        )
        process.clients.add(client_user)
        old_stage = Stage.objects.create(status='Old', date='2026-05-01')
        process.stages.add(old_stage)
        StageAlert.objects.create(stage=old_stage)
        old_stage_id = old_stage.id

        url = reverse('update-process', args=[process.id])
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'New', 'date': '2099-07-01'}],
            ref='UPD-1',
        )
        response = api_client.put(
            url, {'mainData': json.dumps(payload)}, format='multipart'
        )

        assert response.status_code == status.HTTP_200_OK
        assert not Stage.objects.filter(id=old_stage_id).exists()
        assert not StageAlert.objects.filter(stage_id=old_stage_id).exists()

    def test_update_creates_alerts_for_all_new_stages(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Update creates alerts for all new stages."""
        api_client.force_authenticate(user=admin_user)
        process = Process.objects.create(
            authority='C', plaintiff='P', defendant='D', ref='UPD-2',
            lawyer=lawyer_user, case=case_type, subcase='Sub',
        )
        process.clients.add(client_user)

        url = reverse('update-process', args=[process.id])
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[
                {'status': 'A', 'date': '2099-07-01'},
                {'status': 'B', 'date': '2099-07-15'},
                {'status': 'C', 'date': '2099-08-01'},
            ],
            ref='UPD-2',
            alertDescription='Heads up',
            alertIsActive=True,
            alertNotifyClients=True,
        )
        response = api_client.put(
            url, {'mainData': json.dumps(payload)}, format='multipart'
        )

        assert response.status_code == status.HTTP_200_OK
        new_stages = list(process.stages.order_by('id'))
        assert len(new_stages) == 3
        assert all(StageAlert.objects.filter(stage=s).exists() for s in new_stages)
        assert new_stages[-1].alert.description == 'Heads up'


@pytest.mark.django_db
class TestStageAlertNotifications:
    """B2 regression: lawyer (actor) receives the process_alert notification.

    Prior to the fix, ``_create_stage_alerts`` invoked
    ``build_process_recipients(..., actor=actor)`` which stripped the actor
    from the recipient list. When the lawyer toggled the alert themselves,
    the in-app notification skipped them — only clients received it. The
    fix passes ``actor=None`` so the activating lawyer also gets the cue
    in their Notification Center.
    """

    def test_lawyer_receives_notification_when_activating_alert(
        self, api_client, client_user, lawyer_user, case_type,
    ):
        """Lawyer receives notification when activating alert."""
        from gym_app.models import Notification

        api_client.force_authenticate(user=lawyer_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'Audiencia', 'date': '2099-12-31'}],
            ref='ALERT-LAWYER-1',
            alertDescription='Trae los originales',
            alertIsActive=True,
            alertNotifyClients=True,
        )
        url = reverse('create-process')
        response = api_client.post(
            url, {'mainData': json.dumps(payload)}, format='multipart'
        )
        assert response.status_code == status.HTTP_201_CREATED

        lawyer_alerts = Notification.objects.filter(
            user=lawyer_user, category='process_alert',
        )
        assert lawyer_alerts.exists(), (
            'Lawyer (actor) should receive a process_alert notification '
            'when they activate the stage alert themselves.'
        )

    def test_client_still_receives_notification_when_alert_is_active(
        self, api_client, client_user, lawyer_user, case_type,
    ):
        """Companion to the lawyer test — confirm clients still get notified."""
        from gym_app.models import Notification

        api_client.force_authenticate(user=lawyer_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'Audiencia', 'date': '2099-12-31'}],
            ref='ALERT-CLIENT-1',
            alertIsActive=True,
            alertNotifyClients=True,
        )
        url = reverse('create-process')
        api_client.post(url, {'mainData': json.dumps(payload)}, format='multipart')

        client_alerts = Notification.objects.filter(
            user=client_user, category='process_alert',
        )
        assert client_alerts.exists()

    def test_no_notification_when_alert_inactive(
        self, api_client, client_user, lawyer_user, case_type,
    ):
        """When the alert is inactive, no process_alert notification is emitted."""
        from gym_app.models import Notification

        api_client.force_authenticate(user=lawyer_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'Audiencia', 'date': '2099-12-31'}],
            ref='ALERT-INACTIVE-1',
            alertIsActive=False,
            alertNotifyClients=True,
        )
        url = reverse('create-process')
        api_client.post(url, {'mainData': json.dumps(payload)}, format='multipart')

        assert not Notification.objects.filter(
            user__in=[lawyer_user, client_user],
            category='process_alert',
            link_id__in=Process.objects.filter(ref='ALERT-INACTIVE-1').values_list('id', flat=True),
        ).exists()


# ── validation 400s, email guards and pending badge (coverage batch 2026-07-16) ──

from unittest.mock import patch

from django.utils import timezone

from gym_app.models import Notification


@pytest.mark.django_db
class TestAlertConfigValidation:
    """Activating an alert on a past-dated last stage returns 400."""

    def _create(self, api_client, client_user, lawyer_user, case_type, **overrides):
        overrides.setdefault('alertIsActive', True)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'Audiencia', 'date': '2020-01-01'}],
            **overrides,
        )
        return api_client.post(
            reverse('create-process'),
            {'mainData': json.dumps(payload)},
            format='multipart',
        )

    def test_create_rejects_active_alert_on_past_stage_date(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Create rejects active alert on past stage date."""
        api_client.force_authenticate(user=admin_user)

        response = self._create(api_client, client_user, lawyer_user, case_type)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'No se puede activar' in response.data['detail']

    def test_update_rejects_active_alert_on_past_stage_date(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Update rejects active alert on past stage date."""
        api_client.force_authenticate(user=admin_user)
        ok = self._create(
            api_client, client_user, lawyer_user, case_type,
            alertIsActive=False, ref='ALERT-UPD-400',
        )
        assert ok.status_code == status.HTTP_201_CREATED
        process = Process.objects.get(ref='ALERT-UPD-400')

        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'Audiencia', 'date': '2020-01-01'}],
            ref='ALERT-UPD-400',
            alertIsActive=True,
        )
        response = api_client.put(
            reverse('update-process', args=[process.pk]),
            {'mainData': json.dumps(payload)},
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'No se puede activar' in response.data['detail']


@pytest.mark.django_db
class TestAlertActivationEmailGuards:
    """Recipient and failure guards of the activation email helper."""

    def _activate(self, api_client, client_user, lawyer_user, case_type, ref):
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[{'status': 'Audiencia', 'date': '2099-12-31'}],
            ref=ref,
            alertIsActive=True,
            alertNotifyClients=False,
        )
        return api_client.post(
            reverse('create-process'),
            {'mainData': json.dumps(payload)},
            format='multipart',
        )

    def test_no_email_sent_when_no_recipient_has_email(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """No email sent when no recipient has email."""
        api_client.force_authenticate(user=admin_user)
        User.objects.filter(pk=lawyer_user.pk).update(email='')
        lawyer_user.refresh_from_db()

        with patch('gym_app.views.process.send_template_email') as mock_email:
            response = self._activate(
                api_client, client_user, lawyer_user, case_type, 'ALERT-NOMAIL'
            )

        assert response.status_code == status.HTTP_201_CREATED
        mock_email.assert_not_called()

    def test_email_failure_is_logged_and_creation_succeeds(
        self, api_client, admin_user, client_user, lawyer_user, case_type
    ):
        """Email failure is logged and creation succeeds."""
        api_client.force_authenticate(user=admin_user)

        with patch(
            'gym_app.views.process.send_template_email',
            side_effect=Exception('smtp down'),
        ), patch('gym_app.views.process.logger') as mock_logger:
            response = self._activate(
                api_client, client_user, lawyer_user, case_type, 'ALERT-SMTPFAIL'
            )

        assert response.status_code == status.HTTP_201_CREATED
        mock_logger.error.assert_called()


@pytest.mark.django_db
class TestPendingProcessAlertsCount:
    """SlideBar badge endpoint scoped to category=process_alert."""

    def test_counts_only_unread_active_process_alerts(
        self, api_client, lawyer_user
    ):
        """Counts only unread active process alerts."""
        api_client.force_authenticate(user=lawyer_user)
        Notification.objects.create(
            user=lawyer_user, category='process_alert', title='a', message='d'
        )
        Notification.objects.create(
            user=lawyer_user, category='process_alert', title='b', message='d',
            is_read=True,
        )
        Notification.objects.create(
            user=lawyer_user, category='general', title='c', message='d'
        )
        snoozed = Notification.objects.create(
            user=lawyer_user, category='process_alert', title='e', message='d',
        )
        Notification.objects.filter(pk=snoozed.pk).update(
            snoozed_until=timezone.now() + timezone.timedelta(days=1)
        )

        response = api_client.get(reverse('process-pending-alerts-count'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['pending_count'] == 1
