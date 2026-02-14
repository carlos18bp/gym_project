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


# ======================================================================
# Tests merged from test_dynamic_document_model_edges.py
# ======================================================================

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from gym_app.models import (
    DynamicDocument,
    DocumentRelationship,
    DocumentVisibilityPermission,
    DocumentUsabilityPermission,
    DocumentSignature,
    DocumentVariable,
    RecentDocument,
)
from gym_app.models.user import User


pytestmark = pytest.mark.django_db


@pytest.fixture
def user_factory():
    def create_user(email, role="client", is_gym_lawyer=False):
        return User.objects.create_user(
            email=email,
            password="testpassword",
            role=role,
            is_gym_lawyer=is_gym_lawyer,
        )

    return create_user


@pytest.fixture
def document_factory():
    def create_document(created_by, **kwargs):
        return DynamicDocument.objects.create(
            title=kwargs.pop("title", "Doc"),
            content=kwargs.pop("content", "<p>x</p>"),
            state=kwargs.pop("state", "Draft"),
            created_by=created_by,
            assigned_to=kwargs.pop("assigned_to", None),
            is_public=kwargs.pop("is_public", False),
            requires_signature=kwargs.pop("requires_signature", False),
        )

    return create_document


def test_add_relationship_duplicate_does_not_create(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator)

    first = doc_a.add_relationship(doc_b, created_by=creator)
    second = doc_a.add_relationship(doc_b, created_by=creator)

    assert DocumentRelationship.objects.count() == 1
    assert first.id == second.id


def test_remove_relationship_returns_false_when_missing(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator)

    removed = doc_a.remove_relationship(doc_b)

    assert removed is False
    assert DocumentRelationship.objects.count() == 0


def test_get_related_documents_includes_fully_signed_for_owner(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    source = document_factory(created_by=creator)
    target = document_factory(created_by=creator, state="FullySigned")

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=creator).values_list("id", flat=True))

    assert related_ids == {target.id}


def test_get_related_documents_allows_assigned_user_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    assignee = user_factory("assignee@example.com")
    source = document_factory(created_by=creator, assigned_to=assignee)
    target = document_factory(created_by=creator, state="Completed")

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=assignee).values_list("id", flat=True))

    assert related_ids == {target.id}


def test_get_related_documents_allows_signer_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    source = document_factory(created_by=creator)
    target = document_factory(created_by=creator, state="Completed")

    DocumentSignature.objects.create(document=source, signer=signer)
    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=signer).values_list("id", flat=True))

    assert related_ids == {target.id}


def test_get_related_documents_allows_lawyer_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    source = document_factory(created_by=creator)
    final_doc = document_factory(created_by=creator, state="Completed", title="Final Doc")
    draft_doc = document_factory(created_by=creator, state="Draft", title="Draft Doc")

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=final_doc,
        created_by=creator,
    )
    DocumentRelationship.objects.create(
        source_document=source,
        target_document=draft_doc,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=lawyer).values_list("id", flat=True))

    assert related_ids == {final_doc.id}


def test_document_relationship_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    source = document_factory(created_by=creator)
    target = document_factory(created_by=creator)

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentRelationship.objects.create(
                source_document=source,
                target_document=target,
                created_by=creator,
            )


def test_document_visibility_permission_str(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer = user_factory("viewer@example.com")
    document = document_factory(created_by=creator, title="Doc Title")

    permission = DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer,
        granted_by=creator,
    )

    assert str(permission) == f"{viewer.email} can view '{document.title}'"


def test_document_visibility_permission_ordering_by_granted_at(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer_old = user_factory("viewer-old@example.com")
    viewer_new = user_factory("viewer-new@example.com")
    document = document_factory(created_by=creator)

    perm_old = DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer_old,
        granted_by=creator,
    )
    perm_new = DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer_new,
        granted_by=creator,
    )

    older_time = timezone.now() - timedelta(days=1)
    newer_time = timezone.now()
    DocumentVisibilityPermission.objects.filter(pk=perm_old.pk).update(
        granted_at=older_time
    )
    DocumentVisibilityPermission.objects.filter(pk=perm_new.pk).update(
        granted_at=newer_time
    )

    permissions = list(DocumentVisibilityPermission.objects.all())

    assert permissions[0].id == perm_new.id
    assert permissions[1].id == perm_old.id


def test_document_visibility_permission_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer = user_factory("viewer@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer,
        granted_by=creator,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentVisibilityPermission.objects.create(
                document=document,
                user=viewer,
                granted_by=creator,
            )


def test_document_usability_permission_str(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    editor = user_factory("editor@example.com")
    document = document_factory(created_by=creator, title="Doc Title")

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )
    permission = DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )

    assert str(permission) == f"{editor.email} can use '{document.title}'"


