"""
Batch 1: Model edge-case tests for Process, DynamicDocument, CorporateRequest,
LegalRequest, Organization, and Subscription models.
Covers __str__, clean, save, signals, and helper methods not yet exercised.
"""
import os
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.utils import timezone

from gym_app.models import (
    Case, CaseFile, Stage, Process, RecentProcess,
    DynamicDocument, DocumentVariable, DocumentSignature,
    DocumentVisibilityPermission, DocumentUsabilityPermission,
    DocumentFolder, RecentDocument, Tag,
    CorporateRequest, CorporateRequestType, CorporateRequestFiles,
    CorporateRequestResponse,
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles,
    LegalRequestResponse,
    Organization, OrganizationInvitation, OrganizationMembership,
    OrganizationPost,
    Subscription, PaymentHistory,
)
from gym_app.models.user import User

pytestmark = pytest.mark.django_db


# ── helpers / fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="lawyer-b1@example.com", password="testpassword",
        first_name="Lawyer", last_name="B1", role="lawyer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="client-b1@example.com", password="testpassword",
        first_name="Client", last_name="B1", role="client",
    )


@pytest.fixture
def basic_user():  # pragma: no cover – unused fixture
    return User.objects.create_user(
        email="basic-b1@example.com", password="testpassword",
        first_name="Basic", last_name="B1", role="basic",
    )


@pytest.fixture
def corporate_user():
    return User.objects.create_user(
        email="corp-b1@example.com", password="testpassword",
        first_name="Corp", last_name="B1", role="corporate_client",
    )


@pytest.fixture
def case_type():
    return Case.objects.create(type="Civil")


@pytest.fixture
def organization(corporate_user):
    return Organization.objects.create(
        title="TestOrg", description="Desc", corporate_client=corporate_user,
    )


# ── Stage edge-cases ────────────────────────────────────────────────────────

class TestStageEdges:
    def test_stage_with_explicit_date(self):
        stage = Stage.objects.create(status="Filed", date=date(2024, 6, 15))
        assert stage.date == date(2024, 6, 15)

    def test_stage_date_defaults_to_null(self):
        stage = Stage.objects.create(status="Open")
        assert stage.date is None


# ── CaseFile signal edge-case ───────────────────────────────────────────────

class TestCaseFileSignalEdge:
    def test_delete_casefile_no_physical_file_does_not_raise(self):
        """Signal should not fail when file was already removed from disk."""
        f = SimpleUploadedFile("gone.pdf", b"x", content_type="application/pdf")
        cf = CaseFile.objects.create(file=f)
        path = cf.file.path
        if os.path.isfile(path):
            os.remove(path)
        cf.delete()  # should not raise


# ── Process edge-cases ──────────────────────────────────────────────────────

class TestProcessEdges:
    def test_process_multiple_clients(self, lawyer, case_type):
        c1 = User.objects.create_user(email="c1@x.com", password="p", role="client")
        c2 = User.objects.create_user(email="c2@x.com", password="p", role="client")
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="MULTI-C", lawyer=lawyer, case=case_type, subcase="S",
        )
        proc.clients.set([c1, c2])
        assert proc.clients.count() == 2

    def test_process_authority_email_nullable(self, lawyer, case_type, client_user):
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="NO-EMAIL", lawyer=lawyer, case=case_type, subcase="S",
        )
        assert proc.authority_email is None

    def test_process_progress_default_zero(self, lawyer, case_type):
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="PROG-0", lawyer=lawyer, case=case_type, subcase="S",
        )
        assert proc.progress == 0


# ── RecentProcess str ────────────────────────────────────────────────────────

class TestRecentProcessStr:
    def test_str_contains_ref_and_user(self, lawyer, case_type):
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="REF-STR", lawyer=lawyer, case=case_type, subcase="S",
        )
        rp = RecentProcess.objects.create(user=lawyer, process=proc)
        s = str(rp)
        assert "REF-STR" in s


# ── DynamicDocument permission helpers ───────────────────────────────────────

