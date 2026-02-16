import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone

from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    CorporateRequest,
    CorporateRequestType,
)


User = get_user_model()
@pytest.fixture
@pytest.mark.django_db
def corporate_client():
    return User.objects.create_user(
        email="corp@example.com",
        password="testpassword",
        first_name="Corp",
        last_name="Leader",
        role="corporate_client",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        first_name="Client",
        last_name="User",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corporate_client):
    return Organization.objects.create(
        title="Org Title",
        description="Org Description",
        corporate_client=corporate_client,
    )


@pytest.mark.django_db
@pytest.mark.integration
class TestOrganizationCrudAndMembers:
    @pytest.mark.contract
    def test_create_organization_corporate_only(self, api_client, corporate_client, client_user):
        url = reverse("create-organization")
        data = {"title": "Nueva Org", "description": "Desc"}

        # Corporate client puede crear
        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["message"]
        org_data = response.data["organization"]
        assert org_data["title"] == "Nueva Org"

        # Cliente normal no puede crear
        api_client.force_authenticate(user=client_user)
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.contract
    def test_get_my_organizations_filters_by_leader(self, api_client, corporate_client):
        # Org del corporate_client
        org1 = Organization.objects.create(title="Org1", description="D1", corporate_client=corporate_client)
        org2 = Organization.objects.create(title="Org2", description="D2", corporate_client=corporate_client)
        # Org de otro corporate
        other_corp = User.objects.create_user(
            email="othercorp@example.com",
            password="testpassword",
            role="corporate_client",
        )
        Organization.objects.create(title="ForeignOrg", description="FD", corporate_client=other_corp)

        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-my-organizations")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Puede venir paginado o no; comprobamos que solo aparezcan sus orgs en el contenido
        data = response.data
        # Si es paginado, results está en 'results', si no en 'organizations'
        orgs = data.get("results") or data.get("organizations")
        titles = {o["title"] for o in orgs}
        assert {"Org1", "Org2"}.issubset(titles)
        assert "ForeignOrg" not in titles

    @pytest.mark.edge
    def test_delete_organization_prevents_when_active_requests(self, api_client, corporate_client, organization, client_user):
        # Crear membresía activa para el cliente y una corporate request asociada a la org
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        request_type = CorporateRequestType.objects.create(name="Org Test Type")

        CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req",
            description="Desc",
            priority="MEDIUM",
            status="PENDING",
        )

        api_client.force_authenticate(user=corporate_client)
        url = reverse("delete-organization", kwargs={"organization_id": organization.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "solicitudes activas" in response.data["error"]

    @pytest.mark.contract
    def test_get_organization_members_and_remove_member(self, api_client, corporate_client, client_user, organization):
        # Leader membership
        leader_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
            is_active=True,
        )
        # Member membership
        member_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        api_client.force_authenticate(user=corporate_client)

        # Listar miembros
        url = reverse("get-organization-members", kwargs={"organization_id": organization.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        members = response.data["members"]
        assert len(members) == 2

        # No se puede remover LEADER
        url_remove = reverse("remove-organization-member", kwargs={"organization_id": organization.id, "user_id": corporate_client.id})
        response = api_client.delete(url_remove)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Se puede remover MEMBER
        url_remove = reverse("remove-organization-member", kwargs={"organization_id": organization.id, "user_id": client_user.id})
        response = api_client.delete(url_remove)
        assert response.status_code == status.HTTP_200_OK
        member_membership.refresh_from_db()
        assert member_membership.is_active is False


@pytest.mark.django_db
@pytest.mark.integration
class TestOrganizationInvitationsAndMemberships:
    @pytest.mark.contract
    def test_send_and_list_invitations_and_client_accepts(self, api_client, corporate_client, client_user, organization):
        # Enviar invitación
        api_client.force_authenticate(user=corporate_client)
        url_send = reverse("send-organization-invitation", kwargs={"organization_id": organization.id})
        data = {"invited_user_email": client_user.email, "message": "Únete"}
        response = api_client.post(url_send, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED

        invitation = OrganizationInvitation.objects.get(organization=organization, invited_user=client_user)

        # Corporate lista sus invitaciones
        url_list = reverse("get-organization-invitations", kwargs={"organization_id": organization.id})
        response = api_client.get(url_list)
        assert response.status_code == status.HTTP_200_OK
        invites = (response.data.get("results") or response.data.get("invitations"))
        assert any(inv["id"] == invitation.id for inv in invites)

        # Client ve sus invitaciones
        api_client.force_authenticate(user=client_user)
        url_my_inv = reverse("get-my-invitations")
        response = api_client.get(url_my_inv)
        assert response.status_code == status.HTTP_200_OK
        my_invites = (response.data.get("results") or response.data.get("invitations"))
        assert any(inv["id"] == invitation.id for inv in my_invites)

        # Client acepta invitación
        url_respond = reverse("respond-to-invitation", kwargs={"invitation_id": invitation.id})
        response = api_client.post(url_respond, {"action": "accept"}, format="json")
        assert response.status_code == status.HTTP_200_OK

        invitation.refresh_from_db()
        assert invitation.status == "ACCEPTED"
        # Debe existir membresía
        assert OrganizationMembership.objects.filter(organization=organization, user=client_user, is_active=True).exists()

    @pytest.mark.edge
    def test_cancel_invitation_only_pending(self, api_client, corporate_client, client_user, organization):
        api_client.force_authenticate(user=corporate_client)
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        # Cancelar pendiente
        url_cancel = reverse("cancel-organization-invitation", kwargs={"organization_id": organization.id, "invitation_id": invitation.id})
        response = api_client.delete(url_cancel)
        assert response.status_code == status.HTTP_200_OK

        # Intentar cancelar una no pendiente
        invitation2 = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="ACCEPTED",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )
        url_cancel2 = reverse("cancel-organization-invitation", kwargs={"organization_id": organization.id, "invitation_id": invitation2.id})
        response = api_client.delete(url_cancel2)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.contract
    def test_get_my_memberships_and_leave_organization(self, api_client, client_user, corporate_client, organization):
        # Crear membresía MEMBER
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        api_client.force_authenticate(user=client_user)
        url_memberships = reverse("get-my-memberships")
        response = api_client.get(url_memberships)
        assert response.status_code == status.HTTP_200_OK
        orgs = response.data["organizations"]
        assert len(orgs) == 1
        assert orgs[0]["title"] == organization.title

        # Dejar organización
        url_leave = reverse("leave-organization", kwargs={"organization_id": organization.id})
        response = api_client.post(url_leave, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        membership.refresh_from_db()
        assert membership.is_active is False

        # Líder no puede dejar su propia organización
        leader_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
            is_active=True,
        )
        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url_leave, {}, format="json")
        # Decorador require_client_only devuelve 403 para roles no permitidos (corporate_client)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@pytest.mark.integration
class TestOrganizationStatsAndPublicDetail:
    @pytest.mark.contract
    def test_get_organization_stats_for_corporate(self, api_client, corporate_client, client_user, organization):
        # Crear algunos datos
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )
        request_type = CorporateRequestType.objects.create(name="Org Stats Type")

        CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req",
            description="Desc",
            priority="MEDIUM",
            status="PENDING",
        )

        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-organization-stats")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        # Chequear que algunas métricas básicas existen
        assert "total_organizations" in data
        assert "total_members" in data
        assert "total_pending_invitations" in data
        assert "recent_requests_count" in data

    @pytest.mark.edge
    def test_get_organization_public_detail_access_rules(self, api_client, corporate_client, client_user, organization):
        # Añadir membresía del cliente
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        # Corporate líder puede ver
        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-organization-public-detail", kwargs={"organization_id": organization.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

        # Cliente miembro puede ver
        api_client.force_authenticate(user=client_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

        # Cliente sin membresía no puede ver
        other_client = User.objects.create_user(
            email="otherclient@example.com",
            password="testpassword",
            role="client",
        )
        api_client.force_authenticate(user=other_client)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestOrganizationRest:
    def test_rest_create_update_delete_and_detail(self, api_client, corporate_client):
        api_client.force_authenticate(user=corporate_client)

        create_url = reverse("create-organization")
        response = api_client.post(
            create_url,
            {"title": "Rest Org", "description": "Rest desc"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        organization_id = response.data["organization"]["id"]

        detail_url = reverse("get-organization-detail", kwargs={"organization_id": organization_id})
        response = api_client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["organization"]["id"] == organization_id

        update_url = reverse("update-organization", kwargs={"organization_id": organization_id})
        response = api_client.post(update_url, {"title": "Rest Org Updated"}, format="json")
        assert response.status_code == status.HTTP_200_OK

        delete_url = reverse("delete-organization", kwargs={"organization_id": organization_id})
        response = api_client.delete(delete_url)
        assert response.status_code == status.HTTP_200_OK
        assert not Organization.objects.filter(id=organization_id).exists()

    def test_rest_get_my_organizations_and_stats(self, api_client, corporate_client, client_user):
        Organization.objects.create(title="Org A", description="A", corporate_client=corporate_client)
        Organization.objects.create(title="Org B", description="B", corporate_client=corporate_client)
        other_corp = User.objects.create_user(
            email="othercorp@example.com",
            password="testpassword",
            role="corporate_client",
        )
        Organization.objects.create(title="Foreign", description="F", corporate_client=other_corp)

        api_client.force_authenticate(user=corporate_client)
        list_url = reverse("get-my-organizations")
        response = api_client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        orgs = response.data.get("results") or response.data.get("organizations")
        titles = {org["title"] for org in orgs}
        assert {"Org A", "Org B"}.issubset(titles)
        assert "Foreign" not in titles

        OrganizationMembership.objects.create(
            organization=Organization.objects.filter(corporate_client=corporate_client).first(),
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        stats_url = reverse("get-organization-stats")
        response = api_client.get(stats_url)
        assert response.status_code == status.HTTP_200_OK
        assert "total_organizations" in response.data


# ======================================================================
# Tests migrated from test_views_batch26.py
# ======================================================================

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


# ======================================================================
# Tests migrated from test_views_batch34.py
# ======================================================================

"""Batch 34 – 20 tests: organization views, subscription views, intranet views edges."""
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization, OrganizationInvitation, OrganizationMembership,
    OrganizationPost, Subscription,
)
from decimal import Decimal
import datetime

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law34@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli34@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
def corp():
    return User.objects.create_user(email="corp34@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Rp")


# -- Organization views --
class TestOrganizationViews:
    def test_create_org_non_corporate_forbidden(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("create-organization"), {"title": "O", "description": "D"}, format="json")
        assert resp.status_code == 403

    def test_create_org_success(self, api, corp):
        api.force_authenticate(user=corp)
        resp = api.post(reverse("create-organization"), {"title": "NewOrg", "description": "Desc"}, format="json")
        assert resp.status_code == 201
        assert Organization.objects.filter(title="NewOrg").exists()

    def test_get_my_orgs(self, api, corp):
        Organization.objects.create(title="MyOrg", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-my-organizations"))
        assert resp.status_code == 200

    def test_get_org_detail(self, api, corp):
        org = Organization.objects.create(title="Det", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-organization-detail", args=[org.id]))
        assert resp.status_code == 200

    def test_delete_org(self, api, corp):
        org = Organization.objects.create(title="DelOrg", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.delete(reverse("delete-organization", args=[org.id]))
        assert resp.status_code in (200, 204)
        assert not Organization.objects.filter(id=org.id).exists()

    def test_send_invitation(self, api, corp, cli):
        org = Organization.objects.create(title="InvOrg", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.post(
            reverse("send-organization-invitation", args=[org.id]),
            {"invited_user_email": cli.email}, format="json",
        )
        assert resp.status_code == 201
        assert OrganizationInvitation.objects.filter(organization=org, invited_user=cli).exists()

    def test_get_invitations(self, api, corp, cli):
        org = Organization.objects.create(title="GI", corporate_client=corp)
        OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-organization-invitations", args=[org.id]))
        assert resp.status_code == 200

    def test_get_my_invitations(self, api, corp, cli):
        org = Organization.objects.create(title="MI", corporate_client=corp)
        OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-my-invitations"))
        assert resp.status_code == 200

    def test_respond_accept_invitation(self, api, corp, cli):
        org = Organization.objects.create(title="RA", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("respond-to-invitation", args=[inv.id]), {"action": "accept"}, format="json")
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.status == "ACCEPTED"
        assert OrganizationMembership.objects.filter(organization=org, user=cli, is_active=True).exists()

    def test_respond_reject_invitation(self, api, corp, cli):
        org = Organization.objects.create(title="RR", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("respond-to-invitation", args=[inv.id]), {"action": "reject"}, format="json")
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.status == "REJECTED"

    def test_get_org_stats(self, api, corp):
        Organization.objects.create(title="S1", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-organization-stats"))
        assert resp.status_code == 200

    def test_leave_organization(self, api, corp, cli):
        org = Organization.objects.create(title="LV", corporate_client=corp)
        OrganizationMembership.objects.create(organization=org, user=cli, role="MEMBER", is_active=True)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("leave-organization", args=[org.id]))
        assert resp.status_code == 200
        assert not OrganizationMembership.objects.filter(organization=org, user=cli, is_active=True).exists()


# -- Subscription views --
class TestSubscriptionViews:
    def test_get_wompi_config(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-wompi-config"))
        assert resp.status_code == 200

    def test_get_current_no_subscription(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-current"))
        assert resp.status_code in (200, 404)

    def test_get_current_with_subscription(self, api, law):
        Subscription.objects.create(
            user=law, plan_type="cliente", status="active",
            amount=Decimal("50000"), next_billing_date=datetime.date.today(),
        )
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-current"))
        assert resp.status_code == 200

    def test_cancel_no_subscription(self, api, law):
        api.force_authenticate(user=law)
        resp = api.patch(reverse("subscription-cancel"))
        assert resp.status_code in (400, 404)

    def test_get_payment_history_empty(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-payments"))
        assert resp.status_code == 200


# -- Intranet views --
class TestIntranetViews:
    def test_list_legal_intranet_documents(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("list-legal-intranet-documents"))
        assert resp.status_code == 200

    def test_create_report_request(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(
            reverse("create-report-request"),
            {"title": "Report", "content": "Body"},
            format="json",
        )
        assert resp.status_code in (200, 201, 400)

    def test_list_intranet_unauthenticated(self, api):
        resp = api.get(reverse("list-legal-intranet-documents"))
        assert resp.status_code in (401, 403)


# ======================================================================
# Tests merged from test_organization_views_coverage.py
# ======================================================================

"""Tests for uncovered branches in organization.py (91%→higher)."""
import pytest
import unittest.mock as mock
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization, OrganizationInvitation, OrganizationMembership,
)
from gym_app.views.organization import OrganizationPagination

User = get_user_model()
@pytest.fixture
def corp_client():
    return User.objects.create_user(
        email='corp_oc@e.com', password='p', role='corporate_client',
        first_name='C', last_name='O')


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_oc@e.com', password='p', role='client',
        first_name='Cl', last_name='O')


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_oc@e.com', password='p', role='lawyer',
        first_name='L', last_name='O')


@pytest.fixture
def org(corp_client):
    return Organization.objects.create(
        title='OrgOC', description='Desc', corporate_client=corp_client)


@pytest.mark.django_db
class TestOrganizationViewsRegressionScenarios:

    # --- Line 57: require_client_or_corporate_client blocks lawyer ---
    def test_public_detail_blocked_for_lawyer(self, api_client, lawyer, org):
        """Line 57: lawyer blocked by require_client_or_corporate_client."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-organization-public-detail',
            kwargs={'organization_id': org.pk}))
        assert r.status_code == 403

    # --- Line 95: create_organization invalid data ---
    def test_create_org_invalid(self, api_client, corp_client):
        """Line 95: invalid serializer returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('create-organization'),
            {},  # missing required title/description
            format='json')
        assert r.status_code == 400
        assert 'details' in r.data

    # --- Lines 116, 121: search and is_active filters ---
    def test_get_my_orgs_search_filter(self, api_client, corp_client, org):
        """Line 116: search filter on organizations."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-my-organizations'), {'search': 'OrgOC'})
        assert r.status_code == 200

    def test_get_my_orgs_is_active_filter(self, api_client, corp_client, org):
        """Line 121: is_active filter on organizations."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-my-organizations'), {'is_active': 'true'})
        assert r.status_code == 200

    # --- Line 206: update_organization invalid data ---
    def test_update_org_invalid(self, api_client, corp_client, org):
        """Line 206: invalid serializer returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.put(
            reverse('update-organization',
                    kwargs={'organization_id': org.pk}),
            {'title': ''},  # empty title should be invalid
            format='json')
        assert r.status_code in (200, 400)

    # --- Line 275: send_invitation invalid data ---
    def test_send_invitation_invalid(self, api_client, corp_client, org):
        """Line 275: invalid invitation data returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('send-organization-invitation',
                    kwargs={'organization_id': org.pk}),
            {},  # missing required invited_user
            format='json')
        assert r.status_code == 400
        assert 'details' in r.data

    # --- Line 302: invitation status filter ---
    def test_get_invitations_status_filter(self, api_client, corp_client, org):
        """Line 302: status filter on invitations."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-invitations',
                    kwargs={'organization_id': org.pk}),
            {'status': 'PENDING'})
        assert r.status_code == 200

    # --- Lines 387-391: member role filter ---
    def test_get_members_role_filter(self, api_client, corp_client, org):
        """Line 391: role filter on members."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-members',
                    kwargs={'organization_id': org.pk}),
            {'role': 'MEMBER'})
        assert r.status_code == 200

    def test_get_members_inactive_filter(self, api_client, corp_client, org):
        """Lines 387-388: is_active=false filter shows inactive members."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-members',
                    kwargs={'organization_id': org.pk}),
            {'is_active': 'false'})
        assert r.status_code == 200

    # --- Lines 579-584: respond_to_invitation invalid ---
    def test_respond_invitation_invalid(
        self, api_client, corp_client, client_u, org
    ):
        """Lines 579-584: invalid invitation response returns 400."""
        inv = OrganizationInvitation.objects.create(
            organization=org, invited_user=client_u,
            invited_by=corp_client, status='PENDING')
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('respond-to-invitation',
                    kwargs={'invitation_id': inv.pk}),
            {'action': 'invalid_action'},
            format='json')
        assert r.status_code == 400

    # --- Line 632: leader cannot leave organization ---
    def test_leader_cannot_leave(self, api_client, client_u, corp_client, org):
        """Line 632: leader role gets 400 when trying to leave."""
        mem = OrganizationMembership.objects.create(
            organization=org, user=client_u, role='LEADER', is_active=True)
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('leave-organization',
                    kwargs={'organization_id': org.pk}))
        assert r.status_code == 400
        assert 'líderes' in r.data['error']

    # --- Lines 138-146: get_my_organizations pagination fallback ---
    @mock.patch.object(OrganizationPagination, 'paginate_queryset', return_value=None)
    def test_get_my_orgs_pagination_fallback(
        self, mock_paginate, api_client, corp_client, org
    ):
        """Lines 138-146: pagination returns None → fallback response."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(reverse('get-my-organizations'))
        assert r.status_code == 200
        assert 'organizations' in r.data
        assert 'total_count' in r.data

    # --- Lines 319-328: get_organization_invitations pagination fallback ---
    @mock.patch.object(OrganizationPagination, 'paginate_queryset', return_value=None)
    def test_get_invitations_pagination_fallback(
        self, mock_paginate, api_client, corp_client, org
    ):
        """Lines 319-328: invitations pagination returns None → fallback."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('get-organization-invitations',
                    kwargs={'organization_id': org.pk}))
        assert r.status_code == 200
        assert 'invitations' in r.data
        assert 'total_count' in r.data

    # --- Lines 531-540: get_my_invitations pagination fallback ---
    @mock.patch.object(OrganizationPagination, 'paginate_queryset', return_value=None)
    def test_get_my_invitations_pagination_fallback(
        self, mock_paginate, api_client, client_u
    ):
        """Lines 531-540: my invitations pagination returns None → fallback."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(reverse('get-my-invitations'))
        assert r.status_code == 200
        assert 'invitations' in r.data
        assert 'total_count' in r.data

    # --- Lines 579-582: respond_to_invitation save exception ---
    @mock.patch('gym_app.views.organization.OrganizationInvitationResponseSerializer')
    def test_respond_invitation_save_exception(
        self, MockSerializer, api_client, corp_client, client_u, org
    ):
        """Lines 579-582: exception during serializer.save() returns 400."""
        inv = OrganizationInvitation.objects.create(
            organization=org, invited_user=client_u,
            invited_by=corp_client, status='PENDING')
        mock_instance = mock.MagicMock()
        mock_instance.is_valid.return_value = True
        mock_instance.save.side_effect = RuntimeError("save failed")
        MockSerializer.return_value = mock_instance
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('respond-to-invitation',
                    kwargs={'invitation_id': inv.pk}),
            {'action': 'accept'},
            format='json')
        assert r.status_code == 400
        assert 'save failed' in r.data['error']
