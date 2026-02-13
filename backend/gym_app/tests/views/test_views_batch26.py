"""Batch 26 – 20 tests: model __str__, invitation accept/reject, request numbers, documents_by_state report."""
import pytest
from django.urls import reverse
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import (
    Process, Case, Stage, DynamicDocument, LegalRequest,
    LegalRequestType, LegalDiscipline, LegalRequestResponse,
    Organization, OrganizationInvitation, OrganizationMembership,
    OrganizationPost,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType, CorporateRequestResponse,
)

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="l26@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="c26@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
def corp():
    return User.objects.create_user(email="co26@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Rp")


# 1-3. Organization model __str__ and invitation __str__
class TestOrgModelStr:
    def test_org_str(self, corp):
        org = Organization.objects.create(title="MyOrg", corporate_client=corp)
        assert "MyOrg" in str(org)
        assert corp.email in str(org)

    def test_invitation_str(self, corp, cli):
        org = Organization.objects.create(title="O2", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        s = str(inv)
        assert cli.email in s
        assert "PENDING" in s

    def test_membership_str(self, corp, cli):
        org = Organization.objects.create(title="O3", corporate_client=corp)
        mem = OrganizationMembership.objects.create(organization=org, user=cli, role="MEMBER")
        assert str(mem)  # just ensure no crash


# 4-6. Invitation accept and reject
class TestInvitationActions:
    def test_accept_creates_membership(self, corp, cli):
        org = Organization.objects.create(title="AccOrg", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        inv.accept()
        inv.refresh_from_db()
        assert inv.status == "ACCEPTED"
        assert OrganizationMembership.objects.filter(organization=org, user=cli, is_active=True).exists()

    def test_accept_already_member_raises(self, corp, cli):
        org = Organization.objects.create(title="DupOrg", corporate_client=corp)
        OrganizationMembership.objects.create(organization=org, user=cli, role="MEMBER", is_active=True)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        with pytest.raises(ValidationError):
            inv.accept()

    def test_reject_invitation(self, corp, cli):
        org = Organization.objects.create(title="RejOrg", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        inv.reject()
        inv.refresh_from_db()
        assert inv.status == "REJECTED"
        assert inv.responded_at is not None


# 7-9. LegalRequest model gaps
class TestLegalRequestModel:
    def test_str_with_user(self, cli):
        rt = LegalRequestType.objects.create(name="Q")
        di = LegalDiscipline.objects.create(name="C")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        s = str(lr)
        assert lr.request_number in s
        assert "C" in s

    def test_request_number_sequence(self, cli):
        rt = LegalRequestType.objects.create(name="Q2")
        di = LegalDiscipline.objects.create(name="C2")
        lr1 = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D1")
        lr2 = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D2")
        n1 = int(lr1.request_number.split("-")[-1])
        n2 = int(lr2.request_number.split("-")[-1])
        assert n2 == n1 + 1

    def test_response_str(self, cli, law):
        rt = LegalRequestType.objects.create(name="Q3")
        di = LegalDiscipline.objects.create(name="C3")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")
        r = LegalRequestResponse.objects.create(legal_request=lr, user=law, response_text="ok", user_type="lawyer")
        s = str(r)
        assert lr.request_number in s
        assert "lawyer" in s


# 10-12. CorporateRequest model gaps
class TestCorporateRequestModel:
    def test_str(self, cli, corp):
        ct = CorporateRequestType.objects.create(name="T")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="TT", description="D")
        s = str(cr)
        assert cr.request_number in s
        assert cli.email in s

    def test_request_number_sequence(self, cli, corp):
        ct = CorporateRequestType.objects.create(name="T2")
        cr1 = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="A", description="D")
        cr2 = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="B", description="D")
        n1 = int(cr1.request_number.split("-")[-1])
        n2 = int(cr2.request_number.split("-")[-1])
        assert n2 == n1 + 1

    def test_response_str(self, cli, corp, law):
        ct = CorporateRequestType.objects.create(name="T3")
        cr = CorporateRequest.objects.create(client=cli, corporate_client=corp, request_type=ct, title="T", description="D")
        r = CorporateRequestResponse.objects.create(corporate_request=cr, user=law, response_text="ok", user_type="lawyer")
        assert str(r)


# 13-14. OrganizationPost model
class TestOrgPostModel:
    def test_post_str(self, corp):
        org = Organization.objects.create(title="PostOrg", corporate_client=corp)
        p = OrganizationPost.objects.create(organization=org, author=corp, title="News", content="Body")
        assert str(p)

    def test_post_has_link_false(self, corp):
        org = Organization.objects.create(title="PostOrg2", corporate_client=corp)
        p = OrganizationPost.objects.create(organization=org, author=corp, title="N", content="B")
        assert p.has_link is False

    
# 15-16. Process model __str__ and edge cases
class TestProcessModel:
    def test_process_str(self, law):
        c = Case.objects.create(type="Civil")
        p = Process.objects.create(ref="REF-001", case=c, lawyer=law)
        assert str(p)

    def test_case_str(self):
        c = Case.objects.create(type="Penal")
        assert "Penal" in str(c)


# 17. documents_by_state report
class TestDocByStateReport:
    def test_documents_by_state(self, api, law):
        DynamicDocument.objects.create(title="D1", content="<p>x</p>", state="Draft", created_by=law)
        DynamicDocument.objects.create(title="D2", content="<p>y</p>", state="Completed", created_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("generate-excel-report"), {"reportType": "documents_by_state"}, format="json")
        assert resp.status_code == 200
        assert "spreadsheetml" in resp["Content-Type"]


# 18. Invitation can_be_responded after rejection
class TestInvitationEdge:
    def test_cannot_respond_after_reject(self, corp, cli):
        org = Organization.objects.create(title="E1", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        inv.reject()
        assert inv.can_be_responded() is False

    def test_cannot_accept_after_accept(self, corp, cli):
        org = Organization.objects.create(title="E2", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        inv.accept()
        with pytest.raises(ValidationError):
            inv.accept()


# 20. DynamicDocument __str__
class TestDynamicDocStr:
    def test_dynamic_doc_str(self, law):
        d = DynamicDocument.objects.create(title="MyDoc", content="<p>x</p>", state="Draft", created_by=law)
        assert "MyDoc" in str(d)
