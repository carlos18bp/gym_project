"""
Batch 4 – Coverage-gap tests for:
  • signature_views helper functions (get_client_ip, generate_encrypted_document_id,
    format_datetime_spanish, get_letterhead_for_document, expire_overdue_documents)
  • subscription views edge cases (missing tokens, json parse error, request exception,
    db exception, generic exception handlers)
  • user views edge cases (photo upload, serializer validation error)
  • intranet_gym views edge cases (no profile, create_report exception, userEmail as list)
"""
import datetime
import hashlib
import json
import unittest.mock as mock
from decimal import Decimal
from io import BytesIO
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
import requests as req_lib
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    DynamicDocument,
    DocumentSignature,
    Subscription,
    PaymentHistory,
    LegalDocument,
    IntranetProfile,
)
from gym_app.models.user import UserSignature
from gym_app.views.dynamic_documents import signature_views

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_b4@example.com",
        password="testpassword",
        first_name="Law",
        last_name="Yer",
        role="lawyer",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic_b4@example.com",
        password="testpassword",
        first_name="Ba",
        last_name="Sic",
        role="basic",
    )


@pytest.fixture
def wompi_settings(settings):
    settings.WOMPI_PUBLIC_KEY = "pub_test_b4"
    settings.WOMPI_ENVIRONMENT = "test"
    settings.WOMPI_INTEGRITY_KEY = "integrity_b4"
    settings.WOMPI_API_URL = "https://sandbox.wompi.co/v1"
    settings.WOMPI_PRIVATE_KEY = "priv_test_b4"
    settings.WOMPI_EVENTS_KEY = "events_test_b4"
    return settings


def _png_file(name="test.png"):
    buf = BytesIO()
    Image.new("RGB", (1, 1), color="white").save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


# ===========================================================================
# 1. signature_views – helper functions (unit tests, no DB required)
# ===========================================================================

class TestGetClientIp:
    def test_x_forwarded_for_single(self):
        request = MagicMock()
        request.META = {"HTTP_X_FORWARDED_FOR": "1.2.3.4"}
        assert signature_views.get_client_ip(request) == "1.2.3.4"

    def test_x_forwarded_for_multiple(self):
        request = MagicMock()
        request.META = {"HTTP_X_FORWARDED_FOR": "10.0.0.1, 10.0.0.2, 10.0.0.3"}
        assert signature_views.get_client_ip(request) == "10.0.0.1"

    def test_x_forwarded_for_empty_string_falls_through(self):
        request = MagicMock()
        request.META = {"HTTP_X_FORWARDED_FOR": "", "HTTP_X_REAL_IP": "5.5.5.5"}
        assert signature_views.get_client_ip(request) == "5.5.5.5"

    def test_x_real_ip(self):
        request = MagicMock()
        request.META = {"HTTP_X_REAL_IP": "9.8.7.6"}
        assert signature_views.get_client_ip(request) == "9.8.7.6"

    def test_remote_addr_fallback(self):
        request = MagicMock()
        request.META = {"REMOTE_ADDR": "127.0.0.1"}
        assert signature_views.get_client_ip(request) == "127.0.0.1"

    def test_no_headers_returns_none(self):
        request = MagicMock()
        request.META = {}
        assert signature_views.get_client_ip(request) is None


class TestGenerateEncryptedDocumentId:
    def test_deterministic_output(self):
        dt = datetime.datetime(2025, 6, 15, 10, 30, 45)
        result = signature_views.generate_encrypted_document_id(42, dt)
        # Format: XXXX-XXXX-XXXX-XXXX
        assert len(result) == 19
        parts = result.split("-")
        assert len(parts) == 4
        assert all(len(p) == 4 for p in parts)

    def test_same_inputs_same_output(self):
        dt = datetime.datetime(2025, 1, 1, 0, 0, 0)
        a = signature_views.generate_encrypted_document_id(1, dt)
        b = signature_views.generate_encrypted_document_id(1, dt)
        assert a == b

    def test_different_ids_different_output(self):
        dt = datetime.datetime(2025, 1, 1, 0, 0, 0)
        a = signature_views.generate_encrypted_document_id(1, dt)
        b = signature_views.generate_encrypted_document_id(2, dt)
        assert a != b

    def test_exception_fallback(self):
        # Pass an object whose strftime raises on first call but returns a
        # date string on the second call (used by the fallback path).
        bad_dt = MagicMock()
        bad_dt.strftime.side_effect = [Exception("boom"), "20250101"]
        result = signature_views.generate_encrypted_document_id(7, bad_dt)
        assert result.startswith("DOC-0007-")