def test_document_usability_permission_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    editor = user_factory("editor@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )
    DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentUsabilityPermission.objects.create(
                document=document,
                user=editor,
                granted_by=creator,
            )


def test_document_usability_permission_ordering_by_granted_at(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    editor_old = user_factory("editor-old@example.com")
    editor_new = user_factory("editor-new@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor_old,
        granted_by=creator,
    )
    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor_new,
        granted_by=creator,
    )

    perm_old = DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor_old,
        granted_by=creator,
    )
    perm_new = DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor_new,
        granted_by=creator,
    )

    older_time = timezone.now() - timedelta(days=1)
    newer_time = timezone.now()
    DocumentUsabilityPermission.objects.filter(pk=perm_old.pk).update(
        granted_at=older_time
    )
    DocumentUsabilityPermission.objects.filter(pk=perm_new.pk).update(
        granted_at=newer_time
    )

    permissions = list(DocumentUsabilityPermission.objects.all())

    assert permissions[0].id == perm_new.id
    assert permissions[1].id == perm_old.id


def test_document_usability_permission_allows_gym_lawyer(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    gym_lawyer = user_factory("gym@example.com", is_gym_lawyer=True)
    document = document_factory(created_by=creator)

    permission = DocumentUsabilityPermission.objects.create(
        document=document,
        user=gym_lawyer,
        granted_by=creator,
    )

    assert permission.id is not None


def test_document_signature_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    DocumentSignature.objects.create(document=document, signer=signer)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentSignature.objects.create(document=document, signer=signer)


def test_document_signature_ordering_by_signer_email(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer_b = user_factory("b@example.com")
    signer_a = user_factory("a@example.com")
    document = document_factory(created_by=creator)

    DocumentSignature.objects.create(document=document, signer=signer_b)
    DocumentSignature.objects.create(document=document, signer=signer_a)

    signatures = list(DocumentSignature.objects.filter(document=document))

    assert [signature.signer.email for signature in signatures] == [
        "a@example.com",
        "b@example.com",
    ]


def test_document_signature_save_triggers_check_on_update(user_factory, document_factory, monkeypatch):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    DocumentSignature.objects.bulk_create(
        [DocumentSignature(document=document, signer=signer, signed=False)]
    )
    signature = DocumentSignature.objects.get(document=document, signer=signer)

    called = {"count": 0}

    def fake_check(self):
        called["count"] += 1
        return True

    monkeypatch.setattr(DynamicDocument, "check_fully_signed", fake_check)

    signature.signed = True
    signature.save()

    assert called["count"] == 1


def test_document_variable_invalid_number_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser un"):
        DocumentVariable.objects.create(
            document=document,
            name_en="amount",
            field_type="number",
            value="not-a-number",
        )


def test_document_variable_invalid_date_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser una fecha"):
        DocumentVariable.objects.create(
            document=document,
            name_en="start",
            field_type="date",
            value="2023/01/01",
        )


def test_document_variable_invalid_email_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser un correo"):
        DocumentVariable.objects.create(
            document=document,
            name_en="email",
            field_type="email",
            value="not-an-email",
        )


def test_document_variable_valid_number_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        value="1234.56",
    )

    assert variable.id is not None


def test_document_variable_valid_date_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="start_date",
        field_type="date",
        value="2024-01-31",
    )

    assert variable.id is not None


def test_document_variable_valid_email_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="contact_email",
        field_type="email",
        value="person@example.com",
    )

    assert variable.id is not None


def test_document_variable_get_formatted_value_usd_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        currency="USD",
        value="1000",
    )

    assert variable.get_formatted_value() == "US $ 1.000.00"


def test_document_variable_get_formatted_value_returns_raw_when_not_value(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="notes",
        field_type="input",
        summary_field="none",
        value="Some notes",
    )

    assert variable.get_formatted_value() == "Some notes"


def test_document_variable_get_formatted_value_without_currency_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        value="1000",
    )

    assert variable.get_formatted_value() == "1.000.00"


def test_document_variable_get_formatted_value_unknown_currency_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        currency="GBP",
        value="1000",
    )

    assert variable.get_formatted_value() == "GBP 1.000.00"


def test_recent_document_str(user_factory, document_factory):
    user = user_factory("recent@example.com")
    document = document_factory(created_by=user, title="Recent Doc")

    recent = RecentDocument.objects.create(user=user, document=document)

    assert user.email in str(recent)
    assert document.title in str(recent)


