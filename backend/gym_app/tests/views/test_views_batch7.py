"""
Batch 7 – Coverage-gap tests for:
  • permission_views.py (93%) – unified manage endpoint, role-based grants,
    revoke by role, combined endpoints, error paths
  • legal_request.py (93%) – filters, date parsing, file validation,
    confirmation email, download file, status update, delete
"""
import json
import os
from io import BytesIO
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    LegalRequest,
    LegalRequestType,
    LegalDiscipline,
    LegalRequestFiles,
    LegalRequestResponse,
)
from gym_app.models.dynamic_document import (
    DynamicDocument,
    DocumentVisibilityPermission,
    DocumentUsabilityPermission,
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
        email="lawyer_b7@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b7@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic_b7@test.com", password="pw", role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Perm Doc B7",
        content="<p>Hello</p>",
        state="Draft",
        created_by=lawyer_user,
        is_public=False,
    )


@pytest.fixture
@pytest.mark.django_db
def req_type():
    return LegalRequestType.objects.create(name="Civil B7")


@pytest.fixture
@pytest.mark.django_db
def discipline():
    return LegalDiscipline.objects.create(name="Penal B7")


@pytest.fixture
@pytest.mark.django_db
def legal_request(client_user, req_type, discipline):
    return LegalRequest.objects.create(
        user=client_user,
        request_type=req_type,
        discipline=discipline,
        description="Test legal request B7",
        status="PENDING",
    )


# ===========================================================================
# 1. permission_views – manage_document_permissions_unified edge cases
# ===========================================================================

@pytest.mark.django_db
class TestManagePermissionsUnified:

    def test_set_public_and_visibility_roles(
        self, api_client, lawyer_user, document, client_user
    ):
        """Lines 204-284: is_public + visibility roles in unified endpoint."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "is_public": True,
            "visibility": {"roles": ["client"]},
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["is_public"] is True
        assert len(resp.data["changes_made"]) >= 1

    def test_visibility_invalid_role(self, api_client, lawyer_user, document):
        """Line 242: invalid role in visibility config."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "visibility": {"roles": ["admin_fake"]},
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert any("Invalid" in e for e in resp.data["errors"])

    def test_visibility_missing_user_ids(self, api_client, lawyer_user, document):
        """Lines 252-255: user_ids with missing users."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "visibility": {"user_ids": [99999]},
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert any("not found" in e for e in resp.data["errors"])

    def test_visibility_exclude_user_ids(
        self, api_client, lawyer_user, document, client_user
    ):
        """Lines 260-263: exclude specific user_ids."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "visibility": {
                "roles": ["client"],
                "exclude_user_ids": [client_user.id],
            },
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_usability_without_visibility_error(
        self, api_client, lawyer_user, document, client_user
    ):
        """Lines 345-357: usability granted without visibility on private doc."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "usability": {"user_ids": [client_user.id]},
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["results"]["usability"]["errors"]) > 0

    def test_usability_with_public_doc_model_still_validates(
        self, api_client, lawyer_user, document, client_user
    ):
        """Line 345: view skips visibility check for public doc, but model
        clean() still enforces it, resulting in a 500 from the generic handler."""
        document.is_public = True
        document.save()
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        resp = api_client.post(url, {
            "usability": {"user_ids": [client_user.id]},
        }, format="json")
        # Model-level ValidationError is caught by the generic except → 500
        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_document_not_found(self, api_client, lawyer_user):
        """Line 404-408: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": 99999})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. permission_views – toggle, grant, revoke endpoints
# ===========================================================================

