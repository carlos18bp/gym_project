import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentVisibilityPermission, DocumentUsabilityPermission


User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def api_client():
    return APIClient()


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
        first_name="Client",
        last_name="User",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc permisos",
        content="<p>x</p>",
        state="Draft",
        created_by=lawyer_user,
    )


@pytest.mark.django_db
@pytest.mark.integration
class TestGetDocumentPermissions:
    @pytest.mark.contract
    def test_get_document_permissions_as_lawyer(self, api_client, lawyer_user, client_user, document):
        """get_document_permissions devuelve resumen de visibilidad/usabilidad y roles activos."""
        # Crear permisos de visibilidad y usabilidad
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )
        DocumentUsabilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )

        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-document-permissions", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data

        assert data["document_id"] == document.id
        assert data["document_title"] == document.title
        assert data["summary"]["total_visibility_users"] == 1
        assert data["summary"]["total_usability_users"] == 1
        assert len(data["visibility_permissions"]) == 1
        assert len(data["usability_permissions"]) == 1

    @pytest.mark.edge
    def test_get_document_permissions_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-permissions", kwargs={"pk": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_get_document_permissions_forbidden_for_non_owner(self, api_client, client_user, document):
        api_client.force_authenticate(user=client_user)
        url = reverse("get-document-permissions", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    @pytest.mark.edge
    def test_get_document_permissions_internal_error(self, api_client, lawyer_user, document, monkeypatch):
        api_client.force_authenticate(user=lawyer_user)

        def raise_error(*args, **kwargs):
            raise Exception("boom")

        monkeypatch.setattr(DocumentVisibilityPermission.objects, "filter", raise_error)

        url = reverse("get-document-permissions", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Internal server error" in response.data["detail"]

    @pytest.mark.edge
    def test_get_document_permissions_active_roles_detection(self, api_client, lawyer_user, document):
        """active_roles debe incluir solo roles con permisos otorgados a todos sus usuarios."""
        basic_user_1 = User.objects.create_user(
            email="basic1@example.com",
            password="testpassword",
            role="basic",
        )
        basic_user_2 = User.objects.create_user(
            email="basic2@example.com",
            password="testpassword",
            role="basic",
        )
        client_user_1 = User.objects.create_user(
            email="client1@example.com",
            password="testpassword",
            role="client",
        )
        client_user_2 = User.objects.create_user(
            email="client2@example.com",
            password="testpassword",
            role="client",
        )
        corporate_user_1 = User.objects.create_user(
            email="corp1@example.com",
            password="testpassword",
            role="corporate_client",
        )
        User.objects.create_user(
            email="corp2@example.com",
            password="testpassword",
            role="corporate_client",
        )

        DocumentVisibilityPermission.objects.bulk_create(
            [
                DocumentVisibilityPermission(document=document, user=basic_user_1, granted_by=lawyer_user),
                DocumentVisibilityPermission(document=document, user=basic_user_2, granted_by=lawyer_user),
                DocumentVisibilityPermission(document=document, user=client_user_1, granted_by=lawyer_user),
                DocumentVisibilityPermission(document=document, user=corporate_user_1, granted_by=lawyer_user),
            ]
        )
        DocumentUsabilityPermission.objects.bulk_create(
            [
                DocumentUsabilityPermission(document=document, user=basic_user_1, granted_by=lawyer_user),
                DocumentUsabilityPermission(document=document, user=basic_user_2, granted_by=lawyer_user),
                DocumentUsabilityPermission(document=document, user=client_user_1, granted_by=lawyer_user),
            ]
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-permissions", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        active_roles = response.data["active_roles"]
        assert "basic" in active_roles["visibility_roles"]
        assert "basic" in active_roles["usability_roles"]
        assert "client" not in active_roles["visibility_roles"]
        assert "client" not in active_roles["usability_roles"]
        assert "corporate_client" not in active_roles["visibility_roles"]


@pytest.mark.django_db
@pytest.mark.integration
class TestManageDocumentPermissionsUnified:
    @pytest.mark.contract
    def test_manage_permissions_unified_basic_flow(self, api_client, lawyer_user, client_user, document):
        """manage_document_permissions_unified maneja is_public, visibility y usability."""
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "is_public": False,
            "visibility": {
                "roles": ["client"],
                "user_ids": [client_user.id],
            },
            "usability": {
                "user_ids": [client_user.id],
            },
        }

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        data = response.data

        # Debe haber concedido visibilidad y usabilidad al client_user
        assert data["document_id"] == document.id
        assert data["results"]["visibility"]["granted"]
        assert data["results"]["usability"]["granted"]
        assert data["summary"]["total_errors"] == 0

        vis_emails = set(
            DocumentVisibilityPermission.objects.filter(document=document).values_list("user__email", flat=True)
        )
        usab_emails = set(
            DocumentUsabilityPermission.objects.filter(document=document).values_list("user__email", flat=True)
        )
        assert client_user.email in vis_emails
        assert client_user.email in usab_emails

    @pytest.mark.edge
    def test_manage_permissions_unified_invalid_role_and_missing_user(self, api_client, lawyer_user, document):
        """Roles inválidos y user_ids inexistentes deben aparecer en errors."""
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "visibility": {
                "roles": ["invalid-role"],
                "user_ids": [9999],
            },
            "usability": {
                "roles": ["client"],
                "user_ids": [9999],
            },
        }

        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK

        errors = response.data["errors"]
        assert any("Invalid visibility roles" in err for err in errors)
        assert any("users not found".lower() in err.lower() for err in errors)

    @pytest.mark.edge
    def test_manage_permissions_unified_exclude_users_and_public_warning(self, api_client, lawyer_user, client_user, document):
        """exclude_user_ids debe excluir usuarios y is_public=True debe agregar warning."""
        api_client.force_authenticate(user=lawyer_user)

        excluded_user = User.objects.create_user(
            email="excluded@example.com",
            password="testpassword",
            role="client",
            first_name="Excluded",
            last_name="User",
        )

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "is_public": True,
            "visibility": {
                "roles": ["client"],
                "exclude_user_ids": [excluded_user.id],
            },
            "usability": {
                "user_ids": [client_user.id, excluded_user.id],
                "exclude_user_ids": [excluded_user.id],
            },
        }

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert any("Document is now public" in warning for warning in response.data["warnings"])

        visibility_ids = set(
            DocumentVisibilityPermission.objects.filter(document=document).values_list("user_id", flat=True)
        )
        usability_ids = set(
            DocumentUsabilityPermission.objects.filter(document=document).values_list("user_id", flat=True)
        )

        assert client_user.id in visibility_ids
        assert excluded_user.id not in visibility_ids
        assert client_user.id in usability_ids
        assert excluded_user.id not in usability_ids

    @pytest.mark.edge
    def test_manage_permissions_unified_empty_payload(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["changes_made"] == []
        assert response.data["summary"]["total_errors"] == 0

    @pytest.mark.edge
    def test_manage_permissions_unified_usability_requires_visibility(self, api_client, lawyer_user, client_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "usability": {
                "user_ids": [client_user.id],
            }
        }

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        errors = response.data["results"]["usability"]["errors"]
        assert errors
        assert "visibility" in errors[0]["error"].lower()
        assert DocumentUsabilityPermission.objects.filter(document=document).count() == 0

    @pytest.mark.edge
    def test_manage_permissions_unified_usability_granted_when_public(self, api_client, lawyer_user, client_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "is_public": True,
            "usability": {
                "user_ids": [client_user.id],
            }
        }

        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Internal server error" in response.data["detail"]
        assert DocumentUsabilityPermission.objects.filter(document=document, user=client_user).count() == 0

    @pytest.mark.edge
    def test_manage_permissions_unified_visibility_empty_clears_permissions(self, api_client, lawyer_user, client_user, document):
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        response = api_client.post(url, {"visibility": {}}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert DocumentVisibilityPermission.objects.filter(document=document).count() == 0
        assert len(response.data["results"]["visibility"]["removed"]) == 1

    @pytest.mark.edge
    def test_manage_permissions_unified_usability_empty_clears_permissions(self, api_client, lawyer_user, client_user, document):
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )
        DocumentUsabilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        response = api_client.post(url, {"usability": {}}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert DocumentUsabilityPermission.objects.filter(document=document).count() == 0
        assert len(response.data["results"]["usability"]["removed"]) == 1

    @pytest.mark.edge
    def test_manage_permissions_unified_forbidden_for_non_lawyer_owner(self, api_client, client_user, document):
        """Solo lawyer u owner pueden llamar a manage_document_permissions_unified."""
        # document.created_by es lawyer_user; aquí autenticamos client sin ser owner
        api_client.force_authenticate(user=client_user)

        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@pytest.mark.integration
class TestTogglePublicAccess:
    @pytest.mark.contract
    def test_toggle_public_access_auto_toggle(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("toggle-public-access", kwargs={"pk": document.id})
        # Inicialmente is_public=False; sin payload debe hacer toggle a True
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert document.is_public is True

        # Segunda llamada sin payload → vuelve a False
        response = api_client.post(url, {}, format="json")
        document.refresh_from_db()
        assert document.is_public is False

    @pytest.mark.contract
    def test_toggle_public_access_set_explicit_value(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("toggle-public-access", kwargs={"pk": document.id})
        response = api_client.post(url, {"is_public": True}, format="json")
        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert document.is_public is True

    @pytest.mark.edge
    def test_toggle_public_access_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("toggle-public-access", kwargs={"pk": 9999})
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_toggle_public_access_forbidden_for_non_owner(self, api_client, client_user, document):
        api_client.force_authenticate(user=client_user)
        url = reverse("toggle-public-access", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()
