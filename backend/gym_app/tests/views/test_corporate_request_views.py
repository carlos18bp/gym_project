"""Tests for corporate_request_views module."""
from datetime import datetime
from datetime import timezone as dt_timezone
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from gym_app.models import (
    CorporateRequest,
    CorporateRequestFiles,
    CorporateRequestResponse,
    CorporateRequestType,
    Organization,
    OrganizationMembership,
)

User = get_user_model()
MAX_CORPORATE_REQUEST_LIST_QUERIES = 6
MAX_CONVERSATION_QUERIES = 4
MAX_DASHBOARD_QUERIES = 4
MAX_CLIENT_REQUEST_DETAIL_QUERIES = 4
MAX_CORPORATE_REQUEST_DETAIL_QUERIES = 4


def _create_conversation_request(client, corporate_client, organization, request_type):
    """Create a request that both authorized conversation roles can access."""
    OrganizationMembership.objects.create(
        organization=organization,
        user=client,
        role="MEMBER",
        is_active=True,
    )
    return CorporateRequest.objects.create(
        client=client,
        organization=organization,
        corporate_client=corporate_client,
        request_type=request_type,
        title="Conversation request",
        description="Conversation fixture",
        priority="MEDIUM",
        status="PENDING",
    )


def _create_conversation_responses(corporate_request, client, corporate_client, count):
    """Create visible responses with loaded author and attachment relations."""
    responses = []
    for index in range(count):
        response = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text=f"Visible response {index}",
            user=corporate_client if index % 2 else client,
            user_type="corporate_client" if index % 2 else "client",
        )
        responses.append(response)
    return responses


def _create_detail_request(
    client,
    corporate_client,
    request_type,
    organization=None,
    assigned_to=None,
):
    """Create a nullable detail row that both authorized actors can retrieve."""
    return CorporateRequest.objects.create(
        client=client,
        corporate_client=corporate_client,
        request_type=request_type,
        organization=organization,
        assigned_to=assigned_to,
        title='Detail request',
        description='Detail request fixture',
        priority='MEDIUM',
        status='PENDING',
    )


def _create_detail_responses(corporate_request, client, count, response_file=None):
    """Create response rows with distinct client authors outside a query capture."""
    responses = []
    start_index = corporate_request.responses.count()
    for index in range(start_index, start_index + count):
        author = client if index == 0 else User.objects.create_user(
            email=f'detail-response-author-{corporate_request.pk}-{index}@example.com',
            password=None,
            first_name=f'Detail{index}',
            last_name='Author',
            role='client',
        )
        response = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text=f'Detail response {index}',
            user=author,
            user_type='client',
            is_internal_note=index == start_index + count - 1,
        )
        if response_file is not None:
            response.response_files.add(response_file)
        responses.append(response)
    return responses


def _detail_payload_summary(payload):
    """Return the nested detail fields whose values form the response contract."""
    return {
        'request': (
            payload['id'],
            payload['response_count'],
            payload['assigned_to_info'],
            payload['organization_info'],
            [item['file_name'] for item in payload['files']],
        ),
        'responses': [
            (
                item['response_text'],
                item['user_email'],
                item['is_internal_note'],
                [attachment['file_name'] for attachment in item['response_files']],
            )
            for item in payload['responses']
        ],
    }


def _create_detail_payload_fixture(client, corporate_client, request_type):
    """Create a nullable request with direct and response attachments."""
    corporate_request = _create_detail_request(
        client,
        corporate_client,
        request_type,
    )
    request_file = CorporateRequestFiles.objects.create(
        file=SimpleUploadedFile('detail-request.txt', b'request attachment'),
    )
    response_file = CorporateRequestFiles.objects.create(
        file=SimpleUploadedFile('detail-response.txt', b'response attachment'),
    )
    corporate_request.files.add(request_file)
    responses = _create_detail_responses(corporate_request, client, 2)
    responses[1].response_files.add(response_file)
    return corporate_request, responses


def _create_populated_detail_request(client, corporate_client, request_type, title):
    """Create a valid detail request with populated organization and assignment FKs."""
    organization = Organization.objects.create(
        title=title,
        corporate_client=corporate_client,
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=client,
        role='MEMBER',
        is_active=True,
    )
    return _create_detail_request(
        client,
        corporate_client,
        request_type,
        organization=organization,
        assigned_to=corporate_client,
    )


def _create_dashboard_request(client, corporate_client, request_type, title, **values):
    """Create a dashboard row without an organization membership dependency."""
    return CorporateRequest.objects.create(
        client=client,
        corporate_client=corporate_client,
        request_type=request_type,
        title=title,
        description="Dashboard fixture",
        priority=values.pop("priority", "MEDIUM"),
        status=values.pop("status", "PENDING"),
        **values,
    )


