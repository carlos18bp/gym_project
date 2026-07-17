"""Model tests for gym_app.models.notification.Notification.

Notification rows are created by notification_service on behalf of other
modules; previously the model was only exercised indirectly through views and
services. These tests pin its defaults, ordering and validation directly.
"""
import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import Notification, User


@pytest.fixture
def owner(db):
    """Owner."""
    return User.objects.create_user(
        email="notif_owner@test.com",
        password="testpassword",
        role="client",
    )


@pytest.mark.django_db
def test_notification_applies_default_category_and_priority(owner):
    """Notification applies default category and priority."""
    notification = Notification.objects.create(
        user=owner, title="Hola", message="cuerpo"
    )

    assert notification.category == "general"
    assert notification.priority == "medium"


@pytest.mark.django_db
def test_notification_state_flags_default_to_false(owner):
    """Notification state flags default to false."""
    notification = Notification.objects.create(
        user=owner, title="Hola", message="cuerpo"
    )

    assert notification.is_read is False
    assert notification.is_archived is False
    assert notification.is_deleted is False


@pytest.mark.django_db
def test_notification_link_type_defaults_to_empty_string(owner):
    """Notification link type defaults to empty string."""
    notification = Notification.objects.create(
        user=owner, title="Hola", message="cuerpo"
    )

    assert notification.link_type == ""
    assert notification.link_id is None


@pytest.mark.django_db
@freeze_time("2026-07-16 12:00:00")
def test_notifications_are_ordered_most_recent_first(owner):
    """Notifications are ordered most recent first."""
    older = Notification.objects.create(user=owner, title="Viejo", message="x")
    Notification.objects.filter(pk=older.pk).update(
        created_at=timezone.now() - timezone.timedelta(days=1)
    )
    newer = Notification.objects.create(user=owner, title="Nuevo", message="y")

    ordered = list(Notification.objects.filter(user=owner))

    assert ordered == [newer, older]


@pytest.mark.django_db
def test_notification_str_includes_category_and_title(owner):
    """Notification str includes category and title."""
    notification = Notification.objects.create(
        user=owner, title="Firma pendiente", message="cuerpo", category="signature_request"
    )

    assert str(notification) == f"[signature_request] Firma pendiente → {owner}"


@pytest.mark.django_db
@pytest.mark.edge
def test_notification_rejects_invalid_category(owner):
    """Notification rejects invalid category."""
    notification = Notification(user=owner, title="Hola", message="cuerpo", category="not_a_category")

    with pytest.raises(ValidationError):
        notification.full_clean()
