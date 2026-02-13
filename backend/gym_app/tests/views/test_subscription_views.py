import json
import hashlib
import hmac
import unittest.mock as mock
from decimal import Decimal

import pytest
import requests
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import Subscription, PaymentHistory


User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def subscription_user():
    return User.objects.create_user(
        email="subscriber@example.com",
        password="testpassword",
        first_name="Sub",
        last_name="User",
        role="basic",
    )


@pytest.fixture
def wompi_settings(settings):
    settings.WOMPI_PUBLIC_KEY = "pub_test_123"
    settings.WOMPI_ENVIRONMENT = "test"
    settings.WOMPI_INTEGRITY_KEY = "integrity_test_key"
    settings.WOMPI_API_URL = "https://sandbox.wompi.co/v1"
    settings.WOMPI_PRIVATE_KEY = "priv_test_123"
    settings.WOMPI_EVENTS_KEY = "events_test_key"
    return settings


@pytest.mark.django_db
class TestWompiConfigAndSignature:
    def test_get_wompi_config(self, api_client, wompi_settings):
        url = reverse("subscription-wompi-config")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["public_key"] == wompi_settings.WOMPI_PUBLIC_KEY
        assert response.data["environment"] == wompi_settings.WOMPI_ENVIRONMENT

    def test_debug_signature_missing_fields(self, api_client, wompi_settings):
        url = reverse("subscription-debug-signature")

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount_in_cents and reference are required" in response.data["error"]

    def test_debug_signature_success(self, api_client, wompi_settings):
        url = reverse("subscription-debug-signature")
        payload = {
            "amount_in_cents": 1000,
            "currency": "COP",
            "reference": "REF123",
        }

        expected_concatenated = f"{payload['reference']}{payload['amount_in_cents']}{payload['currency']}{wompi_settings.WOMPI_INTEGRITY_KEY}"
        expected_signature = hashlib.sha256(expected_concatenated.encode()).hexdigest()

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["signature"] == expected_signature
        assert response.data["reference"] == payload["reference"]
        assert int(response.data["amount_in_cents"]) == payload["amount_in_cents"]
        assert response.data["currency"] == payload["currency"]
        assert response.data["concatenated_string"] == expected_concatenated

    def test_generate_signature_unauthenticated(self, api_client, wompi_settings):
        url = reverse("subscription-generate-signature")
        payload = {"amount_in_cents": 1000, "reference": "REF123"}

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_generate_signature_missing_fields_authenticated(self, api_client, subscription_user, wompi_settings):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-generate-signature")

        response = api_client.post(url, {"amount_in_cents": 1000}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount_in_cents and reference are required" in response.data["error"]

    def test_generate_signature_success(self, api_client, subscription_user, wompi_settings):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-generate-signature")

        payload = {"amount_in_cents": 5000, "currency": "COP", "reference": "REF999"}
        expected_concatenated = f"{payload['reference']}{payload['amount_in_cents']}{payload['currency']}{wompi_settings.WOMPI_INTEGRITY_KEY}"
        expected_signature = hashlib.sha256(expected_concatenated.encode()).hexdigest()

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["signature"] == expected_signature


@pytest.mark.django_db
class TestCreateSubscription:
    def test_create_subscription_unauthenticated(self, api_client):
        url = reverse("subscription-create")
        response = api_client.post(url, {"plan_type": "basico"}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_subscription_missing_plan_type(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "plan_type is required"

    def test_create_subscription_invalid_plan_type(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        response = api_client.post(url, {"plan_type": "invalid"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid plan_type. Must be: basico, cliente, or corporativo" in response.data["error"]

    def test_create_free_subscription_basico(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        response = api_client.post(url, {"plan_type": "basico"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        # Subscription created
        sub = Subscription.objects.get(user=subscription_user)
        assert sub.plan_type == "basico"
        assert sub.status == "active"
        assert sub.amount == Decimal("0.00")
        # User role updated accordingly
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"

    @pytest.mark.contract
    def test_create_subscription_response_contract(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        response = api_client.post(url, {"plan_type": "basico"}, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert set(response.data.keys()) == {
            "subscription_id",
            "plan_type",
            "status",
            "amount",
            "next_billing_date",
            "user_role",
            "message",
        }

    def test_create_paid_subscription_with_existing_payment_source(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        payload = {"plan_type": "cliente", "payment_source_id": "src_test_123"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        sub = Subscription.objects.get(user=subscription_user)
        assert sub.plan_type == "cliente"
        assert sub.payment_source_id == "src_test_123"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "client"

    def test_create_paid_subscription_missing_session_and_token(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        payload = {"plan_type": "corporativo"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "session_id and token are required for paid plans"

    @mock.patch("gym_app.views.subscription.requests.post")
    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_paid_subscription_with_session_and_token_success(
        self,
        mock_get,
        mock_post,
        api_client,
        subscription_user,
        wompi_settings,
    ):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        # Mock merchant info with acceptance tokens
        merchant_resp = mock.Mock()
        merchant_resp.raise_for_status.return_value = None
        merchant_resp.json.return_value = {
            "data": {
                "presigned_acceptance": {"acceptance_token": "acc_token"},
                "presigned_personal_data_auth": {"acceptance_token": "personal_token"},
            }
        }
        mock_get.return_value = merchant_resp

        # Mock successful payment source creation
        ps_response = mock.Mock()
        ps_response.status_code = 200
        ps_response.json.return_value = {"data": {"id": "src_from_wompi"}}
        mock_post.return_value = ps_response

        payload = {"plan_type": "cliente", "session_id": "sess_1", "token": "card_tok"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        sub = Subscription.objects.get(user=subscription_user)
        assert sub.payment_source_id == "src_from_wompi"

    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_paid_subscription_error_fetching_tokens(self, mock_get, api_client, subscription_user, wompi_settings):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        # Simulate network error when fetching merchant info
        mock_get.side_effect = requests.RequestException("boom")

        payload = {"plan_type": "cliente", "session_id": "sess_1", "token": "card_tok"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert "Error fetching acceptance tokens from Wompi" in response.data["error"]

    @pytest.mark.edge
    @mock.patch("gym_app.views.subscription.requests.post")
    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_paid_subscription_wompi_payment_source_error(
        self,
        mock_get,
        mock_post,
        api_client,
        subscription_user,
        wompi_settings,
    ):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        merchant_resp = mock.Mock()
        merchant_resp.raise_for_status.return_value = None
        merchant_resp.json.return_value = {
            "data": {
                "presigned_acceptance": {"acceptance_token": "acc_token"},
                "presigned_personal_data_auth": {"acceptance_token": "personal_token"},
            }
        }
        mock_get.return_value = merchant_resp

        ps_response = mock.Mock()
        ps_response.status_code = 400
        ps_response.json.return_value = {"error": "bad"}
        mock_post.return_value = ps_response

        payload = {"plan_type": "cliente", "session_id": "sess_1", "token": "card_tok"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data["error"] == "Error creating payment source with Wompi"
        assert response.data["wompi_status"] == 400
        assert not Subscription.objects.filter(user=subscription_user).exists()

    @pytest.mark.edge
    @mock.patch("gym_app.views.subscription.requests.post")
    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_paid_subscription_wompi_payment_source_missing_id(
        self,
        mock_get,
        mock_post,
        api_client,
        subscription_user,
        wompi_settings,
    ):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-create")

        merchant_resp = mock.Mock()
        merchant_resp.raise_for_status.return_value = None
        merchant_resp.json.return_value = {
            "data": {
                "presigned_acceptance": {"acceptance_token": "acc_token"},
                "presigned_personal_data_auth": {"acceptance_token": "personal_token"},
            }
        }
        mock_get.return_value = merchant_resp

        ps_response = mock.Mock()
        ps_response.status_code = 200
        ps_response.json.return_value = {"data": {}}
        mock_post.return_value = ps_response

        payload = {"plan_type": "cliente", "session_id": "sess_1", "token": "card_tok"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data["error"] == "Invalid response from Wompi while creating payment source"
        assert not Subscription.objects.filter(user=subscription_user).exists()


@pytest.mark.django_db
class TestSubscriptionManagement:
    def test_get_current_subscription_no_active(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-current")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["subscription"] is None
        assert response.data["message"] == "No active subscription found"

    def test_get_current_subscription_with_active(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-current")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == sub.id
        assert response.data["plan_type"] == sub.plan_type

    def test_cancel_subscription_no_active(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-cancel")

        response = api_client.patch(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["error"] == "No active subscription found"

    def test_cancel_subscription_success(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-cancel")

        response = api_client.patch(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        sub.refresh_from_db()
        assert sub.status == "cancelled"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"

    def test_cancel_subscription_already_cancelled(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="cancelled",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-cancel")

        response = api_client.patch(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Subscription is already cancelled"

    def test_update_payment_method_missing_payment_source_id(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-update-payment-method")

        response = api_client.patch(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "payment_source_id is required"

    def test_update_payment_method_no_active_subscription(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-update-payment-method")

        response = api_client.patch(url, {"payment_source_id": "src_new"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["error"] == "No active subscription found"

    def test_update_payment_method_success(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
            payment_source_id="src_old",
        )
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-update-payment-method")

        response = api_client.patch(
            url, {"payment_source_id": "src_new"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        sub.refresh_from_db()
        assert sub.payment_source_id == "src_new"

    def test_get_payment_history_success(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("50000.00"),
            status="approved",
            reference="REF-1",
        )
        # Another user's payment should not appear
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpassword",
        )
        other_sub = Subscription.objects.create(
            user=other_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        PaymentHistory.objects.create(
            subscription=other_sub,
            amount=Decimal("50000.00"),
            status="approved",
            reference="REF-2",
        )

        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-payments")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["reference"] == "REF-1"


@pytest.mark.django_db
class TestWompiWebhook:
    def test_wompi_webhook_missing_signature(self, api_client, wompi_settings):
        url = reverse("subscription-webhook")
        payload = {"event": "transaction.updated", "data": {}}
        raw_body = json.dumps(payload)

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
        )

        assert response.status_code == 400
        assert response.json()["error"] == "Missing signature"

    def test_wompi_webhook_invalid_signature(self, api_client, wompi_settings):
        url = reverse("subscription-webhook")
        payload = {"event": "transaction.updated", "data": {}}
        raw_body = json.dumps(payload)

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE="invalid_signature",
        )

        assert response.status_code == 401
        assert response.json()["error"] == "Invalid signature"

    def test_wompi_webhook_invalid_json(self, api_client, wompi_settings):
        url = reverse("subscription-webhook")
        raw_body = "{bad-json"
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 400
        assert response.json()["error"] == "Invalid JSON"

    def test_wompi_webhook_missing_transaction_data(self, api_client, wompi_settings):
        url = reverse("subscription-webhook")
        payload = {"event": "transaction.updated", "data": {}}
        raw_body = json.dumps(payload)
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 400
        assert response.json()["error"] == "Missing transaction data"

    def test_wompi_webhook_subscription_approved(self, api_client, subscription_user, wompi_settings):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="expired",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )

        url = reverse("subscription-webhook")
        reference = f"SUB-{sub.id}-20240101010101"
        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "trx_1",
                    "status": "APPROVED",
                    "reference": reference,
                }
            },
        }
        raw_body = json.dumps(payload)
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "success"
        sub.refresh_from_db()
        assert sub.status == "active"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "client"

    def test_wompi_webhook_subscription_declined(self, api_client, subscription_user, wompi_settings):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )

        url = reverse("subscription-webhook")
        reference = f"SUB-{sub.id}-20240101010101"
        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "trx_2",
                    "status": "DECLINED",
                    "reference": reference,
                }
            },
        }
        raw_body = json.dumps(payload)
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 200
        sub.refresh_from_db()
        assert sub.status == "expired"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"

    @pytest.mark.parametrize("status_value", ["VOIDED", "ERROR"])
    def test_wompi_webhook_subscription_voided_or_error(self, api_client, subscription_user, wompi_settings, status_value):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )

        url = reverse("subscription-webhook")
        reference = f"SUB-{sub.id}-20240101010101"
        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "trx_3",
                    "status": status_value,
                    "reference": reference,
                }
            },
        }
        raw_body = json.dumps(payload)
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 200
        sub.refresh_from_db()
        assert sub.status == "active"

    def test_wompi_webhook_invalid_reference_format(self, api_client, wompi_settings):
        url = reverse("subscription-webhook")
        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "trx_4",
                    "status": "APPROVED",
                    "reference": "SUB-INVALID",
                }
            },
        }
        raw_body = json.dumps(payload)
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 200
        assert response.json()["status"] == "success"

    def test_wompi_webhook_subscription_not_found(self, api_client, wompi_settings):
        url = reverse("subscription-webhook")
        payload = {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": "trx_5",
                    "status": "APPROVED",
                    "reference": "SUB-9999-20240101010101",
                }
            },
        }
        raw_body = json.dumps(payload)
        expected_signature = hmac.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        response = api_client.post(
            url,
            data=raw_body,
            content_type="application/json",
            HTTP_X_WOMPI_SIGNATURE=expected_signature,
        )

        assert response.status_code == 200
        assert response.json()["status"] == "success"


@pytest.mark.django_db
class TestCancelSubscriptionById:
    def test_cancel_subscription_view_success(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-cancel-by-id", kwargs={"subscription_id": sub.id})

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        sub.refresh_from_db()
        assert sub.status == "cancelled"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"
        assert response.data["message"] == "Subscription cancelled successfully"

    def test_cancel_subscription_view_not_found(self, api_client, subscription_user):
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-cancel-by-id", kwargs={"subscription_id": 9999})

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["error"] == "Subscription not found"

    def test_cancel_subscription_view_already_cancelled(self, api_client, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="cancelled",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )
        api_client.force_authenticate(user=subscription_user)
        url = reverse("subscription-cancel-by-id", kwargs={"subscription_id": sub.id})

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Subscription is already cancelled"