class TestDynamicDocumentPermissions:
    def test_is_lawyer_true_for_lawyer_role(self, lawyer):
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=lawyer,
        )
        assert doc.is_lawyer(lawyer) is True

    def test_is_lawyer_true_for_gym_lawyer_flag(self, client_user):
        client_user.is_gym_lawyer = True
        client_user.save()
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=client_user,
        )
        assert doc.is_lawyer(client_user) is True

    def test_can_view_public_document(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Pub", content="C", created_by=lawyer, is_public=True,
        )
        assert doc.can_view(client_user) is True

    def test_can_view_creator(self, client_user):
        doc = DynamicDocument.objects.create(
            title="Own", content="C", created_by=client_user,
        )
        assert doc.can_view(client_user) is True

    def test_can_view_signer(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Sig", content="C", created_by=lawyer,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)
        assert doc.can_view(client_user) is True

    def test_can_view_explicit_visibility(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Vis", content="C", created_by=lawyer,
        )
        DocumentVisibilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        assert doc.can_view(client_user) is True

    def test_can_view_returns_false_when_no_access(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="No", content="C", created_by=lawyer,
        )
        assert doc.can_view(client_user) is False

    def test_can_use_assigned_to(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Assign", content="C", created_by=lawyer,
            assigned_to=client_user,
        )
        assert doc.can_use(client_user) is True

    def test_can_use_public(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="PubUse", content="C", created_by=lawyer, is_public=True,
        )
        assert doc.can_use(client_user) is True

    def test_can_use_explicit_usability(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Usa", content="C", created_by=lawyer,
        )
        DocumentVisibilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        DocumentUsabilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        assert doc.can_use(client_user) is True

    def test_can_use_returns_false_when_no_access(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="NoUse", content="C", created_by=lawyer,
        )
        assert doc.can_use(client_user) is False


# ── get_user_permission_level ────────────────────────────────────────────────

class TestGetUserPermissionLevel:
    def test_lawyer_level(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        assert doc.get_user_permission_level(lawyer) == "lawyer"

    def test_owner_level(self, client_user):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=client_user)
        assert doc.get_user_permission_level(client_user) == "owner"

    def test_assigned_to_level(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=lawyer, assigned_to=client_user,
        )
        assert doc.get_user_permission_level(client_user) == "usability"

    def test_published_template_usability(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=lawyer,
            state="Published", assigned_to=None,
        )
        assert doc.get_user_permission_level(client_user) == "usability"

    def test_explicit_usability_level(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        DocumentVisibilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        DocumentUsabilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        assert doc.get_user_permission_level(client_user) == "usability"

    def test_view_only_level(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        DocumentVisibilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        assert doc.get_user_permission_level(client_user) == "view_only"

    def test_public_access_level(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=lawyer,
            is_public=True, state="Draft",
        )
        assert doc.get_user_permission_level(client_user) == "public_access"

    def test_no_access_returns_none(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        assert doc.get_user_permission_level(client_user) is None


# ── DocumentUsabilityPermission.clean ────────────────────────────────────────

class TestDocumentUsabilityPermissionClean:
    def test_clean_skips_validation_for_lawyer(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        perm = DocumentUsabilityPermission(
            document=doc, user=lawyer, granted_by=lawyer,
        )
        perm.clean()  # should not raise

    def test_clean_raises_without_visibility(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        perm = DocumentUsabilityPermission(
            document=doc, user=client_user, granted_by=lawyer,
        )
        with pytest.raises(ValidationError, match="visibility permission"):
            perm.clean()


# ── DynamicDocument.delete ───────────────────────────────────────────────────

class TestDynamicDocumentDelete:
    def test_delete_removes_from_folders(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        folder = DocumentFolder.objects.create(name="F", owner=client_user)
        folder.documents.add(doc)
        assert folder.documents.count() == 1
        doc.delete()
        assert folder.documents.count() == 0


# ── DocumentVariable.clean validation ────────────────────────────────────────

class TestDocumentVariableClean:
    def test_clean_number_invalid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="number", value="abc",
        )
        with pytest.raises(ValidationError):
            var.clean()

    def test_clean_date_invalid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="date", value="not-a-date",
        )
        with pytest.raises(ValidationError):
            var.clean()

    def test_clean_email_invalid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="email", value="bad-email",
        )
        with pytest.raises(ValidationError):
            var.clean()

    def test_clean_number_valid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="number", value="42.5",
        )
        var.clean()  # should not raise

    def test_clean_date_valid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="date", value="2024-01-15",
        )
        var.clean()  # should not raise

    def test_clean_email_valid(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable(
            document=doc, name_en="v", field_type="email", value="ok@example.com",
        )
        var.clean()  # should not raise


# ── DocumentVariable.get_formatted_value ─────────────────────────────────────

class TestDocumentVariableFormattedValue:
    def test_non_value_field_returns_raw(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="none", value="hello",
        )
        assert var.get_formatted_value() == "hello"

    def test_value_without_currency(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", value="1000000", currency=None,
        )
        result = var.get_formatted_value()
        assert "1.000.000" in result

    def test_value_usd_currency(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", currency="USD", value="500",
        )
        result = var.get_formatted_value()
        assert "US $" in result

    def test_value_eur_currency(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", currency="EUR", value="250",
        )
        result = var.get_formatted_value()
        assert "EUR" in result

    def test_empty_string_value(self, lawyer):
        doc = DynamicDocument.objects.create(title="D", content="C", created_by=lawyer)
        var = DocumentVariable.objects.create(
            document=doc, name_en="v", field_type="input",
            summary_field="value", value="",
        )
        assert var.get_formatted_value() == ""


# ── Tag, DocumentFolder, RecentDocument str / basics ─────────────────────────

class TestTagAndFolderAndRecentDoc:
    def test_tag_str(self, lawyer):
        tag = Tag.objects.create(name="Important", created_by=lawyer)
        assert str(tag) == "Important"

    def test_document_folder_str(self, client_user):
        folder = DocumentFolder.objects.create(name="MyFolder", owner=client_user)
        assert "MyFolder" in str(folder)
        assert client_user.email in str(folder)

    def test_recent_document_str(self, lawyer):
        doc = DynamicDocument.objects.create(title="RD", content="C", created_by=lawyer)
        rd = RecentDocument.objects.create(user=lawyer, document=doc)
        assert "RD" in str(rd)


# ── DocumentVisibilityPermission / DocumentUsabilityPermission str ──────────

class TestPermissionStr:
    def test_visibility_permission_str(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="DocTitle", content="C", created_by=lawyer)
        perm = DocumentVisibilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        s = str(perm)
        assert client_user.email in s
        assert "DocTitle" in s

    def test_usability_permission_str(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(title="DocTitle", content="C", created_by=lawyer)
        DocumentVisibilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        perm = DocumentUsabilityPermission.objects.create(
            document=doc, user=client_user, granted_by=lawyer,
        )
        s = str(perm)
        assert client_user.email in s
        assert "DocTitle" in s


# ── LegalRequest ─────────────────────────────────────────────────────────────

class TestLegalRequestEdges:
    def test_request_number_auto_generated(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld,
            description="Desc",
        )
        year = timezone.now().year
        assert lr.request_number.startswith(f"SOL-{year}-")

    def test_request_number_increments(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr1 = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D1",
        )
        lr2 = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D2",
        )
        seq1 = int(lr1.request_number.split("-")[-1])
        seq2 = int(lr2.request_number.split("-")[-1])
        assert seq2 == seq1 + 1

    def test_legal_request_str_with_user(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D",
        )
        s = str(lr)
        assert lr.request_number in s
        assert client_user.first_name in s

    def test_legal_request_response_str(self, client_user):
        rt = LegalRequestType.objects.create(name="Consulta")
        ld = LegalDiscipline.objects.create(name="Civil")
        lr = LegalRequest.objects.create(
            user=client_user, request_type=rt, discipline=ld, description="D",
        )
        resp = LegalRequestResponse.objects.create(
            legal_request=lr, response_text="R", user=client_user, user_type="client",
        )
        s = str(resp)
        assert lr.request_number in s
        assert "client response" in s

    def test_legal_request_files_str(self):
        f = SimpleUploadedFile("legal.pdf", b"x", content_type="application/pdf")
        lrf = LegalRequestFiles.objects.create(file=f)
        assert "legal" in str(lrf)

    def test_legal_request_files_delete_signal(self):
        f = SimpleUploadedFile("del.pdf", b"x", content_type="application/pdf")
        lrf = LegalRequestFiles.objects.create(file=f)
        path = lrf.file.path
        assert os.path.isfile(path)
        lrf.delete()
        assert not os.path.isfile(path)


# ── Organization ─────────────────────────────────────────────────────────────

class TestOrganizationEdges:
    def test_organization_clean_invalid_leader_role(self, client_user):
        org = Organization(
            title="Bad", description="D", corporate_client=client_user,
        )
        with pytest.raises(ValidationError, match="cliente corporativo"):
            org.clean()

    def test_get_member_count(self, organization, client_user):
        OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
        )
        assert organization.get_member_count() == 1

    def test_get_pending_invitations_count(self, organization, client_user, corporate_user):
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            status="PENDING",
            expires_at=timezone.now() + timedelta(days=30),
        )
        assert organization.get_pending_invitations_count() == 1

    def test_organization_str(self, organization, corporate_user):
        s = str(organization)
        assert "TestOrg" in s
        assert corporate_user.email in s


# ── OrganizationInvitation ───────────────────────────────────────────────────

class TestOrganizationInvitationEdges:
    def test_invitation_is_expired(self, organization, client_user, corporate_user):
        inv = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            expires_at=timezone.now() - timedelta(days=1),
        )
        assert inv.is_expired() is True

    def test_invitation_can_be_responded_false_when_expired(
        self, organization, client_user, corporate_user
    ):
        inv = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            expires_at=timezone.now() - timedelta(days=1),
        )
        assert inv.can_be_responded() is False

    def test_invitation_accept_creates_membership(
        self, organization, client_user, corporate_user
    ):
        inv = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            expires_at=timezone.now() + timedelta(days=30),
        )
        inv.accept()
        assert OrganizationMembership.objects.filter(
            organization=organization, user=client_user, is_active=True,
        ).exists()
        inv.refresh_from_db()
        assert inv.status == "ACCEPTED"

    def test_invitation_reject(self, organization, client_user, corporate_user):
        inv = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            expires_at=timezone.now() + timedelta(days=30),
        )
        inv.reject()
        inv.refresh_from_db()
        assert inv.status == "REJECTED"

    def test_accept_already_member_raises(
        self, organization, client_user, corporate_user
    ):
        OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
        )
        inv = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            expires_at=timezone.now() + timedelta(days=30),
        )
        with pytest.raises(ValidationError, match="ya es miembro"):
            inv.accept()

    def test_invitation_str(self, organization, client_user, corporate_user):
        inv = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_user,
            expires_at=timezone.now() + timedelta(days=30),
        )
        s = str(inv)
        assert organization.title in s
        assert client_user.email in s


