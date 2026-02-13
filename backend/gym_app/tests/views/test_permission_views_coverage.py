import pytest
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework.response import Response as DRFResponse

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentVisibilityPermission, DocumentUsabilityPermission
from gym_app.models.corporate_request import CorporateRequest, CorporateRequestType
from gym_app.models.organization import Organization, OrganizationMembership


User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="pvc-lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="pvc-client@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="PVC Coverage Doc",
        content="<p>test</p>",
        state="Draft",
        created_by=lawyer_user,
    )


class TestManageUnifiedLawyerSkipBranches:
    """Tests for lines 269 and 342 in permission_views.py:
    Lawyer users included in target_users are skipped (continue) when
    granting visibility/usability permissions via the unified endpoint.
    """

    def test_unified_visibility_skips_lawyer_in_user_ids(
        self, api_client, lawyer_user, client_user, document
    ):
        """Line 269: lawyer user in visibility.user_ids is skipped,
        only the client user gets a visibility permission created."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "visibility": {
                "user_ids": [lawyer_user.id, client_user.id],
            }
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        granted_ids = {u["user_id"] for u in response.data["results"]["visibility"]["granted"]}
        assert client_user.id in granted_ids
        assert lawyer_user.id not in granted_ids
        assert DocumentVisibilityPermission.objects.filter(
            document=document, user=client_user
        ).exists()
        assert not DocumentVisibilityPermission.objects.filter(
            document=document, user=lawyer_user
        ).exists()

    def test_unified_usability_skips_lawyer_in_user_ids(
        self, api_client, lawyer_user, client_user, document
    ):
        """Line 342: lawyer user in usability.user_ids is skipped,
        only the client user gets a usability permission created."""
        document.is_public = True
        document.save(update_fields=["is_public"])

        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer_user
        )

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": document.id})
        payload = {
            "usability": {
                "user_ids": [lawyer_user.id, client_user.id],
            }
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        granted_ids = {u["user_id"] for u in response.data["results"]["usability"]["granted"]}
        assert client_user.id in granted_ids
        assert lawyer_user.id not in granted_ids
        assert DocumentUsabilityPermission.objects.filter(
            document=document, user=client_user
        ).exists()
        assert not DocumentUsabilityPermission.objects.filter(
            document=document, user=lawyer_user
        ).exists()


class TestFilterDocumentsByVisibilityEdgeCases:
    """Tests for permissions.py line 286: document entry without 'id' is skipped
    in filter_documents_by_visibility decorator."""

    def test_document_without_id_is_skipped(self, lawyer_user, client_user):
        """Line 286: When the wrapped view returns items with missing 'id',
        the decorator silently skips them and only keeps valid entries."""
        from rest_framework.test import APIRequestFactory
        from gym_app.views.dynamic_documents.permissions import filter_documents_by_visibility

        doc = DynamicDocument.objects.create(
            title="Visible Doc",
            content="<p>visible</p>",
            state="Draft",
            created_by=lawyer_user,
            is_public=True,
        )

        @filter_documents_by_visibility
        def fake_view(request):
            return DRFResponse({
                'items': [
                    {'id': doc.id, 'title': 'Valid'},
                    {'title': 'no-id-entry'},  # missing 'id' → line 286
                ],
            })

        factory = APIRequestFactory()
        request = factory.get('/fake/')
        request.user = client_user
        # DRF force_authenticate equivalent for raw request
        from rest_framework.request import Request
        drf_request = Request(request)
        drf_request.user = client_user

        response = fake_view(drf_request)

        # The entry without 'id' should have been silently skipped
        returned_ids = [item['id'] for item in response.data['items']]
        assert doc.id in returned_ids
        assert len(returned_ids) == 1  # only the valid entry


class TestCorporateRequestSerializerValidation:
    """Test for corporate_request.py line 258: serializer validation error
    when client_add_response_to_request receives invalid data."""

    @pytest.fixture
    def corporate_user(self):
        return User.objects.create_user(
            email="pvc-corp@example.com",
            password="testpassword",
            role="corporate_client",
        )

    @pytest.fixture
    def organization(self, corporate_user):
        return Organization.objects.create(
            title="PVC Test Org",
            description="Test organization",
            corporate_client=corporate_user,
        )

    @pytest.fixture
    def corp_request(self, client_user, corporate_user, organization):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            is_active=True,
        )
        req_type = CorporateRequestType.objects.create(name="PVC Test Type")
        return CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_user,
            request_type=req_type,
            title="PVC Test Request",
            description="Test description",
        )

    def test_client_add_response_serializer_error_returns_400(
        self, api_client, client_user, corp_request
    ):
        """Line 258: When the serializer fails validation, the endpoint
        returns 400 with error details instead of creating the response."""
        api_client.force_authenticate(user=client_user)
        url = reverse(
            "client-add-response-to-request",
            kwargs={"request_id": corp_request.id},
        )
        # Patch serializer.is_valid to return False, triggering the else branch
        with patch(
            "gym_app.views.corporate_request.CorporateRequestResponseSerializer"
        ) as MockSerializer:
            mock_instance = MockSerializer.return_value
            mock_instance.is_valid.return_value = False
            mock_instance.errors = {"response_text": ["Invalid data"]}

            response = api_client.post(
                url, {"response_text": "Valid text"}, format="json"
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Error al añadir la respuesta"
        assert "details" in response.data