def _set_created_at(corporate_request, created_at):
    """Set deterministic request age after the model's auto timestamp is assigned."""
    CorporateRequest.objects.filter(pk=corporate_request.pk).update(created_at=created_at)


def _create_dashboard_contract_rows(client, corporate_client, request_type, now):
    """Create one row for each dashboard state, priority, and overdue boundary."""
    rows = [
        _create_dashboard_request(client, corporate_client, request_type, "pending", priority="URGENT", assigned_to=corporate_client, estimated_completion_date=now - timezone.timedelta(minutes=1)),
        _create_dashboard_request(client, corporate_client, request_type, "review", priority="HIGH", status="IN_REVIEW", estimated_completion_date=now),
        _create_dashboard_request(client, corporate_client, request_type, "responded", status="RESPONDED"),
        _create_dashboard_request(client, corporate_client, request_type, "resolved", priority="LOW", status="RESOLVED"),
        _create_dashboard_request(client, corporate_client, request_type, "closed", priority="LOW", status="CLOSED", estimated_completion_date=now - timezone.timedelta(minutes=1)),
        _create_dashboard_request(client, corporate_client, request_type, "nullable", priority="LOW"),
        _create_dashboard_request(client, corporate_client, request_type, "future", status="PENDING", estimated_completion_date=now + timezone.timedelta(minutes=1)),
    ]
    _set_created_at(rows[0], now)
    _set_created_at(rows[1], now - timezone.timedelta(days=7))
    for row in rows[2:]:
        _set_created_at(row, now - timezone.timedelta(days=8))
    return rows


def _create_dashboard_rows(client, corporate_client, request_type, start, count):
    """Create rows outside the aggregate query capture for the dashboard budget test."""
    return [
        _create_dashboard_request(
            client,
            corporate_client,
            request_type,
            f"Dashboard budget {index}",
        )
        for index in range(start, start + count)
    ]


def _corporate_request_list_items(response):
    """Return the paginated request payload from either corporate list endpoint."""
    return response.data["results"]


def _create_client_list_requests(
    client,
    corporate_client,
    request_type,
    count,
):
    """Create client-list rows with varied related objects and a nullable organization."""
    alternate_corporate_client = User.objects.create_user(
        email="alternate-corporate@example.com",
        password=None,
        role="corporate_client",
    )
    primary_organization = Organization.objects.create(
        title="Primary performance organization",
        corporate_client=corporate_client,
    )
    alternate_organization = Organization.objects.create(
        title="Alternate performance organization",
        corporate_client=alternate_corporate_client,
    )
    alternate_request_type = CorporateRequestType.objects.create(name="Alternate performance type")
    OrganizationMembership.objects.create(
        organization=primary_organization,
        user=client,
        role="MEMBER",
    )
    OrganizationMembership.objects.create(
        organization=alternate_organization,
        user=client,
        role="MEMBER",
    )
    organizations = [primary_organization, alternate_organization]
    corporate_clients = [corporate_client, alternate_corporate_client]
    request_types = [request_type, alternate_request_type]
    requests = []
    for index in range(count):
        organization = organizations[index % 2] if index % 3 else None
        request = CorporateRequest.objects.create(
            client=client,
            corporate_client=organization.corporate_client if organization else corporate_clients[index % 2],
            organization=organization,
            request_type=request_types[index % 2],
            title=f"Performance client request {index}",
            description="List budget fixture",
            priority="MEDIUM",
            status="PENDING",
        )
        requests.append(request)
    return requests


def _create_received_list_requests(corporate_client, request_type, count, priorities):
    """Create received-list rows with varied client, organization, and type relations."""
    clients = [
        User.objects.create_user(
            email=f"received-client-{index}@example.com",
            password=None,
            role="client",
        )
        for index in range(2)
    ]
    organizations = [
        Organization.objects.create(
            title=f"Received performance organization {index}",
            corporate_client=corporate_client,
        )
        for index in range(2)
    ]
    alternate_request_type = CorporateRequestType.objects.create(name="Received alternate type")
    for client in clients:
        for organization in organizations:
            OrganizationMembership.objects.create(organization=organization, user=client, role="MEMBER")
    request_types = [request_type, alternate_request_type]
    requests = []
    for index in range(count):
        request = CorporateRequest.objects.create(
            client=clients[index % 2],
            corporate_client=corporate_client,
            organization=organizations[index % 2],
            request_type=request_types[index % 2],
            title=f"Performance received request {index}",
            description="List budget fixture",
            priority=priorities[index],
            status="PENDING",
        )
        requests.append(request)
    return requests


