"""
Edge tests for gym_app/serializers/corporate_request.py to close coverage gaps.

Targets: CorporateRequestFilesSerializer (lines 31, 37, 44-46),
CorporateRequestResponseSerializer.get_user_name (line 65),
CorporateRequestCreateSerializer.validate (lines 265-284),
CorporateRequestUpdateSerializer.validate_assigned_to (lines 303-307),
CorporateRequestListSerializer.get_client_name (line 235).
"""
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers as drf_serializers

from gym_app.models import (
    Organization, OrganizationMembership,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType, CorporateRequestFiles,
    CorporateRequestResponse,
)
from gym_app.serializers.corporate_request import (
    CorporateRequestFilesSerializer,
    CorporateRequestResponseSerializer,
    CorporateRequestCreateSerializer,
    CorporateRequestUpdateSerializer,
    CorporateRequestListSerializer,
)

User = get_user_model()


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def corporate_user(db):
    return User.objects.create_user(
        email="corp-crser@example.com",
        password="testpassword",
        first_name="Corp",
        last_name="User",
        role="corporate_client",
    )


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        email="client-crser@example.com",
        password="testpassword",
        first_name="Client",
        last_name="User",
        role="client",
    )


@pytest.fixture
def organization(db, corporate_user):
    org = Organization.objects.create(
        title="CR Org",
        description="Desc",
        corporate_client=corporate_user,
    )
    return org


@pytest.fixture
def request_type(db):
    return CorporateRequestType.objects.create(name="Support")


@pytest.fixture
def corporate_request(db, client_user, corporate_user, organization, request_type):
    # Client must be a member of the organization
    OrganizationMembership.objects.create(
        organization=organization,
        user=client_user,
        role="MEMBER",
        is_active=True,
    )
    return CorporateRequest.objects.create(
        client=client_user,
        corporate_client=corporate_user,
        organization=organization,
        request_type=request_type,
        title="Test Request",
        description="Desc",
    )


# ---------------------------------------------------------------------------
# CorporateRequestFilesSerializer (lines 31, 37, 44-46)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCorporateRequestFilesSerializerEdges:
    def test_file_url_no_file(self, rf):
        """Cover line 31: no file → return None."""
        obj = CorporateRequestFiles.objects.create()
        request = rf.get("/")
        serializer = CorporateRequestFilesSerializer(obj, context={"request": request})
        data = serializer.data
        assert data["file_url"] is None

    def test_file_name_no_file(self, rf):
        """Cover line 37: no file → file_name is None."""
        obj = CorporateRequestFiles.objects.create()
        request = rf.get("/")
        serializer = CorporateRequestFilesSerializer(obj, context={"request": request})
        assert serializer.data["file_name"] is None

    def test_file_size_no_file(self, rf):
        """Cover line 46: no file → file_size is None."""
        obj = CorporateRequestFiles.objects.create()
        request = rf.get("/")
        serializer = CorporateRequestFilesSerializer(obj, context={"request": request})
        assert serializer.data["file_size"] is None

    def test_file_size_exception(self, rf):
        """Cover lines 44-45: .size raises → return None."""
        f = SimpleUploadedFile("doc.txt", b"content", content_type="text/plain")
        obj = CorporateRequestFiles.objects.create(file=f)
        request = rf.get("/")
        with patch.object(type(obj.file), "size", new_callable=PropertyMock, side_effect=Exception("broken")):
            serializer = CorporateRequestFilesSerializer(obj, context={"request": request})
            assert serializer.data["file_size"] is None

    def test_file_url_no_request(self):
        """Cover line 30: file exists but no request → raw url."""
        f = SimpleUploadedFile("doc2.txt", b"content", content_type="text/plain")
        obj = CorporateRequestFiles.objects.create(file=f)
        serializer = CorporateRequestFilesSerializer(obj)
        data = serializer.data
        assert data["file_url"] is not None
        assert "http" not in str(data["file_url"])


# ---------------------------------------------------------------------------
# CorporateRequestResponseSerializer.get_user_name (line 65)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCorporateRequestResponseSerializerEdges:
    def test_get_user_name_with_user(self, corporate_request, client_user, rf):
        """Cover lines 63-64: user with name."""
        resp = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            user=client_user,
            user_type="client",
            response_text="Response text",
        )
        request = rf.get("/")
        serializer = CorporateRequestResponseSerializer(resp, context={"request": request})
        assert serializer.data["user_name"] == "Client User"

    def test_get_user_name_no_user(self, corporate_request, client_user, rf):
        """Cover line 65: user obj is None → return None."""
        resp = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            user=client_user,
            user_type="client",
            response_text="Response",
        )
        request = rf.get("/")
        # Directly call get_user_name with a mock obj whose user is None
        serializer = CorporateRequestResponseSerializer(context={"request": request})
        mock_obj = MagicMock()
        mock_obj.user = None
        assert serializer.get_user_name(mock_obj) is None


# ---------------------------------------------------------------------------
# CorporateRequestCreateSerializer.validate (lines 265-284)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCorporateRequestCreateSerializerEdges:
    def test_validate_non_client_role_raises(self, corporate_user, organization, request_type, rf):
        """Cover lines 265-268: non-client role raises."""
        request = rf.post("/")
        request.user = corporate_user  # corporate_client, not client
        serializer = CorporateRequestCreateSerializer(
            data={
                "organization": organization.id,
                "request_type": request_type.id,
                "title": "T",
                "description": "D",
                "priority": "medium",
            },
            context={"request": request},
        )
        assert not serializer.is_valid()

    def test_validate_non_member_raises(self, client_user, organization, request_type, rf):
        """Cover lines 276-283: client not member of organization raises."""
        request = rf.post("/")
        request.user = client_user
        serializer = CorporateRequestCreateSerializer(
            data={
                "organization": organization.id,
                "request_type": request_type.id,
                "title": "T",
                "description": "D",
                "priority": "medium",
            },
            context={"request": request},
        )
        assert not serializer.is_valid()


# ---------------------------------------------------------------------------
# CorporateRequestUpdateSerializer.validate_assigned_to (lines 303-307)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCorporateRequestUpdateSerializerEdges:
    def test_validate_assigned_to_none(self):
        """Cover lines 303-307: assigned_to is None → pass."""
        serializer = CorporateRequestUpdateSerializer(
            data={"status": "in_progress"},
            partial=True,
        )
        result = serializer.validate_assigned_to(None)
        assert result is None

    def test_validate_assigned_to_with_value(self, client_user):
        """Cover lines 303-306: assigned_to has value → pass."""
        serializer = CorporateRequestUpdateSerializer(
            data={"status": "in_progress", "assigned_to": client_user.id},
            partial=True,
        )
        result = serializer.validate_assigned_to(client_user)
        assert result == client_user
