import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from gym_app.models import (
    CorporateRequestType,
    CorporateRequestFiles,
    CorporateRequest,
    CorporateRequestResponse,
    Organization,
    OrganizationMembership,
    User,
)
from gym_app.serializers.corporate_request import (
    CorporateRequestFilesSerializer,
    CorporateRequestResponseSerializer,
    CorporateRequestSerializer,
    CorporateRequestListSerializer,
    CorporateRequestCreateSerializer,
    UserBasicInfoSerializer,
    OrganizationBasicInfoSerializer,
)


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