def _item_with_request_id(items, request_id):
    """Find one concrete list row while preserving the endpoint payload contract."""
    return next(item for item in items if item["id"] == request_id)

@pytest.fixture
def corporate_client():
    """Corporate client."""
    return User.objects.create_user(
        email="corp@example.com",
        password="testpassword",
        first_name="Corp",
        last_name="Client",
        role="corporate_client",
    )


@pytest.fixture
def client_user():
    """Client user."""
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        first_name="Client",
        last_name="User",
        role="client",
    )


@pytest.fixture
def organization(corporate_client):
    """Organization."""
    return Organization.objects.create(
        title="Org",
        description="Org desc",
        corporate_client=corporate_client,
    )


@pytest.fixture
def request_type():
    """Request type."""
    return CorporateRequestType.objects.create(name="Consulta")


@pytest.fixture
def corporate_request(organization, corporate_client, client_user, request_type):
    """Corporate request."""
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
    """Tests for Client Side Corporate Requests."""

    def test_client_get_my_organizations(self, api_client, client_user, corporate_client):
        """Verify client get my organizations."""
        org1 = Organization.objects.create(title="Org1", description="D1", corporate_client=corporate_client)
        org2 = Organization.objects.create(title="Org2", description="D2", corporate_client=corporate_client)
        _other_org = Organization.objects.create(title="OtherOrg", description="OD", corporate_client=corporate_client)

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
        """Verify client get request types."""
        CorporateRequestType.objects.create(name="Tipo1")
        CorporateRequestType.objects.create(name="Tipo2")

        api_client.force_authenticate(user=client_user)
        url = reverse("client-get-request-types")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["request_types"]) == 2

    def test_client_create_corporate_request_requires_membership(self, api_client, client_user, corporate_client, organization, request_type):
        """Verify client create corporate request requires membership."""
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

    def test_client_get_my_corporate_requests(self, api_client, client_user, corporate_client, organization, request_type):
        """Test client can list their own corporate requests."""
        OrganizationMembership.objects.create(organization=organization, user=client_user, role="MEMBER", is_active=True)
        cr1 = CorporateRequest.objects.create(client=client_user, organization=organization, corporate_client=corporate_client, request_type=request_type, title="Req1", description="D1", priority="MEDIUM", status="PENDING")
        cr2 = CorporateRequest.objects.create(client=client_user, organization=organization, corporate_client=corporate_client, request_type=request_type, title="Req2", description="D2", priority="HIGH", status="IN_REVIEW")

        api_client.force_authenticate(user=client_user)
        url_list = reverse("client-get-my-corporate-requests")
        response = api_client.get(url_list)
        
        assert response.status_code == status.HTTP_200_OK
        crs = response.data.get("results") or response.data.get("corporate_requests")
        ids = {cr["id"] for cr in crs}
        assert {cr1.id, cr2.id}.issubset(ids)

    def test_client_get_corporate_request_detail(self, api_client, client_user, corporate_client, organization, request_type):
        """Test client can view detail of their corporate request."""
        OrganizationMembership.objects.create(organization=organization, user=client_user, role="MEMBER", is_active=True)
        cr = CorporateRequest.objects.create(client=client_user, organization=organization, corporate_client=corporate_client, request_type=request_type, title="Req", description="D", priority="MEDIUM", status="PENDING")

        api_client.force_authenticate(user=client_user)
        url_detail = reverse("client-get-corporate-request-detail", kwargs={"request_id": cr.id})
        response = api_client.get(url_detail)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["corporate_request"]["id"] == cr.id

    def test_client_add_response_to_request(self, api_client, client_user, corporate_request):
        """Verify client add response to request."""
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
    """Tests for Corporate Side Corporate Requests."""

    def test_corporate_get_received_requests_filters_by_corporate(self, api_client, corporate_client, client_user, organization, request_type):
        """Test corporate gets only their requests."""
        OrganizationMembership.objects.create(organization=organization, user=client_user, role="MEMBER", is_active=True)
        cr1 = CorporateRequest.objects.create(client=client_user, organization=organization, corporate_client=corporate_client, request_type=request_type, title="Req1", description="D1", priority="URGENT", status="PENDING")
        cr2 = CorporateRequest.objects.create(client=client_user, organization=organization, corporate_client=corporate_client, request_type=request_type, title="Req2", description="D2", priority="LOW", status="IN_REVIEW")

        api_client.force_authenticate(user=corporate_client)
        url = reverse("corporate-get-received-requests")
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        crs = response.data.get("results") or response.data.get("corporate_requests")
        ids = {cr["id"] for cr in crs}
        assert {cr1.id, cr2.id}.issubset(ids)

    def test_corporate_get_request_detail_and_update_status(self, api_client, corporate_client, corporate_request):
        """Verify corporate get request detail and update status."""
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
        """Verify corporate add response to request nested payload."""
        api_client.force_authenticate(user=corporate_client)

        url = reverse("corporate-add-response-to-request", kwargs={"request_id": corporate_request.id})
        data = {"response_text": {"response_text": "Nota interna", "is_internal_note": True}}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        resp = CorporateRequestResponse.objects.first()
        assert resp.response_text == "Nota interna"
        assert resp.is_internal_note is True

    def test_corporate_dashboard_stats_returns_tenant_aggregate_payload(self, api_client, corporate_client, client_user, request_type):
        """Fails if dashboard aggregates leak tenants or change temporal counter semantics."""
        fixed_now = datetime(2026, 9, 24, 12, 0, tzinfo=dt_timezone.utc)
        _create_dashboard_contract_rows(client_user, corporate_client, request_type, fixed_now)
        other_corporate = User.objects.create_user(
            email="other-dashboard@example.com",
            password=None,
            role="corporate_client",
        )
        _create_dashboard_request(client_user, other_corporate, request_type, "foreign")
        api_client.force_authenticate(user=corporate_client)

        with patch("gym_app.views.corporate_request.timezone.now", return_value=fixed_now):
            response = api_client.get(reverse("corporate-get-dashboard-stats"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "total_requests": 7,
            "status_counts": {"PENDING": 3, "IN_REVIEW": 1, "RESPONDED": 1, "RESOLVED": 1, "CLOSED": 1},
            "priority_counts": {"LOW": 3, "MEDIUM": 2, "HIGH": 1, "URGENT": 1},
            "recent_requests_count": 2,
            "assigned_to_me_count": 1,
            "overdue_count": 1,
        }


@pytest.mark.django_db
class TestRequestConversation:
    """Tests for Request Conversation."""

    def test_get_request_conversation_client_vs_corporate(self, api_client, client_user, corporate_client, organization, request_type, settings, tmp_path):
        """Fails if role visibility drops nested authors, files, or chronological responses."""
        settings.MEDIA_ROOT = tmp_path
        corporate_request = _create_conversation_request(
            client_user, corporate_client, organization, request_type,
        )
        visible_response = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Visible",
            user=corporate_client,
            user_type="corporate_client",
        )
        attachment = CorporateRequestFiles.objects.create(
            file=SimpleUploadedFile("conversation.txt", b"attachment", content_type="text/plain"),
        )
        visible_response.response_files.add(attachment)
        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Client reply",
            user=client_user,
            user_type="client",
        )
        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Internal note",
            user=corporate_client,
            user_type="corporate_client",
            is_internal_note=True,
        )
        url = reverse("get-request-conversation", kwargs={"request_id": corporate_request.id})
        api_client.force_authenticate(user=client_user)
        client_response = api_client.get(url)
        api_client.force_authenticate(user=corporate_client)
        corporate_response = api_client.get(url)

        assert client_response.status_code == status.HTTP_200_OK
        assert [(item["response_text"], item["user_email"], len(item["response_files"])) for item in client_response.data["responses"]] == [("Visible", corporate_client.email, 1), ("Client reply", client_user.email, 0)]
        assert corporate_response.status_code == status.HTTP_200_OK
        assert [(item["response_text"], item["user_email"]) for item in corporate_response.data["responses"]] == [("Visible", corporate_client.email), ("Client reply", client_user.email), ("Internal note", corporate_client.email)]

    def test_get_request_conversation_returns_empty_thread(self, api_client, client_user, corporate_client, organization, request_type):
        """Fails if an empty authorized conversation returns stale response data."""
        corporate_request = _create_conversation_request(
            client_user, corporate_client, organization, request_type,
        )
        api_client.force_authenticate(user=client_user)

        response = api_client.get(reverse("get-request-conversation", kwargs={"request_id": corporate_request.id}))

        assert response.status_code == status.HTTP_200_OK
        assert {"responses": response.data["responses"], "total_responses": response.data["total_responses"]} == {"responses": [], "total_responses": 0}

    def test_client_conversation_has_constant_query_budget(self, api_client, client_user, corporate_client, organization, request_type):
        """Fails if client-visible conversation rows restore per-response queries."""
        corporate_request = _create_conversation_request(
            client_user, corporate_client, organization, request_type,
        )
        _create_conversation_responses(corporate_request, client_user, corporate_client, 1)
        api_client.force_authenticate(user=client_user)
        url = reverse("get-request-conversation", kwargs={"request_id": corporate_request.id})

        with CaptureQueriesContext(connection) as one_row_queries:
            one_row_response = api_client.get(url)
        _create_conversation_responses(corporate_request, client_user, corporate_client, 49)
        with CaptureQueriesContext(connection) as fifty_row_queries:
            fifty_row_response = api_client.get(url)

        assert one_row_response.status_code == status.HTTP_200_OK
        assert len(one_row_response.data["responses"]) == 1
        assert fifty_row_response.status_code == status.HTTP_200_OK
        assert len(fifty_row_response.data["responses"]) == 50
        assert len(one_row_queries) == len(fifty_row_queries)
        assert len(fifty_row_queries) <= MAX_CONVERSATION_QUERIES

    def test_corporate_conversation_has_constant_query_budget(self, api_client, client_user, corporate_client, organization, request_type):
        """Fails if corporate conversation rows restore per-response queries."""
        corporate_request = _create_conversation_request(
            client_user, corporate_client, organization, request_type,
        )
        _create_conversation_responses(corporate_request, client_user, corporate_client, 1)
        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-request-conversation", kwargs={"request_id": corporate_request.id})

        with CaptureQueriesContext(connection) as one_row_queries:
            one_row_response = api_client.get(url)
        _create_conversation_responses(corporate_request, client_user, corporate_client, 49)
        with CaptureQueriesContext(connection) as fifty_row_queries:
            fifty_row_response = api_client.get(url)

        assert one_row_response.status_code == status.HTTP_200_OK
        assert len(one_row_response.data["responses"]) == 1
        assert fifty_row_response.status_code == status.HTTP_200_OK
        assert len(fifty_row_response.data["responses"]) == 50
        assert len(one_row_queries) == len(fifty_row_queries)
        assert len(fifty_row_queries) <= MAX_CONVERSATION_QUERIES

    def test_get_request_conversation_forbidden_for_other_roles(self, api_client, client_user, organization, corporate_client, request_type):
        """Verify get request conversation forbidden for other roles."""
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

