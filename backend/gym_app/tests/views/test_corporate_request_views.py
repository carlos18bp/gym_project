import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone

from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization,
    OrganizationMembership,
    CorporateRequest,
    CorporateRequestType,
    CorporateRequestResponse,
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
        last_name="Client",
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
        title="Org",
        description="Org desc",
        corporate_client=corporate_client,
    )


@pytest.fixture
@pytest.mark.django_db
def request_type():
    return CorporateRequestType.objects.create(name="Consulta")


@pytest.fixture
@pytest.mark.django_db
def corporate_request(organization, corporate_client, client_user, request_type):
    OrganizationMembership.objects.create(
        organization=organization,
        user=client_user,
        role="MEMBER",
        is_active=True,
    )

    return CorporateRequest.objects.create(
        client=client_user,
        organization=organization,
        corporate_client=corporate_client,
        request_type=request_type,
        title="Solicitud",
        description="Descripción",
        priority="MEDIUM",
        status="PENDING",
    )


@pytest.mark.django_db
class TestClientSideCorporateRequests:
    def test_client_get_my_organizations(self, api_client, client_user, corporate_client):
        org1 = Organization.objects.create(title="Org1", description="D1", corporate_client=corporate_client)
        org2 = Organization.objects.create(title="Org2", description="D2", corporate_client=corporate_client)
        other_org = Organization.objects.create(title="OtherOrg", description="OD", corporate_client=corporate_client)

        # Membresías solo en org1 y org2
        OrganizationMembership.objects.create(organization=org1, user=client_user, role="MEMBER", is_active=True)
        OrganizationMembership.objects.create(organization=org2, user=client_user, role="MEMBER", is_active=True)

        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-my-organizations")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        orgs = response.data["organizations"]
        titles = {o["title"] for o in orgs}
        assert {"Org1", "Org2"}.issubset(titles)
        assert "OtherOrg" not in titles

    def test_client_get_request_types(self, api_client, client_user):
        CorporateRequestType.objects.create(name="Tipo1")
        CorporateRequestType.objects.create(name="Tipo2")

        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-request-types")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["request_types"]) == 2

    def test_client_create_corporate_request_requires_membership(self, api_client, client_user, corporate_client, organization, request_type):
        api_client.force_authenticate(user=client_user)

        data = {
            "organization": organization.id,
            "request_type": request_type.id,
            "title": "Nueva",
            "description": "Desc",
            "priority": "MEDIUM",
        }

        # Sin membership → debe fallar
        url = reverse("client-create-corporate-request")
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Con membership → debe crear
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert CorporateRequest.objects.filter(client=client_user, organization=organization).exists()

    def test_client_get_my_corporate_requests_and_detail(self, api_client, client_user, corporate_client, organization, request_type):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        # Dos requests del mismo cliente
        cr1 = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req1",
            description="D1",
            priority="MEDIUM",
            status="PENDING",
        )
        cr2 = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req2",
            description="D2",
            priority="HIGH",
            status="IN_REVIEW",
        )
        # Request de otro cliente
        other_client = User.objects.create_user(
            email="other@example.com",
            password="testpassword",
            role="client",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=other_client,
            role="MEMBER",
            is_active=True,
        )
        CorporateRequest.objects.create(
            client=other_client,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req3",
            description="D3",
            priority="LOW",
            status="PENDING",
        )

        api_client.force_authenticate(user=client_user)

        # Listar mis solicitudes
        url_list = reverse("client-get-my-corporate-requests")
        response = api_client.get(url_list)
        assert response.status_code == status.HTTP_200_OK
        crs = (response.data.get("results") or response.data.get("corporate_requests"))
        ids = {cr["id"] for cr in crs}
        assert {cr1.id, cr2.id}.issubset(ids)

        # Ver detalle de una solicitud propia
        url_detail = reverse("client-get-corporate-request-detail", kwargs={"request_id": cr1.id})
        response = api_client.get(url_detail)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["corporate_request"]["id"] == cr1.id

    def test_client_add_response_to_request(self, api_client, client_user, corporate_request):
        api_client.force_authenticate(user=client_user)

        url = reverse("client-add-response-to-request", kwargs={"request_id": corporate_request.id})
        data = {"response_text": "Respuesta del cliente"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["response"]["response_text"] == "Respuesta del cliente"

        # Campo vacío debe fallar
        response = api_client.post(url, {"response_text": ""}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestCorporateSideCorporateRequests:
    def test_corporate_get_received_requests_filters_by_corporate(self, api_client, corporate_client, client_user, organization, request_type):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        # Requests para corporate_client
        cr1 = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req1",
            description="D1",
            priority="URGENT",
            status="PENDING",
        )
        cr2 = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req2",
            description="D2",
            priority="LOW",
            status="IN_REVIEW",
        )
        # Request de otro corporate en otra organización
        other_corp = User.objects.create_user(
            email="othercorp@example.com",
            password="testpassword",
            role="corporate_client",
        )
        other_org = Organization.objects.create(
            title="OtherOrg",
            description="Other",
            corporate_client=other_corp,
        )
        OrganizationMembership.objects.create(
            organization=other_org,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )
        CorporateRequest.objects.create(
            client=client_user,
            organization=other_org,
            corporate_client=other_corp,
            request_type=request_type,
            title="Req3",
            description="D3",
            priority="MEDIUM",
            status="PENDING",
        )

        api_client.force_authenticate(user=corporate_client)
        url = reverse("corporate-get-received-requests")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        crs = (response.data.get("results") or response.data.get("corporate_requests"))
        ids = {cr["id"] for cr in crs}
        assert {cr1.id, cr2.id}.issubset(ids)

    def test_corporate_get_request_detail_and_update_status(self, api_client, corporate_client, corporate_request):
        api_client.force_authenticate(user=corporate_client)

        # Detalle
        url_detail = reverse("corporate-get-request-detail", kwargs={"request_id": corporate_request.id})
        response = api_client.get(url_detail)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["corporate_request"]["id"] == corporate_request.id

        # Actualización de estado
        url_update = reverse("corporate-update-request-status", kwargs={"request_id": corporate_request.id})
        data = {"status": "RESPONDED"}
        response = api_client.put(url_update, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        corporate_request.refresh_from_db()
        assert corporate_request.status == "RESPONDED"

    def test_corporate_add_response_to_request_nested_payload(self, api_client, corporate_client, corporate_request):
        api_client.force_authenticate(user=corporate_client)

        url = reverse("corporate-add-response-to-request", kwargs={"request_id": corporate_request.id})
        data = {"response_text": {"response_text": "Nota interna", "is_internal_note": True}}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        resp = CorporateRequestResponse.objects.first()
        assert resp.response_text == "Nota interna"
        assert resp.is_internal_note is True

    def test_corporate_get_dashboard_stats(self, api_client, corporate_client, client_user, organization, request_type):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        # Crear solicitudes en varios estados/prioridades
        CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req1",
            description="D1",
            priority="URGENT",
            status="PENDING",
        )
        CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req2",
            description="D2",
            priority="LOW",
            status="IN_REVIEW",
            estimated_completion_date=timezone.now() - timezone.timedelta(days=1),
        )

        api_client.force_authenticate(user=corporate_client)
        url = reverse("corporate-get-dashboard-stats")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert "total_requests" in data
        assert "status_counts" in data
        assert "priority_counts" in data
        assert "recent_requests_count" in data
        assert "assigned_to_me_count" in data
        assert "overdue_count" in data


