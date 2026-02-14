import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import Tag, DocumentFolder, DynamicDocument


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
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        role="client",
    )


@pytest.mark.django_db
class TestTagViews:
    def test_list_tags_empty(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-tags")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_list_tags_returns_all(self, api_client, lawyer_user):
        Tag.objects.create(name="A", color_id=1, created_by=lawyer_user)
        Tag.objects.create(name="B", color_id=2, created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-tags")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_create_tag_as_lawyer(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-tag")
        data = {"name": "Importante", "color_id": 3}
        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        tag = Tag.objects.get(name="Importante")
        assert tag.created_by == lawyer_user

    def test_create_tag_duplicate_name(self, api_client, lawyer_user):
        Tag.objects.create(name="Duplicado", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-tag")
        response = api_client.post(url, {"name": "Duplicado", "color_id": 2}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_create_tag_invalid_payload(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-tag")
        response = api_client.post(url, {"color_id": 1}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_tag_forbidden_for_non_lawyer(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("create-tag")
        data = {"name": "Tag", "color_id": 1}
        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_tag_as_lawyer(self, api_client, lawyer_user):
        tag = Tag.objects.create(name="Old", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-tag", kwargs={"pk": tag.id})
        data = {"name": "New"}
        response = api_client.put(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        tag.refresh_from_db()
        assert tag.name == "New"

    def test_update_tag_patch_partial(self, api_client, lawyer_user):
        tag = Tag.objects.create(name="Old", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-tag", kwargs={"pk": tag.id})
        response = api_client.patch(url, {"color_id": 5}, format="json")

        assert response.status_code == status.HTTP_200_OK
        tag.refresh_from_db()
        assert tag.color_id == 5
        assert tag.name == "Old"

    def test_update_tag_invalid_payload(self, api_client, lawyer_user):
        tag = Tag.objects.create(name="Old", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-tag", kwargs={"pk": tag.id})
        response = api_client.put(url, {"name": ""}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_tag_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-tag", kwargs={"pk": 9999})
        response = api_client.put(url, {"name": "New"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_tag_forbidden_for_non_lawyer(self, api_client, client_user, lawyer_user):
        tag = Tag.objects.create(name="Old", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=client_user)
        url = reverse("update-tag", kwargs={"pk": tag.id})
        response = api_client.put(url, {"name": "New"}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_tag_as_lawyer(self, api_client, lawyer_user):
        tag = Tag.objects.create(name="ToDelete", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-tag", kwargs={"pk": tag.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert Tag.objects.count() == 0

    def test_delete_tag_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-tag", kwargs={"pk": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_tag_forbidden_for_non_lawyer(self, api_client, client_user, lawyer_user):
        tag = Tag.objects.create(name="ToDelete", color_id=1, created_by=lawyer_user)

        api_client.force_authenticate(user=client_user)
        url = reverse("delete-tag", kwargs={"pk": tag.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestFolderViews:
    def test_list_folders_empty(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("list-folders")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_list_folders_returns_only_owner_folders(self, api_client, client_user):
        other = User.objects.create_user(
            email="other@example.com",
            password="testpassword",
            role="client",
        )

        # Folders de ambos usuarios
        DocumentFolder.objects.create(name="Mine", color_id=1, owner=client_user)
        DocumentFolder.objects.create(name="Other", color_id=1, owner=other)

        api_client.force_authenticate(user=client_user)
        url = reverse("list-folders")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Mine"

    def test_create_folder_sets_owner(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)

        # Crear algunos documentos
        doc1 = DynamicDocument.objects.create(
            title="Doc 1",
            content="<p>1</p>",
            state="Draft",
            created_by=client_user,
        )
        doc2 = DynamicDocument.objects.create(
            title="Doc 2",
            content="<p>2</p>",
            state="Draft",
            created_by=client_user,
        )

        url = reverse("create-folder")
        data = {
            "name": "Carpeta",
            "color_id": 2,
            "document_ids": [doc1.id, doc2.id],
        }
        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        folder = DocumentFolder.objects.get(name="Carpeta")
        assert folder.owner == client_user
        doc_ids = set(folder.documents.values_list("id", flat=True))
        assert doc_ids == {doc1.id, doc2.id}

    def test_create_folder_invalid_payload(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("create-folder")
        response = api_client.post(url, {"color_id": 1}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_folder_invalid_document_ids(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("create-folder")
        response = api_client.post(
            url,
            {"name": "Bad", "color_id": 1, "document_ids": [9999]},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "document_ids" in response.data

    def test_get_folder_only_owner_can_access(self, api_client, client_user):
        other = User.objects.create_user(
            email="other2@example.com",
            password="testpassword",
            role="client",
        )
        folder = DocumentFolder.objects.create(name="Mine", color_id=1, owner=client_user)

        # Owner
        api_client.force_authenticate(user=client_user)
        url = reverse("get-folder", kwargs={"pk": folder.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

        # No-owner
        api_client.force_authenticate(user=other)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_folder_returns_documents(self, api_client, client_user):
        doc1 = DynamicDocument.objects.create(
            title="Doc 1",
            content="<p>1</p>",
            state="Draft",
            created_by=client_user,
        )
        doc2 = DynamicDocument.objects.create(
            title="Doc 2",
            content="<p>2</p>",
            state="Draft",
            created_by=client_user,
        )
        folder = DocumentFolder.objects.create(name="Mine", color_id=1, owner=client_user)
        folder.documents.add(doc1, doc2)

        api_client.force_authenticate(user=client_user)
        url = reverse("get-folder", kwargs={"pk": folder.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == folder.id
        assert response.data["name"] == folder.name
        doc_ids = {doc["id"] for doc in response.data["documents"]}
        assert doc_ids == {doc1.id, doc2.id}

    def test_get_folder_not_found(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("get-folder", kwargs={"pk": 9999})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_folder_owner_only(self, api_client, client_user):
        other = User.objects.create_user(
            email="other3@example.com",
            password="testpassword",
            role="client",
        )
        folder = DocumentFolder.objects.create(name="Old", color_id=1, owner=client_user)

        # Owner puede actualizar
        api_client.force_authenticate(user=client_user)
        url = reverse("update-folder", kwargs={"pk": folder.id})
        response = api_client.patch(url, {"name": "New"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        folder.refresh_from_db()
        assert folder.name == "New"

        # No-owner recibe 403
        api_client.force_authenticate(user=other)
        response = api_client.patch(url, {"name": "X"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_folder_document_ids_updates_documents(self, api_client, client_user):
        doc1 = DynamicDocument.objects.create(
            title="Doc A",
            content="<p>a</p>",
            state="Draft",
            created_by=client_user,
        )
        doc2 = DynamicDocument.objects.create(
            title="Doc B",
            content="<p>b</p>",
            state="Draft",
            created_by=client_user,
        )
        folder = DocumentFolder.objects.create(name="Folder", color_id=1, owner=client_user)
        folder.documents.add(doc1)

        api_client.force_authenticate(user=client_user)
        url = reverse("update-folder", kwargs={"pk": folder.id})
        response = api_client.patch(url, {"document_ids": [doc2.id]}, format="json")

        assert response.status_code == status.HTTP_200_OK
        folder.refresh_from_db()
        doc_ids = set(folder.documents.values_list("id", flat=True))
        assert doc_ids == {doc2.id}

    def test_update_folder_not_found(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("update-folder", kwargs={"pk": 9999})
        response = api_client.patch(url, {"name": "Missing"}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_folder_invalid_payload(self, api_client, client_user):
        folder = DocumentFolder.objects.create(name="Old", color_id=1, owner=client_user)

        api_client.force_authenticate(user=client_user)
        url = reverse("update-folder", kwargs={"pk": folder.id})
        response = api_client.patch(url, {"name": ""}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_folder_invalid_document_ids(self, api_client, client_user):
        folder = DocumentFolder.objects.create(name="Old", color_id=1, owner=client_user)

        api_client.force_authenticate(user=client_user)
        url = reverse("update-folder", kwargs={"pk": folder.id})
        response = api_client.patch(url, {"document_ids": [9999]}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "document_ids" in response.data

    def test_delete_folder_owner_only(self, api_client, client_user):
        other = User.objects.create_user(
            email="other4@example.com",
            password="testpassword",
            role="client",
        )
        folder = DocumentFolder.objects.create(name="ToDelete", color_id=1, owner=client_user)

        # Owner puede borrar
        api_client.force_authenticate(user=client_user)
        url = reverse("delete-folder", kwargs={"pk": folder.id})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert DocumentFolder.objects.count() == 0

        # No-owner recibe 403
        folder2 = DocumentFolder.objects.create(name="ToDelete2", color_id=1, owner=client_user)
        api_client.force_authenticate(user=other)
        url = reverse("delete-folder", kwargs={"pk": folder2.id})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_folder_not_found(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("delete-folder", kwargs={"pk": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ======================================================================
# Tests moved from test_user_auth.py – batch36 (tag/folder domain)
# ======================================================================

@pytest.mark.django_db
class TestTagViewsBasic:

    def test_list_tags(self, api_client, lawyer_user):
        Tag.objects.create(name="Tag36", created_by=lawyer_user)
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.get(reverse("list-tags"))
        assert resp.status_code == 200

    def test_create_tag(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.post(reverse("create-tag"), {"name": "NewTag36"}, format="json")
        assert resp.status_code == 201
        assert Tag.objects.filter(name="NewTag36").exists()

    def test_delete_tag(self, api_client, lawyer_user):
        tag = Tag.objects.create(name="DelTag36", created_by=lawyer_user)
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.delete(reverse("delete-tag", args=[tag.id]))
        assert resp.status_code in (200, 204)
        assert not Tag.objects.filter(id=tag.id).exists()


@pytest.mark.django_db
class TestFolderViewsBasic:

    def test_list_folders(self, api_client, lawyer_user):
        DocumentFolder.objects.create(name="Folder36", owner=lawyer_user)
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.get(reverse("list-folders"))
        assert resp.status_code == 200

    def test_create_folder(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.post(reverse("create-folder"), {"name": "NewFolder36"}, format="json")
        assert resp.status_code == 201
        assert DocumentFolder.objects.filter(name="NewFolder36").exists()

    def test_delete_folder(self, api_client, lawyer_user):
        folder = DocumentFolder.objects.create(name="DelFolder36", owner=lawyer_user)
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.delete(reverse("delete-folder", args=[folder.id]))
        assert resp.status_code in (200, 204)
        assert not DocumentFolder.objects.filter(id=folder.id).exists()
