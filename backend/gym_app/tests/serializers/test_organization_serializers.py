import pytest
from django.utils import timezone
from rest_framework import serializers

from gym_app.models import (
    CorporateRequest,
    CorporateRequestType,
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    OrganizationPost,
    User,
)
from gym_app.serializers.organization import (
    OrganizationListSerializer,
    OrganizationMembershipSerializer,
    OrganizationPostListSerializer,
    OrganizationPostSerializer,
    OrganizationPostUpdateSerializer,
    OrganizationSearchSerializer,
    OrganizationSerializer,
    OrganizationStatsSerializer,
    UserBasicInfoSerializer,
    OrganizationCreateSerializer,
    OrganizationInvitationSerializer,
    OrganizationInvitationCreateSerializer,
    OrganizationInvitationResponseSerializer,
    OrganizationPostCreateSerializer,
)


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
class TestUserBasicInfoSerializer:
    def test_full_name_and_profile_image_url(self, corporate_client, settings):
        """UserBasicInfoSerializer debe devolver full_name y URL de imagen de perfil."""
        # Asignar foto de perfil simulada
        corporate_client.photo_profile.name = "profile_photos/test.jpg"

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = UserBasicInfoSerializer(
            corporate_client,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["full_name"] == "Corp Leader"
        assert data["profile_image_url"].startswith("http://testserver")
        assert "profile_photos/test.jpg" in data["profile_image_url"]


@pytest.mark.django_db
class TestOrganizationCreateSerializer:
    def test_corporate_client_can_create_organization_and_leader_membership(self, corporate_client):
        """Solo corporate_client puede crear organización y se crea membership LEADER."""

        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "title": "Nueva Org",
            "description": "Desc",
        }

        serializer = OrganizationCreateSerializer(
            data=data,
            context={"request": MockRequest(corporate_client)},
        )

        assert serializer.is_valid(), serializer.errors
        org = serializer.save()

        assert org.corporate_client == corporate_client
        membership = OrganizationMembership.objects.get(
            organization=org,
            user=corporate_client,
        )
        assert membership.role == "LEADER"

    def test_non_corporate_client_cannot_create_organization(self, client_user):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "title": "Org",
            "description": "Desc",
        }

        serializer = OrganizationCreateSerializer(
            data=data,
            context={"request": MockRequest(client_user)},
        )

        assert not serializer.is_valid()


