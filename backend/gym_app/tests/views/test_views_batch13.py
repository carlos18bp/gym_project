"""
Batch 13 – 20 tests for:
  • admin.py: custom admin methods (get_primary_client, get_user_name, get_response_preview,
    get_client_name, get_corporate_client_name, get_assigned_to_name, get_member_count,
    get_pending_invitations_count, get_invited_user_name, get_invited_by_name, get_is_expired,
    get_document_count, get_author_name, has_link, get_queryset, get_app_list)
  • reports.py: generate_excel_report endpoint coverage
"""
import pytest
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.admin import (
    ProcessAdmin, LegalRequestAdmin, LegalRequestResponseAdmin,
    CorporateRequestAdmin, CorporateRequestResponseAdmin,
    OrganizationAdmin, OrganizationInvitationAdmin, OrganizationMembershipAdmin,
    OrganizationPostAdmin, TagAdmin, DocumentFolderAdmin, DynamicDocumentAdmin,
    GyMAdminSite,
)
from gym_app.models import (
    Process, Case, Stage, User as UserModel,
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestResponse,
    Organization, OrganizationInvitation, OrganizationMembership, OrganizationPost,
    DynamicDocument, Tag, DocumentFolder,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType, CorporateRequestResponse,
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
        email="lawyer_b13@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b13@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(
        email="corp_b13@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


# ===========================================================================
# 1. admin.py custom methods
# ===========================================================================

@pytest.mark.django_db
class TestProcessAdminMethods:

    def test_get_primary_client_with_client(self, lawyer_user, client_user):
        """Lines 109-116: get_primary_client returns name + email."""
        case = Case.objects.create(type="Civil")
        proc = Process.objects.create(
            ref="P-001", authority="Juzgado", plaintiff="A", defendant="B",
            lawyer=lawyer_user, case=case,
        )
        proc.clients.add(client_user)
        admin_obj = ProcessAdmin(Process, None)
        result = admin_obj.get_primary_client(proc)
        assert client_user.email in result
        assert "Cli" in result

    def test_get_primary_client_no_clients(self, lawyer_user):
        """Line 112-113: no clients returns None."""
        case = Case.objects.create(type="Penal")
        proc = Process.objects.create(
            ref="P-002", authority="Juzgado", plaintiff="A", defendant="B",
            lawyer=lawyer_user, case=case,
        )
        admin_obj = ProcessAdmin(Process, None)
        result = admin_obj.get_primary_client(proc)
        assert result is None


@pytest.mark.django_db
class TestLegalRequestAdminMethods:

    def test_get_user_name(self, client_user):
        """Lines 146-149: user full name."""
        lr_type = LegalRequestType.objects.create(name="Consulta")
        lr_disc = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=lr_type, discipline=lr_disc,
            description="Test", status="OPEN",
        )
        admin_obj = LegalRequestAdmin(LegalRequest, None)
        result = admin_obj.get_user_name(lr)
        assert "Cli" in result

    def test_get_user_email(self, client_user):
        """Lines 152-154: user email."""
        lr_type = LegalRequestType.objects.create(name="Consulta2")
        lr_disc = LegalDiscipline.objects.create(name="Civil2")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=lr_type, discipline=lr_disc,
            description="Test", status="OPEN",
        )
        admin_obj = LegalRequestAdmin(LegalRequest, None)
        assert admin_obj.get_user_email(lr) == client_user.email


@pytest.mark.django_db
class TestLegalRequestResponseAdminMethods:

    def test_get_response_preview_short(self, client_user):
        """Lines 202-204: short response text returned as-is."""
        lr_type = LegalRequestType.objects.create(name="C3")
        lr_disc = LegalDiscipline.objects.create(name="D3")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=lr_type, discipline=lr_disc,
            description="T", status="OPEN",
        )
        resp = LegalRequestResponse.objects.create(
            legal_request=lr, user=client_user, response_text="Short reply",
            user_type="client",
        )
        admin_obj = LegalRequestResponseAdmin(LegalRequestResponse, None)
        result = admin_obj.get_response_preview(resp)
        assert result == "Short reply"

    def test_get_response_preview_long(self, client_user):
        """Lines 202-204: long response text gets truncated."""
        lr_type = LegalRequestType.objects.create(name="C4")
        lr_disc = LegalDiscipline.objects.create(name="D4")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=lr_type, discipline=lr_disc,
            description="T", status="OPEN",
        )
        long_text = "A" * 200
        resp = LegalRequestResponse.objects.create(
            legal_request=lr, user=client_user, response_text=long_text,
            user_type="client",
        )
        admin_obj = LegalRequestResponseAdmin(LegalRequestResponse, None)
        result = admin_obj.get_response_preview(resp)
        assert result.endswith("...")
        assert len(result) == 103


