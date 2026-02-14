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


# ======================================================================
# Tests migrated from test_views_batch6.py
# ======================================================================

"""
Batch 6 – Coverage-gap tests for corporate_request views and organization views.
Covers: role-based decorator rejections, filter params, non-paginated fallbacks,
serializer errors, nested response_text dict, conversation access, invitation
responses, member filters, and leader-cannot-leave logic.
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    CorporateRequest,
    CorporateRequestType,
    CorporateRequestResponse,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_b6@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic_b6@test.com", password="pw", role="basic",
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


@pytest.fixture
@pytest.mark.django_db
def req_type():
    return CorporateRequestType.objects.create(name="General")


@pytest.fixture
@pytest.mark.django_db
def corp_request(client_user, corporate_client, organization, req_type, membership):
    """Depends on membership so client_user is already a member of the org."""
    return CorporateRequest.objects.create(
        title="Test Request B6",
        description="Desc",
        client=client_user,
        corporate_client=corporate_client,
        organization=organization,
        request_type=req_type,
        status="PENDING",
        priority="MEDIUM",
    )


# ===========================================================================
# 1. Role decorator rejections
# ===========================================================================

@pytest.mark.django_db
class TestRoleDecoratorRejections:

    def test_require_client_only_rejects_lawyer(self, api_client, lawyer_user):
        """corporate_request.py line 31 – lawyer blocked from client endpoint."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("client-get-my-organizations")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_require_corporate_client_only_rejects_client(self, api_client, client_user):
        """corporate_request.py line 42 – client blocked from corporate endpoint."""
        api_client.force_authenticate(user=client_user)
        url = reverse("corporate-get-received-requests")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_require_client_or_corporate_rejects_lawyer(self, api_client, lawyer_user):
        """corporate_request.py line 53 / organization.py line 57."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-request-conversation", kwargs={"request_id": 9999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_org_require_corporate_only_rejects_client(self, api_client, client_user):
        """organization.py line 34 – client blocked from corporate org endpoint."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-my-organizations")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_org_require_client_only_rejects_lawyer(self, api_client, lawyer_user):
        """organization.py line 45 – lawyer blocked from client org endpoint."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-my-invitations")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# 2. Corporate request – filter & search params
# ===========================================================================

@pytest.mark.django_db
class TestCorporateRequestFilters:

    def test_client_requests_filter_by_status(
        self, api_client, client_user, corp_request
    ):
        """Lines 166: filter by status."""
        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-my-corporate-requests")
        resp = api_client.get(url, {"status": "PENDING"})
        assert resp.status_code == status.HTTP_200_OK

    def test_client_requests_filter_by_priority(
        self, api_client, client_user, corp_request
    ):
        """Line 168: filter by priority."""
        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-my-corporate-requests")
        resp = api_client.get(url, {"priority": "MEDIUM"})
        assert resp.status_code == status.HTTP_200_OK

    def test_client_requests_filter_by_search(
        self, api_client, client_user, corp_request
    ):
        """Line 170: filter by search term."""
        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-my-corporate-requests")
        resp = api_client.get(url, {"search": "Test Request"})
        assert resp.status_code == status.HTTP_200_OK

    def test_corporate_received_requests_filters(
        self, api_client, corporate_client, corp_request
    ):
        """Lines 285-291: status, priority, assigned_to_me, search filters."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse("corporate-get-received-requests")
        resp = api_client.get(url, {
            "status": "PENDING",
            "priority": "MEDIUM",
            "assigned_to_me": "true",
            "search": "Test",
        })
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 3. Corporate request – add response nested dict format
# ===========================================================================

@pytest.mark.django_db
class TestCorporateResponseNestedDict:

    def test_corporate_add_response_nested_dict(
        self, api_client, corporate_client, corp_request
    ):
        """Lines 405-407: response_text as nested dict."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "corporate-add-response-to-request",
            kwargs={"request_id": corp_request.id},
        )
        resp = api_client.post(url, {
            "response_text": {
                "response_text": "Nested response body",
                "is_internal_note": True,
            }
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_corporate_add_response_empty_text(
        self, api_client, corporate_client, corp_request
    ):
        """Line 414-419: empty response text rejected."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "corporate-add-response-to-request",
            kwargs={"request_id": corp_request.id},
        )
        resp = api_client.post(url, {"response_text": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_client_add_response_empty_text(
        self, api_client, client_user, corp_request
    ):
        """Line 232-236: client empty response text rejected."""
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "client-add-response-to-request",
            kwargs={"request_id": corp_request.id},
        )
        resp = api_client.post(url, {"response_text": ""}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ===========================================================================
# 4. Conversation access – basic user path
# ===========================================================================

@pytest.mark.django_db
class TestConversationAccess:

    def test_basic_user_blocked_from_conversation(
        self, api_client, basic_user, corp_request
    ):
        """Line 520: basic user role that is not 'client' falls to else."""
        # basic_user is role='basic' which is not 'client' or 'corporate_client'
        # The decorator require_client_or_corporate_client allows 'basic',
        # but inside the view the role check only handles 'client' and 'corporate_client'.
        api_client.force_authenticate(user=basic_user)
        url = reverse(
            "get-request-conversation",
            kwargs={"request_id": corp_request.id},
        )
        resp = api_client.get(url)
        # basic passes the decorator but hits the else branch (403)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_client_conversation_access(
        self, api_client, client_user, corp_request
    ):
        """Lines 507-512, 526-528: client sees conversation without internal notes."""
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "get-request-conversation",
            kwargs={"request_id": corp_request.id},
        )
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK
        assert "responses" in resp.data

    def test_corporate_conversation_access(
        self, api_client, corporate_client, corp_request
    ):
        """Lines 513-517, 530-531: corporate client sees all responses."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "get-request-conversation",
            kwargs={"request_id": corp_request.id},
        )
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 5. Organization – filter & search edge cases
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationFilters:

    def test_get_my_organizations_with_search(
        self, api_client, corporate_client, organization
    ):
        """Line 116: search filter."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-my-organizations")
        resp = api_client.get(url, {"search": "Org"})
        assert resp.status_code == status.HTTP_200_OK

    def test_get_my_organizations_with_is_active(
        self, api_client, corporate_client, organization
    ):
        """Line 121: is_active filter."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-my-organizations")
        resp = api_client.get(url, {"is_active": "true"})
        assert resp.status_code == status.HTTP_200_OK

    def test_get_organization_invitations_status_filter(
        self, api_client, corporate_client, organization, client_user
    ):
        """Line 302: status filter on invitations."""
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
        )
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "get-organization-invitations",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.get(url, {"status": "PENDING"})
        assert resp.status_code == status.HTTP_200_OK

    def test_get_organization_members_role_filter(
        self, api_client, corporate_client, organization, membership
    ):
        """Lines 387-391: role and is_active filters."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "get-organization-members",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.get(url, {"role": "MEMBER", "is_active": "false"})
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 6. Organization – invitation responses & leave
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationInvitationFlow:

    def test_respond_accept_invitation(
        self, api_client, corporate_client, organization, client_user
    ):
        """Lines 561-577: accept invitation happy path."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
        )
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "respond-to-invitation",
            kwargs={"invitation_id": invitation.id},
        )
        resp = api_client.post(url, {"action": "accept"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "aceptada" in resp.data["message"]

    def test_respond_reject_invitation(
        self, api_client, corporate_client, organization, client_user
    ):
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
        )
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "respond-to-invitation",
            kwargs={"invitation_id": invitation.id},
        )
        resp = api_client.post(url, {"action": "reject"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "rechazada" in resp.data["message"]

    def test_respond_invalid_action(
        self, api_client, corporate_client, organization, client_user
    ):
        """Line 584: serializer validation error for invalid action."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
        )
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "respond-to-invitation",
            kwargs={"invitation_id": invitation.id},
        )
        resp = api_client.post(url, {"action": "maybe"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_leader_cannot_leave_organization(
        self, api_client, corporate_client, organization
    ):
        """Line 632: leader can't leave."""
        OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
            is_active=True,
        )
        api_client.force_authenticate(user=corporate_client)
        # corporate_client has role='corporate_client', but we need a 'client'
        # user to hit this endpoint. The decorator restricts to client/basic.
        pass

    def test_client_leader_cannot_leave(
        self, api_client, client_user, organization
    ):
        """Line 632: a client with LEADER role cannot leave."""
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="LEADER",
            is_active=True,
        )
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "leave-organization",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "líderes" in resp.data["error"].lower()

    def test_client_member_can_leave(
        self, api_client, client_user, organization, membership
    ):
        """Happy path: regular member leaves."""
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "leave-organization",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        membership.refresh_from_db()
        assert not membership.is_active


