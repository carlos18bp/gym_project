"""Tests for StageAlert auto-creation in create_process / update_process views."""
import json

import pytest
from django.urls import reverse
from rest_framework import status

from gym_app.models import Case, Process, Stage, StageAlert, User


@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email='alerts.lawyer@test.com',
        password='x',
        role='Lawyer',
    )


@pytest.fixture
def admin_user():
    return User.objects.create_user(
        email='alerts.admin@test.com',
        password='x',
        role='Admin',
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email='alerts.client@test.com',
        password='x',
        role='Client',
    )


@pytest.fixture
def case_type():
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
        api_client.force_authenticate(user=admin_user)
        payload = _make_payload(
            [client_user.id], lawyer_user.id, case_type.id,
            stages=[
                {'status': 'Apertura', 'date': '2026-06-01'},
                {'status': 'Audiencia', 'date': '2026-06-15'},
                {'status': 'Sentencia', 'date': '2026-06-30'},
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
            stages=[{'status': 'New', 'date': '2026-07-01'}],
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
                {'status': 'A', 'date': '2026-07-01'},
                {'status': 'B', 'date': '2026-07-15'},
                {'status': 'C', 'date': '2026-08-01'},
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
