import pytest
from unittest.mock import MagicMock, patch, PropertyMock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from django.utils import timezone
from rest_framework import serializers as drf_serializers

from gym_app.models import (
    CorporateRequest,
    CorporateRequestFiles,
    CorporateRequestResponse,
    CorporateRequestType,
    Organization,
    OrganizationMembership,
    User,
)
from gym_app.serializers.corporate_request import (
    CorporateRequestCreateSerializer,
    CorporateRequestFilesSerializer,
    CorporateRequestListSerializer,
    CorporateRequestResponseSerializer,
    CorporateRequestSerializer,
    CorporateRequestUpdateSerializer,
    OrganizationBasicInfoSerializer,
    UserBasicInfoSerializer,
)

factory = RequestFactory()


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
def normal_client():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        first_name="Normal",
        last_name="Client",
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
def corporate_request(organization, normal_client, corporate_client, request_type):
    OrganizationMembership.objects.create(
        organization=organization,
        user=normal_client,
        role="MEMBER",
        is_active=True,
    )

    return CorporateRequest.objects.create(
        client=normal_client,
        organization=organization,
        corporate_client=corporate_client,
        request_type=request_type,
        title="Solicitud",
        description="Descripción",
        priority="MEDIUM",
    )


@pytest.mark.django_db
class TestCorporateRequestFilesSerializer:
    def test_file_serializer_includes_url_name_and_size(self, settings):
        test_file = SimpleUploadedFile(
            "corp_file.pdf",
            b"file-content",
            content_type="application/pdf",
        )
        file_obj = CorporateRequestFiles.objects.create(file=test_file)

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = CorporateRequestFilesSerializer(
            file_obj,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["file_url"] is not None
        # El nombre físico puede incluir un sufijo aleatorio, por eso no comprobamos igualdad exacta
        assert "corp_file" in data["file_name"]
        assert data["file_name"].endswith(".pdf")
        assert data["file_size"] > 0

    def test_file_serializer_without_request_uses_relative_url(self):
        test_file = SimpleUploadedFile(
            "corp_file.pdf",
            b"file-content",
            content_type="application/pdf",
        )
        file_obj = CorporateRequestFiles.objects.create(file=test_file)

        serializer = CorporateRequestFilesSerializer(file_obj)
        data = serializer.data

        assert data["file_url"] == file_obj.file.url
        assert "corp_file" in data["file_name"]


@pytest.mark.django_db
class TestCorporateRequestResponseSerializer:
    def test_response_serializer_sets_user_and_user_type_corporate_client(self, corporate_request, corporate_client):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "corporate_request": corporate_request.id,
            "response_text": "Respuesta corp",
        }
        serializer = CorporateRequestResponseSerializer(
            data=data,
            context={"request": MockRequest(corporate_client)},
        )

        assert serializer.is_valid(), serializer.errors
        response = serializer.save()

        assert response.user == corporate_client
        assert response.user_type == "corporate_client"

    def test_response_serializer_sets_user_type_client(self, corporate_request, normal_client):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "corporate_request": corporate_request.id,
            "response_text": "Respuesta cliente",
        }
        serializer = CorporateRequestResponseSerializer(
            data=data,
            context={"request": MockRequest(normal_client)},
        )

        assert serializer.is_valid(), serializer.errors
        response = serializer.save()

        assert response.user == normal_client
        assert response.user_type == "client"

    def test_response_serializer_user_name(self, corporate_request, corporate_client):
        response = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Respuesta",
            user=corporate_client,
            user_type="corporate_client",
        )

        serializer = CorporateRequestResponseSerializer(response)
        data = serializer.data

        assert data["user_name"] == f"{corporate_client.first_name} {corporate_client.last_name}".strip()

    def test_response_serializer_user_name_empty_when_missing_names(self, corporate_request):
        user = User.objects.create_user(
            email="noname@example.com",
            password="testpassword",
            first_name="",
            last_name="",
            role="corporate_client",
        )
        response = CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="Respuesta",
            user=user,
            user_type="corporate_client",
        )

        serializer = CorporateRequestResponseSerializer(response)
        data = serializer.data

        assert data["user_name"] == ""


@pytest.mark.django_db
class TestCorporateRequestSerializer:
    def test_serializer_computed_fields(self, corporate_request):
        corporate_request.created_at = timezone.now() - timezone.timedelta(days=3)
        corporate_request.save(update_fields=["created_at"])

        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="R1",
            user=corporate_request.corporate_client,
            user_type="corporate_client",
        )

        serializer = CorporateRequestSerializer(corporate_request)
        data = serializer.data

        assert data["status_display"] == corporate_request.get_status_display()
        assert data["priority_display"] == corporate_request.get_priority_display()
        assert data["days_since_created"] >= 3
        assert data["response_count"] == 1