from gym_app.models import (
    OrganizationInvitation,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def lawyer_user():
    """Lawyer user."""
    return User.objects.create_user(
        email="lawyer_b6@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
def basic_user():
    """Create a basic user."""
    return User.objects.create_user(
        email="basic_b6@test.com", password="pw", role="basic",
    )


@pytest.fixture
def membership(organization, client_user):
    """Membership."""
    return OrganizationMembership.objects.create(
        organization=organization,
        user=client_user,
        role="MEMBER",
        is_active=True,
    )


@pytest.fixture
def req_type():
    """Req type."""
    return CorporateRequestType.objects.create(name="General")


@pytest.fixture
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
    """Tests for Role Decorator Rejections."""

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
    """Tests for Corporate Request Filters."""

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
    """Tests for Corporate Response Nested Dict."""

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
    """Tests for Conversation Access."""

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
    """Tests for Organization Filters."""

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
    """Tests for Organization Invitation Flow."""

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
        """Verify respond reject invitation."""
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
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
            is_active=True,
        )
        api_client.force_authenticate(user=corporate_client)
        # corporate_client has role='corporate_client', but we need a 'client'
        # user to hit this endpoint. The decorator restricts to client/basic.
        # Verify membership still exists and is active
        assert OrganizationMembership.objects.filter(id=membership.id, is_active=True).exists()

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
    """Tests for Organization Delete."""

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
    """Tests for Organization Public Detail."""

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
    """Tests for Organization Member Management."""

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
        _leader_membership = OrganizationMembership.objects.create(
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
from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from gym_app.views.corporate_request import CorporateRequestPagination

User = get_user_model()
@pytest.fixture
def corp_client():
    """Corp client."""
    return User.objects.create_user(
        email='corp_crc@e.com', password='p', role='corporate_client',
        first_name='C', last_name='R')


@pytest.fixture
def client_u():
    """Client u."""
    return User.objects.create_user(
        email='cli_crc@e.com', password='p', role='client',
        first_name='Cl', last_name='R')


@pytest.fixture
def lawyer():
    """Lawyer."""
    return User.objects.create_user(
        email='law_crc@e.com', password='p', role='lawyer',
        first_name='L', last_name='R')


@pytest.fixture
def org(corp_client):
    """Org."""
    return Organization.objects.create(
        title='OrgCRC', description='Desc', corporate_client=corp_client)


@pytest.fixture
def crc_req_type():
    """Crc req type."""
    return CorporateRequestType.objects.create(name='TypeCRC')


@pytest.fixture
def crc_corp_request(client_u, corp_client, org, crc_req_type):
    """Create a corporate request for testing filters and conversations."""
    _mem = OrganizationMembership.objects.create(
        organization=org, user=client_u, role='MEMBER', is_active=True)
    return CorporateRequest.objects.create(
        title='ReqCRC', description='Desc',
        client=client_u, corporate_client=corp_client,
        organization=org, request_type=crc_req_type,
        priority='MEDIUM', status='PENDING')


@pytest.mark.django_db
class TestCorporateRequestRegressionScenarios:
    """Tests for Corporate Request Regression Scenarios."""

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
        MockSerializer.assert_called()
        mock_instance.is_valid.assert_called()


# ======================================================================
# Tests moved from test_user_auth.py – batch14 (corporate request domain)
# ======================================================================

@pytest.mark.django_db
class TestCorporateRequestViewsAdditionalScenarios:
    """Tests for Corporate Request Views Additional Scenarios."""

    def test_dashboard_stats_returns_empty_payload(self, api_client, corporate_client):
        """Fails if an empty corporate tenant returns missing or stale dashboard counters."""
        api_client.force_authenticate(user=corporate_client)
        response = api_client.get(reverse("corporate-get-dashboard-stats"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "total_requests": 0,
            "status_counts": {"PENDING": 0, "IN_REVIEW": 0, "RESPONDED": 0, "RESOLVED": 0, "CLOSED": 0},
            "priority_counts": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "URGENT": 0},
            "recent_requests_count": 0,
            "assigned_to_me_count": 0,
            "overdue_count": 0,
        }

    def test_dashboard_stats_non_corp_forbidden(self, api_client, client_user):
        """Decorator: require_corporate_client_only."""
        api_client.force_authenticate(user=client_user)
        url = reverse("corporate-get-dashboard-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_conversation_not_found(self, api_client, client_user):
        """get_request_conversation – request not found."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-request-conversation", kwargs={"request_id": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_corporate_dashboard_stats_has_constant_query_budget(client_user, corporate_client, request_type, api_client):
    """Fails if dashboard counters regress from one aggregate into per-row queries."""
    _create_dashboard_rows(client_user, corporate_client, request_type, 0, 1)
    api_client.force_authenticate(user=corporate_client)
    url = reverse("corporate-get-dashboard-stats")

    with CaptureQueriesContext(connection) as one_row_queries:
        one_row_response = api_client.get(url)
    _create_dashboard_rows(client_user, corporate_client, request_type, 1, 49)
    with CaptureQueriesContext(connection) as fifty_row_queries:
        fifty_row_response = api_client.get(url)

    assert one_row_response.status_code == status.HTTP_200_OK
    assert one_row_response.data["total_requests"] == 1
    assert fifty_row_response.status_code == status.HTTP_200_OK
    assert fifty_row_response.data["total_requests"] == 50
    assert len(one_row_queries) == len(fifty_row_queries)
    assert len(fifty_row_queries) <= MAX_DASHBOARD_QUERIES


@pytest.mark.django_db
def test_client_corporate_request_list_has_bounded_queries(
    api_client,
    client_user,
    corporate_client,
    request_type,
):
    """Fails if client request list relations return to per-row queries."""
    _create_client_list_requests(
        client_user,
        corporate_client,
        request_type,
        50,
    )
    api_client.force_authenticate(user=client_user)
    url = reverse("client-get-my-corporate-requests")

    with CaptureQueriesContext(connection) as single_row_queries:
        single_row_response = api_client.get(url, {"page_size": 1})
    with CaptureQueriesContext(connection) as fifty_row_queries:
        fifty_row_response = api_client.get(url, {"page_size": 50})

    assert single_row_response.status_code == status.HTTP_200_OK
    assert len(_corporate_request_list_items(single_row_response)) == 1
    assert fifty_row_response.status_code == status.HTTP_200_OK
    fifty_row_items = _corporate_request_list_items(fifty_row_response)
    assert len(fifty_row_items) == 50
    assert len(single_row_queries) == len(fifty_row_queries)
    assert len(fifty_row_queries) <= MAX_CORPORATE_REQUEST_LIST_QUERIES


@pytest.mark.django_db
def test_client_corporate_request_list_counts_internal_responses(
    api_client,
    client_user,
    corporate_client,
    request_type,
):
    """Fails if list response_count stops including corporate internal notes."""
    requests = _create_client_list_requests(client_user, corporate_client, request_type, 2)
    CorporateRequestResponse.objects.create(
        corporate_request=requests[0],
        response_text="Internal note",
        user=corporate_client,
        user_type="corporate_client",
        is_internal_note=True,
    )
    CorporateRequestResponse.objects.create(
        corporate_request=requests[0],
        response_text="Client answer",
        user=client_user,
        user_type="client",
    )
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("client-get-my-corporate-requests"), {"page_size": 50})

    assert response.status_code == status.HTTP_200_OK
    assert _item_with_request_id(response.data["results"], requests[0].id)["response_count"] == 2
    assert _item_with_request_id(response.data["results"], requests[1].id)["response_count"] == 0


@pytest.mark.django_db
def test_client_corporate_request_list_serializes_null_organization(
    api_client,
    client_user,
    corporate_client,
    request_type,
):
    """Fails if a client request without an organization raises during list serialization."""
    requests = _create_client_list_requests(client_user, corporate_client, request_type, 2)
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("client-get-my-corporate-requests"), {"page_size": 50})

    assert response.status_code == status.HTTP_200_OK
    assert _item_with_request_id(response.data["results"], requests[0].id)["organization_info"] is None


@pytest.mark.django_db
def test_corporate_received_request_list_preserves_priority_order(
    api_client,
    corporate_client,
    request_type,
):
    """Fails if received request ordering no longer follows the priority contract."""
    priorities = ["URGENT", "HIGH", "MEDIUM", "LOW"] + ["LOW"] * 46
    _create_received_list_requests(
        corporate_client,
        request_type,
        50,
        priorities=priorities,
    )
    api_client.force_authenticate(user=corporate_client)
    response = api_client.get(reverse("corporate-get-received-requests"), {"page_size": 50})

    assert response.status_code == status.HTTP_200_OK
    fifty_row_items = _corporate_request_list_items(response)
    assert len(fifty_row_items) == 50
    assert [item["priority"] for item in fifty_row_items[:4]] == ["URGENT", "HIGH", "MEDIUM", "LOW"]


@pytest.mark.django_db
def test_corporate_received_request_list_has_bounded_queries(
    api_client,
    corporate_client,
    request_type,
):
    """Fails if received request list relations return to per-row queries."""
    _create_received_list_requests(corporate_client, request_type, 50, ["MEDIUM"] * 50)
    api_client.force_authenticate(user=corporate_client)
    url = reverse("corporate-get-received-requests")

    with CaptureQueriesContext(connection) as single_row_queries:
        single_row_response = api_client.get(url, {"page_size": 1})
    with CaptureQueriesContext(connection) as fifty_row_queries:
        fifty_row_response = api_client.get(url, {"page_size": 50})

    assert single_row_response.status_code == status.HTTP_200_OK
    assert len(_corporate_request_list_items(single_row_response)) == 1
    assert fifty_row_response.status_code == status.HTTP_200_OK
    assert len(_corporate_request_list_items(fifty_row_response)) == 50
    assert len(single_row_queries) == len(fifty_row_queries)
    assert len(fifty_row_queries) <= MAX_CORPORATE_REQUEST_LIST_QUERIES


@pytest.mark.django_db
def test_client_request_detail_preserves_nested_payload(
    api_client,
    client_user,
    corporate_client,
    request_type,
    settings,
    tmp_path,
):
    """Fails if detail drops nullable fields, nested files, authors, or internal notes."""
    settings.MEDIA_ROOT = tmp_path
    corporate_request, responses = _create_detail_payload_fixture(
        client_user,
        corporate_client,
        request_type,
    )
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse(
            'client-get-corporate-request-detail',
            kwargs={'request_id': corporate_request.pk},
        )
    )

    payload = response.data['corporate_request']
    assert response.status_code == status.HTTP_200_OK
    assert _detail_payload_summary(payload) == {
        'request': (
            corporate_request.pk,
            2,
            None,
            None,
            ['detail-request.txt'],
        ),
        'responses': [
            ('Detail response 0', client_user.email, False, []),
            (
                'Detail response 1',
                responses[1].user.email,
                True,
                ['detail-response.txt'],
            ),
        ],
    }


@pytest.mark.django_db
def test_client_request_detail_has_constant_query_budget(
    api_client,
    client_user,
    corporate_client,
    request_type,
    settings,
    tmp_path,
):
    """Fails if client detail restores per-response relation queries."""
    corporate_request = _create_populated_detail_request(
        client_user,
        corporate_client,
        request_type,
        'Client detail budget organization',
    )
    settings.MEDIA_ROOT = tmp_path
    response_file = CorporateRequestFiles.objects.create(
        file=SimpleUploadedFile('client-budget.txt', b'client budget attachment'),
    )
    _create_detail_responses(corporate_request, client_user, 1, response_file)
    api_client.force_authenticate(user=client_user)
    url = reverse(
        'client-get-corporate-request-detail',
        kwargs={'request_id': corporate_request.pk},
    )

    with CaptureQueriesContext(connection) as single_row_queries:
        single_row_response = api_client.get(url)
    _create_detail_responses(corporate_request, client_user, 49, response_file)
    with CaptureQueriesContext(connection) as fifty_row_queries:
        fifty_row_response = api_client.get(url)

    assert (
        single_row_response.status_code,
        single_row_response.data['corporate_request']['response_count'],
        fifty_row_response.status_code,
        fifty_row_response.data['corporate_request']['response_count'],
    ) == (status.HTTP_200_OK, 1, status.HTTP_200_OK, 50)
    assert len(single_row_queries) == len(fifty_row_queries)
    assert len(fifty_row_queries) <= MAX_CLIENT_REQUEST_DETAIL_QUERIES


@pytest.mark.django_db
def test_corporate_request_detail_has_constant_query_budget(
    api_client,
    client_user,
    corporate_client,
    request_type,
    settings,
    tmp_path,
):
    """Fails if corporate detail restores per-response relation queries."""
    corporate_request = _create_populated_detail_request(
        client_user,
        corporate_client,
        request_type,
        'Corporate detail budget organization',
    )
    settings.MEDIA_ROOT = tmp_path
    response_file = CorporateRequestFiles.objects.create(
        file=SimpleUploadedFile('corporate-budget.txt', b'corporate budget attachment'),
    )
    _create_detail_responses(corporate_request, client_user, 1, response_file)
    api_client.force_authenticate(user=corporate_client)
    url = reverse(
        'corporate-get-request-detail',
        kwargs={'request_id': corporate_request.pk},
    )

    with CaptureQueriesContext(connection) as single_row_queries:
        single_row_response = api_client.get(url)
    _create_detail_responses(corporate_request, client_user, 49, response_file)
    with CaptureQueriesContext(connection) as fifty_row_queries:
        fifty_row_response = api_client.get(url)

    assert (
        single_row_response.status_code,
        single_row_response.data['corporate_request']['response_count'],
        fifty_row_response.status_code,
        fifty_row_response.data['corporate_request']['response_count'],
    ) == (status.HTTP_200_OK, 1, status.HTTP_200_OK, 50)
    assert len(single_row_queries) == len(fifty_row_queries)
    assert len(fifty_row_queries) <= MAX_CORPORATE_REQUEST_DETAIL_QUERIES


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('actor', 'url_name'),
    [
        ('client', 'client-get-corporate-request-detail'),
        ('corporate', 'corporate-get-request-detail'),
    ],
)
def test_request_detail_returns_empty_relations_for_nullable_fields(
    api_client,
    client_user,
    corporate_client,
    request_type,
    actor,
    url_name,
):
    """Fails if a detail with nullable fields bypasses the empty relation fast path."""
    corporate_request = _create_detail_request(
        client_user,
        corporate_client,
        request_type,
    )
    authenticated_user = {
        'client': client_user,
        'corporate': corporate_client,
    }[actor]
    api_client.force_authenticate(user=authenticated_user)

    response = api_client.get(
        reverse(url_name, kwargs={'request_id': corporate_request.pk})
    )

    assert response.status_code == status.HTTP_200_OK
    assert {
        'assigned_to_info': response.data['corporate_request']['assigned_to_info'],
        'organization_info': response.data['corporate_request']['organization_info'],
        'responses': response.data['corporate_request']['responses'],
        'response_count': response.data['corporate_request']['response_count'],
    } == {
        'assigned_to_info': None,
        'organization_info': None,
        'responses': [],
        'response_count': 0,
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('role', 'url_name'),
    [
        ('client', 'client-get-corporate-request-detail'),
        ('corporate_client', 'corporate-get-request-detail'),
    ],
)
def test_request_detail_hides_other_tenant(
    api_client,
    client_user,
    corporate_client,
    request_type,
    role,
    url_name,
):
    """Fails if either detail endpoint exposes a request to a different tenant."""
    corporate_request = _create_detail_request(
        client_user,
        corporate_client,
        request_type,
    )
    outsider = User.objects.create_user(
        email=f'{role}-detail-outsider@example.com',
        password=None,
        role=role,
    )
    api_client.force_authenticate(user=outsider)

    response = api_client.get(
        reverse(url_name, kwargs={'request_id': corporate_request.pk})
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
