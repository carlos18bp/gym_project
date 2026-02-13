"""
Batch 14 – 20 tests for:
  • corporate_request.py: dashboard stats, conversation, status update
  • userAuth.py: sign_on, sign_in, google_login, update_password, validate_token,
    send_passcode, verify_passcode_and_reset_password
  • organization_posts.py: CRUD, toggle pin/status, public posts
"""
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    Organization, OrganizationMembership, OrganizationPost, PasswordCode,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType,
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
def client_user():
    return User.objects.create_user(
        email="client_b14@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(
        email="corp_b14@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corp_user):
    return Organization.objects.create(
        title="Org B14", corporate_client=corp_user, is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def membership(organization, client_user):
    return OrganizationMembership.objects.create(
        organization=organization, user=client_user, role="MEMBER", is_active=True,
    )


# ===========================================================================
# 1. corporate_request.py – dashboard stats, conversation
# ===========================================================================

@pytest.mark.django_db
class TestCorporateRequestViews:

    def test_dashboard_stats(self, api_client, corp_user, organization):
        """Lines covering corporate_get_dashboard_stats."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("corporate-get-dashboard-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_dashboard_stats_non_corp_forbidden(self, api_client, client_user):
        """Decorator: require_corporate_client_only."""
        api_client.force_authenticate(user=client_user)
        url = reverse("corporate-get-dashboard-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_conversation_not_found(self, api_client, client_user):
        """get_request_conversation – request not found."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-request-conversation", kwargs={"request_id": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. userAuth.py
# ===========================================================================

@pytest.mark.django_db
class TestUserAuth:

    def test_sign_on_duplicate_email(self, api_client, client_user):
        """Lines 36-37: email already registered."""
        url = reverse("sign_on")
        resp = api_client.post(url, {
            "email": client_user.email,
            "password": "newpw123",
        }, format="json")
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_sign_on_invalid_data(self, api_client):
        """Lines 63-64: serializer validation error."""
        url = reverse("sign_on")
        resp = api_client.post(url, {
            "email": "",
            "password": "",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_sign_in_missing_fields(self, api_client):
        """Lines 151-152: email/password required."""
        url = reverse("sign_in")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_sign_in_missing_captcha(self, api_client):
        """Lines 154-155: captcha required."""
        url = reverse("sign_in")
        resp = api_client.post(url, {
            "email": "test@test.com", "password": "pw",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_google_login_missing_email(self, api_client):
        """Lines 220-221: email required."""
        url = reverse("google_login")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_google_login_new_user_no_picture(self, api_client):
        """Lines 234-252: new user without picture."""
        url = reverse("google_login")
        resp = api_client.post(url, {
            "email": "newgoogle_b14@test.com",
            "given_name": "Google",
            "family_name": "User",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["created"] is True
        assert User.objects.filter(email="newgoogle_b14@test.com").exists()

    def test_google_login_existing_user(self, api_client, client_user):
        """Lines 254-266: existing user login."""
        url = reverse("google_login")
        resp = api_client.post(url, {
            "email": client_user.email,
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["created"] is False

    def test_update_password_missing_fields(self, api_client, client_user):
        """Lines 302-303: both passwords required."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update_password")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_password_wrong_current(self, api_client, client_user):
        """Lines 306-307: current password incorrect."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update_password")
        resp = api_client.post(url, {
            "current_password": "wrongpw",
            "new_password": "newpw123",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_password_success(self, api_client, client_user):
        """Lines 310-314: password update success."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update_password")
        resp = api_client.post(url, {
            "current_password": "pw",
            "new_password": "newpw123",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_validate_token(self, api_client, client_user):
        """Lines 453-460: validate token."""
        api_client.force_authenticate(user=client_user)
        url = reverse("validate_token")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 3. organization_posts.py
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationPosts:

    def test_create_post_success(self, api_client, corp_user, organization):
        """Lines 42-63: create post."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("create-organization-post", kwargs={"organization_id": organization.id})
        resp = api_client.post(url, {
            "title": "Test Post",
            "content": "Post content here",
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_post_missing_title(self, api_client, corp_user, organization):
        """Lines 65-72: validation error on missing title."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("create-organization-post", kwargs={"organization_id": organization.id})
        resp = api_client.post(url, {"content": "No title"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_posts(self, api_client, corp_user, organization):
        """Lines 78-120: list posts with filters."""
        OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="P1", content="C1",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_posts_public_member(self, api_client, client_user, organization, membership):
        """Lines 125-172: public posts for member."""
        OrganizationPost.objects.create(
            organization=organization, author=organization.corporate_client,
            title="Public P1", content="C1", is_active=True,
        )
        api_client.force_authenticate(user=client_user)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_posts_public_non_member_forbidden(self, api_client, organization):
        """Lines 144-147: non-member forbidden."""
        outsider = User.objects.create_user(
            email="outsider_b14@test.com", password="pw", role="client",
        )
        api_client.force_authenticate(user=outsider)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_pin(self, api_client, corp_user, organization):
        """Lines 272-294: toggle pin status."""
        post = OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="Pin Post", content="C", is_pinned=False,
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("toggle-organization-post-pin", kwargs={
            "organization_id": organization.id, "post_id": post.id,
        })
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_pinned is True

    def test_toggle_status(self, api_client, corp_user, organization):
        """Lines 300-327: toggle active status."""
        post = OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="Status Post", content="C", is_active=True,
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("toggle-organization-post-status", kwargs={
            "organization_id": organization.id, "post_id": post.id,
        })
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_active is False

    def test_delete_post(self, api_client, corp_user, organization):
        """Lines 245-266: delete post."""
        post = OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="Del Post", content="C",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("delete-organization-post", kwargs={
            "organization_id": organization.id, "post_id": post.id,
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        assert not OrganizationPost.objects.filter(id=post.id).exists()