# ── OrganizationMembership ───────────────────────────────────────────────────

class TestOrganizationMembershipEdges:
    def test_deactivate(self, organization, client_user):
        m = OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
        )
        m.deactivate()
        m.refresh_from_db()
        assert m.is_active is False
        assert m.deactivated_at is not None

    def test_reactivate(self, organization, client_user):
        m = OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
            is_active=False,
        )
        m.reactivate()
        m.refresh_from_db()
        assert m.is_active is True
        assert m.deactivated_at is None

    def test_only_one_leader(self, organization, client_user, corporate_user):
        OrganizationMembership.objects.create(
            organization=organization, user=corporate_user, role="LEADER",
        )
        m2 = OrganizationMembership(
            organization=organization, user=client_user, role="LEADER",
        )
        with pytest.raises(ValidationError, match="un líder"):
            m2.clean()

    def test_membership_str(self, organization, client_user):
        m = OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
        )
        s = str(m)
        assert client_user.email in s
        assert organization.title in s


# ── OrganizationPost ─────────────────────────────────────────────────────────

class TestOrganizationPostEdges:
    def test_toggle_pin(self, organization, corporate_user):
        post = OrganizationPost.objects.create(
            title="P", content="C", organization=organization, author=corporate_user,
        )
        assert post.is_pinned is False
        post.toggle_pin()
        post.refresh_from_db()
        assert post.is_pinned is True

    def test_deactivate_and_reactivate(self, organization, corporate_user):
        post = OrganizationPost.objects.create(
            title="P", content="C", organization=organization, author=corporate_user,
        )
        post.deactivate()
        post.refresh_from_db()
        assert post.is_active is False
        post.reactivate()
        post.refresh_from_db()
        assert post.is_active is True

    def test_has_link_property(self, organization, corporate_user):
        post = OrganizationPost.objects.create(
            title="P", content="C", organization=organization, author=corporate_user,
            link_name="Google", link_url="https://google.com",
        )
        assert post.has_link is True

    def test_has_link_false_when_no_link(self, organization, corporate_user):
        post = OrganizationPost.objects.create(
            title="P", content="C", organization=organization, author=corporate_user,
        )
        assert post.has_link is False

    def test_clean_link_name_without_url(self, organization, corporate_user):
        post = OrganizationPost(
            title="P", content="C", organization=organization, author=corporate_user,
            link_name="Name",
        )
        with pytest.raises(ValidationError):
            post.clean()

    def test_clean_link_url_without_name(self, organization, corporate_user):
        post = OrganizationPost(
            title="P", content="C", organization=organization, author=corporate_user,
            link_url="https://google.com",
        )
        with pytest.raises(ValidationError):
            post.clean()

    def test_post_str_contains_title(self, organization, corporate_user):
        post = OrganizationPost.objects.create(
            title="MyPost", content="C", organization=organization,
            author=corporate_user,
        )
        assert "MyPost" in str(post)