@pytest.mark.django_db
class TestCorporateRequestBasicInfoSerializers:
    def test_user_basic_info_profile_image_url_with_request(self, corporate_client):
        corporate_client.photo_profile.name = "profile_photos/test.jpg"

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = UserBasicInfoSerializer(
            corporate_client,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["profile_image_url"].startswith("http://testserver")
        assert "profile_photos/test.jpg" in data["profile_image_url"]

    def test_user_basic_info_profile_image_url_without_request(self, corporate_client, settings):
        corporate_client.photo_profile.name = "profile_photos/test.jpg"

        serializer = UserBasicInfoSerializer(corporate_client)
        data = serializer.data

        assert data["profile_image_url"] == f"{settings.MEDIA_URL}profile_photos/test.jpg"

    def test_organization_basic_info_profile_image_url_with_request(self, organization):
        organization.profile_image.name = "organization_images/profiles/test.jpg"

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = OrganizationBasicInfoSerializer(
            organization,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["profile_image_url"].startswith("http://testserver")
        assert "organization_images/profiles/test.jpg" in data["profile_image_url"]

    def test_organization_basic_info_profile_image_url_without_request(self, organization):
        organization.profile_image.name = "organization_images/profiles/test.jpg"

        serializer = OrganizationBasicInfoSerializer(organization)
        data = serializer.data

        assert data["profile_image_url"].endswith("organization_images/profiles/test.jpg")


@pytest.mark.django_db
class TestCorporateRequestSerializerCreate:
    def test_only_client_or_basic_can_create_and_must_be_member(self, organization, request_type):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        # Setup client member of org
        client = User.objects.create_user(
            email="member@example.com",
            password="testpassword",
            role="client",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=client,
            role="MEMBER",
            is_active=True,
        )

        data = {
            "organization": organization.id,
            "request_type": request_type.id,
            "title": "Nueva",
            "description": "Desc",
            "priority": "MEDIUM",
            "corporate_client": organization.corporate_client.id,
        }

        serializer = CorporateRequestSerializer(
            data=data,
            context={"request": MockRequest(client)},
        )
        assert serializer.is_valid(), serializer.errors
        req = serializer.save()

        assert req.client == client

        # Usuario no miembro
        other_client = User.objects.create_user(
            email="other@example.com",
            password="testpassword",
            role="client",
        )
        serializer = CorporateRequestSerializer(
            data=data,
            context={"request": MockRequest(other_client)},
        )
        assert not serializer.is_valid()

        # Usuario abogado no permitido
        lawyer = User.objects.create_user(
            email="lawyer@example.com",
            password="testpassword",
            role="lawyer",
        )
        serializer = CorporateRequestSerializer(
            data=data,
            context={"request": MockRequest(lawyer)},
        )
        assert not serializer.is_valid()

    def test_validate_corporate_client_role(self, organization, request_type, normal_client):
        """validate_corporate_client debe exigir rol corporate_client."""
        invalid_corp = User.objects.create_user(
            email="notcorp@example.com",
            password="testpassword",
            role="client",
        )

        data = {
            "organization": organization.id,
            "request_type": request_type.id,
            "title": "Nueva",
            "description": "Desc",
            "priority": "MEDIUM",
            "corporate_client": invalid_corp.id,
        }

        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = CorporateRequestSerializer(
            data=data,
            context={"request": MockRequest(normal_client)},
        )
        assert not serializer.is_valid()
        assert "corporate_client" in serializer.errors


@pytest.mark.django_db
class TestCorporateRequestListSerializer:
    def test_list_serializer_computed_fields(self, corporate_request):
        # Ajustar created_at para simular días transcurridos
        corporate_request.created_at = timezone.now() - timezone.timedelta(days=5)
        corporate_request.save(update_fields=["created_at"])

        # Crear algunas respuestas
        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="R1",
            user=corporate_request.corporate_client,
            user_type="corporate_client",
        )
        CorporateRequestResponse.objects.create(
            corporate_request=corporate_request,
            response_text="R2",
            user=corporate_request.client,
            user_type="client",
        )

        serializer = CorporateRequestListSerializer(corporate_request)
        data = serializer.data

        assert data["response_count"] == 2
        assert data["days_since_created"] >= 5
        assert data["corporate_client_name"] == f"{corporate_request.corporate_client.first_name} {corporate_request.corporate_client.last_name}".strip()


@pytest.mark.django_db
class TestCorporateRequestCreateSerializer:
    def test_create_serializer_requires_membership_and_role(self, organization, request_type):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        client = User.objects.create_user(
            email="client@example.com",
            password="testpassword",
            role="client",
        )

        data = {
            "organization": organization.id,
            "request_type": request_type.id,
            "title": "Nueva",
            "description": "Desc",
            "priority": "MEDIUM",
        }

        # Sin membership debe fallar
        serializer = CorporateRequestCreateSerializer(
            data=data,
            context={"request": MockRequest(client)},
        )
        assert not serializer.is_valid()

        # Agregar membership y debe funcionar
        OrganizationMembership.objects.create(
            organization=organization,
            user=client,
            role="MEMBER",
            is_active=True,
        )
        serializer = CorporateRequestCreateSerializer(
            data=data,
            context={"request": MockRequest(client)},
        )
        assert serializer.is_valid(), serializer.errors
        req = serializer.save()
        assert req.client == client

        # Usuario abogado no puede crear
        lawyer = User.objects.create_user(
            email="lawyer@example.com",
            password="testpassword",
            role="lawyer",
        )
        serializer = CorporateRequestCreateSerializer(
            data=data,
            context={"request": MockRequest(lawyer)},
        )
        assert not serializer.is_valid()


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
        assert serializer.data["user_name"] == f"{client_user.first_name} {client_user.last_name}"

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

@pytest.fixture
def lawyer(db):
    return User.objects.create_user(
        email="dds-lawyer@example.com",
        password="testpassword",
        first_name="Doc",
        last_name="Lawyer",
        role="lawyer",
    )


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        email="dds-client@example.com",
        password="testpassword",
        first_name="Doc",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def client_user2(db):
    return User.objects.create_user(
        email="dds-client2@example.com",
        password="testpassword",
        first_name="Second",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def document(db, lawyer):
    return DynamicDocument.objects.create(
        title="Test Doc",
        content="<p>Content</p>",
        state="Progress",
        created_by=lawyer,
    )


@pytest.fixture
def tag(db, lawyer):
    return Tag.objects.create(name="TestTag", color_id=1, created_by=lawyer)


# ---------------------------------------------------------------------------
# DocumentVariableSerializer validation edges
# ---------------------------------------------------------------------------
@pytest.mark.django_db



@pytest.mark.django_db
class TestCorporateRequestValidateCorporateClient:
    def test_validate_corporate_client_rejects_non_corporate_role(
        self, normal_client, corporate_client, organization, request_type
    ):
        """
        validate_corporate_client raises ValidationError when the user
        is not a corporate_client (line 198).
        """
        OrganizationMembership.objects.create(
            organization=organization, user=normal_client, role="MEMBER",
        )
        request = factory.post("/fake/")
        request.user = normal_client

        serializer = CorporateRequestSerializer(
            data={
                "corporate_client": normal_client.pk,  # not a corporate_client role
                "organization": organization.pk,
                "request_type": request_type.pk,
                "title": "Test",
                "description": "Desc",
            },
            context={"request": request},
        )

        is_valid = serializer.is_valid()

        assert is_valid is False
        assert "corporate_client" in serializer.errors


# ---------------------------------------------------------------------------
# corporate_request.py – lines 205-209: validate_assigned_to
# ---------------------------------------------------------------------------



@pytest.mark.django_db
class TestCorporateRequestValidateAssignedTo:
    def test_validate_assigned_to_with_instance_having_corporate_client(
        self, corporate_request, corporate_client
    ):
        """
        validate_assigned_to passes through when value is truthy and
        instance has corporate_client attribute (lines 205-209).
        """
        request = factory.patch("/fake/")
        request.user = corporate_client

        serializer = CorporateRequestSerializer(
            instance=corporate_request,
            data={"assigned_to": corporate_client.pk},
            partial=True,
            context={"request": request},
        )

        # The validator on assigned_to should run the branch and return value
        assert serializer.is_valid() or "assigned_to" not in serializer.errors


# ---------------------------------------------------------------------------
# corporate_request.py – line 235: get_client_name on CorporateRequestListSerializer
# ---------------------------------------------------------------------------



@pytest.mark.django_db
class TestCorporateRequestListSerializerGetClientName:
    def test_get_client_name_returns_full_name(self, corporate_request):
        """
        get_client_name returns 'first_name last_name' (line 235).
        Note: This method exists on CorporateRequestListSerializer but
        may not be in `fields`. We call it directly.
        """
        serializer = CorporateRequestListSerializer()

        result = serializer.get_client_name(corporate_request)

        assert result == "Normal Client"


# ---------------------------------------------------------------------------
# dynamic_document.py – line 402: get_summary_creation_date returns None
# ---------------------------------------------------------------------------



@pytest.mark.django_db
class TestCorporateRequestValidateCorporateClientDirect:
    def test_validate_corporate_client_direct_call_rejects_non_corp(self, normal_client):
        """
        Call validate_corporate_client directly (bypassing DRF's
        limit_choices_to queryset filter) to exercise line 198.
        """
        serializer = CorporateRequestSerializer()

        with pytest.raises(drf_serializers.ValidationError, match="corporativo"):
            serializer.validate_corporate_client(normal_client)


# ---------------------------------------------------------------------------
# dynamic_document.py – line 607: creator skipped in visibility update
# ---------------------------------------------------------------------------

