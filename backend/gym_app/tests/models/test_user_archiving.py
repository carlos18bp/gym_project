"""Tests for the User archive/unarchive behavior."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from gym_app.models import User


@pytest.fixture
def lawyer():
    """Active lawyer account."""
    return User.objects.create_user(
        email="archiving-lawyer@test.com",
        password="testpassword",
        first_name="Archi",
        last_name="Ving",
        role="lawyer",
        is_gym_lawyer=True,
    )


@pytest.mark.django_db
def test_archive_flips_both_flags(lawyer):
    """archive() sets is_archived and clears is_active."""
    lawyer.archive()
    lawyer.refresh_from_db()
    assert lawyer.is_archived is True
    assert lawyer.is_active is False


@pytest.mark.django_db
def test_unarchive_restores_both_flags(lawyer):
    """unarchive() restores is_archived and is_active."""
    lawyer.archive()
    lawyer.unarchive()
    lawyer.refresh_from_db()
    assert lawyer.is_archived is False
    assert lawyer.is_active is True


@pytest.mark.django_db
def test_archived_user_existing_token_is_rejected(lawyer):
    """An already-issued access token stops working once archived.

    simplejwt CHECK_USER_IS_ACTIVE (default True) rejects the inactive
    user at request time — no need to wait for token expiry.
    """
    token = str(RefreshToken.for_user(lawyer).access_token)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # Sanity: token works while active
    assert client.get("/api/validate_token/").status_code == status.HTTP_200_OK

    lawyer.archive()

    # Same token now bounces
    assert client.get("/api/validate_token/").status_code == status.HTTP_401_UNAUTHORIZED