# ── Subscription & PaymentHistory ────────────────────────────────────────────

class TestSubscriptionEdges:
    def test_subscription_str(self, client_user):
        sub = Subscription.objects.create(
            user=client_user, plan_type="cliente", status="active",
            next_billing_date=date.today() + timedelta(days=30),
            amount=Decimal("50000.00"),
        )
        s = str(sub)
        assert client_user.email in s
        assert "Cliente" in s

    def test_payment_history_str(self, client_user):
        sub = Subscription.objects.create(
            user=client_user, plan_type="basico", status="active",
            next_billing_date=date.today() + timedelta(days=30),
            amount=Decimal("0.00"),
        )
        ph = PaymentHistory.objects.create(
            subscription=sub, amount=Decimal("50000.00"),
            status="approved", reference="REF-001",
        )
        s = str(ph)
        assert "approved" in s
        assert client_user.email in s


# ── CorporateRequestFiles str and signal ─────────────────────────────────────

class TestCorporateRequestFilesEdges:
    def test_files_str(self):
        f = SimpleUploadedFile("corp.pdf", b"x", content_type="application/pdf")
        crf = CorporateRequestFiles.objects.create(file=f)
        assert "corp" in str(crf)

    def test_delete_signal_removes_file(self):
        f = SimpleUploadedFile("rmcorp.pdf", b"x", content_type="application/pdf")
        crf = CorporateRequestFiles.objects.create(file=f)
        path = crf.file.path
        assert os.path.isfile(path)
        crf.delete()
        assert not os.path.isfile(path)


# ── CorporateRequest __str__ ────────────────────────────────────────────────

class TestCorporateRequestStr:
    def test_str(self, client_user, corporate_user, organization):
        OrganizationMembership.objects.create(
            organization=organization, user=client_user, role="MEMBER",
        )
        rt = CorporateRequestType.objects.create(name="Consulta")
        cr = CorporateRequest.objects.create(
            client=client_user, organization=organization,
            request_type=rt, title="Titulo", description="D",
        )
        s = str(cr)
        assert cr.request_number in s
        assert client_user.email in s
