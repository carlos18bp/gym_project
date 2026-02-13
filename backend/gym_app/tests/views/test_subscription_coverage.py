"""Tests for uncovered branches in subscription.py (91%→higher)."""
import pytest
import json
import hashlib
import hmac
from unittest import mock
from django.urls import reverse
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status
from gym_app.models import User, Subscription
from datetime import datetime, timedelta
from decimal import Decimal


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_sc@e.com', password='p', role='client',
        first_name='C', last_name='S')


@pytest.fixture
def active_sub(client_u):
    return Subscription.objects.create(
        user=client_u, plan_type='cliente', status='active',
        amount=Decimal('50000.00'),
        next_billing_date=datetime.now().date() + timedelta(days=30))


@pytest.mark.django_db
class TestSubscriptionCoverage:

    # --- create_subscription: Wompi merchant fetch fails (lines 198-203) ---
    def test_create_sub_wompi_merchant_error(self, api_client, client_u):
        """Lines 198-203: requests.RequestException fetching merchant tokens."""
        api_client.force_authenticate(user=client_u)
        import requests as req_lib
        with mock.patch.object(
            req_lib, 'get', side_effect=req_lib.RequestException('timeout')
        ):
            r = api_client.post(
                reverse('subscription-create'),
                {'plan_type': 'cliente', 'session_id': 's1', 'token': 't1'},
                format='json')
        assert r.status_code == 502
        assert 'acceptance tokens' in r.data['error']

    # --- create_subscription: missing acceptance tokens (lines 205-210) ---
    def test_create_sub_missing_acceptance_tokens(self, api_client, client_u):
        """Lines 205-210: Wompi merchant returns empty tokens."""
        api_client.force_authenticate(user=client_u)
        mock_resp = mock.MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'data': {}}
        mock_resp.raise_for_status.return_value = None
        with mock.patch('requests.get', return_value=mock_resp):
            r = api_client.post(
                reverse('subscription-create'),
                {'plan_type': 'cliente', 'session_id': 's1', 'token': 't1'},
                format='json')
        assert r.status_code == 502
        assert 'Invalid acceptance tokens' in r.data['error']

    # --- create_subscription: payment source API error (lines 240-252) ---
    def test_create_sub_payment_source_api_error(self, api_client, client_u):
        """Lines 240-252: Wompi payment source returns 4xx."""
        api_client.force_authenticate(user=client_u)
        merchant_resp = mock.MagicMock()
        merchant_resp.status_code = 200
        merchant_resp.json.return_value = {
            'data': {
                'presigned_acceptance': {'acceptance_token': 'tok_a'},
                'presigned_personal_data_auth': {'acceptance_token': 'tok_p'},
            }
        }
        merchant_resp.raise_for_status.return_value = None

        ps_resp = mock.MagicMock()
        ps_resp.status_code = 422
        ps_resp.json.return_value = {'error': 'invalid card'}

        with mock.patch('requests.get', return_value=merchant_resp), \
             mock.patch('requests.post', return_value=ps_resp):
            r = api_client.post(
                reverse('subscription-create'),
                {'plan_type': 'cliente', 'session_id': 's1', 'token': 't1'},
                format='json')
        assert r.status_code == 502
        assert 'Error creating payment source' in r.data['error']

    # --- create_subscription: payment source request exception (lines 262-267) ---
    def test_create_sub_payment_source_exception(self, api_client, client_u):
        """Lines 262-267: requests.RequestException creating payment source."""
        api_client.force_authenticate(user=client_u)
        import requests as req_lib
        merchant_resp = mock.MagicMock()
        merchant_resp.status_code = 200
        merchant_resp.json.return_value = {
            'data': {
                'presigned_acceptance': {'acceptance_token': 'tok_a'},
                'presigned_personal_data_auth': {'acceptance_token': 'tok_p'},
            }
        }
        merchant_resp.raise_for_status.return_value = None

        with mock.patch('requests.get', return_value=merchant_resp), \
             mock.patch('requests.post',
                        side_effect=req_lib.RequestException('conn err')):
            r = api_client.post(
                reverse('subscription-create'),
                {'plan_type': 'cliente', 'session_id': 's1', 'token': 't1'},
                format='json')
        assert r.status_code == 502
        assert 'Error creating payment source' in r.data['error']

    # --- wompi_webhook: invalid JSON (lines 581-583) ---
    def test_webhook_invalid_json(self, api_client):
        """Lines 581-583: invalid JSON in webhook payload."""
        raw = 'not json{{{'
        sig = hmac.new(
            settings.WOMPI_EVENTS_KEY.encode(),
            raw.encode(), hashlib.sha256).hexdigest()
        r = api_client.post(
            reverse('subscription-webhook'),
            raw, content_type='application/json',
            HTTP_X_WOMPI_SIGNATURE=sig)
        assert r.status_code == 400

    # --- wompi_webhook: DECLINED transaction (lines 554-563) ---
    def test_webhook_declined_transaction(self, api_client, active_sub):
        """Lines 554-563: DECLINED transaction downgrades user."""
        event = {
            'event': 'transaction.updated',
            'data': {'transaction': {
                'id': 'tx1',
                'status': 'DECLINED',
                'reference': f'SUB-{active_sub.id}-12345'
            }}
        }
        raw = json.dumps(event)
        sig = hmac.new(
            settings.WOMPI_EVENTS_KEY.encode(),
            raw.encode(), hashlib.sha256).hexdigest()
        r = api_client.post(
            reverse('subscription-webhook'),
            raw, content_type='application/json',
            HTTP_X_WOMPI_SIGNATURE=sig)
        assert r.status_code == 200
        active_sub.refresh_from_db()
        assert active_sub.status == 'expired'
        active_sub.user.refresh_from_db()
        assert active_sub.user.role == 'basic'

    # --- wompi_webhook: generic exception (lines 584-586) ---
    def test_webhook_generic_exception(self, api_client):
        """Lines 584-586: generic exception returns 500."""
        raw = json.dumps({'event': 'test'})
        sig = hmac.new(
            settings.WOMPI_EVENTS_KEY.encode(),
            raw.encode(), hashlib.sha256).hexdigest()
        with mock.patch('json.loads', side_effect=RuntimeError('boom')):
            r = api_client.post(
                reverse('subscription-webhook'),
                raw, content_type='application/json',
                HTTP_X_WOMPI_SIGNATURE=sig)
        assert r.status_code == 500
