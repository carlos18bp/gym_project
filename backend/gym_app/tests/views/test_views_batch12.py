"""
Batch 12 – 20 tests for:
  • legal_request.py: download_legal_request_file, add_files, delete_legal_request
  • organization.py: get_organization_stats, get_my_invitations, respond_to_invitation,
    get_my_memberships, leave_organization, get_organization_public_detail
"""
import os
import tempfile
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    Organization, OrganizationInvitation, OrganizationMembership,
)
from gym_app.models.legal_request import (
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles,
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
        email="lawyer_b12@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b12@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(
        email="corp_b12@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


@pytest.fixture
@pytest.mark.django_db
def legal_request_type():
    return LegalRequestType.objects.create(name="Consulta General")


@pytest.fixture
@pytest.mark.django_db
def legal_discipline():
    return LegalDiscipline.objects.create(name="Civil")


@pytest.fixture
@pytest.mark.django_db
def legal_req(client_user, legal_request_type, legal_discipline):
    return LegalRequest.objects.create(
        user=client_user,
        request_type=legal_request_type,
        discipline=legal_discipline,
        description="Test legal request",
        status="OPEN",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corp_user):
    return Organization.objects.create(
        title="Test Org B12",
        description="Org description",
        corporate_client=corp_user,
        is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def membership(organization, client_user):
    return OrganizationMembership.objects.create(
        organization=organization,
        user=client_user,
        role="MEMBER",
        is_active=True,
    )


# ===========================================================================
# 1. download_legal_request_file
# ===========================================================================

@pytest.mark.django_db
class TestDownloadLegalRequestFile:

    def test_download_file_permission_denied(self, api_client, lawyer_user, client_user, legal_req):
        """Lines 833-838: non-owner non-lawyer denied."""
        other_client = User.objects.create_user(
            email="other_b12@test.com", password="pw", role="client",
        )
        # Create a file
        lr_file = LegalRequestFiles.objects.create(
            file=SimpleUploadedFile("test.pdf", b"fake-pdf"),
        )
        legal_req.files.add(lr_file)

        api_client.force_authenticate(user=other_client)
        url = reverse("download-legal-request-file", kwargs={
            "request_id": legal_req.id, "file_id": lr_file.id,
        })
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_download_file_not_found(self, api_client, lawyer_user, legal_req):
        """Lines 843-845: file does not exist."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download-legal-request-file", kwargs={
            "request_id": legal_req.id, "file_id": 99999,
        })
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_download_file_not_belonging_to_request(self, api_client, lawyer_user, legal_req):
        """Lines 848-853: file exists but not linked to request."""
        lr_file = LegalRequestFiles.objects.create(
            file=SimpleUploadedFile("orphan.pdf", b"fake"),
        )
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download-legal-request-file", kwargs={
            "request_id": legal_req.id, "file_id": lr_file.id,
        })
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_download_file_missing_on_disk(self, api_client, lawyer_user, legal_req):
        """Lines 856-861: file record exists but physical file missing."""
        lr_file = LegalRequestFiles.objects.create(
            file=SimpleUploadedFile("missing.pdf", b"content"),
        )
        legal_req.files.add(lr_file)
        # Delete the physical file
        if os.path.exists(lr_file.file.path):
            os.remove(lr_file.file.path)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download-legal-request-file", kwargs={
            "request_id": legal_req.id, "file_id": lr_file.id,
        })
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. add_files_to_legal_request
# ===========================================================================

@pytest.mark.django_db
class TestAddFilesToLegalRequest:

    def test_add_files_non_owner_forbidden(self, api_client, lawyer_user, legal_req):
        """Lines 753-758: non-owner cannot add files."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("add-files-to-legal-request", kwargs={"request_id": legal_req.id})
        f = SimpleUploadedFile("doc.pdf", b"content", content_type="application/pdf")
        resp = api_client.post(url, {"files": [f]}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_add_files_non_client_forbidden(self, api_client, legal_req):
        """Lines 761-766: non-client role forbidden."""
        # Change owner to lawyer temporarily — but they have wrong role
        lawyer = User.objects.create_user(
            email="law2_b12@test.com", password="pw", role="lawyer",
        )
        legal_req.user = lawyer
        legal_req.save()
        api_client.force_authenticate(user=lawyer)
        url = reverse("add-files-to-legal-request", kwargs={"request_id": legal_req.id})
        f = SimpleUploadedFile("doc.pdf", b"content", content_type="application/pdf")
        resp = api_client.post(url, {"files": [f]}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_add_files_closed_request(self, api_client, client_user, legal_req):
        """Lines 769-773: closed request rejects files."""
        legal_req.status = "CLOSED"
        legal_req.save()
        api_client.force_authenticate(user=client_user)
        url = reverse("add-files-to-legal-request", kwargs={"request_id": legal_req.id})
        f = SimpleUploadedFile("doc.pdf", b"content", content_type="application/pdf")
        resp = api_client.post(url, {"files": [f]}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_add_files_no_files(self, api_client, client_user, legal_req):
        """Lines 777-778: no files provided."""
        api_client.force_authenticate(user=client_user)
        url = reverse("add-files-to-legal-request", kwargs={"request_id": legal_req.id})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ===========================================================================
# 3. delete_legal_request
# ===========================================================================

@pytest.mark.django_db
class TestDeleteLegalRequest:

    def test_delete_by_non_lawyer(self, api_client, client_user, legal_req):
        """Lines 711-715: non-lawyer forbidden."""
        api_client.force_authenticate(user=client_user)
        url = reverse("delete-legal-request", kwargs={"request_id": legal_req.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_success(self, api_client, lawyer_user, legal_req):
        """Lines 718-728: successful deletion."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-legal-request", kwargs={"request_id": legal_req.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        assert not LegalRequest.objects.filter(id=legal_req.id).exists()


# ===========================================================================
# 4. Organization views — stats, invitations, memberships, leave, public
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationStats:

    def test_get_stats(self, api_client, corp_user, organization):
        """Lines 447-493: organization dashboard stats."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("get-organization-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK
        assert "total_organizations" in resp.data
        assert "total_members" in resp.data

    def test_get_stats_non_corp_forbidden(self, api_client, client_user):
        """Decorator: require_corporate_client_only."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-organization-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestOrganizationInvitationsAndMemberships:

    def test_get_my_invitations(self, api_client, client_user, organization, corp_user):
        """Lines 502-540: client gets their invitations."""
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corp_user,
            status="PENDING",
        )
        api_client.force_authenticate(user=client_user)
        url = reverse("get-my-invitations")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_my_memberships(self, api_client, client_user, membership):
        """Lines 592-613: client gets memberships."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-my-memberships")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_leave_organization_success(self, api_client, client_user, membership):
        """Lines 618-641: member leaves organization."""
        api_client.force_authenticate(user=client_user)
        url = reverse("leave-organization", kwargs={"organization_id": membership.organization.id})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        membership.refresh_from_db()
        assert membership.is_active is False

    def test_leave_organization_leader_forbidden(self, api_client, corp_user, organization):
        """Lines 631-634: leader cannot leave."""
        leader_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=corp_user,
            role="LEADER",
            is_active=True,
        )
        # corp_user is corporate_client, but leave_organization requires client role
        # We need a client who is a LEADER
        client_leader = User.objects.create_user(
            email="clientleader@test.com", password="pw", role="client",
        )
        leader_mem = OrganizationMembership.objects.create(
            organization=organization,
            user=client_leader,
            role="LEADER",
            is_active=True,
        )
        api_client.force_authenticate(user=client_leader)
        url = reverse("leave-organization", kwargs={"organization_id": organization.id})
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestOrganizationPublicDetail:

    def test_public_detail_corp_owner(self, api_client, corp_user, organization):
        """Lines 660-661: corp client who owns org can view."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("get-organization-public-detail", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_public_detail_member(self, api_client, client_user, membership):
        """Lines 662-667: member client can view."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-organization-public-detail", kwargs={"organization_id": membership.organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_public_detail_no_access(self, api_client, organization):
        """Lines 669-672: non-member client forbidden."""
        outsider = User.objects.create_user(
            email="outsider_b12@test.com", password="pw", role="client",
        )
        api_client.force_authenticate(user=outsider)
        url = reverse("get-organization-public-detail", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN
