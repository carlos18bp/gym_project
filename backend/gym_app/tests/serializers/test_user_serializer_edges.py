"""
Edge tests for gym_app/serializers/user.py to close coverage gaps.

Targets uncovered lines: 35-45 (UserSignatureSerializer.to_representation),
72-75 (ActivityFeedSerializer.get_time_ago), 81 (get_action_display).
"""
import pytest
from unittest.mock import MagicMock, PropertyMock, patch
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from gym_app.models.user import ActivityFeed, UserSignature
from gym_app.serializers.user import (
    UserSignatureSerializer,
    ActivityFeedSerializer,
)

User = get_user_model()


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="sertest@example.com",
        password="testpassword",
        first_name="Ser",
        last_name="Test",
        role="Lawyer",
    )


# ---------------------------------------------------------------------------
# UserSignatureSerializer.to_representation (lines 34-45)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestUserSignatureSerializerEdges:
    def test_to_representation_with_request_and_image(self, user, rf):
        """Cover lines 38-40: request present, signature_image exists."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        sig = UserSignature.objects.create(
            user=user,
            signature_image=SimpleUploadedFile("sig.png", b"\x89PNG", content_type="image/png"),
            method="upload",
            ip_address="127.0.0.1",
        )
        request = rf.get("/")
        serializer = UserSignatureSerializer(sig, context={"request": request})
        data = serializer.data
        # Should build an absolute URI
        assert data["signature_image"] is not None
        assert "sig" in data["signature_image"] or "http" in data["signature_image"]

    def test_to_representation_without_request(self, user):
        """Cover line 36: no request in context → no URI rewriting."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        sig = UserSignature.objects.create(
            user=user,
            signature_image=SimpleUploadedFile("sig2.png", b"\x89PNG", content_type="image/png"),
            method="draw",
            ip_address="127.0.0.1",
        )
        serializer = UserSignatureSerializer(sig)
        data = serializer.data
        assert data["signature_image"] is not None

    def test_to_representation_image_error_sets_none(self, user, rf):
        """Cover lines 41-43: file error sets signature_image to None."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        sig = UserSignature.objects.create(
            user=user,
            signature_image=SimpleUploadedFile("sig3.png", b"\x89PNG", content_type="image/png"),
            method="draw",
            ip_address="127.0.0.1",
        )
        request = rf.get("/")
        # Selective mock: let the first call (DRF internal) succeed, fail on the second (custom code)
        call_count = [0]
        original = request.build_absolute_uri

        def selective_raise(url):
            call_count[0] += 1
            if call_count[0] > 1:
                raise Exception("broken")
            return original(url)

        request.build_absolute_uri = selective_raise
        serializer = UserSignatureSerializer(sig, context={"request": request})
        data = serializer.data
        assert data["signature_image"] is None


# ---------------------------------------------------------------------------
# ActivityFeedSerializer methods (lines 68-75, 77-81)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestActivityFeedSerializerEdges:
    def test_get_time_ago(self, user):
        """Cover lines 72-75: get_time_ago returns timesince string."""
        activity = ActivityFeed.objects.create(
            user=user,
            action_type="create",
            description="Test activity",
        )
        serializer = ActivityFeedSerializer(activity)
        data = serializer.data
        assert "time_ago" in data
        assert isinstance(data["time_ago"], str)

    def test_get_action_display(self, user):
        """Cover lines 77-81: get_action_display returns display value."""
        activity = ActivityFeed.objects.create(
            user=user,
            action_type="edit",
            description="Edited something",
        )
        serializer = ActivityFeedSerializer(activity)
        data = serializer.data
        assert "action_display" in data
        # The display value should match the ACTION_TYPE_CHOICES mapping
        expected = dict(ActivityFeed.ACTION_TYPE_CHOICES).get("edit", "edit")
        assert data["action_display"] == expected

    def test_get_action_display_unknown_type(self, user):
        """Cover the fallback in get_action_display for unknown action_type."""
        activity = ActivityFeed.objects.create(
            user=user,
            action_type="other",
            description="Other action",
        )
        serializer = ActivityFeedSerializer(activity)
        data = serializer.data
        assert "action_display" in data