@pytest.mark.django_db
class TestOrganizationInvitationSerializers:
    def test_organization_invitation_serializer_flags(self, organization, client_user, corporate_client):
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=5),
        )

        serializer = OrganizationInvitationSerializer(invitation)
        data = serializer.data

        assert data["is_expired"] == invitation.is_expired()
        assert data["can_be_responded"] == invitation.can_be_responded()

    def test_organization_invitation_create_serializer_validates_membership_and_pending(self, organization, client_user, corporate_client):
        """No debe permitir invitación si ya es miembro o ya hay invitación pendiente."""

        class MockRequest:
            def __init__(self, user):
                self.user = user

        # Caso 1: ya es miembro activo
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )

        serializer = OrganizationInvitationCreateSerializer(
            data={"invited_user_email": client_user.email},
            context={"organization": organization, "request": MockRequest(corporate_client)},
        )

        assert not serializer.is_valid()

        # Quitar membresía y crear invitación pendiente
        OrganizationMembership.objects.all().delete()
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=5),
        )

        serializer = OrganizationInvitationCreateSerializer(
            data={"invited_user_email": client_user.email},
            context={"organization": organization, "request": MockRequest(corporate_client)},
        )

        assert not serializer.is_valid()

    def test_organization_invitation_response_serializer_accept_and_reject(self, organization, client_user, corporate_client):
        """Response serializer debe delegar en accept/reject y devolver la instancia."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=5),
        )

        # Aceptar
        serializer = OrganizationInvitationResponseSerializer(invitation, data={"action": "accept"})
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.status == "ACCEPTED"

        # Crear otra invitación para probar reject
        invitation2 = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=User.objects.create_user(
                email="other@example.com",
                password="testpassword",
                role="client",
            ),
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=5),
        )

        serializer = OrganizationInvitationResponseSerializer(invitation2, data={"action": "reject"})
        assert serializer.is_valid(), serializer.errors
        updated2 = serializer.save()
        assert updated2.status == "REJECTED"


@pytest.mark.django_db
class TestOrganizationPostCreateSerializer:
    def test_leader_corporate_client_can_create_post(self, organization, corporate_client):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "title": "Post",
            "content": "Contenido",
            "organization": organization.id,
            "is_pinned": True,
        }

        serializer = OrganizationPostCreateSerializer(
            data=data,
            context={"request": MockRequest(corporate_client)},
        )
        assert serializer.is_valid(), serializer.errors
        post = serializer.save()

        assert post.author == corporate_client
        assert post.organization == organization

    def test_non_corporate_client_cannot_create_post(self, organization, client_user):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "title": "Post",
            "content": "Contenido",
            "organization": organization.id,
        }

        serializer = OrganizationPostCreateSerializer(
            data=data,
            context={"request": MockRequest(client_user)},
        )

        assert not serializer.is_valid()

    def test_post_create_serializer_validates_links_and_leader(self, organization, corporate_client, client_user):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        # link_name sin link_url
        data = {
            "title": "Post",
            "content": "Contenido",
            "organization": organization.id,
            "link_name": "Ver más",
        }
        serializer = OrganizationPostCreateSerializer(
            data=data,
            context={"request": MockRequest(corporate_client)},
        )
        assert not serializer.is_valid()

        # link_url sin link_name
        data = {
            "title": "Post",
            "content": "Contenido",
            "organization": organization.id,
            "link_url": "https://example.com",
        }
        serializer = OrganizationPostCreateSerializer(
            data=data,
            context={"request": MockRequest(corporate_client)},
        )
        assert not serializer.is_valid()

        # Usuario corporate_client que no es líder de la organización
        other_corp = User.objects.create_user(
            email="othercorp@example.com",
            password="testpassword",
            role="corporate_client",
        )
        data = {
            "title": "Post",
            "content": "Contenido",
            "organization": organization.id,
        }
        serializer = OrganizationPostCreateSerializer(
            data=data,
            context={"request": MockRequest(other_corp)},
        )
        assert not serializer.is_valid()


@pytest.mark.django_db
class TestOrganizationListSerializer:
    def test_list_serializer_defaults_without_images_or_members(self, organization):
        serializer = OrganizationListSerializer(organization)
        data = serializer.data

        assert data["member_count"] == 0
        assert data["pending_invitations_count"] == 0
        assert data["profile_image_url"] is None
        assert data["cover_image_url"] is None

    def test_list_serializer_counts_and_images_with_request(self, organization, corporate_client, client_user):
        organization.profile_image.name = "organization_images/profiles/test.jpg"
        organization.cover_image.name = "organization_images/covers/test.jpg"

        OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=User.objects.create_user(
                email="inactive@example.com",
                password="testpassword",
                role="client",
            ),
            role="MEMBER",
            is_active=False,
        )

        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=User.objects.create_user(
                email="invitee@example.com",
                password="testpassword",
                role="client",
            ),
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=3),
        )
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=User.objects.create_user(
                email="invitee2@example.com",
                password="testpassword",
                role="client",
            ),
            invited_by=corporate_client,
            status="ACCEPTED",
            expires_at=timezone.now() + timezone.timedelta(days=3),
        )

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = OrganizationListSerializer(
            organization,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["member_count"] == 2
        assert data["pending_invitations_count"] == 1
        assert data["profile_image_url"].startswith("http://testserver")
        assert "organization_images/profiles/test.jpg" in data["profile_image_url"]
        assert data["cover_image_url"].startswith("http://testserver")
        assert "organization_images/covers/test.jpg" in data["cover_image_url"]

    def test_list_serializer_images_without_request(self, organization):
        organization.profile_image.name = "organization_images/profiles/test.jpg"
        organization.cover_image.name = "organization_images/covers/test.jpg"

        serializer = OrganizationListSerializer(organization)
        data = serializer.data

        assert data["profile_image_url"].endswith("organization_images/profiles/test.jpg")
        assert data["cover_image_url"].endswith("organization_images/covers/test.jpg")


@pytest.mark.django_db
class TestOrganizationSerializer:
    def test_detail_serializer_defaults_without_members_or_images(self, organization):
        serializer = OrganizationSerializer(organization)
        data = serializer.data

        assert data["member_count"] == 0
        assert data["pending_invitations_count"] == 0
        assert data["recent_requests_count"] == 0
        assert data["members"] == []
        assert data["profile_image_url"] is None
        assert data["cover_image_url"] is None

    def test_detail_serializer_members_and_recent_requests(self, organization, corporate_client, client_user):
        organization.profile_image.name = "organization_images/profiles/test.jpg"
        organization.cover_image.name = "organization_images/covers/test.jpg"

        OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=User.objects.create_user(
                email="inactive-member@example.com",
                password="testpassword",
                role="client",
            ),
            role="MEMBER",
            is_active=False,
        )

        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=User.objects.create_user(
                email="pending@example.com",
                password="testpassword",
                role="client",
            ),
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=3),
        )

        request_type = CorporateRequestType.objects.create(name="Consulta")
        recent_request = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Reciente",
            description="Desc",
        )
        old_request = CorporateRequest.objects.create(
            client=client_user,
            organization=organization,
            corporate_client=corporate_client,
            request_type=request_type,
            title="Antigua",
            description="Desc",
        )
        old_request.created_at = timezone.now() - timezone.timedelta(days=40)
        old_request.save(update_fields=["created_at"])

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = OrganizationSerializer(
            organization,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["member_count"] == 2
        assert data["pending_invitations_count"] == 1
        assert data["recent_requests_count"] == 1

        members = {member["email"] for member in data["members"]}
        assert corporate_client.email in members
        assert client_user.email in members
        assert "inactive-member@example.com" not in members

        assert data["profile_image_url"].startswith("http://testserver")
        assert data["cover_image_url"].startswith("http://testserver")
        assert recent_request.title == "Reciente"


@pytest.mark.django_db
class TestOrganizationMembershipSerializer:
    def test_membership_serializer_fields(self, organization, client_user):
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="ADMIN",
        )

        serializer = OrganizationMembershipSerializer(membership)
        data = serializer.data

        assert data["organization_title"] == organization.title
        assert data["role_display"] == "Administrador"
        assert data["user_info"]["email"] == client_user.email
        assert data["user_info"]["full_name"] == "Client User"


@pytest.mark.django_db
class TestOrganizationStatsSerializer:
    def test_stats_serializer_valid_data(self):
        payload = {
            "total_organizations": 2,
            "total_members": 5,
            "total_pending_invitations": 1,
            "recent_requests_count": 3,
            "active_organizations_count": 2,
            "organizations_by_status": {"active": 2, "inactive": 0},
            "recent_invitations_count": 1,
        }

        serializer = OrganizationStatsSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["total_organizations"] == 2


@pytest.mark.django_db
class TestOrganizationSearchSerializer:
    def test_search_serializer_valid_data(self):
        payload = {
            "search": "Org",
            "is_active": True,
            "created_after": timezone.now() - timezone.timedelta(days=7),
            "created_before": timezone.now(),
            "min_members": 1,
            "max_members": 10,
        }

        serializer = OrganizationSearchSerializer(data=payload)
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["search"] == "Org"

    def test_search_serializer_invalid_min_members(self):
        serializer = OrganizationSearchSerializer(data={"min_members": -1})
        assert not serializer.is_valid()
        assert "min_members" in serializer.errors

    def test_search_serializer_invalid_max_members(self):
        serializer = OrganizationSearchSerializer(data={"max_members": -5})
        assert not serializer.is_valid()
        assert "max_members" in serializer.errors


@pytest.mark.django_db
class TestOrganizationPostSerializer:
    def test_post_serializer_create_and_representation(self, organization, corporate_client):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        data = {
            "title": "Post",
            "content": "Contenido",
            "link_name": "Más",
            "link_url": "https://example.com",
            "organization": organization.id,
        }

        serializer = OrganizationPostSerializer(
            data=data,
            context={"request": MockRequest(corporate_client)},
        )
        assert serializer.is_valid(), serializer.errors
        post = serializer.save()

        assert post.author == corporate_client

        data = OrganizationPostSerializer(post).data
        assert data["has_link"] is True
        assert data["organization_title"] == organization.title
        assert data["author_info"]["full_name"] == "Corp Leader"

    def test_post_serializer_rejects_missing_link_url(self, organization, corporate_client):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = OrganizationPostSerializer(
            data={
                "title": "Post",
                "content": "Contenido",
                "link_name": "Más",
                "organization": organization.id,
            },
            context={"request": MockRequest(corporate_client)},
        )

        assert not serializer.is_valid()
        assert "Si se proporciona un nombre de enlace" in serializer.errors["non_field_errors"][0]

    def test_post_serializer_rejects_missing_link_name(self, organization, corporate_client):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = OrganizationPostSerializer(
            data={
                "title": "Post",
                "content": "Contenido",
                "link_url": "https://example.com",
                "organization": organization.id,
            },
            context={"request": MockRequest(corporate_client)},
        )

        assert not serializer.is_valid()
        assert "Si se proporciona una URL" in serializer.errors["non_field_errors"][0]

    def test_post_serializer_rejects_non_leader(self, organization):
        other_corp = User.objects.create_user(
            email="othercorp@example.com",
            password="testpassword",
            role="corporate_client",
        )

        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = OrganizationPostSerializer(
            data={
                "title": "Post",
                "content": "Contenido",
                "organization": organization.id,
            },
            context={"request": MockRequest(other_corp)},
        )

        assert not serializer.is_valid()
        assert "Solo el líder" in serializer.errors["non_field_errors"][0]

    def test_post_serializer_create_rejects_non_corporate_user(self, organization, client_user):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = OrganizationPostSerializer(
            context={"request": MockRequest(client_user)}
        )

        with pytest.raises(serializers.ValidationError):
            serializer.create(
                {
                    "title": "Post",
                    "content": "Contenido",
                    "organization": organization,
                }
            )


@pytest.mark.django_db
class TestOrganizationPostListSerializer:
    def test_post_list_serializer_fields(self, organization, corporate_client):
        post = OrganizationPost.objects.create(
            title="Post",
            content="Contenido",
            link_name="Más",
            link_url="https://example.com",
            organization=organization,
            author=corporate_client,
        )

        serializer = OrganizationPostListSerializer(post)
        data = serializer.data

        assert data["author_name"] == "Corp Leader"
        assert data["has_link"] is True

    def test_post_list_serializer_has_link_false(self, organization, corporate_client):
        post = OrganizationPost.objects.create(
            title="Post",
            content="Contenido",
            organization=organization,
            author=corporate_client,
        )

        serializer = OrganizationPostListSerializer(post)
        data = serializer.data

        assert data["has_link"] is False


@pytest.mark.django_db
class TestOrganizationPostUpdateSerializer:
    def test_post_update_serializer_validates_link_pairing(self, organization, corporate_client):
        post = OrganizationPost.objects.create(
            title="Post",
            content="Contenido",
            organization=organization,
            author=corporate_client,
        )

        serializer = OrganizationPostUpdateSerializer(post, data={"link_name": "Más"}, partial=True)
        assert not serializer.is_valid()
        assert "link_url" in serializer.errors

        serializer = OrganizationPostUpdateSerializer(
            post,
            data={"link_url": "https://example.com"},
            partial=True,
        )
        assert not serializer.is_valid()
        assert "link_name" in serializer.errors
