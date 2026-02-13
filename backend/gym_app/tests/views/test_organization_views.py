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
def api_client():
    return APIClient()


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
