"""Tests for uncovered branches in corporate_request.py (89%→higher)."""
import pytest
import unittest.mock as mock
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization, OrganizationMembership,
    CorporateRequest, CorporateRequestType,
)
from gym_app.views.corporate_request import CorporateRequestPagination

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def corp_client():
    return User.objects.create_user(
        email='corp_crc@e.com', password='p', role='corporate_client',
        first_name='C', last_name='R')


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_crc@e.com', password='p', role='client',
        first_name='Cl', last_name='R')


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_crc@e.com', password='p', role='lawyer',
        first_name='L', last_name='R')


@pytest.fixture
def org(corp_client):
    return Organization.objects.create(
        title='OrgCRC', description='Desc', corporate_client=corp_client)


@pytest.fixture
def req_type():
    return CorporateRequestType.objects.create(name='TypeCRC')


@pytest.fixture
def corp_request(client_u, corp_client, org, req_type):
    """A corporate request for testing filters and conversations."""
    mem = OrganizationMembership.objects.create(
        organization=org, user=client_u, role='MEMBER', is_active=True)
    return CorporateRequest.objects.create(
        title='ReqCRC', description='Desc',
        client=client_u, corporate_client=corp_client,
        organization=org, request_type=req_type,
        priority='MEDIUM', status='PENDING')


@pytest.mark.django_db
class TestCorporateRequestCoverage:

    # --- Line 31: require_client_only blocks lawyer ---
    def test_client_only_blocks_lawyer(self, api_client, lawyer):
        """Line 31: lawyer blocked by require_client_only decorator."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse('client-get-my-organizations'))
        assert r.status_code == 403

    # --- Line 42: require_corporate_client_only blocks client ---
    def test_corp_only_blocks_client(self, api_client, client_u):
        """Line 42: client blocked by require_corporate_client_only."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(reverse('corporate-get-received-requests'))
        assert r.status_code == 403

    # --- Lines 166-174: client request filters ---
    def test_client_requests_status_filter(
        self, api_client, client_u, corp_request
    ):
        """Line 166: status filter on client requests."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(
            reverse('client-get-my-corporate-requests'),
            {'status': 'PENDING'})
        assert r.status_code == 200

    def test_client_requests_priority_filter(
        self, api_client, client_u, corp_request
    ):
        """Line 168: priority filter on client requests."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(
            reverse('client-get-my-corporate-requests'),
            {'priority': 'MEDIUM'})
        assert r.status_code == 200

    def test_client_requests_search_filter(
        self, api_client, client_u, corp_request
    ):
        """Lines 170-174: search filter on client requests."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(
            reverse('client-get-my-corporate-requests'),
            {'search': 'ReqCRC'})
        assert r.status_code == 200

    # --- Lines 285-298: corporate received requests filters ---
    def test_corp_received_status_filter(
        self, api_client, corp_client, corp_request
    ):
        """Line 285: status filter on received requests."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'status': 'PENDING'})
        assert r.status_code == 200

    def test_corp_received_priority_filter(
        self, api_client, corp_client, corp_request
    ):
        """Line 287: priority filter on received requests."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'priority': 'MEDIUM'})
        assert r.status_code == 200

    def test_corp_received_assigned_to_me(
        self, api_client, corp_client, corp_request
    ):
        """Line 289: assigned_to_me filter."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'assigned_to_me': 'true'})
        assert r.status_code == 200

    def test_corp_received_search_filter(
        self, api_client, corp_client, corp_request
    ):
        """Lines 291-298: search filter on received requests."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'search': 'ReqCRC'})
        assert r.status_code == 200

    # --- Lines 405-419: corporate add response (dict and empty text) ---
    def test_corp_add_response_empty_text(
        self, api_client, corp_client, corp_request
    ):
        """Lines 414-419: empty response_text returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('corporate-add-response-to-request',
                    kwargs={'request_id': corp_request.pk}),
            {'response_text': ''},
            format='json')
        assert r.status_code == 400
        assert 'vacío' in str(r.data)

    def test_corp_add_response_as_string(
        self, api_client, corp_client, corp_request
    ):
        """Lines 409-410: response_text as plain string."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('corporate-add-response-to-request',
                    kwargs={'request_id': corp_request.pk}),
            {'response_text': 'Valid response text'},
            format='json')
        assert r.status_code == 201

    # --- Line 520: get_request_conversation blocks lawyer ---
    def test_conversation_blocks_lawyer(
        self, api_client, lawyer, corp_request
    ):
        """Line 520: unauthorized role in get_request_conversation."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('get-request-conversation',
                    kwargs={'request_id': corp_request.pk}))
        assert r.status_code == 403

    # --- Lines 187-191: client requests pagination fallback ---
    @mock.patch.object(CorporateRequestPagination, 'paginate_queryset', return_value=None)
    def test_client_requests_pagination_fallback(
        self, mock_paginate, api_client, client_u, corp_request
    ):
        """Lines 187-191: pagination returns None → fallback response."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(reverse('client-get-my-corporate-requests'))
        assert r.status_code == 200
        assert 'corporate_requests' in r.data
        assert 'total_count' in r.data

    # --- Lines 314-318: corporate received requests pagination fallback ---
    @mock.patch.object(CorporateRequestPagination, 'paginate_queryset', return_value=None)
    def test_corp_received_pagination_fallback(
        self, mock_paginate, api_client, corp_client, corp_request
    ):
        """Lines 314-318: corporate pagination returns None → fallback."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(reverse('corporate-get-received-requests'))
        assert r.status_code == 200
        assert 'corporate_requests' in r.data
        assert 'total_count' in r.data

    # --- Line 258: client_add_response serializer error ---
    def test_client_add_response_serializer_error(
        self, api_client, client_u, corp_request
    ):
        """Line 258: serializer.is_valid() fails → 400 with error details."""
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('client-add-response-to-request',
                    kwargs={'request_id': corp_request.pk}),
            {'response_text': ''},
            format='json')
        assert r.status_code == 400
        assert 'error' in r.data or 'details' in r.data

    # --- Line 377: corporate_update_request_status serializer error ---
    def test_corp_update_status_serializer_error(
        self, api_client, corp_client, corp_request
    ):
        """Line 377: invalid update data returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.put(
            reverse('corporate-update-request-status',
                    kwargs={'request_id': corp_request.pk}),
            {'status': 'INVALID_STATUS_VALUE'},
            format='json')
        assert r.status_code == 400
        assert 'error' in r.data or 'details' in r.data

    # --- Line 447: corporate_add_response serializer error ---
    @mock.patch('gym_app.views.corporate_request.CorporateRequestResponseSerializer')
    def test_corp_add_response_serializer_error(
        self, MockSerializer, api_client, corp_client, corp_request
    ):
        """Line 447: serializer.is_valid() fails both times → 400."""
        mock_instance = mock.MagicMock()
        mock_instance.is_valid.return_value = False
        mock_instance.errors = {'response_text': ['This field is required.']}
        MockSerializer.return_value = mock_instance
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('corporate-add-response-to-request',
                    kwargs={'request_id': corp_request.pk}),
            {'response_text': 'valid text'},
            format='json')
        assert r.status_code == 400
        assert 'error' in r.data
