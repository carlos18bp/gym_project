"""Batch 25 – admin helpers + GyMAdminSite + model gaps."""
import pytest
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from gym_app.admin import (
    ProcessAdmin, LegalRequestAdmin, LegalRequestResponseAdmin,
    CorporateRequestAdmin, CorporateRequestResponseAdmin,
    OrganizationAdmin, OrganizationInvitationAdmin,
    OrganizationMembershipAdmin, OrganizationPostAdmin,
    TagAdmin, DocumentFolderAdmin, DynamicDocumentAdmin, GyMAdminSite,
)
from gym_app.models import (
    Process, Case, LegalRequest, LegalRequestType, LegalDiscipline,
    LegalRequestResponse, DynamicDocument, Tag, Organization,
    OrganizationInvitation, OrganizationMembership, OrganizationPost,
    DocumentFolder,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType, CorporateRequestResponse,
)

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def site():
    return AdminSite()

@pytest.fixture
def law():
    return User.objects.create_user(email="l25@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="c25@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
def corp():
    return User.objects.create_user(email="co25@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Rp")

class TestAdminHelpers:
    def test_process_client(self, site, law, cli):
        c = Case.objects.create(type="X")
        p = Process.objects.create(ref="R", case=c, lawyer=law)
        p.clients.add(cli)
        assert cli.email in ProcessAdmin(Process, site).get_primary_client(p)

    def test_process_no_client(self, site, law):
        c = Case.objects.create(type="Y")
        p = Process.objects.create(ref="R2", case=c, lawyer=law)
        assert ProcessAdmin(Process, site).get_primary_client(p) is None

    def test_lr_user_name(self, site, cli):
        rt = LegalRequestType.objects.create(name="Q")
        di = LegalDiscipline.objects.create(name="C")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        assert LegalRequestAdmin(LegalRequest, site).get_user_name(lr) == "C E"

    def test_lr_user_email(self, site, cli):
        rt = LegalRequestType.objects.create(name="Q2")
        di = LegalDiscipline.objects.create(name="C2")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        assert LegalRequestAdmin(LegalRequest, site).get_user_email(lr) == cli.email

    def test_lr_resp_user_name(self, site, cli, law):
        rt = LegalRequestType.objects.create(name="Q3")
        di = LegalDiscipline.objects.create(name="C3")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        r = LegalRequestResponse.objects.create(legal_request=lr, user=law, response_text="ok", user_type="lawyer")
        assert "L W" == LegalRequestResponseAdmin(LegalRequestResponse, site).get_user_name(r)

    def test_lr_resp_preview_short(self, site, cli, law):
        rt = LegalRequestType.objects.create(name="Q4")
        di = LegalDiscipline.objects.create(name="C4")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        r = LegalRequestResponse.objects.create(legal_request=lr, user=law, response_text="short", user_type="lawyer")
        assert LegalRequestResponseAdmin(LegalRequestResponse, site).get_response_preview(r) == "short"

    def test_lr_resp_preview_long(self, site, cli, law):
        rt = LegalRequestType.objects.create(name="Q5")
        di = LegalDiscipline.objects.create(name="C5")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        r = LegalRequestResponse.objects.create(legal_request=lr, user=law, response_text="x" * 200, user_type="lawyer")
        prev = LegalRequestResponseAdmin(LegalRequestResponse, site).get_response_preview(r)
        assert prev.endswith("...")
        assert len(prev) == 103

    def test_corp_req_client_name(self, site, cli, corp):
        ct = CorporateRequestType.objects.create(name="T")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="T", description="D")
        assert cli.email in CorporateRequestAdmin(CorporateRequest, site).get_client_name(cr)

    def test_corp_req_corp_name(self, site, cli, corp):
        ct = CorporateRequestType.objects.create(name="T2")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="T", description="D")
        assert corp.email in CorporateRequestAdmin(CorporateRequest, site).get_corporate_client_name(cr)

    def test_corp_req_assigned_none(self, site, cli, corp):
        ct = CorporateRequestType.objects.create(name="T3")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="T", description="D")
        assert "No asignado" in CorporateRequestAdmin(CorporateRequest, site).get_assigned_to_name(cr)

    def test_corp_resp_user_name(self, site, cli, corp, law):
        ct = CorporateRequestType.objects.create(name="T4")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="T", description="D")
        r = CorporateRequestResponse.objects.create(corporate_request=cr, user=law, response_text="ok", user_type="lawyer")
        assert "L W" in CorporateRequestResponseAdmin(CorporateRequestResponse, site).get_user_name(r)

    def test_corp_resp_preview(self, site, cli, corp, law):
        ct = CorporateRequestType.objects.create(name="T5")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="T", description="D")
        r = CorporateRequestResponse.objects.create(corporate_request=cr, user=law, response_text="y" * 200, user_type="lawyer")
        assert CorporateRequestResponseAdmin(CorporateRequestResponse, site).get_response_preview(r).endswith("...")

    def test_org_admin_helpers(self, site, corp):
        org = Organization.objects.create(title="Org", corporate_client=corp)
        oa = OrganizationAdmin(Organization, site)
        assert corp.email in oa.get_corporate_client_name(org)
        assert oa.get_member_count(org) == 0
        assert oa.get_pending_invitations_count(org) == 0

    def test_org_invite_helpers(self, site, corp, cli):
        org = Organization.objects.create(title="Org2", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        oia = OrganizationInvitationAdmin(OrganizationInvitation, site)
        assert cli.email in oia.get_invited_user_name(inv)
        assert corp.email in oia.get_invited_by_name(inv)
        assert isinstance(oia.get_is_expired(inv), bool)

    def test_org_membership_helper(self, site, corp, cli):
        org = Organization.objects.create(title="Org3", corporate_client=corp)
        mem = OrganizationMembership.objects.create(organization=org, user=cli, role="member")
        assert cli.email in OrganizationMembershipAdmin(OrganizationMembership, site).get_user_name(mem)

    def test_org_post_helpers(self, site, corp):
        org = Organization.objects.create(title="Org4", corporate_client=corp)
        post = OrganizationPost.objects.create(organization=org, author=corp, title="P", content="C")
        opa = OrganizationPostAdmin(OrganizationPost, site)
        assert corp.email in opa.get_author_name(post)
        assert opa.has_link(post) is False

    def test_tag_doc_count(self, site, law):
        t = Tag.objects.create(name="T1", color_id=1, created_by=law)
        assert TagAdmin(Tag, site).get_document_count(t) == 0

    def test_folder_doc_count(self, site, cli):
        f = DocumentFolder.objects.create(name="F1", owner=cli)
        assert DocumentFolderAdmin(DocumentFolder, site).get_document_count(f) == 0

    def test_gym_admin_get_app_list(self, law):
        gas = GyMAdminSite(name="testadmin")
        rf = RequestFactory()
        req = rf.get("/admin/")
        req.user = law
        result = gas.get_app_list(req)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_dynamic_doc_admin_queryset(self, site, law):
        DynamicDocument.objects.create(title="QS", content="<p>x</p>", state="Draft", created_by=law)
        adm = DynamicDocumentAdmin(DynamicDocument, site)
        rf = RequestFactory()
        req = rf.get("/admin/")
        req.user = law
        qs = adm.get_queryset(req)
        assert qs.count() >= 1
