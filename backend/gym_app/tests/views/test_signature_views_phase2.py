import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentSignature


User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="sv2-lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
def another_lawyer():
    return User.objects.create_user(
        email="sv2-lawyer2@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="sv2-client@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def document_with_signature(lawyer_user, client_user):
    doc = DynamicDocument.objects.create(
        title="SV2 Doc",
        content="<p>test</p>",
        state="PendingSignatures",
        created_by=lawyer_user,
    )
    sig = DocumentSignature.objects.create(
        document=doc,
        signer=client_user,
        signed=False,
    )
    return doc, sig


# ── Line 565: Lawyer non-creator denied from removing signature request ──

class TestRemoveSignatureRequestPermission:
    def test_lawyer_non_creator_gets_403(
        self, api_client, another_lawyer, document_with_signature
    ):
        """Line 565: A lawyer who is NOT the document creator gets 403
        when trying to remove a signature request."""
        doc, sig = document_with_signature
        api_client.force_authenticate(user=another_lawyer)
        url = reverse(
            "remove-signature-request",
            kwargs={"document_id": doc.id, "user_id": sig.signer.id},
        )
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "creator" in response.data["detail"].lower()
        # Verify signature was NOT deleted
        assert DocumentSignature.objects.filter(id=sig.id).exists()


# ── Line 771: get_letterhead_for_document returns document letterhead ──

class TestGetLetterheadForDocument:
    def test_returns_document_letterhead_when_set(self, lawyer_user):
        """Line 771: When document has letterhead_image, it takes priority."""
        from gym_app.views.dynamic_documents.signature_views import (
            get_letterhead_for_document,
        )

        doc = DynamicDocument.objects.create(
            title="SV2 Letterhead Doc",
            content="<p>test</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        # Set a fake letterhead path (we only test the branch, not the file)
        doc.letterhead_image = "letterheads/fake.png"
        doc.save(update_fields=["letterhead_image"])

        result = get_letterhead_for_document(doc, lawyer_user)

        assert result is not None
        assert result == doc.letterhead_image