class TestFormatDatetimeSpanish:
    def test_known_date(self):
        dt = datetime.datetime(2025, 12, 25, 14, 30, 15)
        result = signature_views.format_datetime_spanish(dt)
        assert "diciembre" in result
        assert "25" in result
        assert "2025" in result
        assert "14:30:15" in result

    def test_january(self):
        dt = datetime.datetime(2025, 1, 5, 8, 0, 0)
        result = signature_views.format_datetime_spanish(dt)
        assert "enero" in result


class TestGetLetterheadForDocument:
    def test_document_letterhead_priority(self):
        doc = MagicMock()
        doc.letterhead_image = "doc_letterhead.png"
        user = MagicMock()
        user.letterhead_image = "user_letterhead.png"
        assert signature_views.get_letterhead_for_document(doc, user) == "doc_letterhead.png"

    def test_user_letterhead_fallback(self):
        doc = MagicMock()
        doc.letterhead_image = None
        user = MagicMock()
        user.letterhead_image = "user_letterhead.png"
        assert signature_views.get_letterhead_for_document(doc, user) == "user_letterhead.png"

    def test_no_letterhead(self):
        doc = MagicMock()
        doc.letterhead_image = None
        user = MagicMock()
        user.letterhead_image = None
        assert signature_views.get_letterhead_for_document(doc, user) is None

    def test_no_user(self):
        doc = MagicMock()
        doc.letterhead_image = None
        assert signature_views.get_letterhead_for_document(doc, None) is None


# ===========================================================================
# 2. expire_overdue_documents
# ===========================================================================

