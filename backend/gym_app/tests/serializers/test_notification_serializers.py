"""Tests for the NotificationSerializer."""

import pytest

from gym_app.models import Notification
from gym_app.serializers.notification import NotificationSerializer

EXPECTED_FIELDS = {
    "id",
    "title",
    "message",
    "category",
    "priority",
    "is_read",
    "is_archived",
    "snoozed_until",
    "link_type",
    "link_id",
    "created_at",
}


@pytest.mark.django_db
def test_notification_serializer_exposes_expected_fields(client_user):
    """The serialized payload contains exactly the user-facing fields."""
    notif = Notification.objects.create(
        user=client_user,
        title="Título",
        message="Cuerpo",
        category="general",
        priority="medium",
        link_type="process",
        link_id=7,
    )

    data = NotificationSerializer(notif).data

    assert set(data.keys()) == EXPECTED_FIELDS


@pytest.mark.django_db
def test_notification_serializer_hides_internal_fields(client_user):
    """The recipient user and soft-delete flag are never serialized."""
    notif = Notification.objects.create(
        user=client_user,
        title="Título",
        message="Cuerpo",
        is_deleted=True,
    )

    data = NotificationSerializer(notif).data

    assert "user" not in data
    assert "is_deleted" not in data


def test_notification_serializer_ignores_write_input():
    """All fields are read-only, so incoming data yields empty validated_data."""
    serializer = NotificationSerializer(
        data={"title": "hack", "message": "x", "is_read": True}
    )

    assert serializer.is_valid()
    assert serializer.validated_data == {}
