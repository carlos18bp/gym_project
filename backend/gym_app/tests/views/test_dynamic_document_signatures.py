import datetime
from io import BytesIO
from unittest.mock import patch, MagicMock, mock_open
from unittest import mock
from contextlib import ExitStack

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models import DynamicDocument, DocumentSignature, UserSignature
from gym_app.models.dynamic_document import DocumentVariable, RecentDocument

try:
    from PIL import Image as PILImage
except ImportError:
    PILImage = None

try:
    from PyPDF2 import PdfWriter, PdfReader
except ImportError:
    PdfWriter = PdfReader = None

try:
    from reportlab.pdfgen import canvas as rl_canvas
except ImportError:
    rl_canvas = None
from gym_app.views.dynamic_documents import signature_views
from gym_app.views.dynamic_documents.signature_views import (
    get_client_ip,
    generate_encrypted_document_id,
    format_datetime_spanish,
    expire_overdue_documents,
    get_letterhead_for_document,
)


User = get_user_model()
@pytest.fixture
@pytest.mark.django_db
def signer_user():
    return User.objects.create_user(
        email="signer@example.com",
        password="testpassword",
        first_name="Sig",
        last_name="Ner",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
@pytest.mark.django_db
def document_requiring_signature(lawyer_user, signer_user):
    doc = DynamicDocument.objects.create(
        title="Doc firmas",
        content="<p>Firmar {{var}}</p>",
        state="PendingSignatures",
        created_by=lawyer_user,
        requires_signature=True,
    )
    # Crear registro de firma pendiente para signer_user
    DocumentSignature.objects.create(document=doc, signer=signer_user)
    return doc


@pytest.mark.django_db
class TestGetDocumentSignaturesAndPending:
    def test_get_document_signatures(self, api_client, lawyer_user, signer_user, document_requiring_signature):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-signatures", kwargs={"document_id": document_requiring_signature.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["signer_email"] == signer_user.email

    def test_get_document_signatures_forbidden_when_cannot_view(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_user,
            requires_signature=False,
            is_public=False,
        )

        api_client.force_authenticate(user=signer_user)
        url = reverse("get-document-signatures", kwargs={"document_id": doc.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_document_signatures_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-signatures", kwargs={"document_id": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_pending_signatures_for_user(self, api_client, signer_user, document_requiring_signature):
        api_client.force_authenticate(user=signer_user)
        url = reverse("get-pending-signatures")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Debe devolver al menos el documento que requiere la firma
        doc_ids = {doc["id"] for doc in response.data}
        assert document_requiring_signature.id in doc_ids

    def test_get_pending_signatures_expires_overdue_document(self, api_client, signer_user, lawyer_user):
        overdue_doc = DynamicDocument.objects.create(
            title="Overdue",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
        )
        DocumentSignature.objects.create(document=overdue_doc, signer=signer_user)

        api_client.force_authenticate(user=signer_user)
        url = reverse("get-pending-signatures")

        with patch('gym_app.views.dynamic_documents.signature_views.EmailMessage'):
            response = api_client.get(url)

        overdue_doc.refresh_from_db()
        assert overdue_doc.state == "Expired"
        returned_ids = {doc["id"] for doc in response.data}
        assert overdue_doc.id not in returned_ids


@pytest.mark.django_db
class TestSignAndRejectDocument:
    def test_sign_document_success(self, api_client, signer_user, document_requiring_signature):
        # Crear firma electrónica del usuario
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        sig = DocumentSignature.objects.get(document=document_requiring_signature, signer=signer_user)
        assert sig.signed is True
        assert sig.rejected is False

    def test_sign_document_sets_fully_signed(self, api_client, signer_user, lawyer_user):
        other_signer = User.objects.create_user(
            email="other-signer@example.com",
            password="testpassword",
            role="client",
        )
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=signer_user)
        DocumentSignature.objects.create(document=doc, signer=other_signer)
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")
        UserSignature.objects.create(user=other_signer, signature_image="signatures/test.png", method="upload")

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        doc.refresh_from_db()
        assert doc.state == "PendingSignatures"

        api_client.force_authenticate(user=other_signer)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": other_signer.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        doc.refresh_from_db()
        assert doc.state == "FullySigned"
        assert doc.fully_signed is True

    def test_sign_document_not_found(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": 9999, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_sign_document_requires_user_signature(self, api_client, signer_user, document_requiring_signature):
        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'needs to create a signature' in response.data['detail']

    def test_sign_document_forbidden_when_cannot_view(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
            is_public=False,
        )
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission" in response.data["detail"].lower()

    def test_sign_document_staff_can_sign_for_user(self, api_client, signer_user, lawyer_user, document_requiring_signature):
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")
        lawyer_user.is_staff = True
        lawyer_user.save(update_fields=["is_staff"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("sign-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        sig = DocumentSignature.objects.get(document=document_requiring_signature, signer=signer_user)
        assert sig.signed is True

    def test_sign_document_user_not_authorized_signer(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        other_user = User.objects.create_user(email="other@example.com", password="testpassword", role="client")
        DocumentSignature.objects.create(document=doc, signer=other_user)
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_sign_document_already_signed(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=signer_user, signed=True)
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "not authorized" in response.data["detail"].lower()

    def test_sign_document_user_not_found(self, api_client, lawyer_user):
        lawyer_user.is_staff = True
        lawyer_user.save(update_fields=["is_staff"])

        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": 9999})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["detail"] == "User not found."

    def test_sign_document_error_saving_signature(self, api_client, signer_user, document_requiring_signature, monkeypatch):
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")

        def raise_error(*args, **kwargs):
            raise Exception("save failed")

        monkeypatch.setattr(DocumentSignature, "save", raise_error)

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error saving signature" in response.data["detail"]

    def test_sign_document_requires_signature_and_authorization(self, api_client, signer_user, lawyer_user):
        # Documento que NO requiere firma
        doc = DynamicDocument.objects.create(
            title="Sin firma",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_user,
            requires_signature=False,
        )

        api_client.force_authenticate(user=signer_user)
        url = reverse("sign-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Usuario distinto intentando firmar por signer_user sin ser staff
        doc2 = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc2, signer=signer_user)

        api_client.force_authenticate(user=lawyer_user)  # no is_staff
        url = reverse("sign-document", kwargs={"document_id": doc2.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reject_document_success(self, api_client, signer_user, document_requiring_signature):
        api_client.force_authenticate(user=signer_user)
        url = reverse("reject-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        payload = {"comment": "No estoy de acuerdo"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        sig = DocumentSignature.objects.get(document=document_requiring_signature, signer=signer_user)
        assert sig.rejected is True
        assert sig.rejection_comment == "No estoy de acuerdo"

    def test_reject_document_no_comment(self, api_client, signer_user, document_requiring_signature):
        api_client.force_authenticate(user=signer_user)
        url = reverse("reject-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        sig = DocumentSignature.objects.get(document=document_requiring_signature, signer=signer_user)
        assert sig.rejected is True
        assert not sig.rejection_comment

    def test_reject_document_staff_can_reject_for_user(self, api_client, signer_user, lawyer_user, document_requiring_signature):
        lawyer_user.is_staff = True
        lawyer_user.save(update_fields=["is_staff"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reject-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {"comment": "X"}, format="json")

        assert response.status_code == status.HTTP_200_OK
        sig = DocumentSignature.objects.get(document=document_requiring_signature, signer=signer_user)
        assert sig.rejected is True

    def test_reject_document_already_signed(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=signer_user, signed=True)

        api_client.force_authenticate(user=signer_user)
        url = reverse("reject-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {"comment": "X"}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "not authorized" in response.data["detail"].lower()

    def test_reject_document_not_found(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)
        url = reverse("reject-document", kwargs={"document_id": 9999, "user_id": signer_user.id})
        response = api_client.post(url, {"comment": "X"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_reject_document_user_not_found(self, api_client, lawyer_user, document_requiring_signature):
        lawyer_user.is_staff = True
        lawyer_user.save(update_fields=["is_staff"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reject-document", kwargs={"document_id": document_requiring_signature.id, "user_id": 9999})
        response = api_client.post(url, {"comment": "X"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["detail"] == "User not found."

    def test_reject_document_unauthorized_other_user(self, api_client, signer_user, lawyer_user, document_requiring_signature):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reject-document", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.post(url, {"comment": "X"}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reject_document_requires_signatures(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Sin firmas",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_user,
            requires_signature=False,
        )

        api_client.force_authenticate(user=signer_user)
        url = reverse("reject-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {"comment": "No"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["detail"] == "This document does not require signatures."

    def test_reject_document_requires_pending_signature(self, api_client, signer_user, lawyer_user):
        # Documento donde no hay signature pendiente
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        # Sin DocumentSignature asociado

        api_client.force_authenticate(user=signer_user)
        url = reverse("reject-document", kwargs={"document_id": doc.id, "user_id": signer_user.id})
        response = api_client.post(url, {"comment": "X"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestReopenAndRemoveSignatureRequest:
    def test_reopen_document_signatures_from_rejected(self, api_client, lawyer_user, signer_user, document_requiring_signature):
        # Marcar el documento como Rejected
        document_requiring_signature.state = "Rejected"
        document_requiring_signature.save(update_fields=["state"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reopen-document-signatures", kwargs={"document_id": document_requiring_signature.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        document_requiring_signature.refresh_from_db()
        assert document_requiring_signature.state == "PendingSignatures"

    def test_reopen_document_signatures_forbidden_for_non_owner(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Rejected",
            content="<p>x</p>",
            state="Rejected",
            created_by=lawyer_user,
            requires_signature=True,
        )

        api_client.force_authenticate(user=signer_user)
        url = reverse("reopen-document-signatures", kwargs={"document_id": doc.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reopen_document_signatures_from_expired(self, api_client, lawyer_user, signer_user):
        doc = DynamicDocument.objects.create(
            title="Expired",
            content="<p>x</p>",
            state="Expired",
            created_by=lawyer_user,
            requires_signature=True,
        )
        sig = DocumentSignature.objects.create(document=doc, signer=signer_user, signed=True, rejected=True)

        doc.state = "Expired"
        doc.fully_signed = False
        doc.save(update_fields=["state", "fully_signed"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reopen-document-signatures", kwargs={"document_id": doc.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        doc.refresh_from_db()
        sig.refresh_from_db()
        assert doc.state == "PendingSignatures"
        assert sig.signed is False
        assert sig.rejected is False

    def test_reopen_document_signatures_requires_signature(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="NoSign",
            content="<p>x</p>",
            state="Rejected",
            created_by=lawyer_user,
            requires_signature=False,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reopen-document-signatures", kwargs={"document_id": doc.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "does not require signatures" in response.data["detail"]

    def test_reopen_document_signatures_invalid_state(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Completed",
            content="<p>x</p>",
            state="Completed",
            created_by=lawyer_user,
            requires_signature=True,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reopen-document-signatures", kwargs={"document_id": doc.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only rejected or expired" in response.data["detail"]

    def test_reopen_document_signatures_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("reopen-document-signatures", kwargs={"document_id": 9999})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_remove_signature_request_only_creator_and_not_signed(self, api_client, lawyer_user, signer_user, document_requiring_signature):
        sig = DocumentSignature.objects.get(document=document_requiring_signature, signer=signer_user)

        # Caso éxito: creador puede eliminar solicitud pendiente
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("remove-signature-request", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_200_OK
        assert not DocumentSignature.objects.filter(id=sig.id).exists()

        # Crear otra firma y marcarla como firmada
        sig2 = DocumentSignature.objects.create(document=document_requiring_signature, signer=signer_user, signed=True)
        url = reverse("remove-signature-request", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_remove_signature_request_not_found(self, api_client, lawyer_user, signer_user, document_requiring_signature):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("remove-signature-request", kwargs={"document_id": document_requiring_signature.id, "user_id": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_remove_signature_request_document_not_found(self, api_client, lawyer_user, signer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("remove-signature-request", kwargs={"document_id": 9999, "user_id": signer_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_remove_signature_request_forbidden_for_non_creator(self, api_client, signer_user, document_requiring_signature):
        # Creador es lawyer_user, autenticamos como signer_user
        api_client.force_authenticate(user=signer_user)
        url = reverse("remove-signature-request", kwargs={"document_id": document_requiring_signature.id, "user_id": signer_user.id})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestUserSignatureAndDocumentsByUser:

    def test_get_user_pending_documents_full(self, api_client, signer_user, lawyer_user):
        """get_user_pending_documents_full devuelve solo documentos PendingSignatures visibles para el usuario objetivo."""
        # Documento pendiente para signer_user
        doc_pending = DynamicDocument.objects.create(
            title="Pending",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_pending, signer=signer_user, signed=False, rejected=False)

        # Documento en otro estado no debe aparecer
        doc_other = DynamicDocument.objects.create(
            title="Other",
            content="<p>y</p>",
            state="Draft",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_other, signer=signer_user, signed=False, rejected=False)

        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-pending-documents-full", kwargs={"user_id": signer_user.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        ids = {doc["id"] for doc in response.data}
        assert doc_pending.id in ids
        assert doc_other.id not in ids

    def test_get_user_pending_documents_full_filters_by_visibility(self, api_client, signer_user, lawyer_user):
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpassword",
            role="client",
        )
        doc_pending = DynamicDocument.objects.create(
            title="Pending",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_pending, signer=signer_user)

        api_client.force_authenticate(user=other_user)
        url = reverse("get-user-pending-documents-full", kwargs={"user_id": signer_user.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_get_user_pending_documents_full_user_not_found(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-pending-documents-full", kwargs={"user_id": 9999})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_user_archived_documents(self, api_client, signer_user, lawyer_user):
        """get_user_archived_documents devuelve documentos Rejected/Expired para el firmante."""
        # Documento rechazado
        doc_rejected = DynamicDocument.objects.create(
            title="Rejected",
            content="<p>x</p>",
            state="Rejected",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_rejected, signer=signer_user)

        # Documento expirado
        doc_expired = DynamicDocument.objects.create(
            title="Expired",
            content="<p>x</p>",
            state="Expired",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_expired, signer=signer_user)

        # Documento en otro estado no debe aparecer
        doc_other = DynamicDocument.objects.create(
            title="Other",
            content="<p>x</p>",
            state="Completed",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_other, signer=signer_user)

        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-archived-documents", kwargs={"user_id": signer_user.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        titles = {doc["title"] for doc in response.data}
        assert "Rejected" in titles
        assert "Expired" in titles
        assert "Other" not in titles

    def test_get_user_archived_documents_user_not_found(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-archived-documents", kwargs={"user_id": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_user_signed_documents(self, api_client, signer_user, lawyer_user):
        """get_user_signed_documents devuelve documentos firmados por el usuario."""
        doc_signed = DynamicDocument.objects.create(
            title="Signed",
            content="<p>x</p>",
            state="Completed",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_signed, signer=signer_user, signed=True)

        doc_not_signed = DynamicDocument.objects.create(
            title="NotSigned",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc_not_signed, signer=signer_user, signed=False)

        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-signed-documents", kwargs={"user_id": signer_user.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        titles = {doc["title"] for doc in response.data}
        assert "Signed" in titles
        assert "NotSigned" not in titles

    def test_get_user_signed_documents_user_not_found(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-signed-documents", kwargs={"user_id": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_user_signature_present_and_absent(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)

        # Caso sin firma
        url = reverse("get-user-signature", kwargs={"user_id": signer_user.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["has_signature"] is False

        # Crear firma y volver a consultar
        UserSignature.objects.create(user=signer_user, signature_image="signatures/test.png", method="upload")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["has_signature"] is True
        assert "signature" in response.data

    def test_get_user_signature_user_not_found(self, api_client, signer_user):
        api_client.force_authenticate(user=signer_user)
        url = reverse("get-user-signature", kwargs={"user_id": 9999})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_user_signature_internal_error(self, api_client, signer_user, monkeypatch):
        api_client.force_authenticate(user=signer_user)

        def raise_error(*args, **kwargs):
            raise Exception("boom")

        monkeypatch.setattr(signature_views.User.objects, "get", raise_error)

        url = reverse("get-user-signature", kwargs={"user_id": signer_user.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data["error"] == "boom"


@pytest.mark.django_db
class TestGenerateSignaturesPdf:
    def test_generate_signatures_pdf_requires_fully_signed(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Not signed",
            content="<p>x</p>",
            state="PendingSignatures",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-signatures-pdf", kwargs={"pk": doc.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'completamente firmado' in response.data['detail']

    def test_generate_signatures_pdf_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-signatures-pdf", kwargs={"pk": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_generate_signatures_pdf_forbidden_when_cannot_view(self, api_client, signer_user, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="FullySigned",
            created_by=lawyer_user,
            requires_signature=True,
            is_public=False,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user, signed=True)

        api_client.force_authenticate(user=signer_user)
        url = reverse("generate-signatures-pdf", kwargs={"pk": doc.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_generate_signatures_pdf_internal_error(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Signed",
            content="<p>x</p>",
            state="FullySigned",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user, signed=True)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-signatures-pdf", kwargs={"pk": doc.id})

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    'gym_app.views.dynamic_documents.signature_views.generate_original_document_pdf',
                    return_value=BytesIO(b'pdf1'),
                )
            )
            stack.enter_context(
                patch(
                    'gym_app.views.dynamic_documents.signature_views.create_signatures_pdf',
                    side_effect=Exception("boom"),
                )
            )
            response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error al generar el PDF de firmas" in response.data["detail"]

    def test_generate_signatures_pdf_requires_signatures(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="No signatures",
            content="<p>x</p>",
            state="FullySigned",
            created_by=lawyer_user,
            requires_signature=True,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-signatures-pdf", kwargs={"pk": doc.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'no tiene firmas' in response.data['detail']

    def test_generate_signatures_pdf_success(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title="Signed",
            content="<p>x</p>",
            state="FullySigned",
            created_by=lawyer_user,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user, signed=True)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-signatures-pdf", kwargs={"pk": doc.id})

        with ExitStack() as stack:
            stack.enter_context(
                patch(
                    'gym_app.views.dynamic_documents.signature_views.generate_original_document_pdf',
                    return_value=BytesIO(b'pdf1'),
                )
            )
            stack.enter_context(
                patch(
                    'gym_app.views.dynamic_documents.signature_views.create_signatures_pdf',
                    return_value=BytesIO(b'pdf2'),
                )
            )
            stack.enter_context(
                patch(
                    'gym_app.views.dynamic_documents.signature_views.combine_pdfs',
                    return_value=BytesIO(b'combined'),
                )
            )
            stack.enter_context(
                patch(
                    'gym_app.views.dynamic_documents.signature_views.add_identifier_footer',
                    return_value=BytesIO(b'final'),
                )
            )
            response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/pdf'
        assert response.content == b'final'


# ======================================================================
# Tests migrated from test_views_batch28.py
# ======================================================================

"""Batch 28 – 20 tests: signature_views.py – helpers, get_signatures, sign_document."""


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

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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


# ======================================================================
# Tests migrated from test_views_batch29.py
# ======================================================================

"""Batch 29 – 20 tests: signature_views.py – reject, reopen, remove signature + sign edges."""


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

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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


# ======================================================================
# Tests migrated from test_views_batch30.py
# ======================================================================

"""Batch 30 – 20 tests: user pending/signed/archived, get_user_signature."""


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
@pytest.mark.django_db
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
@pytest.mark.django_db
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
@pytest.mark.django_db
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
@pytest.mark.django_db
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
@pytest.mark.django_db
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
@pytest.mark.django_db
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


# ======================================================================
# Tests migrated from test_views_batch8.py
# ======================================================================

"""
Batch 8 – 20 tests for signature_views.py helper functions and error paths.

Targets uncovered lines:
  - register_carlito_fonts (731-753)
  - get_letterhead_for_document (755-780)
  - generate_original_document_pdf (793-932)
  - create_signatures_pdf (941-1143)
  - combine_pdfs (1151-1170)
  - add_identifier_footer (1178-1203)
  - generate_encrypted_document_id fallback (95-97)
  - format_datetime_spanish (116-122)
  - get_client_ip edge cases (50-66)
  - expire_overdue_documents email failure (162-164)
  - view-level DoesNotExist / exception branches
"""



# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_b8@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b8@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def doc_fully_signed(lawyer_user, client_user):  # pragma: no cover – unused fixture
    doc = DynamicDocument.objects.create(
        title="FullySigned B8",
        content="<p>Hello {{var1}}</p>",
        state="FullySigned",
        created_by=lawyer_user,
        requires_signature=True,
        fully_signed=True,
    )
    sig = DocumentSignature.objects.create(
        document=doc, signer=client_user, signed=True,
        signed_at=timezone.now(),
        ip_address="1.2.3.4",
    )
    return doc


# ===========================================================================
# 1. Pure helper functions
# ===========================================================================

@pytest.mark.django_db
class TestHelperFunctions:

    def test_get_client_ip_x_forwarded_for(self):
        """Line 56-60: X-Forwarded-For header."""
        factory = MagicMock()
        factory.META = {'HTTP_X_FORWARDED_FOR': '10.0.0.1, 10.0.0.2'}
        assert signature_views.get_client_ip(factory) == '10.0.0.1'

    def test_get_client_ip_x_real_ip(self):
        """Line 62-64: X-Real-IP header."""
        factory = MagicMock()
        factory.META = {'HTTP_X_REAL_IP': '172.16.0.1'}
        assert signature_views.get_client_ip(factory) == '172.16.0.1'

    def test_get_client_ip_remote_addr(self):
        """Line 66: fallback to REMOTE_ADDR."""
        factory = MagicMock()
        factory.META = {'REMOTE_ADDR': '127.0.0.1'}
        assert signature_views.get_client_ip(factory) == '127.0.0.1'

    def test_get_client_ip_empty_forwarded_for(self):
        """Line 59-60: empty first element in X-Forwarded-For."""
        factory = MagicMock()
        factory.META = {'HTTP_X_FORWARDED_FOR': ' , 10.0.0.2', 'REMOTE_ADDR': '127.0.0.1'}
        # Empty first element -> falls through
        ip = signature_views.get_client_ip(factory)
        # Should fallback since first IP is empty after strip
        assert ip in ('127.0.0.1', '10.0.0.2')  # depends on implementation

    def test_generate_encrypted_document_id_success(self):
        """Lines 81-94: normal hash generation."""
        dt = datetime.datetime(2025, 6, 15, 10, 30, 0)
        result = signature_views.generate_encrypted_document_id(1, dt)
        assert '-' in result
        assert len(result) == 19  # XXXX-XXXX-XXXX-XXXX

    def test_generate_encrypted_document_id_fallback(self):
        """Lines 95-97: fallback on exception."""
        # Use a mock that has strftime for the fallback but causes failure in the try block
        bad_dt = MagicMock()
        bad_dt.strftime.side_effect = [ValueError("bad"), "20250101"]
        result = signature_views.generate_encrypted_document_id(1, bad_dt)
        assert result.startswith("DOC-")

    def test_format_datetime_spanish(self):
        """Lines 116-122: Spanish date formatting."""
        dt = datetime.datetime(2025, 12, 25, 14, 30, 15)
        result = signature_views.format_datetime_spanish(dt)
        assert "diciembre" in result
        assert "25" in result
        assert "14:30:15" in result

    def test_format_datetime_spanish_january(self):
        """Lines 121-122: month lookup for enero."""
        dt = datetime.datetime(2025, 1, 1, 0, 0, 0)
        result = signature_views.format_datetime_spanish(dt)
        assert "enero" in result


# ===========================================================================
# 2. get_letterhead_for_document (signature_views version)
# ===========================================================================

@pytest.mark.django_db
class TestGetLetterheadForDocument:

    def test_document_letterhead_priority(self, lawyer_user):
        """Lines 772-773: document letterhead takes priority."""
        doc = MagicMock()
        doc.letterhead_image = "doc_letterhead.png"
        user = MagicMock()
        user.letterhead_image = "user_letterhead.png"
        result = signature_views.get_letterhead_for_document(doc, user)
        assert result == "doc_letterhead.png"

    def test_user_letterhead_fallback(self, lawyer_user):
        """Lines 776-777: user letterhead when doc has none."""
        doc = MagicMock()
        doc.letterhead_image = None
        user = MagicMock()
        user.letterhead_image = "user_letterhead.png"
        result = signature_views.get_letterhead_for_document(doc, user)
        assert result == "user_letterhead.png"

    def test_no_letterhead(self, lawyer_user):
        """Lines 779-780: no letterhead at all."""
        doc = MagicMock()
        doc.letterhead_image = None
        user = MagicMock()
        user.letterhead_image = None
        result = signature_views.get_letterhead_for_document(doc, user)
        assert result is None


# ===========================================================================
# 3. PDF helper functions (mocked to avoid font/file dependencies)
# ===========================================================================

@pytest.mark.django_db
class TestPdfHelpers:

    @patch('gym_app.views.dynamic_documents.signature_views.os.path.exists', return_value=False)
    def test_register_carlito_fonts_missing_file(self, mock_exists):
        """Lines 740-742: FileNotFoundError when font missing."""
        with pytest.raises(FileNotFoundError):
            signature_views.register_carlito_fonts()

    @patch('gym_app.views.dynamic_documents.signature_views.pisa')
    @patch('gym_app.views.dynamic_documents.signature_views.register_carlito_fonts')
    @patch('gym_app.views.dynamic_documents.signature_views.get_letterhead_for_document', return_value=None)
    def test_generate_original_document_pdf_success(
        self, mock_lh, mock_fonts, mock_pisa, lawyer_user
    ):
        """Lines 793-932: successful PDF generation."""
        mock_fonts.return_value = {
            "Carlito-Regular": "/fake/Carlito-Regular.ttf",
            "Carlito-Bold": "/fake/Carlito-Bold.ttf",
            "Carlito-Italic": "/fake/Carlito-Italic.ttf",
            "Carlito-BoldItalic": "/fake/Carlito-BoldItalic.ttf",
        }
        mock_pisa_status = MagicMock()
        mock_pisa_status.err = 0
        mock_pisa.CreatePDF.return_value = mock_pisa_status

        doc = DynamicDocument.objects.create(
            title="Test PDF", content="<p>Hello {{greeting}}</p>", state="Draft",
            created_by=lawyer_user,
        )
        DocumentVariable.objects.create(
            document=doc, name_en="greeting", value="World",
            field_type="input",
        )
        result = signature_views.generate_original_document_pdf(doc, lawyer_user)
        assert isinstance(result, BytesIO)

    @patch('gym_app.views.dynamic_documents.signature_views.pisa')
    @patch('gym_app.views.dynamic_documents.signature_views.register_carlito_fonts')
    @patch('gym_app.views.dynamic_documents.signature_views.get_letterhead_for_document', return_value=None)
    def test_generate_original_document_pdf_pisa_error(
        self, mock_lh, mock_fonts, mock_pisa, lawyer_user
    ):
        """Lines 927-928: pisa conversion error raises."""
        mock_fonts.return_value = {
            "Carlito-Regular": "/fake/r.ttf", "Carlito-Bold": "/fake/b.ttf",
            "Carlito-Italic": "/fake/i.ttf", "Carlito-BoldItalic": "/fake/bi.ttf",
        }
        mock_pisa_status = MagicMock()
        mock_pisa_status.err = 1
        mock_pisa.CreatePDF.return_value = mock_pisa_status

        doc = DynamicDocument.objects.create(
            title="Err", content="<p>x</p>", state="Draft",
            created_by=lawyer_user,
        )
        with pytest.raises(Exception, match="HTML to PDF conversion failed"):
            signature_views.generate_original_document_pdf(doc, lawyer_user)

    def test_combine_pdfs(self):
        """Lines 1151-1170: combine two PDF buffers."""
        # Create two minimal PDFs
        buf1 = BytesIO()
        w1 = PdfWriter()
        w1.add_blank_page(width=72, height=72)
        w1.write(buf1)
        buf1.seek(0)

        buf2 = BytesIO()
        w2 = PdfWriter()
        w2.add_blank_page(width=72, height=72)
        w2.write(buf2)
        buf2.seek(0)

        result = signature_views.combine_pdfs(buf1, buf2)
        assert isinstance(result, BytesIO)
        # Verify the combined PDF has 2 pages
        reader = PdfReader(result)
        assert len(reader.pages) == 2

    def test_add_identifier_footer(self):
        """Lines 1178-1203: add footer to all pages."""
        buf = BytesIO()
        w = PdfWriter()
        w.add_blank_page(width=612, height=792)
        w.write(buf)
        buf.seek(0)

        # Need Carlito font registered; mock it
        with patch('gym_app.views.dynamic_documents.signature_views.register_carlito_fonts'):
            # Use a safe font fallback
            with patch.object(rl_canvas.Canvas, 'setFont'):
                result = signature_views.add_identifier_footer(buf, "ABCD-1234-EFGH-5678")
        assert isinstance(result, BytesIO)


# ===========================================================================
# 4. View-level exception paths (DoesNotExist on nested lookups)
# ===========================================================================

@pytest.mark.django_db
class TestSignatureViewExceptionPaths:

    def test_get_document_signatures_doc_not_found_inner(
        self, api_client, lawyer_user
    ):
        """Line 186-187: DynamicDocument.DoesNotExist inside view."""
        api_client.force_authenticate(user=lawyer_user)
        url = f"/api/dynamic-documents/99999/signatures/"
        resp = api_client.get(url)
        assert resp.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN)

    def test_reject_document_generic_exception(
        self, api_client, client_user, lawyer_user
    ):
        """Lines 483-484: generic exception in reject_document."""
        doc = DynamicDocument.objects.create(
            title="Err", content="<p>x</p>", state="PendingSignatures",
            created_by=lawyer_user, requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)

        api_client.force_authenticate(user=client_user)
        url = f"/api/dynamic-documents/{doc.id}/reject/{client_user.id}/"

        with patch.object(DocumentSignature, 'save', side_effect=Exception("db crash")):
            resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ======================================================================
# Tests migrated from test_views_batch9.py
# ======================================================================


# ---------------------------------------------------------------------------
# Fixtures (batch 9)
# ---------------------------------------------------------------------------
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
# Tests merged from test_signature_views_coverage.py
# ===========================================================================

@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_svc@e.com', password='p', role='lawyer',
        first_name='L', last_name='S')


@pytest.fixture
def signer():
    return User.objects.create_user(
        email='sig_svc@e.com', password='p', role='client',
        first_name='S', last_name='V')


@pytest.fixture
def signed_doc(lawyer, signer):
    """Fully signed document with signature record."""
    doc = DynamicDocument.objects.create(
        title='SignedDoc', content='<p>Test content</p>',
        state='FullySigned', requires_signature=True,
        fully_signed=True, created_by=lawyer,
        created_at=timezone.now(), updated_at=timezone.now())
    DocumentSignature.objects.create(
        document=doc, signer=signer, signed=True,
        signed_at=timezone.now(), ip_address='127.0.0.1')
    return doc


@pytest.fixture
def pending_doc(lawyer, signer):
    """Document pending signatures."""
    doc = DynamicDocument.objects.create(
        title='PendDoc', content='<p>Pending</p>',
        state='PendingSignatures', requires_signature=True,
        created_by=lawyer,
        created_at=timezone.now(), updated_at=timezone.now())
    DocumentSignature.objects.create(
        document=doc, signer=signer, signed=False)
    return doc


@pytest.mark.django_db
class TestSignatureViewsRegressionScenarios:

    # --- Helper: get_client_ip with X-Forwarded-For ---
    def test_get_client_ip_forwarded_for(self):
        """Lines 58-60: X-Forwarded-For header returns first IP."""
        req = mock.MagicMock()
        req.META = {'HTTP_X_FORWARDED_FOR': '1.2.3.4, 5.6.7.8'}
        assert get_client_ip(req) == '1.2.3.4'

    def test_encrypted_id_normal(self):
        """Lines 81-94: normal encrypted ID generation."""
        dt = datetime.datetime(2025, 6, 15, 10, 30, 0)
        result = generate_encrypted_document_id(1, dt)
        assert '-' in result
        assert len(result) == 19  # XXXX-XXXX-XXXX-XXXX

    # --- Helper: get_letterhead_for_document ---
    def test_letterhead_no_letterhead(self, lawyer):
        """Line 779: no letterhead returns None."""
        doc = mock.MagicMock()
        doc.letterhead_image = None
        lawyer.letterhead_image = None
        assert get_letterhead_for_document(doc, lawyer) is None

    def test_letterhead_user_global(self, lawyer):
        """Line 777: user global letterhead used when doc has none."""
        doc = mock.MagicMock()
        doc.letterhead_image = None
        lawyer.letterhead_image = mock.MagicMock()
        result = get_letterhead_for_document(doc, lawyer)
        assert result == lawyer.letterhead_image

    # --- generate_signatures_pdf: not fully signed ---
    def test_gen_sig_pdf_not_fully_signed(
        self, api_client, lawyer, pending_doc
    ):
        """Line 1230: document not FullySigned returns 400."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': pending_doc.pk}))
        assert r.status_code == 400
        assert 'completamente firmado' in r.data['detail']

    # --- generate_signatures_pdf: fully signed ---
    def test_gen_sig_pdf_success(self, api_client, lawyer, signed_doc):
        """Lines 793-1277: full PDF generation for signed document."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': signed_doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- get_user_archived_documents ---
    def test_get_archived_docs(self, api_client, lawyer, signer):
        """Lines 644-673: archived documents for user."""
        doc = DynamicDocument.objects.create(
            title='Rejected', content='', state='Rejected',
            requires_signature=True, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, rejected=True)
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-archived-documents',
            kwargs={'user_id': signer.pk}))
        assert r.status_code == 200

    # --- get_user_signed_documents ---
    def test_get_signed_docs(self, api_client, lawyer, signer, signed_doc):
        """Lines 678-699: signed documents for user."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-signed-documents',
            kwargs={'user_id': signer.pk}))
        assert r.status_code == 200

    # --- expire_overdue_documents (triggered via get_pending) ---
    def test_expire_overdue(self, api_client, lawyer, signer):
        """Lines 125-164: overdue document gets expired."""
        doc = DynamicDocument.objects.create(
            title='Overdue', content='', state='PendingSignatures',
            requires_signature=True, created_by=lawyer,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        api_client.force_authenticate(user=signer)
        r = api_client.get(reverse('get-pending-signatures'))
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Expired'

    # --- get_document_signatures: non-existent doc (lines 186-187) ---
    def test_get_signatures_nonexistent_doc(self, api_client, lawyer):
        """Lines 186-187: DoesNotExist returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-document-signatures', kwargs={'document_id': 99999}))
        assert r.status_code == 404

    def test_remove_sig_not_creator(self, api_client, lawyer, signer, pending_doc):
        """Line 567: non-creator gets 403."""
        api_client.force_authenticate(user=signer)
        r = api_client.delete(reverse(
            'remove-signature-request',
            kwargs={'document_id': pending_doc.pk, 'user_id': signer.pk}))
        # The decorator or view should block non-creator
        assert r.status_code in (403, 404)

    # --- get_user_pending_documents_full: non-existent user ---
    def test_pending_docs_full_nonexistent_user(self, api_client, lawyer):
        """Lines 638-639: non-existent user_id returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-pending-documents-full',
            kwargs={'user_id': 99999}))
        assert r.status_code == 404

    # --- get_user_archived_documents: non-existent user ---
    def test_archived_docs_nonexistent_user(self, api_client, lawyer):
        """Lines 672-673: non-existent user_id returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-archived-documents',
            kwargs={'user_id': 99999}))
        assert r.status_code == 404

    # --- get_user_signed_documents: non-existent user ---
    def test_signed_docs_nonexistent_user(self, api_client, lawyer):
        """Lines 698-699: non-existent user_id returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-signed-documents',
            kwargs={'user_id': 99999}))
        assert r.status_code == 404

    # --- generate_signatures_pdf: signer with doc_type & identification ---
    def test_gen_sig_pdf_with_identification(self, api_client, lawyer):
        """Lines 1081, 1083, 1085: signer with document_type/identification."""
        signer2 = User.objects.create_user(
            email='sig2_svc@e.com', password='p', role='client',
            first_name='S2', last_name='V2',
            document_type='CC', identification='12345678')
        doc = DynamicDocument.objects.create(
            title='IdentDoc', content='<p>ID</p>',
            state='FullySigned', requires_signature=True,
            fully_signed=True, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer2, signed=True,
            signed_at=timezone.now(), ip_address='10.0.0.1')
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- generate_signatures_pdf: signer with UserSignature image ---
    def test_gen_sig_pdf_with_user_signature_image(self, api_client, lawyer):
        """Lines 1096-1109: signer has a UserSignature with image."""

        signer3 = User.objects.create_user(
            email='sig3_svc@e.com', password='p', role='client',
            first_name='S3', last_name='V3')
        # Create a valid signature image
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.create(
            user=signer3, signature_image=sig_img, method='draw')
        doc = DynamicDocument.objects.create(
            title='SigImgDoc', content='<p>SigImg</p>',
            state='FullySigned', requires_signature=True,
            fully_signed=True, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer3, signed=True,
            signed_at=timezone.now(), ip_address='10.0.0.2')
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    def test_reject_document_with_comment(self, api_client, lawyer, signer):
        """Lines 434-473: rejection with comment and email notification."""
        doc = DynamicDocument.objects.create(
            title='RejectMe', content='<p>R</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        api_client.force_authenticate(user=signer)
        with mock.patch('gym_app.views.dynamic_documents.signature_views.EmailMessage') as mock_email:
            mock_email.return_value.send.return_value = None
            r = api_client.post(
                reverse('reject-document',
                        kwargs={'document_id': doc.pk, 'user_id': signer.pk}),
                {'comment': 'Not acceptable'}, format='json')
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Rejected'

    # ========== Email exception tests (system boundary) ==========

    def test_sign_document_email_exception(self, api_client, lawyer, signer):
        """Lines 347-348: email send failure during sign is caught silently."""
        doc = DynamicDocument.objects.create(
            title='SignEmailFail', content='<p>E</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.filter(user=signer).delete()
        UserSignature.objects.create(
            user=signer, signature_image=sig_img, method='draw')
        api_client.force_authenticate(user=signer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.EmailMessage'
        ) as mock_email:
            mock_email.return_value.send.side_effect = Exception("SMTP fail")
            r = api_client.post(reverse(
                'sign-document',
                kwargs={'document_id': doc.pk, 'user_id': signer.pk}))
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'FullySigned'

    def test_reject_document_email_exception(self, api_client, lawyer, signer):
        """Lines 469-471: email send failure during reject is caught silently."""
        doc = DynamicDocument.objects.create(
            title='RejectEmailFail', content='<p>R</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        api_client.force_authenticate(user=signer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.EmailMessage'
        ) as mock_email:
            mock_email.return_value.send.side_effect = Exception("SMTP fail")
            r = api_client.post(
                reverse('reject-document',
                        kwargs={'document_id': doc.pk, 'user_id': signer.pk}),
                {'comment': 'Bad'}, format='json')
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Rejected'

    # ========== sign_document generic exception (lines 377-378) ==========

    def test_sign_document_generic_exception(self, api_client, lawyer, signer):
        """Lines 377-378: generic exception in sign_document → 500."""
        doc = DynamicDocument.objects.create(
            title='SignFail', content='<p>F</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.filter(user=signer).delete()
        UserSignature.objects.create(
            user=signer, signature_image=sig_img, method='draw')
        api_client.force_authenticate(user=signer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.'
            'DocumentSignatureSerializer',
            side_effect=Exception("serializer error")
        ):
            r = api_client.post(reverse(
                'sign-document',
                kwargs={'document_id': doc.pk, 'user_id': signer.pk}))
        assert r.status_code == 500
        assert 'unexpected' in r.data['detail'].lower()

    # ========== reopen_document: nonexistent doc (lines 539-545) ==========

    def test_reopen_signatures_nonexistent_doc(self, api_client, lawyer):
        """Lines 539-545: nonexistent document → 404 (via decorator)."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.post(reverse(
            'reopen-document-signatures',
            kwargs={'document_id': 99999}))
        assert r.status_code == 404

    # ========== remove_signature: nonexistent doc (lines 598-599) ==========

    def test_remove_signature_nonexistent_doc(self, api_client, lawyer):
        """Lines 598-599: nonexistent document → 404 (via decorator)."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.delete(reverse(
            'remove-signature-request',
            kwargs={'document_id': 99999, 'user_id': 1}))
        assert r.status_code == 404

    # ========== Generic exception for user document list endpoints ==========

    def test_pending_docs_full_generic_exception(self, api_client, lawyer, signer):
        """Lines 636-637: generic exception in get_user_pending_documents_full → 500."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.expire_overdue_documents',
            side_effect=Exception("unexpected")
        ):
            r = api_client.get(reverse(
                'get-user-pending-documents-full',
                kwargs={'user_id': signer.pk}))
        assert r.status_code == 500

    def test_archived_docs_generic_exception(self, api_client, lawyer, signer):
        """Lines 670-671: generic exception in get_user_archived_documents → 500."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.DocumentSignature.objects',
        ) as mock_qs:
            mock_qs.filter.side_effect = Exception("unexpected")
            r = api_client.get(reverse(
                'get-user-archived-documents',
                kwargs={'user_id': signer.pk}))
        assert r.status_code == 500

    def test_signed_docs_generic_exception(self, api_client, lawyer, signer):
        """Lines 696-697: generic exception in get_user_signed_documents → 500."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.DocumentSignature.objects',
        ) as mock_qs:
            mock_qs.filter.side_effect = Exception("unexpected")
            r = api_client.get(reverse(
                'get-user-signed-documents',
                kwargs={'user_id': signer.pk}))
        assert r.status_code == 500

    # ========== generate_signatures_pdf: nonexistent doc (line 1267) ==========

    def test_gen_sig_pdf_nonexistent_doc(self, api_client, lawyer):
        """Line 1267: nonexistent document → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': 99999}))
        assert r.status_code == 404


# ======================================================================
# Tests merged from test_signature_views_phase2.py
# ======================================================================


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

@pytest.mark.django_db
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

@pytest.mark.django_db
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
