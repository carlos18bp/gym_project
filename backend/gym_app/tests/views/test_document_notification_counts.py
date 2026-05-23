"""Tests for GET /api/dynamic-documents/document-notification-counts/."""

import pytest
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from gym_app.models import DynamicDocument, Notification


@pytest.fixture
def api_client():
    return APIClient()


def _make_document(creator, state):
    return DynamicDocument.objects.create(
        title=f"Doc {state}",
        content="<p>x</p>",
        state=state,
        created_by=creator,
    )


def _make_notification(user, link_id, **overrides):
    defaults = dict(
        title="Notif",
        message="body",
        category="signature_request",
        link_type="document",
        link_id=link_id,
        is_read=False,
        is_archived=False,
        is_deleted=False,
    )
    defaults.update(overrides)
    return Notification.objects.create(user=user, **defaults)


@pytest.mark.django_db
def test_returns_empty_counts_when_no_notifications(api_client, client_user):
    """User with no document notifications gets an empty counts map."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {}


@pytest.mark.django_db
def test_buckets_unread_notification_by_document_state(api_client, client_user, lawyer_user):
    """A FullySigned document's unread notification lands in signed-documents."""
    doc = _make_document(lawyer_user, "FullySigned")
    _make_notification(client_user, doc.id)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {"signed-documents": 1}


@pytest.mark.django_db
def test_rejected_and_expired_documents_map_to_archived_tab(api_client, client_user, lawyer_user):
    """Rejected and Expired documents both bucket into archived-documents."""
    _make_notification(client_user, _make_document(lawyer_user, "Rejected").id)
    _make_notification(client_user, _make_document(lawyer_user, "Expired").id)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {"archived-documents": 2}


@pytest.mark.django_db
def test_ignores_read_notifications(api_client, client_user, lawyer_user):
    """Notifications already marked as read are not counted."""
    doc = _make_document(lawyer_user, "FullySigned")
    _make_notification(client_user, doc.id, is_read=True)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {}


@pytest.mark.django_db
def test_ignores_snoozed_notifications(api_client, client_user, lawyer_user):
    """Notifications snoozed into the future are not counted."""
    doc = _make_document(lawyer_user, "FullySigned")
    _make_notification(
        client_user, doc.id, snoozed_until=timezone.now() + timedelta(hours=2)
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {}


@pytest.mark.django_db
def test_ignores_non_document_notifications(api_client, client_user):
    """Notifications whose link_type is not 'document' are excluded."""
    _make_notification(client_user, 999, link_type="process")

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {}


@pytest.mark.django_db
def test_missing_document_does_not_break_counting(api_client, client_user):
    """A notification pointing at a deleted document is skipped, not an error."""
    _make_notification(client_user, link_id=987654)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 200
    assert response.data["counts"] == {}


@pytest.mark.django_db
def test_requires_authentication(api_client):
    """Unauthenticated request is rejected with 401."""
    response = api_client.get(reverse("get-document-notification-counts"))

    assert response.status_code == 401