def test_recent_document_unique_together(user_factory, document_factory):
    user = user_factory("unique@example.com")
    document = document_factory(created_by=user)

    RecentDocument.objects.create(user=user, document=document)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            RecentDocument.objects.create(user=user, document=document)


# ======================================================================
# Tests merged from test_model_coverage_100.py
# ======================================================================

"""
Tests targeting the last 4 uncovered lines in model source files to reach 100% coverage.

Targets:
  - dynamic_document.py: currency formatting outputs expected format
  - legal_request.py line 121: __str__ when user is None
  - organization.py line 214: accept() raises when invitation cannot be responded
  - organization.py line 241: reject() raises when invitation cannot be responded
"""
import pytest
from datetime import timedelta
from unittest.mock import patch
from django.core.exceptions import ValidationError
from django.utils import timezone

from gym_app.models import DynamicDocument, DocumentVariable
from gym_app.models.legal_request import (
    LegalRequest,
    LegalRequestType,
    LegalDiscipline,
)
from gym_app.models.organization import (
    Organization,
    OrganizationInvitation,
)
from gym_app.models.user import User


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_cov100@test.com",
        password="pw",
        role="lawyer",
        first_name="Law",
        last_name="Yer",
    )


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email="basic_cov100@test.com",
        password="pw",
        role="basic",
        first_name="Basic",
        last_name="User",
    )


@pytest.fixture
def corporate_client():
    return User.objects.create_user(
        email="corp_cov100@test.com",
        password="pw",
        role="corporate_client",
        first_name="Corp",
        last_name="Leader",
    )


@pytest.fixture
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Coverage Doc",
        content="<p>test</p>",
        state="Draft",
        created_by=lawyer_user,
    )


@pytest.fixture
def organization(corporate_client):
    return Organization.objects.create(
        title="Org Cov100",
        description="Desc",
        corporate_client=corporate_client,
    )


# ---------------------------------------------------------------------------
# dynamic_document.py – currency formatting behavior
# ---------------------------------------------------------------------------

class TestDocumentVariableCurrencyFormatting:
    def test_get_formatted_value_whole_number_cop(self, document):
        """
        Whole-number COP values are formatted with thousands separators
        and two decimal places.
        """
        var = DocumentVariable.objects.create(
            document=document,
            name_en="amount",
            field_type="input",
            value="1000000",
            summary_field="value",
            currency="COP",
        )

        result = var.get_formatted_value()

        assert result == "COP $ 1.000.000.00"
        assert "," not in result


# ---------------------------------------------------------------------------
# legal_request.py – line 121: __str__ when self.user is None
# ---------------------------------------------------------------------------

class TestLegalRequestStrWithoutUser:
    def test_str_returns_request_number_only_when_user_is_none(self):
        """
        LegalRequest.__str__() should return just the request_number
        when the user field is None (line 121).

        The user FK is NOT NULL at DB level, so we temporarily replace
        the FK descriptor with None to simulate the branch.
        """
        req_type = LegalRequestType.objects.create(name="Cov100 Type")
        discipline = LegalDiscipline.objects.create(name="Cov100 Disc")
        temp_user = User.objects.create_user(
            email="temp_lr_cov100@test.com", password="pw"
        )
        lr = LegalRequest.objects.create(
            user=temp_user,
            request_type=req_type,
            discipline=discipline,
            description="Test",
        )

        # Temporarily replace the FK descriptor so self.user returns None
        with patch.object(LegalRequest, "user", new=None):
            result = str(lr)

        assert result == lr.request_number


# ---------------------------------------------------------------------------
# organization.py – line 214: accept() on non-respondable invitation
# ---------------------------------------------------------------------------

class TestOrganizationInvitationAcceptReject:
    def test_accept_raises_when_invitation_already_accepted(
        self, organization, corporate_client, basic_user
    ):
        """
        Calling accept() on an already-accepted invitation raises
        ValidationError (line 214).
        """
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_client,
            status="ACCEPTED",
            expires_at=timezone.now() + timedelta(days=30),
        )

        with pytest.raises(ValidationError, match="no puede ser aceptada"):
            invitation.accept()

    def test_reject_raises_when_invitation_expired(
        self, organization, corporate_client, basic_user
    ):
        """
        Calling reject() on an expired invitation raises
        ValidationError (line 241).
        """
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() - timedelta(days=1),
        )

        with pytest.raises(ValidationError, match="no puede ser rechazada"):
            invitation.reject()
