import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentVisibilityPermission, DocumentUsabilityPermission


User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email="basic@example.com",
        password="testpassword",
        role="basic",
    )


@pytest.fixture
def corporate_user():
    return User.objects.create_user(
        email="corp@example.com",
        password="testpassword",
        role="corporate_client",
    )


@pytest.fixture
def other_user():
    return User.objects.create_user(
        email="other@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc permisos",
        content="<p>x</p>",
        state="Draft",
        created_by=lawyer_user,
    )


class TestGrantVisibilityPermissions:
    @pytest.mark.parametrize(
        "payload, expected_detail",
        [({}, "user_ids list is required"), ({"user_ids": [9999]}, "Users not found")],
    )
    def test_grant_visibility_permissions_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions", kwargs={"pk": document.id})
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_grant_visibility_permissions_public_warning_skips_lawyer(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions", kwargs={"pk": document.id})
        payload = {"user_ids": [client_user.id, lawyer_user.id]}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
        granted_ids = {perm["user_id"] for perm in response.data["granted_permissions"]}
        assert client_user.id in granted_ids
        assert lawyer_user.id not in granted_ids

    def test_grant_visibility_permissions_forbidden_for_non_owner(self, api_client, client_user, document):
        api_client.force_authenticate(user=client_user)
        url = reverse("grant-visibility-permissions", kwargs={"pk": document.id})
        response = api_client.post(url, {"user_ids": [client_user.id]}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_grant_visibility_permissions_document_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions", kwargs={"pk": 9999})
        response = api_client.post(url, {"user_ids": [lawyer_user.id]}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()


class TestGrantUsabilityPermissions:
    @pytest.mark.parametrize(
        "payload, expected_detail",
        [({}, "user_ids list is required"), ({"user_ids": [9999]}, "Users not found")],
    )
    def test_grant_usability_permissions_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions", kwargs={"pk": document.id})
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_grant_usability_permissions_requires_visibility(self, api_client, lawyer_user, client_user, other_user, document):
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions", kwargs={"pk": document.id})
        payload = {"user_ids": [client_user.id, other_user.id]}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        created_ids = {perm["user_id"] for perm in response.data["granted_permissions"]}
        error_ids = {err["user_id"] for err in response.data["errors"]}
        assert client_user.id in created_ids
        assert other_user.id in error_ids

    def test_grant_usability_permissions_public_warning(self, api_client, lawyer_user, other_user, document):
        document.is_public = True
        document.save(update_fields=["is_public"])
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=other_user,
            granted_by=lawyer_user,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions", kwargs={"pk": document.id})
        payload = {"user_ids": [other_user.id]}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
        assert response.data["granted_permissions"]

    def test_grant_usability_permissions_forbidden_for_non_owner(self, api_client, client_user, document):
        api_client.force_authenticate(user=client_user)
        url = reverse("grant-usability-permissions", kwargs={"pk": document.id})
        response = api_client.post(url, {"user_ids": [client_user.id]}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_grant_usability_permissions_document_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions", kwargs={"pk": 9999})
        response = api_client.post(url, {"user_ids": [lawyer_user.id]}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()


class TestRevokePermissionsByUser:
    def test_revoke_visibility_permission_not_found(self, api_client, lawyer_user, client_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-visibility-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_visibility_permission_user_not_found(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-visibility-permission", kwargs={"pk": document.id, "user_id": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_visibility_permission_forbidden_for_non_owner(self, api_client, client_user, document, other_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("revoke-visibility-permission", kwargs={"pk": document.id, "user_id": other_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_revoke_visibility_permission_document_not_found(self, api_client, lawyer_user, client_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-visibility-permission", kwargs={"pk": 9999, "user_id": client_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_revoke_visibility_permission_public_warning_revokes_usability(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])
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
        url = reverse("revoke-visibility-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
        assert response.data["usability_revoked"] is True

    def test_revoke_usability_permission_not_found(self, api_client, lawyer_user, client_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-usability-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_usability_permission_user_not_found(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-usability-permission", kwargs={"pk": document.id, "user_id": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_usability_permission_forbidden_for_non_owner(self, api_client, client_user, document, other_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("revoke-usability-permission", kwargs={"pk": document.id, "user_id": other_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_revoke_usability_permission_document_not_found(self, api_client, lawyer_user, client_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-usability-permission", kwargs={"pk": 9999, "user_id": client_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_revoke_usability_permission_public_warning(self, api_client, lawyer_user, client_user, document):
        document.is_public = True
        document.save(update_fields=["is_public"])
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
        url = reverse("revoke-usability-permission", kwargs={"pk": document.id, "user_id": client_user.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]


class TestRoleBasedPermissionEndpoints:
    @pytest.mark.parametrize(
        "payload, expected_detail",
        [({}, "roles list is required"), ({"roles": ["invalid"]}, "Invalid roles")],
    )
    def test_grant_visibility_permissions_by_role_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_grant_visibility_permissions_by_role_skips_existing_and_warns(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, {"roles": ["client", "lawyer"]}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
        assert response.data["skipped_users"]

    def test_grant_visibility_permissions_by_role_forbidden_for_non_owner(self, api_client, client_user, document):
        api_client.force_authenticate(user=client_user)
        url = reverse("grant-visibility-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, {"roles": ["client"]}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_grant_visibility_permissions_by_role_document_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-by-role", kwargs={"pk": 9999})
        response = api_client.post(url, {"roles": ["client"]}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    @pytest.mark.parametrize(
        "payload, expected_detail",
        [({}, "roles list is required"), ({"roles": ["invalid"]}, "Invalid roles")],
    )
    def test_grant_usability_permissions_by_role_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_grant_usability_permissions_by_role_requires_visibility(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, {"roles": ["client"]}, format="json")

        assert response.status_code == status.HTTP_200_OK
        error_ids = {err["user_id"] for err in response.data["errors"]}
        assert client_user.id in error_ids

    def test_grant_usability_permissions_by_role_skips_existing(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
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
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, {"roles": ["client"]}, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["skipped_users"]

    def test_grant_usability_permissions_by_role_forbidden_for_non_owner(self, api_client, client_user, document):
        api_client.force_authenticate(user=client_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.post(url, {"roles": ["client"]}, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_grant_usability_permissions_by_role_document_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": 9999})
        response = api_client.post(url, {"roles": ["client"]}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    @pytest.mark.parametrize(
        "payload, expected_detail",
        [
            ({}, "roles list is required"),
            ({"roles": ["invalid"], "permission_type": "both"}, "Invalid roles"),
            ({"roles": ["client"], "permission_type": "invalid"}, "Invalid permission_type"),
        ],
    )
    def test_revoke_permissions_by_role_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        response = api_client.delete(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_revoke_permissions_by_role_public_warning(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])
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
        url = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        payload = {"roles": ["client"], "permission_type": "both"}
        response = api_client.delete(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]


class TestPermissionViewsRest:
    def test_toggle_public_access_rest(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("toggle-public-access", kwargs={"pk": document.id})

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert document.is_public is True

        response = api_client.post(url, {"is_public": False}, format="json")

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert document.is_public is False

    def test_toggle_public_access_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("toggle-public-access", kwargs={"pk": 9999})

        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_available_clients_forbidden_for_non_lawyer(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("get-available-clients")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_get_available_roles_forbidden_for_non_lawyer(self, api_client, client_user):
        api_client.force_authenticate(user=client_user)
        url = reverse("get-available-roles")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only lawyers" in response.data["detail"].lower()

    def test_get_available_clients_and_roles_rest(self, api_client, lawyer_user, client_user, basic_user, corporate_user):
        api_client.force_authenticate(user=lawyer_user)

        clients_url = reverse("get-available-clients")
        response = api_client.get(clients_url)

        assert response.status_code == status.HTTP_200_OK
        emails = {client["email"] for client in response.data["clients"]}
        assert client_user.email in emails
        assert basic_user.email in emails
        assert corporate_user.email in emails
        assert lawyer_user.email not in emails

        roles_url = reverse("get-available-roles")
        response = api_client.get(roles_url)

        assert response.status_code == status.HTTP_200_OK
        role_codes = {role["code"] for role in response.data["roles"]}
        assert {"client", "basic", "corporate_client", "lawyer"}.issubset(role_codes)


class TestCombinedPermissionEndpoints:
    @pytest.mark.parametrize(
        "payload, expected_detail",
        [
            ({}, "At least one of user_ids or roles must be provided"),
            ({"roles": ["invalid"]}, "Invalid roles"),
            ({"user_ids": [9999]}, "Users not found"),
        ],
    )
    def test_grant_visibility_permissions_combined_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_grant_visibility_permissions_combined_warning_and_skipped(
        self,
        api_client,
        lawyer_user,
        client_user,
        basic_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        payload = {
            "user_ids": [client_user.id],
            "roles": ["basic"],
            "exclude_user_ids": [basic_user.id],
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
        assert response.data["skipped_users"]

    @pytest.mark.parametrize(
        "payload, expected_detail",
        [
            ({}, "At least one of user_ids or roles must be provided"),
            ({"roles": ["invalid"]}, "Invalid roles"),
            ({"user_ids": [9999]}, "Users not found"),
        ],
    )
    def test_grant_usability_permissions_combined_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_grant_usability_permissions_combined_requires_visibility(
        self,
        api_client,
        lawyer_user,
        client_user,
        other_user,
        document,
    ):
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=client_user,
            granted_by=lawyer_user,
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        payload = {"user_ids": [client_user.id, other_user.id]}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        created_ids = {perm["user_id"] for perm in response.data["granted_permissions"]}
        error_ids = {err["user_id"] for err in response.data["errors"]}
        assert client_user.id in created_ids
        assert other_user.id in error_ids

    def test_grant_usability_permissions_combined_warning_and_skipped(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])
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
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        payload = {"user_ids": [client_user.id]}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
        assert response.data["skipped_users"]

    @pytest.mark.parametrize(
        "payload, expected_detail",
        [
            ({}, "At least one of user_ids or roles must be provided"),
            ({"roles": ["invalid"], "permission_type": "both"}, "Invalid roles"),
            ({"roles": ["client"], "permission_type": "invalid"}, "Invalid permission_type"),
            ({"user_ids": [9999], "permission_type": "both"}, "Users not found"),
        ],
    )
    def test_revoke_permissions_combined_validation(
        self,
        api_client,
        lawyer_user,
        document,
        payload,
        expected_detail,
    ):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-combined", kwargs={"pk": document.id})
        response = api_client.delete(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert expected_detail in response.data["detail"]

    def test_revoke_permissions_combined_public_warning(
        self,
        api_client,
        lawyer_user,
        client_user,
        document,
    ):
        document.is_public = True
        document.save(update_fields=["is_public"])
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
        url = reverse("revoke-permissions-combined", kwargs={"pk": document.id})
        payload = {"user_ids": [client_user.id], "permission_type": "both"}
        response = api_client.delete(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["warning"]