@pytest.mark.django_db
class TestExpireOverdueDocuments:
    def test_marks_overdue_document_as_expired(self, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Overdue doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        with patch.object(signature_views, "EmailMessage"):
            signature_views.expire_overdue_documents()

        doc.refresh_from_db()
        assert doc.state == "Expired"

    def test_skips_non_overdue_documents(self, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Future doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            signature_due_date=timezone.now().date() + datetime.timedelta(days=10),
        )
        signature_views.expire_overdue_documents()
        doc.refresh_from_db()
        assert doc.state == "PendingSignatures"

    def test_skips_document_without_creator_email(self):
        doc = DynamicDocument.objects.create(
            title="No creator",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=None,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        # Should not raise even though created_by is None
        signature_views.expire_overdue_documents()
        doc.refresh_from_db()
        assert doc.state == "Expired"

    def test_email_failure_does_not_block(self, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Email fail",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        with patch.object(signature_views, "EmailMessage") as MockEmail:
            MockEmail.return_value.send.side_effect = Exception("SMTP error")
            signature_views.expire_overdue_documents()

        doc.refresh_from_db()
        assert doc.state == "Expired"


# ===========================================================================
# 3. subscription views – edge cases not yet covered
# ===========================================================================

@pytest.mark.django_db
class TestSubscriptionEdgeCases:

    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_subscription_missing_acceptance_tokens(
        self, mock_get, api_client, basic_user, wompi_settings
    ):
        """Lines 205-210: merchant returns empty acceptance tokens."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-create")

        merchant_resp = mock.Mock()
        merchant_resp.raise_for_status.return_value = None
        merchant_resp.json.return_value = {
            "data": {
                "presigned_acceptance": {},
                "presigned_personal_data_auth": {},
            }
        }
        mock_get.return_value = merchant_resp

        payload = {"plan_type": "cliente", "session_id": "s1", "token": "t1"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert "Invalid acceptance tokens" in response.data["error"]

    @mock.patch("gym_app.views.subscription.requests.post")
    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_subscription_json_parse_error(
        self, mock_get, mock_post, api_client, basic_user, wompi_settings
    ):
        """Lines 240-241: ps_response.json() raises ValueError."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-create")

        merchant_resp = mock.Mock()
        merchant_resp.raise_for_status.return_value = None
        merchant_resp.json.return_value = {
            "data": {
                "presigned_acceptance": {"acceptance_token": "acc"},
                "presigned_personal_data_auth": {"acceptance_token": "pers"},
            }
        }
        mock_get.return_value = merchant_resp

        ps_response = mock.Mock()
        ps_response.status_code = 200
        ps_response.json.side_effect = ValueError("bad json")
        ps_response.text = "raw-text-body"
        mock_post.return_value = ps_response

        payload = {"plan_type": "cliente", "session_id": "s1", "token": "t1"}
        response = api_client.post(url, payload, format="json")

        # ps_body will be the raw text, and won't have .get('data', {}), so
        # wompi_payment_source_id will be None → 502
        assert response.status_code == status.HTTP_502_BAD_GATEWAY

    @mock.patch("gym_app.views.subscription.requests.post")
    @mock.patch("gym_app.views.subscription.requests.get")
    def test_create_subscription_payment_source_request_exception(
        self, mock_get, mock_post, api_client, basic_user, wompi_settings
    ):
        """Lines 262-264: RequestException when creating payment source."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-create")

        merchant_resp = mock.Mock()
        merchant_resp.raise_for_status.return_value = None
        merchant_resp.json.return_value = {
            "data": {
                "presigned_acceptance": {"acceptance_token": "acc"},
                "presigned_personal_data_auth": {"acceptance_token": "pers"},
            }
        }
        mock_get.return_value = merchant_resp
        mock_post.side_effect = req_lib.RequestException("connection failed")

        payload = {"plan_type": "cliente", "session_id": "s1", "token": "t1"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert "Error creating payment source" in response.data["error"]

    def test_create_subscription_db_exception(
        self, api_client, basic_user, wompi_settings
    ):
        """Lines 299-304: exception creating subscription in DB."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-create")

        with mock.patch(
            "gym_app.views.subscription.Subscription.objects.create",
            side_effect=Exception("DB error"),
        ):
            response = api_client.post(
                url, {"plan_type": "basico"}, format="json"
            )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error creating subscription" in response.data["error"]

    def test_get_current_subscription_exception(
        self, api_client, basic_user
    ):
        """Lines 331-335: generic exception in get_current_subscription."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-current")

        with mock.patch(
            "gym_app.views.subscription.Subscription.objects.filter",
            side_effect=Exception("unexpected"),
        ):
            response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error retrieving subscription" in response.data["error"]

    def test_cancel_subscription_exception(self, api_client, basic_user):
        """Lines 387-391: generic exception in cancel_subscription."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-cancel")

        with mock.patch(
            "gym_app.views.subscription.Subscription.objects.filter",
            side_effect=Exception("unexpected"),
        ):
            response = api_client.patch(url, {}, format="json")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error cancelling subscription" in response.data["error"]

    def test_update_payment_method_exception(self, api_client, basic_user):
        """Lines 436-440: generic exception in update_payment_method."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-update-payment-method")

        with mock.patch(
            "gym_app.views.subscription.Subscription.objects.filter",
            side_effect=Exception("unexpected"),
        ):
            response = api_client.patch(
                url, {"payment_source_id": "src_x"}, format="json"
            )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error updating payment method" in response.data["error"]

    def test_get_payment_history_exception(self, api_client, basic_user):
        """Lines 464-468: generic exception in get_payment_history."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("subscription-payments")

        with mock.patch(
            "gym_app.views.subscription.Subscription.objects.filter",
            side_effect=Exception("unexpected"),
        ):
            response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error retrieving payment history" in response.data["error"]

    def test_wompi_webhook_generic_exception(self, api_client, wompi_settings):
        """Lines 584-586: generic exception in wompi_webhook."""
        url = reverse("subscription-webhook")
        payload = {"event": "transaction.updated", "data": {"transaction": {"id": "t", "status": "APPROVED", "reference": "SUB-1-123"}}}
        raw_body = json.dumps(payload)
        import hmac as hmac_mod
        sig = hmac_mod.new(
            wompi_settings.WOMPI_EVENTS_KEY.encode(),
            raw_body.encode(),
            hashlib.sha256,
        ).hexdigest()

        with mock.patch(
            "gym_app.views.subscription.Subscription.objects.get",
            side_effect=Exception("unexpected"),
        ):
            response = api_client.post(
                url,
                data=raw_body,
                content_type="application/json",
                HTTP_X_WOMPI_SIGNATURE=sig,
            )

        assert response.status_code == 500
        assert response.json()["error"] == "Internal server error"


# ===========================================================================
# 4. user views – edge cases
# ===========================================================================