@pytest.mark.django_db
class TestPermissionEndpoints:

    def test_toggle_public_auto(self, api_client, lawyer_user, document):
        """Lines 447-448: auto-toggle when no is_public provided."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("toggle-public-access", kwargs={"pk": document.id})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["is_public"] is True  # was False, toggled to True

    def test_grant_visibility_empty_user_ids(self, api_client, lawyer_user, document):
        """Line 493-497: empty user_ids."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions", kwargs={"pk": document.id})
        resp = api_client.post(url, {"user_ids": []}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_grant_visibility_missing_users(self, api_client, lawyer_user, document):
        """Lines 501-507: some user_ids not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-visibility-permissions", kwargs={"pk": document.id})
        resp = api_client.post(url, {"user_ids": [99999]}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "not found" in resp.data["detail"]

    def test_grant_usability_no_visibility(
        self, api_client, lawyer_user, document, client_user
    ):
        """Lines 600-611: usability without visibility on private doc."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("grant-usability-permissions", kwargs={"pk": document.id})
        resp = api_client.post(url, {"user_ids": [client_user.id]}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["errors"]) > 0

    def test_revoke_visibility_no_permission(
        self, api_client, lawyer_user, document, client_user
    ):
        """Lines 670-674: revoke visibility that doesn't exist."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-visibility-permission", kwargs={
            "pk": document.id, "user_id": client_user.id
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_usability_no_permission(
        self, api_client, lawyer_user, document, client_user
    ):
        """Lines 718-722: revoke usability that doesn't exist."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-usability-permission", kwargs={
            "pk": document.id, "user_id": client_user.id
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_visibility_user_not_found(self, api_client, lawyer_user, document):
        """Lines 692-696: user not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-visibility-permission", kwargs={
            "pk": document.id, "user_id": 99999
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_revoke_usability_user_not_found(self, api_client, lawyer_user, document):
        """Lines 739-743: user not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("revoke-usability-permission", kwargs={
            "pk": document.id, "user_id": 99999
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_available_clients(self, api_client, lawyer_user, client_user):
        """Lines 749-770: list available clients."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-available-clients")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK
        assert "clients" in resp.data

    def test_get_available_roles(self, api_client, lawyer_user):
        """Lines 776-822: list available roles."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-available-roles")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK
        assert "roles" in resp.data


# ===========================================================================
# 3. legal_request – list filters (search, status, dates)
# ===========================================================================

@pytest.mark.django_db
class TestLegalRequestListFilters:

    def test_list_as_lawyer_sees_all(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 435-438: lawyer sees all requests."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-requests")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["user_role"] == "lawyer"

    def test_list_as_client_sees_own(
        self, api_client, client_user, legal_request
    ):
        """Lines 440-442: client sees only own requests."""
        api_client.force_authenticate(user=client_user)
        url = reverse("list-legal-requests")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["requests"]) >= 1

    def test_list_with_search_filter(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 446-453: search filter."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-requests")
        resp = api_client.get(url, {"search": "Test legal"})
        assert resp.status_code == status.HTTP_200_OK

    def test_list_with_status_filter(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 457-458: status filter."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-requests")
        resp = api_client.get(url, {"status": "PENDING"})
        assert resp.status_code == status.HTTP_200_OK

    def test_list_with_date_filters(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 464-480: date_from and date_to filters."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-requests")
        resp = api_client.get(url, {"date_from": "2020-01-01", "date_to": "2030-12-31"})
        assert resp.status_code == status.HTTP_200_OK

    def test_list_with_invalid_date_format(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 470-471, 479-480: invalid date format."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list-legal-requests")
        resp = api_client.get(url, {"date_from": "bad-date", "date_to": "also-bad"})
        assert resp.status_code == status.HTTP_200_OK  # doesn't fail, just skips


# ===========================================================================
# 4. legal_request – status update, responses, delete
# ===========================================================================

@pytest.mark.django_db
class TestLegalRequestActions:

    def test_update_status_non_lawyer_forbidden(
        self, api_client, client_user, legal_request
    ):
        """Lines 572-576: non-lawyer cannot update status."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update-legal-request-status", kwargs={"request_id": legal_request.id})
        resp = api_client.put(url, {"status": "IN_REVIEW"}, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_update_status_missing_status(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 583-587: missing status field."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-legal-request-status", kwargs={"request_id": legal_request.id})
        resp = api_client.put(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_status_invalid_status(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 591-595: invalid status value."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-legal-request-status", kwargs={"request_id": legal_request.id})
        resp = api_client.put(url, {"status": "INVALID_STATUS"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @patch("gym_app.views.legal_request.send_status_update_notification")
    def test_update_status_success(
        self, mock_notify, api_client, lawyer_user, legal_request
    ):
        """Lines 598-616: successful status update."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-legal-request-status", kwargs={"request_id": legal_request.id})
        resp = api_client.put(url, {"status": "IN_REVIEW"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "IN_REVIEW" in resp.data["message"]

    @patch("gym_app.views.legal_request.notify_client_of_lawyer_response")
    def test_create_response_lawyer_auto_updates_status(
        self, mock_notify, api_client, lawyer_user, legal_request
    ):
        """Lines 664-668: lawyer response auto-updates PENDING → IN_REVIEW."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-legal-request-response", kwargs={"request_id": legal_request.id})
        resp = api_client.post(url, {"response_text": "Reviewing"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED
        legal_request.refresh_from_db()
        assert legal_request.status == "IN_REVIEW"

    @patch("gym_app.views.legal_request.notify_lawyers_of_client_response")
    def test_create_response_client(
        self, mock_notify, api_client, client_user, legal_request
    ):
        """Lines 677-679: client response."""
        api_client.force_authenticate(user=client_user)
        url = reverse("create-legal-request-response", kwargs={"request_id": legal_request.id})
        resp = api_client.post(url, {"response_text": "Client reply"}, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_response_no_permission(
        self, api_client, basic_user, legal_request
    ):
        """Lines 641-645: user without permission to respond."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("create-legal-request-response", kwargs={"request_id": legal_request.id})
        resp = api_client.post(url, {"response_text": "Nope"}, format="json")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_create_response_empty_text(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 649-653: empty response text."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("create-legal-request-response", kwargs={"request_id": legal_request.id})
        resp = api_client.post(url, {"response_text": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_legal_request_non_lawyer(
        self, api_client, client_user, legal_request
    ):
        """Lines 711-715: non-lawyer cannot delete."""
        api_client.force_authenticate(user=client_user)
        url = reverse("delete-legal-request", kwargs={"request_id": legal_request.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_legal_request_success(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 718-728: lawyer deletes request."""
        req_id = legal_request.id
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-legal-request", kwargs={"request_id": req_id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        assert not LegalRequest.objects.filter(id=req_id).exists()


# ===========================================================================
# 5. legal_request – confirmation email
# ===========================================================================

@pytest.mark.django_db
class TestConfirmationEmail:

    def test_missing_legal_request_id(self, api_client, lawyer_user):
        """Lines 348-349: missing legal_request_id."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("send-confirmation-email")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_legal_request_not_found(self, api_client, lawyer_user):
        """Lines 354-355: legal request not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("send-confirmation-email")
        resp = api_client.post(url, {"legal_request_id": 99999}, format="json")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    @patch("gym_app.views.legal_request.send_template_email")
    def test_send_confirmation_success(
        self, mock_send, api_client, lawyer_user, legal_request
    ):
        """Lines 378-398: successful email send."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("send-confirmation-email")
        resp = api_client.post(
            url, {"legal_request_id": legal_request.id}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK
        mock_send.assert_called_once()

    @patch("gym_app.views.legal_request.send_template_email", side_effect=Exception("SMTP"))
    def test_send_confirmation_email_failure(
        self, mock_send, api_client, lawyer_user, legal_request
    ):
        """Lines 400-405: email sending fails."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("send-confirmation-email")
        resp = api_client.post(
            url, {"legal_request_id": legal_request.id}, format="json"
        )
        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR


# ===========================================================================
# 6. legal_request – get_or_delete, add files, download file edge cases
# ===========================================================================

@pytest.mark.django_db
class TestLegalRequestDetailEdges:

    def test_get_detail_no_permission(
        self, api_client, basic_user, legal_request
    ):
        """Lines 520-525: non-owner non-lawyer cannot view."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("get-or-delete-legal-request", kwargs={"request_id": legal_request.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_via_combined_endpoint_non_lawyer(
        self, api_client, client_user, legal_request
    ):
        """Lines 536-540: only lawyers can delete via combined endpoint."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-or-delete-legal-request", kwargs={"request_id": legal_request.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_via_combined_endpoint_success(
        self, api_client, lawyer_user, legal_request
    ):
        """Lines 542-551: lawyer deletes via combined endpoint."""
        req_id = legal_request.id
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-or-delete-legal-request", kwargs={"request_id": req_id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_add_files_non_owner_forbidden(
        self, api_client, basic_user, legal_request
    ):
        """Lines 753-758: non-owner cannot add files."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("add-files-to-legal-request", kwargs={"request_id": legal_request.id})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_add_files_closed_request(
        self, api_client, client_user, legal_request
    ):
        """Lines 769-773: cannot add files to closed request."""
        legal_request.status = "CLOSED"
        legal_request.save()
        api_client.force_authenticate(user=client_user)
        url = reverse("add-files-to-legal-request", kwargs={"request_id": legal_request.id})
        f = SimpleUploadedFile("test.pdf", b"%PDF-content", content_type="application/pdf")
        resp = api_client.post(url, {"files": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_download_file_no_permission(
        self, api_client, basic_user, legal_request
    ):
        """Lines 833-838: non-owner non-lawyer cannot download."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("download-legal-request-file", kwargs={
            "request_id": legal_request.id, "file_id": 1
        })
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN
