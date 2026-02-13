"""Test for uncovered line 215 in process.py."""
import pytest
import json
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from gym_app.models import Process, Case, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_pc@e.com', password='p', role='lawyer',
        first_name='L', last_name='P')


@pytest.fixture
def lawyer2():
    return User.objects.create_user(
        email='law2_pc@e.com', password='p', role='lawyer',
        first_name='L2', last_name='P')


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_pc@e.com', password='p', role='client',
        first_name='C', last_name='P')


@pytest.fixture
def ctype():
    return Case.objects.create(type='CivPC')


@pytest.fixture
def proc(lawyer, client_u, ctype):
    p = Process.objects.create(
        authority='A', plaintiff='P', defendant='D', ref='PC1',
        lawyer=lawyer, case=ctype, subcase='S')
    p.clients.add(client_u)
    return p


@pytest.mark.django_db
class TestProcessCoverage:

    def test_update_process_changes_lawyer(self, api_client, lawyer, lawyer2, proc):
        """Line 215: updating lawyerId assigns new lawyer to process."""
        api_client.force_authenticate(user=lawyer)
        url = reverse('update-process', kwargs={'pk': proc.pk})
        data = {'mainData': json.dumps({'lawyerId': lawyer2.id})}
        r = api_client.put(url, data, format='multipart')
        assert r.status_code == status.HTTP_200_OK
        proc.refresh_from_db()
        assert proc.lawyer_id == lawyer2.id
