import datetime
import hashlib
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.utils import timezone

from gym_app.models import DynamicDocument
from gym_app.views.dynamic_documents import signature_views


User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
def request_factory():
    return RequestFactory()


class TestGetClientIp:
    def test_get_client_ip_prefers_x_forwarded_for(self, request_factory):
        request = request_factory.get("/", HTTP_X_FORWARDED_FOR="1.2.3.4, 5.6.7.8")

        assert signature_views.get_client_ip(request) == "1.2.3.4"

    def test_get_client_ip_uses_x_real_ip_when_forwarded_empty(self, request_factory):
        request = request_factory.get(
            "/",
            HTTP_X_FORWARDED_FOR=" , ",
            HTTP_X_REAL_IP="9.9.9.9",
        )

        assert signature_views.get_client_ip(request) == "9.9.9.9"

    def test_get_client_ip_falls_back_to_remote_addr(self, request_factory):
        request = request_factory.get("/", REMOTE_ADDR="3.3.3.3")

        assert signature_views.get_client_ip(request) == "3.3.3.3"


class TestGenerateEncryptedDocumentId:
    def test_generate_encrypted_document_id_hash(self):
        created_at = datetime.datetime(2024, 2, 1, 10, 5, 6)

        timestamp_str = created_at.strftime("%Y%m%d%H%M%S")
        unique_string = f"DOC5_{timestamp_str}"
        hash_object = hashlib.sha256(unique_string.encode())
        short_hash = hash_object.hexdigest()[:16].upper()
        expected = f"{short_hash[:4]}-{short_hash[4:8]}-{short_hash[8:12]}-{short_hash[12:16]}"

        assert signature_views.generate_encrypted_document_id(5, created_at) == expected

    def test_generate_encrypted_document_id_fallback_when_hash_fails(self):
        created_at = datetime.datetime(2024, 2, 1, 10, 5, 6)

        with patch(
            "gym_app.views.dynamic_documents.signature_views.hashlib.sha256",
            side_effect=Exception("boom"),
        ):
            result = signature_views.generate_encrypted_document_id(5, created_at)

        assert result == "DOC-0005-20240201"


class TestFormatDatetimeSpanish:
    def test_format_datetime_spanish_format(self):
        dt = datetime.datetime(2025, 12, 25, 14, 30, 15)

        assert (
            signature_views.format_datetime_spanish(dt)
            == "25 de diciembre de 2025 a las 14:30:15"
        )


@pytest.mark.django_db
class TestExpireOverdueDocuments:
    def test_expire_overdue_documents_updates_state_and_sends_email(self, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Overdue",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )

        with patch("gym_app.views.dynamic_documents.signature_views.EmailMessage") as email_cls:
            signature_views.expire_overdue_documents()

        doc.refresh_from_db()
        assert doc.state == "Expired"
        email_cls.assert_called_once()
        email_cls.return_value.send.assert_called_once()

    def test_expire_overdue_documents_skips_missing_creator(self):
        doc = DynamicDocument.objects.create(
            title="No creator",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=None,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )

        with patch("gym_app.views.dynamic_documents.signature_views.EmailMessage") as email_cls:
            signature_views.expire_overdue_documents()

        doc.refresh_from_db()
        assert doc.state == "Expired"
        email_cls.assert_not_called()

    def test_expire_overdue_documents_swallows_email_errors(self, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Overdue",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )

        with patch("gym_app.views.dynamic_documents.signature_views.EmailMessage") as email_cls:
            email_cls.return_value.send.side_effect = Exception("boom")
            signature_views.expire_overdue_documents()

        doc.refresh_from_db()
        assert doc.state == "Expired"
        email_cls.return_value.send.assert_called_once()
