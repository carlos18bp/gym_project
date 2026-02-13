"""
Batch 11 – 20 tests for permission_views.py role-based and combined endpoints.

Targets uncovered lines:
  - grant_usability_permissions_by_role (915-1013)
  - revoke_permissions_by_role (1019-1117)
  - grant_visibility_permissions_combined (1123-1236)
  - grant_usability_permissions_combined (1242-1374)
  - revoke_permissions_combined (1380-1510)
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentVisibilityPermission, DocumentUsabilityPermission,
)

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
        email="lawyer_b11@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b11@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc B11", content="<p>Hello</p>", state="Draft",
        created_by=lawyer_user,
    )


# ===========================================================================
# 1. grant_usability_permissions_by_role
# ===========================================================================

@pytest.mark.django_db
class TestGrantUsabilityByRole:

    def test_empty_roles(self, api_client, lawyer_user, document):
        """Line 934-938: empty roles list."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.post(url, {"roles": []}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_roles(self, api_client, lawyer_user, document):
        """Lines 943-947: invalid role name."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.post(url, {"roles": ["superadmin"]}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_grant_usability_requires_visibility(self, api_client, lawyer_user, document, client_user):
        """Lines 960-972: user without visibility gets error."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["errors"]) >= 1

    def test_grant_usability_with_visibility(self, api_client, lawyer_user, document, client_user):
        """Lines 974-993: user with visibility gets usability."""
        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer_user
        )
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["granted_permissions"]) >= 1

    def test_grant_usability_doc_not_found(self, api_client, lawyer_user):
        """Lines 1009-1013: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": 99999})
        resp = api_client.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. revoke_permissions_by_role
# ===========================================================================

@pytest.mark.django_db
class TestRevokePermissionsByRole:

    def test_empty_roles(self, api_client, lawyer_user, document):
        """Lines 1037-1041: empty roles list."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.delete(url, {"roles": []}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_roles(self, api_client, lawyer_user, document):
        """Lines 1045-1050: invalid role."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.delete(url, {"roles": ["admin"]}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_permission_type(self, api_client, lawyer_user, document):
        """Lines 1053-1058: invalid permission_type."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.delete(url, {"roles": ["client"], "permission_type": "invalid"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_revoke_visibility_by_role(self, api_client, lawyer_user, document, client_user):
        """Lines 1074-1078: revoke visibility."""
        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer_user
        )
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": document.id})
        resp = api_client.delete(url, {"roles": ["client"], "permission_type": "visibility"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["total_visibility_revoked"] >= 1

    def test_revoke_doc_not_found(self, api_client, lawyer_user):
        """Lines 1113-1117: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": 99999})
        resp = api_client.delete(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 3. grant_visibility_permissions_combined
# ===========================================================================

@pytest.mark.django_db
class TestGrantVisibilityCombined:

    def test_empty_input(self, api_client, lawyer_user, document):
        """Lines 1142-1146: neither user_ids nor roles."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_roles(self, api_client, lawyer_user, document):
        """Lines 1151-1156: invalid role."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {"roles": ["superuser"]}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_user_ids(self, api_client, lawyer_user, document):
        """Lines 1164-1170: user_ids with non-existent IDs."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {"user_ids": [99999]}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_grant_combined_success(self, api_client, lawyer_user, document, client_user):
        """Lines 1188-1213: grant to user_ids + roles."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "user_ids": [client_user.id],
            "roles": ["client"],
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_grant_combined_with_exclude(self, api_client, lawyer_user, document, client_user):
        """Lines 1180-1182: exclude user IDs."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "roles": ["client"],
            "exclude_user_ids": [client_user.id],
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 4. grant_usability_permissions_combined
# ===========================================================================

@pytest.mark.django_db
class TestGrantUsabilityCombined:

    def test_empty_input(self, api_client, lawyer_user, document):
        """Lines 1262-1266: no user_ids or roles."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_user_ids(self, api_client, lawyer_user, document):
        """Lines 1284-1290: user not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {"user_ids": [99999]}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_grant_usability_combined_no_visibility(self, api_client, lawyer_user, document, client_user):
        """Lines 1316-1328: user without visibility gets error."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.post(url, {"user_ids": [client_user.id]}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data.get("errors", [])) >= 1


# ===========================================================================
# 5. revoke_permissions_combined
# ===========================================================================

@pytest.mark.django_db
class TestRevokePermissionsCombined:

    def test_empty_input(self, api_client, lawyer_user, document):
        """Lines 1401-1405: no user_ids or roles."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.delete(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_permission_type(self, api_client, lawyer_user, document):
        """Lines 1418-1423: invalid permission_type."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.delete(url, {
            "user_ids": [1], "permission_type": "invalid"
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_revoke_combined_success(self, api_client, lawyer_user, document, client_user):
        """Lines 1456-1485: revoke by user_ids."""
        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer_user
        )
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-permissions-combined", kwargs={"pk": document.id})
        resp = api_client.delete(url, {
            "user_ids": [client_user.id],
            "permission_type": "visibility",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["total_visibility_revoked"] >= 1
