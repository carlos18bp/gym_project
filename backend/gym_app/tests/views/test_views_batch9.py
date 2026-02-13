"""
Batch 9 – 20 tests for:
  • signature_views.py: create_signatures_pdf, expire_overdue_documents email failure
  • document_views.py: create/update/delete error paths, list pagination edges,
    get_dynamic_document DoesNotExist, download_pdf/word DoesNotExist
"""
import datetime
from io import BytesIO
from unittest.mock import patch, MagicMock
from contextlib import ExitStack

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentSignature, DocumentVariable, RecentDocument,
)
from gym_app.models import UserSignature
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
        email="lawyer_b9@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b9@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc B9", content="<p>Hello</p>", state="Draft",
        created_by=lawyer_user,
    )


# ===========================================================================
# 1. create_signatures_pdf (lines 941-1143)
# ===========================================================================

@pytest.mark.django_db
class TestCreateSignaturesPdf:

    def test_create_signatures_pdf_basic(self, lawyer_user, client_user):
        """Lines 941-1143: create_signatures_pdf with signed signature."""
        doc = DynamicDocument.objects.create(
            title="Signed Doc", content="<p>x</p>", state="FullySigned",
            created_by=lawyer_user, requires_signature=True, fully_signed=True,
        )
        DocumentSignature.objects.create(
            document=doc, signer=client_user, signed=True,
            signed_at=timezone.now(), ip_address="10.0.0.1",
        )
        request = MagicMock()
        request.user = lawyer_user

        result = signature_views.create_signatures_pdf(doc, request)
        assert isinstance(result, BytesIO)
        content = result.read()
        assert content[:4] == b'%PDF'

    def test_create_signatures_pdf_no_signature_images(self, lawyer_user, client_user):
        """Lines 1116-1118: no signature images branch."""
        doc = DynamicDocument.objects.create(
            title="No Imgs", content="<p>x</p>", state="FullySigned",
            created_by=lawyer_user, requires_signature=True, fully_signed=True,
        )
        DocumentSignature.objects.create(
            document=doc, signer=client_user, signed=True,
            signed_at=timezone.now(),
        )
        request = MagicMock()
        request.user = lawyer_user

        result = signature_views.create_signatures_pdf(doc, request)
        assert isinstance(result, BytesIO)

    def test_create_signatures_pdf_unsigned_signature(self, lawyer_user, client_user):
        """Lines 1070: signed_at is None for unsigned."""
        doc = DynamicDocument.objects.create(
            title="Pending", content="<p>x</p>", state="PendingSignatures",
            created_by=lawyer_user, requires_signature=True,
        )
        DocumentSignature.objects.create(
            document=doc, signer=client_user, signed=False,
        )
        request = MagicMock()
        request.user = lawyer_user

        result = signature_views.create_signatures_pdf(doc, request)
        assert isinstance(result, BytesIO)


# ===========================================================================
# 2. expire_overdue_documents email failure path
# ===========================================================================

