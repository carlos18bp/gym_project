"""Batch 29 – 20 tests: signature_views.py – reject, reopen, remove signature + sign edges."""
import pytest
from unittest.mock import patch
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature
from gym_app.models.user import UserSignature

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def law():
    return User.objects.create_user(
        email="law29@t.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
def cli():
    return User.objects.create_user(
        email="cli29@t.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


def _make_sig_doc(law, cli, state="PendingSignatures"):
    doc = DynamicDocument.objects.create(
        title="SDoc29", content="<p>body</p>", state=state,
        created_by=law, requires_signature=True,
    )
    doc.visibility_permissions.create(user=law, granted_by=law)
    doc.visibility_permissions.create(user=cli, granted_by=law)
    return doc


# ── sign_document – more edges ─────────────────────────────────────

class TestSignDocumentEdges:
    def test_sign_user_not_found_non_staff_gets_403(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        api.force_authenticate(user=law)
        resp = api.post(reverse("sign-document", args=[doc.id, 999999]))
        # non-staff user trying to sign on behalf of another gets 403 before user lookup
        assert resp.status_code == 403

    def test_sign_not_authorized_signer(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        # no DocumentSignature record for cli
        api.force_authenticate(user=cli)
        resp = api.post(reverse("sign-document", args=[doc.id, cli.id]))
        assert resp.status_code == 403

    def test_sign_no_electronic_signature(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("sign-document", args=[doc.id, cli.id]))
        assert resp.status_code == 400
        assert "signature" in resp.data["detail"].lower()

    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_sign_success(self, mock_email, api, law, cli):
        doc = _make_sig_doc(law, cli)
        sig = DocumentSignature.objects.create(document=doc, signer=cli)
        UserSignature.objects.create(user=cli, signature_image="sig.png")
        api.force_authenticate(user=cli)
        resp = api.post(reverse("sign-document", args=[doc.id, cli.id]))
        assert resp.status_code == 200
        sig.refresh_from_db()
        assert sig.signed is True

    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_sign_all_signers_fully_signed(self, mock_email, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        UserSignature.objects.create(user=cli, signature_image="sig.png")
        api.force_authenticate(user=cli)
        api.post(reverse("sign-document", args=[doc.id, cli.id]))
        doc.refresh_from_db()
        assert doc.state == "FullySigned"
        assert doc.fully_signed is True


# ── reject_document ────────────────────────────────────────────────

class TestRejectDocument:
    def test_reject_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("reject-document", args=[999999, law.id]))
        assert resp.status_code == 404

    def test_reject_no_sig_required(self, api, law):
        doc = DynamicDocument.objects.create(
            title="NoSig", content="<p>x</p>", state="Draft",
            created_by=law, requires_signature=False,
        )
        api.force_authenticate(user=law)
        resp = api.post(reverse("reject-document", args=[doc.id, law.id]))
        assert resp.status_code == 400

    def test_reject_on_behalf_forbidden(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=law)
        resp = api.post(reverse("reject-document", args=[doc.id, cli.id]))
        assert resp.status_code == 403

    def test_reject_user_not_found_non_staff_gets_403(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        api.force_authenticate(user=law)
        resp = api.post(reverse("reject-document", args=[doc.id, 999999]))
        # non-staff user trying to reject on behalf of another gets 403 before user lookup
        assert resp.status_code == 403

    def test_reject_not_pending_signer(self, api, cli, law):
        doc = _make_sig_doc(law, cli)
        # no signature record
        api.force_authenticate(user=cli)
        resp = api.post(reverse("reject-document", args=[doc.id, cli.id]))
        assert resp.status_code == 403

    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_reject_success(self, mock_email, api, law, cli):
        doc = _make_sig_doc(law, cli)
        sig = DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.post(
            reverse("reject-document", args=[doc.id, cli.id]),
            {"comment": "Needs changes"},
            format="json",
        )
        assert resp.status_code == 200
        sig.refresh_from_db()
        assert sig.rejected is True
        assert sig.rejection_comment == "Needs changes"
        doc.refresh_from_db()
        assert doc.state == "Rejected"

    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_reject_without_comment(self, mock_email, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("reject-document", args=[doc.id, cli.id]))
        assert resp.status_code == 200


# ── reopen_document_signatures ─────────────────────────────────────

class TestReopenSignatures:
    def test_reopen_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("reopen-document-signatures", args=[999999]))
        assert resp.status_code == 404

    def test_reopen_no_sig_required(self, api, law):
        doc = DynamicDocument.objects.create(
            title="NoSig", content="<p>x</p>", state="Draft",
            created_by=law, requires_signature=False,
        )
        api.force_authenticate(user=law)
        resp = api.post(reverse("reopen-document-signatures", args=[doc.id]))
        assert resp.status_code == 400

    def test_reopen_wrong_state(self, api, law, cli):
        doc = _make_sig_doc(law, cli, state="PendingSignatures")
        api.force_authenticate(user=law)
        resp = api.post(reverse("reopen-document-signatures", args=[doc.id]))
        assert resp.status_code == 400

    @patch("gym_app.views.dynamic_documents.signature_views.EmailMessage")
    def test_reopen_rejected_success(self, mock_email, api, law, cli):
        doc = _make_sig_doc(law, cli, state="Rejected")
        sig = DocumentSignature.objects.create(
            document=doc, signer=cli, rejected=True,
            rejected_at=timezone.now(), rejection_comment="bad",
        )
        api.force_authenticate(user=law)
        resp = api.post(reverse("reopen-document-signatures", args=[doc.id]))
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert doc.state == "PendingSignatures"
        sig.refresh_from_db()
        assert sig.rejected is False
        assert sig.rejection_comment is None


# ── remove_signature_request ───────────────────────────────────────

class TestRemoveSignatureRequest:
    def test_remove_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.delete(reverse("remove-signature-request", args=[999999, law.id]))
        assert resp.status_code == 404

    def test_remove_not_creator_forbidden(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.delete(reverse("remove-signature-request", args=[doc.id, cli.id]))
        assert resp.status_code == 403

    def test_remove_sig_not_found(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("remove-signature-request", args=[doc.id, 999999]))
        assert resp.status_code == 404

    def test_remove_already_signed(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(
            document=doc, signer=cli, signed=True, signed_at=timezone.now(),
        )
        api.force_authenticate(user=law)
        resp = api.delete(reverse("remove-signature-request", args=[doc.id, cli.id]))
        assert resp.status_code == 400

    def test_remove_success(self, api, law, cli):
        doc = _make_sig_doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("remove-signature-request", args=[doc.id, cli.id]))
        assert resp.status_code == 200
        assert not DocumentSignature.objects.filter(document=doc, signer=cli).exists()
