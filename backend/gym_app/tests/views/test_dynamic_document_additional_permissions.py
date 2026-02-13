import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import (
    DynamicDocument,
    DocumentVisibilityPermission,
    DocumentUsabilityPermission,
)


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
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic@example.com",
        password="testpassword",
        role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc permisos extra",
        content="<p>x</p>",
        state="Draft",
        created_by=lawyer_user,
    )


@pytest.mark.django_db
class TestUserBasedGrantAndRevoke:
    def test_grant_and_revoke_visibility_and_usability_permissions(self, api_client, lawyer_user, client_user, document):
        api_client.force_authenticate(user=lawyer_user)

        # Grant visibility to client_user
        url_grant_vis = reverse("grant-visibility-permissions", kwargs={"pk": document.id})
        response = api_client.post(url_grant_vis, {"user_ids": [client_user.id]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()

        # Grant usability to client_user (document is not public, but has visibility)
        url_grant_usa = reverse("grant-usability-permissions", kwargs={"pk": document.id})
        response = api_client.post(url_grant_usa, {"user_ids": [client_user.id]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert DocumentUsabilityPermission.objects.filter(document=document, user=client_user).exists()

        # Revoke only usability
        url_revoke_usa = reverse("revoke-usability-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url_revoke_usa)
        assert response.status_code == status.HTTP_200_OK
        assert not DocumentUsabilityPermission.objects.filter(document=document, user=client_user).exists()
        # Visibilidad se mantiene
        assert DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()

        # Revoke visibility (también debe revocar usability si hubiera)
        url_revoke_vis = reverse("revoke-visibility-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url_revoke_vis)
        assert response.status_code == status.HTTP_200_OK
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()

    def test_revoke_permissions_not_found_cases(self, api_client, lawyer_user, client_user, document):
        api_client.force_authenticate(user=lawyer_user)

        # Usuario sin permisos de visibilidad
        url_revoke_vis = reverse("revoke-visibility-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url_revoke_vis)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Usuario sin permisos de uso
        url_revoke_usa = reverse("revoke-usability-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url_revoke_usa)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRoleAndCombinedPermissionEndpoints:
    def test_get_available_clients_and_roles_as_lawyer(self, api_client, lawyer_user, client_user, basic_user):
        api_client.force_authenticate(user=lawyer_user)

        url_clients = reverse("get-available-clients")
        response = api_client.get(url_clients)
        assert response.status_code == status.HTTP_200_OK
        emails = {c["email"] for c in response.data["clients"]}
        assert client_user.email in emails
        assert basic_user.email in emails

        url_roles = reverse("get-available-roles")
        response = api_client.get(url_roles)
        assert response.status_code == status.HTTP_200_OK
        role_codes = {r["code"] for r in response.data["roles"]}
        assert "client" in role_codes
        assert "lawyer" in role_codes

    def test_grant_and_revoke_permissions_by_role(self, api_client, lawyer_user, client_user, basic_user, document):
        api_client.force_authenticate(user=lawyer_user)

        # Grant visibility to roles client/basic
        url_grant_by_role = reverse("grant-visibility-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url_grant_by_role, {"roles": ["client", "basic"]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()
        assert DocumentVisibilityPermission.objects.filter(document=document, user=basic_user).exists()

        # Grant usability by role requiere visibilidad previa
        url_grant_usa_by_role = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url_grant_usa_by_role, {"roles": ["client"]}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert DocumentUsabilityPermission.objects.filter(document=document, user=client_user).exists()

        # Revoke ambos permisos por rol
        url_revoke_by_role = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        payload = {"roles": ["client", "basic"], "permission_type": "both"}
        response = api_client.delete(url_revoke_by_role, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=basic_user).exists()

    def test_grant_and_revoke_permissions_combined(self, api_client, lawyer_user, client_user, basic_user, document):
        api_client.force_authenticate(user=lawyer_user)

        # Grant visibility combined: user_ids + roles, excluyendo uno
        url_grant_vis_combined = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        payload_vis = {
            "user_ids": [client_user.id],
            "roles": ["basic"],
            "exclude_user_ids": [basic_user.id],
        }
        response = api_client.post(url_grant_vis_combined, payload_vis, format="json")
        assert response.status_code == status.HTTP_200_OK
        # client_user debe tener permiso; basic_user excluido
        assert DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=basic_user).exists()

        # Grant usability combined: requiere visibilidad; usamos solo client_user
        url_grant_usa_combined = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        payload_usa = {"user_ids": [client_user.id]}
        response = api_client.post(url_grant_usa_combined, payload_usa, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert DocumentUsabilityPermission.objects.filter(document=document, user=client_user).exists()

        # Revoke combined solo para client_user
        url_revoke_combined = reverse("revoke-permissions-combined", kwargs={"pk": document.id})
        payload_revoke = {"user_ids": [client_user.id], "permission_type": "both"}
        response = api_client.delete(url_revoke_combined, payload_revoke, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()
        assert not DocumentUsabilityPermission.objects.filter(document=document, user=client_user).exists()
