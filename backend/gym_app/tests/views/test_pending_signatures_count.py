"""Tests for GET /api/dynamic-documents/pending-signatures-count/."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from gym_app.models import DocumentSignature, DynamicDocument


@pytest.fixture
def api_client():
    """Build an API client."""
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def pending_doc(lawyer_user):
    """Document in PendingSignatures state."""
    return DynamicDocument.objects.create(
        title="Test Pending Doc",
        content="<p>content</p>",
        state="PendingSignatures",
        requires_signature=True,
        created_by=lawyer_user,
    )


@pytest.mark.django_db
def test_count_returns_zero_when_no_pending(api_client, client_user):
    """Authenticated user with no pending signatures gets count 0."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-pending-signatures-count"))

    assert response.status_code == 200
    assert response.data["pending_count"] == 0


@pytest.mark.django_db
def test_count_returns_correct_number(api_client, client_user, lawyer_user):
    """Count reflects the number of pending documents for the signer."""
    for _ in range(3):
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="PendingSignatures",
            requires_signature=True,
            created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, signed=False)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-pending-signatures-count"))

    assert response.status_code == 200
    assert response.data["pending_count"] == 3


@pytest.mark.django_db
def test_count_excludes_already_signed(api_client, client_user, lawyer_user):
    """Documents where the user already signed are not counted."""
    doc = DynamicDocument.objects.create(
        title="Signed Doc",
        content="<p>x</p>",
        state="FullySigned",
        requires_signature=True,
        created_by=lawyer_user,
    )
    DocumentSignature.objects.create(
        document=doc, signer=client_user, signed=True
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("get-pending-signatures-count"))

    assert response.status_code == 200
    assert response.data["pending_count"] == 0


@pytest.mark.django_db
def test_count_requires_authentication(api_client):
    """Unauthenticated request is rejected with 401."""
    response = api_client.get(reverse("get-pending-signatures-count"))

    assert response.status_code == 401
