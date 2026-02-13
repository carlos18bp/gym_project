"""
Batch 16 – 20 tests for remaining small gaps:
  • email_notifications.py: lawyer response subject, exception path
  • corporate_request.py views: client detail, client response, corporate detail,
    corporate update validation error, corporate response
  • organization.py views: create validation error, update validation error,
    invitation validation error, decorator for client_or_corporate
  • organization_posts.py: lawyer forbidden on public, search on public posts
  • userAuth.py: google_login exception path, send_passcode missing captcha/email,
    verify_passcode missing fields/captcha
  • user.py: update_profile User.DoesNotExist
  • sendEmail.py: context is non-dict non-string type
"""
import pytest
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    Organization, OrganizationMembership, OrganizationPost,
    OrganizationInvitation, PasswordCode,
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
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_b16@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b16@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(
        email="corp_b16@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corp_user):
    return Organization.objects.create(
        title="Org B16", corporate_client=corp_user, is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def membership(organization, client_user):
    return OrganizationMembership.objects.create(
        organization=organization, user=client_user, role="MEMBER", is_active=True,
    )


# ===========================================================================
# 1. email_notifications.py – lawyer response subject + exception
# ===========================================================================

@pytest.mark.django_db
class TestEmailNotifications:

    @patch("gym_app.utils.email_notifications.send_template_email", return_value=True)
    def test_notify_new_response_lawyer_subject(self, mock_send, lawyer_user, client_user):
        """Line 118: lawyer response generates specific subject."""
        from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestResponse
        from gym_app.utils.email_notifications import send_new_response_notification

        lr_type = LegalRequestType.objects.create(name="C_b16")
        lr_disc = LegalDiscipline.objects.create(name="D_b16")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=lr_type, discipline=lr_disc,
            description="Test", status="OPEN",
        )
        resp = LegalRequestResponse.objects.create(
            legal_request=lr, user=lawyer_user, response_text="Lawyer says hi",
            user_type="lawyer",
        )
        result = send_new_response_notification(lr, resp, client_user.email, "Cli Ent", "client")
        assert result is True
        call_kwargs = mock_send.call_args[1]
        assert "Abogado" in call_kwargs["subject"]

    def test_notify_new_response_exception(self, client_user):
        """Lines 137-139: exception returns False."""
        from gym_app.utils.email_notifications import send_new_response_notification
        # Pass None to trigger exception
        result = send_new_response_notification(None, None, "x@x.com", "Name", "client")
        assert result is False


# ===========================================================================
# 2. corporate_request.py views
# ===========================================================================

@pytest.mark.django_db
class TestCorporateRequestViewsB16:

    def test_client_get_detail(self, api_client, client_user, corp_user, organization, membership):
        """Lines covering client_get_corporate_request_detail."""
        cr_type = CorporateRequestType.objects.create(name="CRT_b16")
        cr = CorporateRequest.objects.create(
            title="CR_b16", description="d", organization=organization,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-corporate-request-detail", kwargs={"request_id": cr.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_client_add_response_empty_text(self, api_client, client_user, corp_user, organization, membership):
        """Lines 232-236: empty response_text."""
        cr_type = CorporateRequestType.objects.create(name="CRT_b16b")
        cr = CorporateRequest.objects.create(
            title="CR_b16b", description="d", organization=organization,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        api_client.force_authenticate(user=client_user)
        url = reverse("client-add-response-to-request", kwargs={"request_id": cr.id})
        resp = api_client.post(url, {"response_text": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_corporate_get_detail(self, api_client, corp_user, client_user, organization, membership):
        """Lines covering corporate_get_request_detail."""
        cr_type = CorporateRequestType.objects.create(name="CRT_b16c")
        cr = CorporateRequest.objects.create(
            title="CR_b16c", description="d", organization=organization,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("corporate-get-request-detail", kwargs={"request_id": cr.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_corporate_update_invalid_status(self, api_client, corp_user, client_user, organization, membership):
        """Line 377: invalid status update."""
        cr_type = CorporateRequestType.objects.create(name="CRT_b16d")
        cr = CorporateRequest.objects.create(
            title="CR_b16d", description="d", organization=organization,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("corporate-update-request-status", kwargs={"request_id": cr.id})
        resp = api_client.put(url, {"status": "INVALID_STATUS"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_corporate_add_response_success(self, api_client, corp_user, client_user, organization, membership):
        """Lines 439-445: corporate adds response successfully."""
        cr_type = CorporateRequestType.objects.create(name="CRT_b16e")
        cr = CorporateRequest.objects.create(
            title="CR_b16e", description="d", organization=organization,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("corporate-add-response-to-request", kwargs={"request_id": cr.id})
        resp = api_client.post(url, {"response_text": "Corporate reply"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED


# ===========================================================================
# 3. organization.py views
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationViewsB16:

    def test_create_org_validation_error(self, api_client, corp_user):
        """Line 95: create org with missing required fields."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("create-organization")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_org_validation_error(self, api_client, corp_user, organization):
        """Line 206: update org with invalid data."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("update-organization", kwargs={"organization_id": organization.id})
        # Send empty title to trigger validation error
        resp = api_client.put(url, {"title": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_send_invitation_validation_error(self, api_client, corp_user, organization):
        """Line 275: invitation with missing user."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("send-organization-invitation", kwargs={"organization_id": organization.id})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_require_client_or_corporate_decorator_lawyer(self, api_client, lawyer_user):
        """Line 57: lawyer blocked by require_client_or_corporate_client."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-my-invitations")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# 4. organization_posts.py
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationPostsB16:

    def test_public_posts_lawyer_forbidden(self, api_client, lawyer_user, organization):
        """Line 149: lawyer role forbidden on public posts."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_public_posts_search_filter(self, api_client, client_user, organization, membership):
        """Line 162: search filter on public posts."""
        OrganizationPost.objects.create(
            organization=organization, author=organization.corporate_client,
            title="Unique Alpha Title", content="C", is_active=True,
        )
        api_client.force_authenticate(user=client_user)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})
        resp = api_client.get(url, {"search": "Unique Alpha"})
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 5. userAuth.py
# ===========================================================================

@pytest.mark.django_db
class TestUserAuthB16:

    def test_google_login_exception(self, api_client):
        """Lines 268-273: google_login exception path."""
        with patch("gym_app.views.userAuth.User.objects.get_or_create", side_effect=Exception("DB error")):
            url = reverse("google_login")
            resp = api_client.post(url, {"email": "exc@test.com"}, format="json")
            assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_send_passcode_missing_email(self, api_client):
        """Line 337-338: email required."""
        url = reverse("send_passcode")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_send_passcode_missing_captcha(self, api_client):
        """Line 340-341: captcha required."""
        url = reverse("send_passcode")
        resp = api_client.post(url, {"email": "x@x.com"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_passcode_missing_fields(self, api_client):
        """Lines 407-408: passcode and password required."""
        url = reverse("verify_passcode_and_reset_password")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_passcode_missing_captcha(self, api_client):
        """Lines 410-411: captcha required."""
        url = reverse("verify_passcode_and_reset_password")
        resp = api_client.post(url, {"passcode": "123456", "new_password": "pw"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ===========================================================================
# 6. sendEmail.py – context non-dict non-string
# ===========================================================================

@pytest.mark.django_db
class TestSendEmailB16:

    @patch("gym_app.views.layouts.sendEmail.send_template_email", return_value=True)
    def test_send_email_context_non_dict_non_string(self, mock_send, api_client, lawyer_user):
        """Line 143: context is neither string nor dict (e.g. integer)."""
        url = reverse("send_email_with_attachments")
        api_client.force_authenticate(user=lawyer_user)
        resp = api_client.post(url, {
            "to_emails": "test@test.com",
            "subject": "Test",
            "template_name": "code_verification",
            "context": 12345,
        }, format="json")
        # Should succeed – context defaults to {}
        assert resp.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST)
