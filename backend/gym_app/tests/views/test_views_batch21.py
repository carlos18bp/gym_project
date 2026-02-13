"""Batch 21 – signature_views.py helper functions."""
import datetime, pytest
from io import BytesIO
from unittest.mock import patch, MagicMock, PropertyMock
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import DynamicDocument, DocumentSignature, DocumentVariable
from gym_app.views.dynamic_documents import signature_views

User = get_user_model()

@pytest.fixture
@pytest.mark.django_db
def lawyer():
    return User.objects.create_user(email="law_b21@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(email="cli_b21@t.com", password="pw", role="client", first_name="C", last_name="L")

@pytest.fixture
@pytest.mark.django_db
def doc(lawyer):
    return DynamicDocument.objects.create(title="DocB21", content="<p>hi</p>", state="Draft", created_by=lawyer)


# ===========================================================================
# 1. get_client_ip helper
# ===========================================================================

@pytest.mark.django_db
class TestGetClientIp:
    def test_x_forwarded_for(self):
        req = RequestFactory().get("/")
        req.META["HTTP_X_FORWARDED_FOR"] = "1.2.3.4, 5.6.7.8"
        assert signature_views.get_client_ip(req) == "1.2.3.4"

    def test_x_real_ip(self):
        req = RequestFactory().get("/")
        req.META["HTTP_X_REAL_IP"] = "9.8.7.6"
        assert signature_views.get_client_ip(req) == "9.8.7.6"

    def test_remote_addr_fallback(self):
        req = RequestFactory().get("/")
        req.META["REMOTE_ADDR"] = "127.0.0.1"
        # Remove proxy headers if present
        req.META.pop("HTTP_X_FORWARDED_FOR", None)
        req.META.pop("HTTP_X_REAL_IP", None)
        assert signature_views.get_client_ip(req) == "127.0.0.1"

    def test_empty_forwarded_for_falls_through(self):
        req = RequestFactory().get("/")
        req.META["HTTP_X_FORWARDED_FOR"] = ""
        req.META["HTTP_X_REAL_IP"] = "10.0.0.1"
        assert signature_views.get_client_ip(req) == "10.0.0.1"


# ===========================================================================
# 2. generate_encrypted_document_id
# ===========================================================================

@pytest.mark.django_db
class TestGenerateEncryptedDocId:
    def test_normal(self):
        dt = datetime.datetime(2025, 1, 15, 10, 30, 0)
        result = signature_views.generate_encrypted_document_id(42, dt)
        assert "-" in result
        assert len(result) == 19  # XXXX-XXXX-XXXX-XXXX

    def test_fallback_on_exception(self):
        bad_dt = MagicMock()
        bad_dt.strftime = MagicMock(side_effect=[Exception("hash fail"), "20250101"])
        result = signature_views.generate_encrypted_document_id(7, bad_dt)
        assert result.startswith("DOC-")


# ===========================================================================
# 3. format_datetime_spanish
# ===========================================================================

class TestFormatDatetimeSpanish:
    def test_december(self):
        dt = datetime.datetime(2025, 12, 25, 14, 30, 15)
        result = signature_views.format_datetime_spanish(dt)
        assert "diciembre" in result
        assert "25" in result

    def test_january(self):
        dt = datetime.datetime(2025, 1, 1, 0, 0, 0)
        result = signature_views.format_datetime_spanish(dt)
        assert "enero" in result


# ===========================================================================
# 4. expire_overdue_documents
# ===========================================================================

@pytest.mark.django_db
class TestExpireOverdueDocuments:
    def test_expires_overdue(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Overdue", content="<p>x</p>", state="PendingSignatures",
            created_by=lawyer, requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=2),
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)
        with patch.object(signature_views, "EmailMessage"):
            signature_views.expire_overdue_documents()
        doc.refresh_from_db()
        assert doc.state == "Expired"

    def test_skips_creator_none(self, client_user, lawyer):
        """When created_by is None, email notification is skipped."""
        doc = DynamicDocument.objects.create(
            title="NoCreator", content="<p>x</p>", state="PendingSignatures",
            created_by=None, requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)
        signature_views.expire_overdue_documents()
        doc.refresh_from_db()
        assert doc.state == "Expired"


# ===========================================================================
# 5. get_letterhead_for_document (in signature_views)
# ===========================================================================

@pytest.mark.django_db
class TestGetLetterheadForDocument:
    def test_doc_letterhead_priority(self, lawyer, doc):
        doc.letterhead_image = "some/path.png"
        assert signature_views.get_letterhead_for_document(doc, lawyer) == doc.letterhead_image

    def test_user_letterhead_fallback(self, lawyer, doc):
        doc.letterhead_image = ""
        lawyer.letterhead_image = "user/path.png"
        assert signature_views.get_letterhead_for_document(doc, lawyer) == lawyer.letterhead_image

    def test_no_letterhead(self, lawyer, doc):
        doc.letterhead_image = ""
        lawyer.letterhead_image = ""
        assert signature_views.get_letterhead_for_document(doc, lawyer) is None