# ===========================================================================
# 7. Organization – delete with active requests
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationDelete:

    def test_delete_org_with_active_requests_blocked(
        self, api_client, corporate_client, organization, corp_request
    ):
        """Line 230-233: cannot delete org with active requests."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "delete-organization",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "solicitudes activas" in resp.data["error"]

    def test_delete_org_success(self, api_client, corporate_client, organization):
        """Happy path: org with no active requests is deleted."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "delete-organization",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        assert not Organization.objects.filter(id=organization.id).exists()


# ===========================================================================
# 8. Organization – public detail access
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationPublicDetail:

    def test_corp_client_can_view_own_org(
        self, api_client, corporate_client, organization
    ):
        """Line 660-661: corporate client accesses own org."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "get-organization-public-detail",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_client_member_can_view_org(
        self, api_client, client_user, organization, membership
    ):
        """Lines 662-667: client member accesses org."""
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "get-organization-public-detail",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_non_member_client_blocked(
        self, api_client, organization
    ):
        """Lines 669-672: non-member client blocked."""
        outsider = User.objects.create_user(
            email="outsider@test.com", password="pw", role="client",
        )
        api_client.force_authenticate(user=outsider)
        url = reverse(
            "get-organization-public-detail",
            kwargs={"organization_id": organization.id},
        )
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# 9. Organization – cancel invitation & remove member
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationMemberManagement:

    def test_cancel_pending_invitation(
        self, api_client, corporate_client, organization, client_user
    ):
        """Lines 351-361: cancel pending invitation."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
        )
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "cancel-organization-invitation",
            kwargs={
                "organization_id": organization.id,
                "invitation_id": invitation.id,
            },
        )
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        invitation.refresh_from_db()
        assert invitation.status == "CANCELLED"

    def test_cancel_non_pending_invitation_rejected(
        self, api_client, corporate_client, organization, client_user
    ):
        """Line 352-354: non-pending invitation cannot be cancelled."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="ACCEPTED",
        )
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "cancel-organization-invitation",
            kwargs={
                "organization_id": organization.id,
                "invitation_id": invitation.id,
            },
        )
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_remove_member_success(
        self, api_client, corporate_client, organization, membership
    ):
        """Lines 434-438: remove member."""
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "remove-organization-member",
            kwargs={
                "organization_id": organization.id,
                "user_id": membership.user.id,
            },
        )
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        membership.refresh_from_db()
        assert not membership.is_active

    def test_remove_leader_blocked(
        self, api_client, corporate_client, organization
    ):
        """Lines 429-432: cannot remove leader."""
        leader_membership = OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
            is_active=True,
        )
        api_client.force_authenticate(user=corporate_client)
        url = reverse(
            "remove-organization-member",
            kwargs={
                "organization_id": organization.id,
                "user_id": corporate_client.id,
            },
        )
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "líder" in resp.data["error"].lower()


# ======================================================================
# Tests merged from test_corporate_request_coverage.py
# ======================================================================

"""Tests for uncovered branches in corporate_request.py (89%→higher)."""
import pytest
import unittest.mock as mock
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization, OrganizationMembership,
    CorporateRequest, CorporateRequestType,
)
from gym_app.views.corporate_request import CorporateRequestPagination

User = get_user_model()
@pytest.fixture
def corp_client():
    return User.objects.create_user(
        email='corp_crc@e.com', password='p', role='corporate_client',
        first_name='C', last_name='R')


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_crc@e.com', password='p', role='client',
        first_name='Cl', last_name='R')


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_crc@e.com', password='p', role='lawyer',
        first_name='L', last_name='R')


@pytest.fixture
def org(corp_client):
    return Organization.objects.create(
        title='OrgCRC', description='Desc', corporate_client=corp_client)


@pytest.fixture
def crc_req_type():
    return CorporateRequestType.objects.create(name='TypeCRC')


@pytest.fixture
def crc_corp_request(client_u, corp_client, org, crc_req_type):
    """A corporate request for testing filters and conversations."""
    mem = OrganizationMembership.objects.create(
        organization=org, user=client_u, role='MEMBER', is_active=True)
    return CorporateRequest.objects.create(
        title='ReqCRC', description='Desc',
        client=client_u, corporate_client=corp_client,
        organization=org, request_type=crc_req_type,
        priority='MEDIUM', status='PENDING')


@pytest.mark.django_db
class TestCorporateRequestCoverage:

    # --- Line 31: require_client_only blocks lawyer ---
    def test_client_only_blocks_lawyer(self, api_client, lawyer):
        """Line 31: lawyer blocked by require_client_only decorator."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse('client-get-my-organizations'))
        assert r.status_code == 403

    # --- Line 42: require_corporate_client_only blocks client ---
    def test_corp_only_blocks_client(self, api_client, client_u):
        """Line 42: client blocked by require_corporate_client_only."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(reverse('corporate-get-received-requests'))
        assert r.status_code == 403

    # --- Lines 166-174: client request filters ---
    def test_client_requests_status_filter(
        self, api_client, client_u, crc_corp_request
    ):
        """Line 166: status filter on client requests."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(
            reverse('client-get-my-corporate-requests'),
            {'status': 'PENDING'})
        assert r.status_code == 200

    def test_client_requests_priority_filter(
        self, api_client, client_u, crc_corp_request
    ):
        """Line 168: priority filter on client requests."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(
            reverse('client-get-my-corporate-requests'),
            {'priority': 'MEDIUM'})
        assert r.status_code == 200

    def test_client_requests_search_filter(
        self, api_client, client_u, crc_corp_request
    ):
        """Lines 170-174: search filter on client requests."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(
            reverse('client-get-my-corporate-requests'),
            {'search': 'ReqCRC'})
        assert r.status_code == 200

    # --- Lines 285-298: corporate received requests filters ---
    def test_corp_received_status_filter(
        self, api_client, corp_client, crc_corp_request
    ):
        """Line 285: status filter on received requests."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'status': 'PENDING'})
        assert r.status_code == 200

    def test_corp_received_priority_filter(
        self, api_client, corp_client, crc_corp_request
    ):
        """Line 287: priority filter on received requests."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'priority': 'MEDIUM'})
        assert r.status_code == 200

    def test_corp_received_assigned_to_me(
        self, api_client, corp_client, crc_corp_request
    ):
        """Line 289: assigned_to_me filter."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'assigned_to_me': 'true'})
        assert r.status_code == 200

    def test_corp_received_search_filter(
        self, api_client, corp_client, crc_corp_request
    ):
        """Lines 291-298: search filter on received requests."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(
            reverse('corporate-get-received-requests'),
            {'search': 'ReqCRC'})
        assert r.status_code == 200

    # --- Lines 405-419: corporate add response (dict and empty text) ---
    def test_corp_add_response_empty_text(
        self, api_client, corp_client, crc_corp_request
    ):
        """Lines 414-419: empty response_text returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('corporate-add-response-to-request',
                    kwargs={'request_id': crc_corp_request.pk}),
            {'response_text': ''},
            format='json')
        assert r.status_code == 400
        assert 'vacío' in str(r.data)

    def test_corp_add_response_as_string(
        self, api_client, corp_client, crc_corp_request
    ):
        """Lines 409-410: response_text as plain string."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('corporate-add-response-to-request',
                    kwargs={'request_id': crc_corp_request.pk}),
            {'response_text': 'Valid response text'},
            format='json')
        assert r.status_code == 201

    # --- Line 520: get_request_conversation blocks lawyer ---
    def test_conversation_blocks_lawyer(
        self, api_client, lawyer, crc_corp_request
    ):
        """Line 520: unauthorized role in get_request_conversation."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('get-request-conversation',
                    kwargs={'request_id': crc_corp_request.pk}))
        assert r.status_code == 403

    # --- Lines 187-191: client requests pagination fallback ---
    @mock.patch.object(CorporateRequestPagination, 'paginate_queryset', return_value=None)
    def test_client_requests_pagination_fallback(
        self, mock_paginate, api_client, client_u, crc_corp_request
    ):
        """Lines 187-191: pagination returns None → fallback response."""
        api_client.force_authenticate(user=client_u)
        r = api_client.get(reverse('client-get-my-corporate-requests'))
        assert r.status_code == 200
        assert 'corporate_requests' in r.data
        assert 'total_count' in r.data

    # --- Lines 314-318: corporate received requests pagination fallback ---
    @mock.patch.object(CorporateRequestPagination, 'paginate_queryset', return_value=None)
    def test_corp_received_pagination_fallback(
        self, mock_paginate, api_client, corp_client, crc_corp_request
    ):
        """Lines 314-318: corporate pagination returns None → fallback."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.get(reverse('corporate-get-received-requests'))
        assert r.status_code == 200
        assert 'corporate_requests' in r.data
        assert 'total_count' in r.data

    # --- Line 258: client_add_response serializer error ---
    def test_client_add_response_serializer_error(
        self, api_client, client_u, crc_corp_request
    ):
        """Line 258: serializer.is_valid() fails → 400 with error details."""
        api_client.force_authenticate(user=client_u)
        r = api_client.post(
            reverse('client-add-response-to-request',
                    kwargs={'request_id': crc_corp_request.pk}),
            {'response_text': ''},
            format='json')
        assert r.status_code == 400
        assert 'error' in r.data or 'details' in r.data

    # --- Line 377: corporate_update_request_status serializer error ---
    def test_corp_update_status_serializer_error(
        self, api_client, corp_client, crc_corp_request
    ):
        """Line 377: invalid update data returns 400."""
        api_client.force_authenticate(user=corp_client)
        r = api_client.put(
            reverse('corporate-update-request-status',
                    kwargs={'request_id': crc_corp_request.pk}),
            {'status': 'INVALID_STATUS_VALUE'},
            format='json')
        assert r.status_code == 400
        assert 'error' in r.data or 'details' in r.data

    # --- Line 447: corporate_add_response serializer error ---
    @mock.patch('gym_app.views.corporate_request.CorporateRequestResponseSerializer')
    def test_corp_add_response_serializer_error(
        self, MockSerializer, api_client, corp_client, crc_corp_request
    ):
        """Line 447: serializer.is_valid() fails both times → 400."""
        mock_instance = mock.MagicMock()
        mock_instance.is_valid.return_value = False
        mock_instance.errors = {'response_text': ['This field is required.']}
        MockSerializer.return_value = mock_instance
        api_client.force_authenticate(user=corp_client)
        r = api_client.post(
            reverse('corporate-add-response-to-request',
                    kwargs={'request_id': crc_corp_request.pk}),
            {'response_text': 'valid text'},
            format='json')
        assert r.status_code == 400
        assert 'error' in r.data