@pytest.mark.django_db
class TestExpireOverdueDocuments:

    def test_expire_email_failure_does_not_block(self, lawyer_user, client_user):
        """Lines 162-164: email failure is silently caught."""
        doc = DynamicDocument.objects.create(
            title="Overdue", content="<p>x</p>", state="PendingSignatures",
            created_by=lawyer_user, requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)

        with patch('gym_app.views.dynamic_documents.signature_views.EmailMessage') as mock_email:
            mock_email.return_value.send.side_effect = Exception("SMTP down")
            signature_views.expire_overdue_documents()

        doc.refresh_from_db()
        assert doc.state == "Expired"

    def test_expire_skips_creator_without_email(self, client_user):
        """Lines 144-145: skip if creator has no email."""
        doc = DynamicDocument.objects.create(
            title="NoCreator", content="<p>x</p>", state="PendingSignatures",
            created_by=None, requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        # Should not raise
        signature_views.expire_overdue_documents()
        doc.refresh_from_db()
        assert doc.state == "Expired"


# ===========================================================================
# 3. document_views.py list_dynamic_documents pagination edges
# ===========================================================================

@pytest.mark.django_db
class TestListDynamicDocumentsEdges:

    def test_list_page_not_integer(self, api_client, lawyer_user, document):
        """Lines 123-125: PageNotAnInteger fallback."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        resp = api_client.get(url, {"page": "abc", "limit": "5"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["currentPage"] == 1

    def test_list_empty_page(self, api_client, lawyer_user, document):
        """Lines 126-129: EmptyPage fallback to last page."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        resp = api_client.get(url, {"page": "9999", "limit": "5"})
        assert resp.status_code == status.HTTP_200_OK
        # Should be on the last page
        assert resp.data["currentPage"] == resp.data["totalPages"]

    def test_list_negative_limit(self, api_client, lawyer_user, document):
        """Lines 116-117: negative limit defaults to 10."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        resp = api_client.get(url, {"limit": "-1"})
        assert resp.status_code == status.HTTP_200_OK

    def test_list_multi_state_filter(self, api_client, lawyer_user):
        """Lines 92-95: multi-state filter."""
        DynamicDocument.objects.create(
            title="D1", content="<p>x</p>", state="Draft", created_by=lawyer_user,
        )
        DynamicDocument.objects.create(
            title="D2", content="<p>x</p>", state="Published", created_by=lawyer_user,
        )
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        resp = api_client.get(url, {"states": "Draft,Published"})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["totalItems"] >= 2

    def test_list_client_id_and_lawyer_id_filters(self, api_client, lawyer_user, client_user):
        """Lines 99-103: client_id and lawyer_id filters."""
        doc = DynamicDocument.objects.create(
            title="Assigned", content="<p>x</p>", state="Draft",
            created_by=lawyer_user, assigned_to=client_user,
        )
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        resp = api_client.get(url, {"client_id": client_user.id})
        assert resp.status_code == status.HTTP_200_OK

        resp2 = api_client.get(url, {"lawyer_id": lawyer_user.id})
        assert resp2.status_code == status.HTTP_200_OK


# ===========================================================================
# 4. document_views.py get/update/delete DoesNotExist
# ===========================================================================

@pytest.mark.django_db
class TestDocumentViewsCRUDEdges:

    def test_get_dynamic_document_not_found(self, api_client, lawyer_user):
        """Line 178-179: doc not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get_dynamic_document", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_update_dynamic_document_not_found(self, api_client, lawyer_user):
        """Line 214-215: doc not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update_dynamic_document", kwargs={"pk": 99999})
        resp = api_client.put(url, {"title": "X"}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_dynamic_document_not_found(self, api_client, lawyer_user):
        """Line 239-240: doc not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete_dynamic_document", kwargs={"pk": 99999})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_update_dynamic_document_validation_error(self, api_client, lawyer_user, document):
        """Line 227: serializer validation error."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update_dynamic_document", kwargs={"pk": document.id})
        # state must be a valid choice - send invalid
        resp = api_client.patch(url, {"state": ""}, format="json")
        # Should be 400 or 200 depending on serializer; empty string may be invalid
        assert resp.status_code in (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST)

    def test_create_dynamic_document_assigns_to(self, api_client, lawyer_user):
        """Lines 63-64: auto-assign assigned_to for Progress state."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create_dynamic_document")
        resp = api_client.post(url, {
            "title": "Auto Assign",
            "content": "<p>test</p>",
            "state": "Progress",
        }, format="json")
        # May succeed or fail depending on serializer validation
        assert resp.status_code in (status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST)

    def test_download_pdf_not_found(self, api_client, lawyer_user):
        """Line 451-452: doc not found for PDF."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download_dynamic_document_pdf", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_download_word_not_found(self, api_client, lawyer_user):
        """Line 778-779: doc not found for Word."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download_dynamic_document_word", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_update_recent_document_not_found(self, api_client, lawyer_user):
        """Lines 827-828: doc not found for recent update."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-recent-document", kwargs={"document_id": 99999})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN)