@pytest.mark.django_db
class TestUserViewEdgeCases:

    @mock.patch("django.core.files.storage.FileSystemStorage.save", return_value="profile_photos/photo.png")
    def test_update_profile_with_photo(self, mock_save, api_client):
        """Lines 58-64: photo_profile upload path."""
        user = User.objects.create_user(
            email="photo_user@example.com",
            password="testpassword",
            first_name="Photo",
            last_name="User",
            contact="1234567890",
            birthday=datetime.date(1990, 1, 1),
            identification="ID123",
            document_type="ID",
        )
        api_client.force_authenticate(user=user)

        photo = _png_file("profile.png")
        url = reverse("update_profile", kwargs={"pk": user.id})
        response = api_client.put(url, {"photo_profile": photo}, format="multipart")

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.photo_profile == "profile_photos/photo.png"

    def test_update_signature_ip_from_x_forwarded_for(self, api_client):
        """Line 163: IP extraction from X-Forwarded-For in update_signature."""
        user = User.objects.create_user(
            email="ip_test@example.com",
            password="testpassword",
            role="basic",
        )
        api_client.force_authenticate(user=user)

        sig_image = _png_file("sig.png")
        url = reverse("update-signature", kwargs={"user_id": user.id})

        with mock.patch(
            "django.core.files.storage.FileSystemStorage.save",
            return_value="signatures/sig.png",
        ):
            response = api_client.post(
                url,
                {"method": "upload", "signature_image": sig_image},
                format="multipart",
                HTTP_X_FORWARDED_FOR="203.0.113.50, 10.0.0.1",
            )

        assert response.status_code == status.HTTP_201_CREATED
        assert UserSignature.objects.filter(user=user).exists()

    def test_update_signature_serializer_validation_error(self, api_client):
        """Lines 205-206: serializer validation error in update_signature."""
        user = User.objects.create_user(
            email="sig_err@example.com",
            password="testpassword",
            role="basic",
        )
        api_client.force_authenticate(user=user)

        sig_image = _png_file("sig.png")
        url = reverse("update-signature", kwargs={"user_id": user.id})

        with mock.patch(
            "gym_app.views.user.UserSignatureSerializer"
        ) as MockSerializer:
            instance = MockSerializer.return_value
            instance.is_valid.return_value = False
            instance.errors = {"method": ["This field is required."]}

            response = api_client.post(
                url,
                {"signature_image": sig_image},
                format="multipart",
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ===========================================================================
# 5. intranet_gym views – edge cases
# ===========================================================================

@pytest.mark.django_db
class TestIntranetGymEdgeCases:

    def test_list_legal_intranet_documents_with_profile(self, api_client, lawyer_user):
        """Lines 28-32: profile exists and is serialized."""
        IntranetProfile.objects.create()
        test_file = SimpleUploadedFile("doc.pdf", b"content", content_type="application/pdf")
        LegalDocument.objects.create(name="Doc1", file=test_file)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-intranet-documents")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["profile"] is not None
        assert len(response.data["documents"]) == 1

    def test_list_legal_intranet_documents_no_profile(self, api_client, lawyer_user):
        """Lines 28-32: no IntranetProfile exists."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-intranet-documents")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["profile"] is None

    @mock.patch("gym_app.views.intranet_gym.send_template_email")
    def test_create_report_success_with_email_list(
        self, mock_send, api_client, lawyer_user
    ):
        """Line 113: userEmail sent as a list."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-report-request")

        response = api_client.post(
            url,
            {
                "contract": "C-001",
                "initialDate": "2025-01-01",
                "endDate": "2025-01-31",
                "paymentConcept": "Honorarios",
                "paymentAmount": "5000000",
                "userName": "Test",
                "userLastName": "User",
                "userEmail": ["test@example.com"],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        # send_template_email should be called twice: main + confirmation
        assert mock_send.call_count == 2

    @mock.patch("gym_app.views.intranet_gym.send_template_email", side_effect=Exception("SMTP down"))
    def test_create_report_exception(self, mock_send, api_client, lawyer_user):
        """Lines 156-161: exception during create_report."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-report-request")

        response = api_client.post(
            url,
            {
                "contract": "C-001",
                "initialDate": "2025-01-01",
                "endDate": "2025-01-31",
                "paymentConcept": "Honorarios",
                "paymentAmount": "5000000",
                "userName": "Test",
                "userLastName": "User",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
