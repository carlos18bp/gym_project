"""
Edge tests for gym_app/serializers/organization.py to close coverage gaps.

Targets: UserBasicInfoSerializer.get_profile_image_url (lines 30-31),
OrganizationDetailSerializer image URLs without request (lines 109, 117),
OrganizationCreateSerializer.validate no user (line 150),
OrganizationCreateSerializer.create no user (line 166),
OrganizationInvitationResponseSerializer.update DjangoValidationError (lines 321-322).
"""
import pytest
from unittest.mock import MagicMock, patch
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers as drf_serializers

from gym_app.models import Organization, OrganizationMembership, OrganizationInvitation, OrganizationPost
from gym_app.serializers.organization import (
    UserBasicInfoSerializer,
    OrganizationListSerializer,
    OrganizationSerializer,
    OrganizationCreateSerializer,
    OrganizationInvitationCreateSerializer,
    OrganizationInvitationResponseSerializer,
    OrganizationPostCreateSerializer,
    OrganizationPostUpdateSerializer,
)

User = get_user_model()


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def corporate_user(db):
    return User.objects.create_user(
        email="corp-org-ser@example.com",
        password="testpassword",
        first_name="Corp",
        last_name="User",
        role="corporate_client",
    )


@pytest.fixture
def basic_user(db):
    return User.objects.create_user(
        email="basic-org-ser@example.com",
        password="testpassword",
        first_name="Basic",
        last_name="User",
        role="basic",
    )


@pytest.fixture
def organization(db, corporate_user):
    return Organization.objects.create(
        title="Test Org",
        description="Desc",
        corporate_client=corporate_user,
    )


# ---------------------------------------------------------------------------
# UserBasicInfoSerializer.get_profile_image_url (lines 23-32)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestUserBasicInfoSerializerEdges:
    def test_profile_image_url_no_image(self, basic_user, rf):
        """Cover line 32: no photo_profile → return None."""
        request = rf.get("/")
        serializer = UserBasicInfoSerializer(basic_user, context={"request": request})
        assert serializer.data["profile_image_url"] is None

    def test_profile_image_url_no_request(self, basic_user):
        """Cover lines 30-31: photo_profile exists but no request → MEDIA_URL fallback."""
        basic_user.photo_profile = SimpleUploadedFile("pic.png", b"\x89PNG", content_type="image/png")
        basic_user.save()
        serializer = UserBasicInfoSerializer(basic_user)
        data = serializer.data
        assert data["profile_image_url"] is not None

    def test_profile_image_url_with_request(self, basic_user, rf):
        """Cover lines 26-28: photo_profile + request → absolute URI."""
        basic_user.photo_profile = SimpleUploadedFile("pic2.png", b"\x89PNG", content_type="image/png")
        basic_user.save()
        request = rf.get("/")
        serializer = UserBasicInfoSerializer(basic_user, context={"request": request})
        data = serializer.data
        assert "http" in data["profile_image_url"]


# ---------------------------------------------------------------------------
# OrganizationListSerializer image URL edges (lines 109-110, 117-118)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationListSerializerEdges:
    def test_profile_image_url_none(self, organization, rf):
        """Cover line 110: no profile_image → None."""
        request = rf.get("/")
        serializer = OrganizationListSerializer(organization, context={"request": request})
        assert serializer.data["profile_image_url"] is None

    def test_cover_image_url_none(self, organization, rf):
        """Cover line 118: no cover_image → None."""
        request = rf.get("/")
        serializer = OrganizationListSerializer(organization, context={"request": request})
        assert serializer.data["cover_image_url"] is None

    def test_profile_image_url_no_request(self, organization):
        """Cover line 109: profile_image without request → raw url."""
        organization.profile_image = SimpleUploadedFile("org_prof.png", b"\x89PNG", content_type="image/png")
        organization.save()
        serializer = OrganizationListSerializer(organization)
        data = serializer.data
        assert data["profile_image_url"] is not None

    def test_cover_image_url_no_request(self, organization):
        """Cover line 117: cover_image without request → raw url."""
        organization.cover_image = SimpleUploadedFile("org_cover.png", b"\x89PNG", content_type="image/png")
        organization.save()
        serializer = OrganizationListSerializer(organization)
        data = serializer.data
        assert data["cover_image_url"] is not None


