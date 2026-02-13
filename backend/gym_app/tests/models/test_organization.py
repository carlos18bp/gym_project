import os

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.utils import timezone

from gym_app.models.organization import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    OrganizationPost,
)
from gym_app.models.user import User


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
def basic_user():
    return User.objects.create_user(
        email="basic@example.com",
        password="testpassword",
        first_name="Basic",
        last_name="User",
        role="basic",
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
class TestOrganizationModel:
    def test_organization_clean_requires_corporate_client_role(self, client_user):
        """El líder debe tener rol corporate_client."""
        org = Organization(
            title="Org",
            description="Desc",
            corporate_client=client_user,
        )

        with pytest.raises(ValidationError):
            org.clean()

    def test_organization_member_and_pending_counts(self, organization, client_user):
        """get_member_count y get_pending_invitations_count deben reflejar datos reales."""
        # Un miembro activo y uno inactivo
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
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

        # Invitaciones: 1 pendiente, 1 aceptada
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=organization.corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=User.objects.create_user(
                email="invited@example.com",
                password="testpassword",
                role="client",
            ),
            invited_by=organization.corporate_client,
            status="ACCEPTED",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        assert organization.get_member_count() == 1
        assert organization.get_pending_invitations_count() == 1

    def test_delete_organization_removes_images(self, organization):
        """Al borrar la organización, se deben eliminar las imágenes físicas."""
        profile = SimpleUploadedFile(
            "org_profile.jpg",
            b"profile content",
            content_type="image/jpeg",
        )
        cover = SimpleUploadedFile(
            "org_cover.jpg",
            b"cover content",
            content_type="image/jpeg",
        )

        organization.profile_image = profile
        organization.cover_image = cover
        organization.save()

        profile_path = organization.profile_image.path
        cover_path = organization.cover_image.path

        assert os.path.exists(profile_path)
        assert os.path.exists(cover_path)

        organization.delete()

        assert not os.path.exists(profile_path)
        assert not os.path.exists(cover_path)


@pytest.mark.django_db
class TestOrganizationInvitation:
    def test_invitation_save_sets_default_expires_at(self, organization, client_user, corporate_client):
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=None,
        )

        assert invitation.expires_at is not None
        # Debe estar aproximadamente 30 días en el futuro
        delta = invitation.expires_at - timezone.now()
        assert 25 <= delta.days <= 35

    def test_invitation_clean_validates_roles_and_leader(self, organization, basic_user, client_user):
        # invited_user con rol inválido
        invalid_invited = User.objects.create_user(
            email="lawyer@example.com",
            password="testpassword",
            role="lawyer",
        )
        invitation = OrganizationInvitation(
            organization=organization,
            invited_user=invalid_invited,
            invited_by=organization.corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )
        with pytest.raises(ValidationError):
            invitation.clean()

        # invited_by con rol inválido
        invalid_inviter = User.objects.create_user(
            email="notcorp@example.com",
            password="testpassword",
            role="client",
        )
        invitation = OrganizationInvitation(
            organization=organization,
            invited_user=client_user,
            invited_by=invalid_inviter,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )
        with pytest.raises(ValidationError):
            invitation.clean()

        # invited_by no es líder de la organización
        other_corp = User.objects.create_user(
            email="othercorp@example.com",
            password="testpassword",
            role="corporate_client",
        )
        invitation = OrganizationInvitation(
            organization=organization,
            invited_user=client_user,
            invited_by=other_corp,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )
        with pytest.raises(ValidationError):
            invitation.clean()

    def test_invitation_prevents_duplicate_pending(self, organization, client_user, corporate_client):
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        invitation = OrganizationInvitation(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        with pytest.raises(ValidationError):
            invitation.clean()

    def test_invitation_is_expired_and_can_be_responded(self, organization, client_user, corporate_client):
        expired = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() - timezone.timedelta(days=1),
        )

        assert expired.is_expired() is True
        assert expired.can_be_responded() is False

        active = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=User.objects.create_user(
                email="another@example.com",
                password="testpassword",
                role="client",
            ),
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        assert active.is_expired() is False
        assert active.can_be_responded() is True

    def test_invitation_accept_creates_membership_and_sets_status(self, organization, client_user, corporate_client):
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        invitation.accept()

        membership = OrganizationMembership.objects.get(organization=organization, user=client_user)
        assert membership.role == "MEMBER"
        assert invitation.status == "ACCEPTED"
        assert invitation.responded_at is not None

    def test_invitation_accept_raises_if_already_member(self, organization, client_user, corporate_client):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
        )

        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        with pytest.raises(ValidationError):
            invitation.accept()

    def test_invitation_reject_updates_status(self, organization, client_user, corporate_client):
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=client_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() + timezone.timedelta(days=10),
        )

        invitation.reject()
        assert invitation.status == "REJECTED"
        assert invitation.responded_at is not None


