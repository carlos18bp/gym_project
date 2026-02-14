import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentRelationship


User = get_user_model()
@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def other_user():
    return User.objects.create_user(
        email="other@example.com",
        password="testpassword",
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


@pytest.mark.django_db
@pytest.mark.integration
class TestListDocumentRelationships:
    @pytest.mark.contract
    def test_list_document_relationships_success(self, api_client, client_user):
        """Debe listar las relaciones de un documento cuando el usuario puede verlo."""
        doc1 = DynamicDocument.objects.create(
            title="Doc 1",
            content="<p>1</p>",
            state="Draft",
            created_by=client_user,
        )
        doc2 = DynamicDocument.objects.create(
            title="Doc 2",
            content="<p>2</p>",
            state="Completed",
            created_by=client_user,
        )

        rel = DocumentRelationship.objects.create(
            source_document=doc1,
            target_document=doc2,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-document-relationships", kwargs={"document_id": doc1.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        data = response.data[0]
        assert data["source_document"] == doc1.id
        assert data["target_document"] == doc2.id
        assert data["source_document_title"] == doc1.title
        assert data["target_document_title"] == doc2.title

    @pytest.mark.edge
    def test_list_document_relationships_empty(self, api_client, client_user):
        doc1 = DynamicDocument.objects.create(
            title="Doc Empty",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-document-relationships", kwargs={"document_id": doc1.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.edge
    def test_list_document_relationships_includes_target_side(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Draft",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )
        DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-document-relationships", kwargs={"document_id": target.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        data = response.data[0]
        assert data["source_document"] == source.id
        assert data["target_document"] == target.id

    @pytest.mark.edge
    def test_list_document_relationships_forbidden_when_cannot_view(self, api_client, client_user, other_user):
        """Si el usuario no puede ver el documento, obtiene 403."""
        doc1 = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>secret</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-document-relationships", kwargs={"document_id": doc1.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_list_document_relationships_not_found(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("list-document-relationships", kwargs={"document_id": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
@pytest.mark.integration
class TestListRelatedAndAvailableDocuments:
    @pytest.mark.contract
    def test_list_related_documents_returns_related_docs(self, api_client, client_user):
        """list_related_documents debe devolver documentos relacionados y filtrados por permisos."""
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Draft",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-related-documents", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["id"] == target.id

    @pytest.mark.edge
    def test_list_related_documents_filters_non_final_state(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Draft",
            content="<p>draft</p>",
            state="Draft",
            created_by=client_user,
        )
        DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-related-documents", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.edge
    def test_list_related_documents_empty(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-related-documents", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.edge
    def test_list_related_documents_forbidden_when_cannot_view(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>hidden</p>",
            state="Completed",
            created_by=other_user,
            is_public=False,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-related-documents", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_list_related_documents_not_found(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("list-related-documents", kwargs={"document_id": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.contract
    def test_list_available_documents_excludes_self_and_existing_and_invalid_states(self, api_client, client_user, other_user):
        """list_available_documents_for_relationship excluye self, ya relacionados y estados no permitidos."""
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )

        # Candidato válido (Completed)
        candidate_ok = DynamicDocument.objects.create(
            title="OK",
            content="<p>ok</p>",
            state="Completed",
            created_by=client_user,
        )

        # Candidato ya relacionado
        candidate_related = DynamicDocument.objects.create(
            title="Related",
            content="<p>rel</p>",
            state="Completed",
            created_by=client_user,
        )
        DocumentRelationship.objects.create(
            source_document=source,
            target_document=candidate_related,
            created_by=client_user,
        )

        # Candidato con estado no permitido
        candidate_bad_state = DynamicDocument.objects.create(
            title="Bad",
            content="<p>bad</p>",
            state="Draft",
            created_by=client_user,
        )

        candidate_pending = DynamicDocument.objects.create(
            title="Pending",
            content="<p>pending</p>",
            state="PendingSignatures",
            created_by=client_user,
        )

        candidate_fully_signed = DynamicDocument.objects.create(
            title="Signed",
            content="<p>signed</p>",
            state="FullySigned",
            created_by=client_user,
        )

        # Documento de otro usuario
        foreign_doc = DynamicDocument.objects.create(
            title="Foreign",
            content="<p>f</p>",
            state="Completed",
            created_by=other_user,
        )

        # Documento asignado pero sin permisos de visibilidad
        assigned_hidden = DynamicDocument.objects.create(
            title="Assigned Hidden",
            content="<p>assigned</p>",
            state="Completed",
            created_by=other_user,
            assigned_to=client_user,
            is_public=False,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-available-documents-for-relationship", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        ids = {doc["id"] for doc in response.data}
        assert candidate_ok.id in ids
        assert candidate_related.id not in ids
        assert candidate_bad_state.id not in ids
        assert candidate_pending.id not in ids
        assert foreign_doc.id not in ids
        assert assigned_hidden.id not in ids

    @pytest.mark.edge
    def test_list_available_documents_excludes_reverse_relationship(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        candidate = DynamicDocument.objects.create(
            title="Candidate",
            content="<p>cand</p>",
            state="Completed",
            created_by=client_user,
        )
        DocumentRelationship.objects.create(
            source_document=candidate,
            target_document=source,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-available-documents-for-relationship", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        ids = {doc["id"] for doc in response.data}
        assert candidate.id not in ids

        response = api_client.get(f"{url}?allow_pending_signatures=true")

        assert response.status_code == status.HTTP_200_OK
        ids = {doc["id"] for doc in response.data}
        assert candidate.id not in ids

    @pytest.mark.edge
    def test_list_available_documents_forbidden_when_cannot_view(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>hidden</p>",
            state="Completed",
            created_by=other_user,
            is_public=False,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-available-documents-for-relationship", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_list_available_documents_not_found(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("list-available-documents-for-relationship", kwargs={"document_id": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_list_available_documents_empty(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-available-documents-for-relationship", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []


@pytest.mark.django_db
@pytest.mark.integration
class TestCreateDocumentRelationship:
    @pytest.mark.contract
    def test_create_document_relationship_success(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert DocumentRelationship.objects.count() == 1
        rel = DocumentRelationship.objects.first()
        assert rel.created_by == client_user

    @pytest.mark.edge
    def test_create_document_relationship_missing_payload(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "source_document" in response.data

    @pytest.mark.edge
    def test_create_document_relationship_target_not_found(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": 9999}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "target_document" in response.data

    @pytest.mark.edge
    def test_create_document_relationship_pending_signatures_requires_flag(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Pending",
            content="<p>pending</p>",
            state="PendingSignatures",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "pending" in response.data["detail"].lower()

    @pytest.mark.contract
    @pytest.mark.parametrize("target_state", ["Completed", "PendingSignatures", "FullySigned"])
    def test_create_document_relationship_pending_signatures_allowed_with_flag(
        self,
        api_client,
        client_user,
        target_state,
    ):
        source = DynamicDocument.objects.create(
            title="Pending",
            content="<p>pending</p>",
            state="PendingSignatures",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state=target_state,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {
            "source_document": source.id,
            "target_document": target.id,
            "allow_pending_signatures": True
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert DocumentRelationship.objects.count() == 1

    @pytest.mark.edge
    def test_create_document_relationship_blocks_fully_signed_source(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Signed",
            content="<p>signed</p>",
            state="FullySigned",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "fully signed" in response.data["detail"].lower()

    @pytest.mark.edge
    @pytest.mark.parametrize("target_state", ["PendingSignatures", "FullySigned"])
    def test_create_document_relationship_blocks_locked_target(self, api_client, client_user, target_state):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state=target_state,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "pending signatures" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_forbidden_when_cannot_view_source(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>secret</p>",
            state="Completed",
            created_by=other_user,
            is_public=False,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "source document" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_forbidden_when_cannot_view_target(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Hidden Target",
            content="<p>hidden</p>",
            state="Completed",
            created_by=other_user,
            is_public=False,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "target document" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_forbidden_when_source_not_owned(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Public Source",
            content="<p>src</p>",
            state="Completed",
            created_by=other_user,
            is_public=True,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "own documents" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_forbidden_when_target_not_owned(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Public Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=other_user,
            is_public=True,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "own documents" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_requires_final_states(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Draft",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "final state" in response.data["detail"]

    @pytest.mark.edge
    def test_create_document_relationship_rejects_invalid_target_state(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Pending",
            content="<p>pending</p>",
            state="PendingSignatures",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Draft Target",
            content="<p>draft</p>",
            state="Draft",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {
            "source_document": source.id,
            "target_document": target.id,
            "allow_pending_signatures": True,
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "target document is in state" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_prevents_duplicates(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_prevents_reverse_duplicate(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        DocumentRelationship.objects.create(
            source_document=target,
            target_document=source,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": target.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_create_document_relationship_rejects_self_relationship(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Self",
            content="<p>self</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        payload = {"source_document": source.id, "target_document": source.id}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cannot be related to itself" in response.data["non_field_errors"][0].lower()


@pytest.mark.django_db
@pytest.mark.integration
class TestDeleteDocumentRelationship:
    @pytest.mark.contract
    def test_delete_relationship_as_creator(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("delete-document-relationship", kwargs={"relationship_id": rel.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert DocumentRelationship.objects.count() == 0

    @pytest.mark.edge
    def test_delete_relationship_forbidden_for_non_creator_non_lawyer(self, api_client, client_user, other_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=other_user)
        url = reverse("delete-document-relationship", kwargs={"relationship_id": rel.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.contract
    def test_delete_relationship_as_lawyer(self, api_client, client_user, lawyer_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-document-relationship", kwargs={"relationship_id": rel.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert DocumentRelationship.objects.count() == 0

    def test_delete_relationship_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-document-relationship", kwargs={"relationship_id": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.parametrize(
        "locked_state,lock_on",
        [("PendingSignatures", "source"), ("FullySigned", "target")]
    )
    def test_delete_relationship_blocked_for_locked_documents(
        self,
        api_client,
        client_user,
        locked_state,
        lock_on,
    ):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        if lock_on == "source":
            source.state = locked_state
            source.save(update_fields=["state"])
        else:
            target.state = locked_state
            target.save(update_fields=["state"])

        api_client.force_authenticate(user=client_user)
        url = reverse("delete-document-relationship", kwargs={"relationship_id": rel.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "pending signatures" in response.data["detail"].lower()
        assert DocumentRelationship.objects.filter(id=rel.id).exists()


@pytest.mark.django_db
class TestDocumentRelationshipsRest:
    def test_rest_list_document_relationships(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )
        DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("list-document-relationships", kwargs={"document_id": source.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        item = response.data[0]
        assert item["source_document"] == source.id
        assert item["target_document"] == target.id
        assert item["source_document_title"] == source.title
        assert item["target_document_title"] == target.title

    def test_rest_create_document_relationship(self, api_client, client_user):
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>src</p>",
            state="Completed",
            created_by=client_user,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>tgt</p>",
            state="Completed",
            created_by=client_user,
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("create-document-relationship")
        response = api_client.post(
            url,
            {"source_document": source.id, "target_document": target.id},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["source_document_title"] == source.title
        assert response.data["target_document_title"] == target.title
        assert response.data["created_by_email"] == client_user.email