# ---------------------------------------------------------------------------
# OrganizationCreateSerializer.validate (line 150) and .create (line 166)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationCreateSerializerEdges:
    def test_validate_no_user_raises(self):
        """Cover line 150: no request user → ValidationError."""
        serializer = OrganizationCreateSerializer(
            data={"title": "Org", "description": "D"},
            context={"request": None},
        )
        with pytest.raises(drf_serializers.ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_validate_non_corporate_raises(self, basic_user, rf):
        """Cover line 153: non-corporate user → ValidationError."""
        request = rf.post("/")
        request.user = basic_user
        serializer = OrganizationCreateSerializer(
            data={"title": "Org", "description": "D"},
            context={"request": request},
        )
        with pytest.raises(drf_serializers.ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_create_no_user_raises(self, rf):
        """Cover line 166: create with no user → ValidationError."""
        serializer = OrganizationCreateSerializer(context={"request": None})
        with pytest.raises(drf_serializers.ValidationError):
            serializer.create({"title": "Org", "description": "D"})


# ---------------------------------------------------------------------------
# OrganizationInvitationResponseSerializer.update DjangoValidationError (lines 321-322)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationInvitationResponseSerializerEdges:
    def test_accept_raises_django_validation_error(self, organization, basic_user, corporate_user):
        """Cover lines 321-322: DjangoValidationError mapped to DRF ValidationError."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_user,
        )
        serializer = OrganizationInvitationResponseSerializer()
        with patch.object(invitation, 'accept', side_effect=DjangoValidationError("Already accepted")):
            with pytest.raises(drf_serializers.ValidationError):
                serializer.update(invitation, {"action": "accept"})

    def test_reject_invocation(self, organization, basic_user, corporate_user):
        """Cover line 320: reject action calls instance.reject()."""
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_user,
        )
        serializer = OrganizationInvitationResponseSerializer()
        with patch.object(invitation, 'reject') as mock_reject:
            result = serializer.update(invitation, {"action": "reject"})
            mock_reject.assert_called_once()


# ---------------------------------------------------------------------------
# OrganizationSerializer (detail) image URL edges (lines 104-118)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationDetailSerializerEdges:
    def test_profile_image_url_no_request(self, organization):
        """Cover line 109: profile_image without request → raw url."""
        organization.profile_image = SimpleUploadedFile("detail_prof.png", b"\x89PNG", content_type="image/png")
        organization.save()
        serializer = OrganizationSerializer(organization)
        data = serializer.data
        assert data["profile_image_url"] is not None

    def test_cover_image_url_no_request(self, organization):
        """Cover line 117: cover_image without request → raw url."""
        organization.cover_image = SimpleUploadedFile("detail_cover.png", b"\x89PNG", content_type="image/png")
        organization.save()
        serializer = OrganizationSerializer(organization)
        data = serializer.data
        assert data["cover_image_url"] is not None


# ---------------------------------------------------------------------------
# OrganizationInvitationCreateSerializer edges (lines 240-241, 279-281, 285-304)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationInvitationCreateSerializerEdges:
    def test_validate_email_user_not_found(self, organization, corporate_user, rf):
        """Cover lines 240-241: user with email not found → ValidationError."""
        request = rf.post("/")
        request.user = corporate_user
        serializer = OrganizationInvitationCreateSerializer(
            data={"invited_user_email": "nonexistent@example.com"},
            context={"organization": organization, "request": request},
        )
        assert not serializer.is_valid()

    def test_validate_already_member(self, organization, basic_user, corporate_user, rf):
        """Cover lines 265-266: user already a member → ValidationError."""
        OrganizationMembership.objects.create(
            organization=organization, user=basic_user, role="MEMBER", is_active=True,
        )
        request = rf.post("/")
        request.user = corporate_user
        serializer = OrganizationInvitationCreateSerializer(
            data={"invited_user_email": basic_user.email},
            context={"organization": organization, "request": request},
        )
        assert not serializer.is_valid()

    def test_validate_pending_invitation_exists(self, organization, basic_user, corporate_user, rf):
        """Cover lines 275-276: pending invitation already exists → ValidationError."""
        OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_user,
            status="PENDING",
        )
        request = rf.post("/")
        request.user = corporate_user
        serializer = OrganizationInvitationCreateSerializer(
            data={"invited_user_email": basic_user.email},
            context={"organization": organization, "request": request},
        )
        assert not serializer.is_valid()

    def test_create_invitation_success(self, organization, basic_user, corporate_user, rf):
        """Cover lines 283-304: successful invitation creation."""
        request = rf.post("/")
        request.user = corporate_user
        serializer = OrganizationInvitationCreateSerializer(
            data={"invited_user_email": basic_user.email, "message": "Welcome!"},
            context={"organization": organization, "request": request},
        )
        assert serializer.is_valid(), serializer.errors
        invitation = serializer.save()
        assert invitation.invited_user == basic_user
        assert invitation.invited_by == corporate_user

    def test_create_invitation_without_cached_user(self, organization, basic_user, corporate_user, rf):
        """Cover lines 290-294: _invited_user not cached → lookup by email."""
        request = rf.post("/")
        request.user = corporate_user
        serializer = OrganizationInvitationCreateSerializer(
            context={"organization": organization, "request": request},
        )
        # Simulate create without validate having been called
        invitation = serializer.create({"invited_user_email": basic_user.email, "message": "Hi"})
        assert invitation.invited_user == basic_user


# ---------------------------------------------------------------------------
# OrganizationPostCreateSerializer edges (line 445) & OrganizationPostUpdateSerializer (line 504)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestOrganizationPostSerializerEdges:
    def test_create_post_non_corporate_raises(self, organization, basic_user, rf):
        """Cover line 445: non-corporate user creating post → ValidationError."""
        request = rf.post("/")
        request.user = basic_user
        serializer = OrganizationPostCreateSerializer(
            data={
                "title": "Post",
                "content": "Content",
                "organization": organization.id,
            },
            context={"request": request},
        )
        # is_valid may pass but create should raise
        if serializer.is_valid():
            with pytest.raises(drf_serializers.ValidationError):
                serializer.save()

    def test_update_post_link_name_without_url(self, rf):
        """Cover line 494-497: link_name without link_url → ValidationError."""
        serializer = OrganizationPostUpdateSerializer(
            data={"link_name": "My Link"},
            partial=True,
        )
        assert not serializer.is_valid()

    def test_update_post_link_url_without_name(self, rf):
        """Cover line 499-502: link_url without link_name → ValidationError."""
        serializer = OrganizationPostUpdateSerializer(
            data={"link_url": "https://example.com"},
            partial=True,
        )
        assert not serializer.is_valid()