@pytest.mark.django_db
class TestOrganizationMembership:
    def test_membership_clean_enforces_single_leader(self, organization, corporate_client, client_user):
        OrganizationMembership.objects.create(
            organization=organization,
            user=corporate_client,
            role="LEADER",
        )

        membership = OrganizationMembership(
            organization=organization,
            user=client_user,
            role="LEADER",
        )

        with pytest.raises(ValidationError):
            membership.clean()

    def test_membership_deactivate_and_reactivate(self, organization, client_user):
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
        )

        membership.deactivate()
        membership.refresh_from_db()
        assert membership.is_active is False
        assert membership.deactivated_at is not None

        membership.reactivate()
        membership.refresh_from_db()
        assert membership.is_active is True
        assert membership.deactivated_at is None

    def test_membership_unique_user_per_organization(self, organization, client_user):
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
        )

        with pytest.raises(IntegrityError):
            OrganizationMembership.objects.create(
                organization=organization,
                user=client_user,
                role="ADMIN",
            )

    def test_membership_str(self, organization, client_user):
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
        )

        s = str(membership)
        assert organization.title in s
        assert client_user.email in s
        assert "MEMBER" in s


@pytest.mark.django_db
class TestOrganizationPost:
    def test_post_clean_requires_author_is_leader(self, organization, client_user):
        post = OrganizationPost(
            title="Post",
            content="Contenido",
            organization=organization,
            author=client_user,  # No es corporate_client
        )

        with pytest.raises(ValidationError):
            post.clean()

    def test_post_clean_validates_link_name_and_url(self, organization, corporate_client):
        # link_name sin link_url
        post = OrganizationPost(
            title="Post",
            content="Contenido",
            organization=organization,
            author=corporate_client,
            link_name="Ver más",
            link_url=None,
        )
        with pytest.raises(ValidationError):
            post.clean()

        # link_url sin link_name
        post = OrganizationPost(
            title="Post",
            content="Contenido",
            organization=organization,
            author=corporate_client,
            link_name=None,
            link_url="https://example.com",
        )
        with pytest.raises(ValidationError):
            post.clean()

    def test_post_has_link_and_toggle_pin_and_activation(self, organization, corporate_client):
        post = OrganizationPost.objects.create(
            title="Post",
            content="Contenido",
            organization=organization,
            author=corporate_client,
            link_name="Ver más",
            link_url="https://example.com",
        )

        assert post.has_link is True
        assert post.is_pinned is False

        post.toggle_pin()
        post.refresh_from_db()
        assert post.is_pinned is True

        post.deactivate()
        post.refresh_from_db()
        assert post.is_active is False

        post.reactivate()
        post.refresh_from_db()
        assert post.is_active is True

    def test_post_str_includes_pinned_indicator(self, organization, corporate_client):
        post = OrganizationPost.objects.create(
            title="Post",
            content="Contenido",
            organization=organization,
            author=corporate_client,
            is_pinned=True,
        )

        s = str(post)
        assert organization.title in s
        assert "📌" in s