@pytest.mark.django_db
class TestRequestConversation:
    def test_get_request_conversation_client_vs_corporate(self, api_client, client_user, corporate_client, organization, request_type):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        corporate_request = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req",
            description="Desc",
            priority="MEDIUM",
            status="PENDING",
        )
        # Respuestas: una interna y una visible
        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Visible",
            user=corporate_client,
            user_type="corporate_client",
            is_internal_note=False,
        )
        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Interna",
            user=corporate_client,
            user_type="corporate_client",
            is_internal_note=True,
        )

        url = reverse("get-request-conversation", kwargs={"request_id": corporate_request.id})

        # Cliente solo ve respuestas no internas
        api_client.force_authenticate(user=client_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        texts = {r["response_text"] for r in response.data["responses"]}
        assert "Visible" in texts
        assert "Interna" not in texts

        # Corporate ve todas
        api_client.force_authenticate(user=corporate_client)
        response = api_client.get(url)
        texts = {r["response_text"] for r in response.data["responses"]}
        assert "Visible" in texts
        assert "Interna" in texts

    def test_get_request_conversation_forbidden_for_other_roles(self, api_client, client_user, organization, corporate_client, request_type):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        corporate_request = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Req",
            description="Desc",
            priority="MEDIUM",
            status="PENDING",
        )

        lawyer = User.objects.create_user(
            email="lawyer@example.com",
            password="testpassword",
            role="lawyer",
        )

        api_client.force_authenticate(user=lawyer)
        url = reverse("get-request-conversation", kwargs={"request_id": corporate_request.id})
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN
