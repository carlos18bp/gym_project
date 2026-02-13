"""Batch 28 – 20 tests: signature_views.py – helpers, get_signatures, sign_document."""
import datetime
from unittest.mock import patch, MagicMock

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature
from gym_app.views.dynamic_documents.signature_views import (
    get_client_ip,
    generate_encrypted_document_id,
    format_datetime_spanish,
    expire_overdue_documents,
    get_letterhead_for_document,
)

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def law():
    return User.objects.create_user(
        email="law28@t.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
def cli():
    return User.objects.create_user(
        email="cli28@t.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
def sig_doc(law, cli):
    doc = DynamicDocument.objects.create(
        title="SigDoc", content="<p>body</p>", state="PendingSignatures",
        created_by=law, requires_signature=True,
    )
    doc.visibility_permissions.create(user=law, granted_by=law)
    doc.visibility_permissions.create(user=cli, granted_by=law)
    return doc


# ── Helper function tests ──────────────────────────────────────────

class TestHelpers:
    def test_get_client_ip_forwarded(self):
        req = MagicMock()
        req.META = {"HTTP_X_FORWARDED_FOR": "1.2.3.4, 5.6.7.8"}
        assert get_client_ip(req) == "1.2.3.4"

    def test_get_client_ip_real_ip(self):
        req = MagicMock()
        req.META = {"HTTP_X_REAL_IP": "10.0.0.1"}
        assert get_client_ip(req) == "10.0.0.1"

    def test_get_client_ip_remote_addr(self):
        req = MagicMock()
        req.META = {"REMOTE_ADDR": "127.0.0.1"}
        assert get_client_ip(req) == "127.0.0.1"

    def test_get_client_ip_forwarded_empty_first(self):
        req = MagicMock()
        req.META = {"HTTP_X_FORWARDED_FOR": " , 5.6.7.8", "REMOTE_ADDR": "9.9.9.9"}
        # empty first entry falls through
        result = get_client_ip(req)
        assert result is not None

    def test_generate_encrypted_document_id_format(self):
        dt = datetime.datetime(2025, 6, 15, 10, 30, 0)
        result = generate_encrypted_document_id(1, dt)
        parts = result.split("-")
        assert len(parts) == 4
        assert all(len(p) == 4 for p in parts)

    def test_generate_encrypted_document_id_deterministic(self):
        dt = datetime.datetime(2025, 1, 1, 0, 0, 0)
        r1 = generate_encrypted_document_id(42, dt)
        r2 = generate_encrypted_document_id(42, dt)
        assert r1 == r2

    def test_format_datetime_spanish(self):
        dt = datetime.datetime(2025, 12, 25, 14, 30, 15)
        result = format_datetime_spanish(dt)
        assert "diciembre" in result
        assert "2025" in result
        assert "14:30:15" in result

    def test_format_datetime_spanish_january(self):
        dt = datetime.datetime(2025, 1, 5, 8, 0, 0)
        result = format_datetime_spanish(dt)
        assert "enero" in result


# ── expire_overdue_documents ───────────────────────────────────────

class TestExpireOverdue:
    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_expire_overdue_updates_state(self, mock_email, law):
        doc = DynamicDocument.objects.create(
            title="Overdue", content="<p>x</p>", state="PendingSignatures",
            created_by=law, requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        expire_overdue_documents()
        doc.refresh_from_db()
        assert doc.state == "Expired"

    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_expire_overdue_sends_email(self, mock_email, law):
        DynamicDocument.objects.create(
            title="Overdue2", content="<p>x</p>", state="PendingSignatures",
            created_by=law, requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        expire_overdue_documents()
        mock_email.assert_called_once()

    def test_expire_no_overdue_noop(self, law):
        DynamicDocument.objects.create(
            title="NotOverdue", content="<p>x</p>", state="PendingSignatures",
            created_by=law, requires_signature=True,
            signature_due_date=timezone.now().date() + datetime.timedelta(days=5),
        )
        expire_overdue_documents()
        assert DynamicDocument.objects.get(title="NotOverdue").state == "PendingSignatures"


# ── get_letterhead_for_document ────────────────────────────────────

class TestGetLetterhead:
    def test_no_letterhead(self, law):
        doc = DynamicDocument.objects.create(
            title="NoLH", content="<p>x</p>", state="Draft", created_by=law,
        )
        assert get_letterhead_for_document(doc, law) is None

    def test_doc_letterhead_priority(self, law):
        doc = MagicMock()
        doc.letterhead_image = "doc_lh.png"
        assert get_letterhead_for_document(doc, law) == "doc_lh.png"

    def test_user_letterhead_fallback(self):
        doc = MagicMock()
        doc.letterhead_image = None
        user = MagicMock()
        user.letterhead_image = "user_lh.png"
        assert get_letterhead_for_document(doc, user) == "user_lh.png"


# ── get_document_signatures endpoint ──────────────────────────────

class TestGetDocumentSignatures:
    def test_get_signatures_success(self, api, law, sig_doc):
        DocumentSignature.objects.create(document=sig_doc, signer=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-document-signatures", args=[sig_doc.id]))
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_get_signatures_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-document-signatures", args=[999999]))
        assert resp.status_code == 404

    def test_get_signatures_no_permission(self, api, sig_doc):
        outsider = User.objects.create_user(email="out@t.com", password="pw", role="client")
        api.force_authenticate(user=outsider)
        resp = api.get(reverse("get-document-signatures", args=[sig_doc.id]))
        assert resp.status_code == 403


# ── sign_document endpoint ─────────────────────────────────────────

class TestSignDocument:
    def test_sign_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("sign-document", args=[999999, law.id]))
        assert resp.status_code == 404

    def test_sign_doc_no_signature_required(self, api, law):
        doc = DynamicDocument.objects.create(
            title="NoSig", content="<p>x</p>", state="Draft",
            created_by=law, requires_signature=False,
        )
        api.force_authenticate(user=law)
        resp = api.post(reverse("sign-document", args=[doc.id, law.id]))
        assert resp.status_code == 400
        assert "does not require" in resp.data["detail"]

    def test_sign_on_behalf_forbidden(self, api, law, cli, sig_doc):
        DocumentSignature.objects.create(document=sig_doc, signer=cli)
        api.force_authenticate(user=law)
        resp = api.post(reverse("sign-document", args=[sig_doc.id, cli.id]))
        assert resp.status_code == 403