@pytest.mark.django_db
class TestCorporateRequestAdminMethods:

    def test_get_client_and_corporate_names(self, client_user, corp_user):
        """Lines 225-238: client, corporate client, assigned_to names."""
        org = Organization.objects.create(
            title="Org", corporate_client=corp_user, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True,
        )
        cr_type = CorporateRequestType.objects.create(name="CR Type")
        cr = CorporateRequest.objects.create(
            title="CR", description="desc", organization=org,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        admin_obj = CorporateRequestAdmin(CorporateRequest, None)
        assert client_user.email in admin_obj.get_client_name(cr)
        assert corp_user.email in admin_obj.get_corporate_client_name(cr)
        assert admin_obj.get_assigned_to_name(cr) == "No asignado"

    def test_get_assigned_to_name_with_assignment(self, client_user, corp_user, lawyer_user):
        """Line 236: assigned_to with a user."""
        org = Organization.objects.create(
            title="Org2", corporate_client=corp_user, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True,
        )
        cr_type = CorporateRequestType.objects.create(name="CR Type2")
        cr = CorporateRequest.objects.create(
            title="CR2", description="desc", organization=org,
            client=client_user, request_type=cr_type, status="OPEN",
            assigned_to=lawyer_user,
        )
        admin_obj = CorporateRequestAdmin(CorporateRequest, None)
        assert "Law" in admin_obj.get_assigned_to_name(cr)


@pytest.mark.django_db
class TestOrganizationAdminMethods:

    def test_get_corporate_client_name(self, corp_user):
        """Lines 300-303: corporate client name."""
        org = Organization.objects.create(
            title="Org3", corporate_client=corp_user, is_active=True,
        )
        admin_obj = OrganizationAdmin(Organization, None)
        assert corp_user.email in admin_obj.get_corporate_client_name(org)

    def test_get_member_count(self, corp_user, client_user):
        """Lines 305-307: member count."""
        org = Organization.objects.create(
            title="Org4", corporate_client=corp_user, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True,
        )
        admin_obj = OrganizationAdmin(Organization, None)
        assert admin_obj.get_member_count(org) >= 1

    def test_get_pending_invitations_count(self, corp_user, client_user):
        """Lines 309-311: pending invitations count."""
        org = Organization.objects.create(
            title="Org5", corporate_client=corp_user, is_active=True,
        )
        OrganizationInvitation.objects.create(
            organization=org, invited_user=client_user, invited_by=corp_user,
            status="PENDING",
        )
        admin_obj = OrganizationAdmin(Organization, None)
        assert admin_obj.get_pending_invitations_count(org) >= 1


@pytest.mark.django_db
class TestOrganizationInvitationAdminMethods:

    def test_get_invited_names_and_expired(self, corp_user, client_user):
        """Lines 330-343: invited user/by names, is_expired."""
        org = Organization.objects.create(
            title="OrgInv", corporate_client=corp_user, is_active=True,
        )
        inv = OrganizationInvitation.objects.create(
            organization=org, invited_user=client_user, invited_by=corp_user,
            status="PENDING",
        )
        admin_obj = OrganizationInvitationAdmin(OrganizationInvitation, None)
        assert client_user.email in admin_obj.get_invited_user_name(inv)
        assert corp_user.email in admin_obj.get_invited_by_name(inv)
        # get_is_expired returns bool
        assert isinstance(admin_obj.get_is_expired(inv), bool)


@pytest.mark.django_db
class TestTagAndFolderAdminMethods:

    def test_tag_get_document_count(self, lawyer_user):
        """Lines 523-526: tag document count."""
        tag = Tag.objects.create(name="TagB13", color_id=1)
        admin_obj = TagAdmin(Tag, None)
        assert admin_obj.get_document_count(tag) == 0

    def test_folder_get_document_count(self, lawyer_user):
        """Lines 562-565: folder document count."""
        folder = DocumentFolder.objects.create(name="FolderB13", owner=lawyer_user)
        admin_obj = DocumentFolderAdmin(DocumentFolder, None)
        assert admin_obj.get_document_count(folder) == 0


# ===========================================================================
# 2. reports.py – generate_excel_report endpoint
# ===========================================================================

@pytest.mark.django_db
class TestGenerateExcelReport:

    def test_missing_report_type(self, api_client, lawyer_user):
        """Lines 37-41: reportType is required."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_unsupported_report_type(self, api_client, lawyer_user):
        """Lines 99-103: unsupported report type."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"reportType": "unknown"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_invalid_date_format(self, api_client, lawyer_user):
        """Lines 56-60: invalid date format."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {
            "reportType": "active_processes",
            "startDate": "not-a-date",
            "endDate": "also-bad",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_only_one_date_provided(self, api_client, lawyer_user):
        """Lines 62-66: only start date without end date."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {
            "reportType": "active_processes",
            "startDate": "2025-01-01",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_active_processes_report_no_dates(self, api_client, lawyer_user):
        """Lines 68-70, 79-80: no dates defaults to all data."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"reportType": "active_processes"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "spreadsheetml" in resp["Content-Type"]

    def test_registered_users_report(self, api_client, lawyer_user):
        """Lines 87-88: registered_users report type."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {
            "reportType": "registered_users",
            "startDate": "2020-01-01",
            "endDate": "2030-12-31",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
