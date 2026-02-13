"""Tests for uncovered branches in intranet_gym.py (92%→higher)."""
import pytest
from unittest import mock
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from gym_app.models import User, IntranetProfile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_igc@e.com', password='p', role='lawyer',
        first_name='L', last_name='I')


@pytest.mark.django_db
class TestIntranetGymCoverage:

    def test_list_docs_no_intranet_profile(self, api_client, lawyer):
        """Lines 28-32: no IntranetProfile → profile_data is None."""
        IntranetProfile.objects.all().delete()
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse('list-legal-intranet-documents'))
        assert r.status_code == 200
        assert r.data['profile'] is None

    def test_create_report_user_email_as_list(self, api_client, lawyer):
        """Line 113: userEmail sent as list extracts first element."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch('gym_app.views.intranet_gym.send_template_email'):
            r = api_client.post(
                reverse('create-report-request'),
                {
                    'contract': 'C1', 'initialDate': '2025-01-01',
                    'endDate': '2025-12-31', 'paymentConcept': 'Test',
                    'paymentAmount': '100', 'userName': 'L',
                    'userLastName': 'I',
                    'userEmail': ['law_igc@e.com'],
                },
                format='json')
        assert r.status_code == 201
        assert r.data['message'] == 'Informe creado y enviado con éxito.'

    def test_create_report_exception(self, api_client, lawyer):
        """Lines 156-158: exception during report creation returns 400."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.intranet_gym.send_template_email',
            side_effect=RuntimeError('email failed')
        ):
            r = api_client.post(
                reverse('create-report-request'),
                {'contract': 'C1', 'userName': 'L', 'userLastName': 'I'},
                format='json')
        assert r.status_code == 400
        assert 'error' in r.data
