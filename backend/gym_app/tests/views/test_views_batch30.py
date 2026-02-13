"""Batch 30 – 20 tests: user pending/signed/archived, get_user_signature."""
import pytest
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
    return User.objects.create_user(email="law30@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli30@t.com", password="pw", role="client", first_name="C", last_name="E")

def _doc(law, cli, state="PendingSignatures"):
    doc = DynamicDocument.objects.create(title="D30", content="<p>x</p>", state=state, created_by=law, requires_signature=True)
    doc.visibility_permissions.create(user=law, granted_by=law)
    doc.visibility_permissions.create(user=cli, granted_by=law)
    return doc

# -- get_user_pending_documents_full --
class TestGetUserPendingDocsFull:
    def test_pending_docs_success(self, api, law, cli):
        doc = _doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-pending-documents-full", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_pending_docs_user_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-pending-documents-full", args=[999999]))
        assert resp.status_code == 404

    def test_pending_docs_excludes_signed(self, api, law, cli):
        doc = _doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli, signed=True, signed_at=timezone.now())
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-pending-documents-full", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) == 0

    def test_pending_docs_excludes_rejected(self, api, law, cli):
        doc = _doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=cli, rejected=True, rejected_at=timezone.now())
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-pending-documents-full", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) == 0

# -- get_user_signed_documents --
class TestGetUserSignedDocs:
    def test_signed_docs_success(self, api, law, cli):
        doc = _doc(law, cli, state="FullySigned")
        DocumentSignature.objects.create(document=doc, signer=cli, signed=True, signed_at=timezone.now())
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-signed-documents", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_signed_docs_user_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-signed-documents", args=[999999]))
        assert resp.status_code == 404

    def test_signed_docs_empty(self, api, law, cli):
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-signed-documents", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) == 0

# -- get_user_archived_documents --
class TestGetUserArchivedDocs:
    def test_archived_docs_rejected(self, api, law, cli):
        doc = _doc(law, cli, state="Rejected")
        DocumentSignature.objects.create(document=doc, signer=cli, rejected=True)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-archived-documents", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_archived_docs_expired(self, api, law, cli):
        doc = _doc(law, cli, state="Expired")
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-archived-documents", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_archived_docs_user_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-archived-documents", args=[999999]))
        assert resp.status_code == 404

    def test_archived_excludes_pending(self, api, law, cli):
        doc = _doc(law, cli, state="PendingSignatures")
        DocumentSignature.objects.create(document=doc, signer=cli)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-user-archived-documents", args=[cli.id]))
        assert resp.status_code == 200
        assert len(resp.data) == 0

# -- get_user_signature --
class TestGetUserSignature:
    def test_user_has_signature(self, api, law):
        UserSignature.objects.create(user=law, signature_image="sig.png")
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-signature", args=[law.id]))
        assert resp.status_code == 200
        assert resp.data["has_signature"] is True

    def test_user_no_signature(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-signature", args=[law.id]))
        assert resp.status_code == 200
        assert resp.data["has_signature"] is False

    def test_user_signature_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-signature", args=[999999]))
        assert resp.status_code == 404

# -- get_pending_signatures --
class TestGetPendingSignatures:
    def test_pending_sigs_success(self, api, law, cli):
        doc = _doc(law, cli)
        DocumentSignature.objects.create(document=doc, signer=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-pending-signatures"))
        assert resp.status_code == 200

    def test_pending_sigs_unauthenticated(self, api):
        resp = api.get(reverse("get-pending-signatures"))
        assert resp.status_code in (401, 403)

# -- generate_signatures_pdf --
class TestGenerateSignaturesPdf:
    def test_pdf_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("generate-signatures-pdf", args=[999999]))
        assert resp.status_code == 404

    def test_pdf_not_fully_signed(self, api, law, cli):
        doc = _doc(law, cli, state="PendingSignatures")
        doc.visibility_permissions.get_or_create(user=law, defaults={"granted_by": law})
        api.force_authenticate(user=law)
        resp = api.get(reverse("generate-signatures-pdf", args=[doc.id]))
        assert resp.status_code == 400

    def test_pdf_no_signatures(self, api, law):
        doc = DynamicDocument.objects.create(
            title="FS_NoSig", content="<p>x</p>", state="FullySigned",
            created_by=law, requires_signature=True, fully_signed=True,
        )
        doc.visibility_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("generate-signatures-pdf", args=[doc.id]))
        assert resp.status_code == 400

    def test_pdf_no_permission(self, api, law, cli):
        doc = DynamicDocument.objects.create(
            title="FS_NoPerm", content="<p>x</p>", state="FullySigned",
            created_by=law, requires_signature=True, fully_signed=True,
        )
        api.force_authenticate(user=cli)
        resp = api.get(reverse("generate-signatures-pdf", args=[doc.id]))
        assert resp.status_code == 403
