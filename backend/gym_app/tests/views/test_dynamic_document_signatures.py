import datetime
from io import BytesIO
from unittest.mock import patch
from contextlib import ExitStack

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentSignature, UserSignature
from gym_app.views.dynamic_documents import signature_views


User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def api_client():
    return APIClient()


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
