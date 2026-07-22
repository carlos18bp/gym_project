"""Tests for the TourProgress model."""

from datetime import timedelta

import pytest
from freezegun import freeze_time
from django.db import IntegrityError
from django.utils import timezone

from gym_app.models import TourProgress


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_tour_progress_creation(client_user):
    """A TourProgress record stores user, module and completion time."""
    now = timezone.now()
    progress = TourProgress.objects.create(
        user=client_user,
        module_name="dynamic_documents",
        completed_at=now,
    )

    assert progress.pk is not None
    assert progress.user == client_user
    assert progress.module_name == "dynamic_documents"
    assert progress.completed_at == now


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_tour_progress_str_contains_module_and_user(client_user):
    """__str__ includes the module name and the user."""
    progress = TourProgress.objects.create(
        user=client_user,
        module_name="dynamic_documents",
        completed_at=timezone.now(),
    )

    assert "dynamic_documents" in str(progress)
    assert str(client_user) in str(progress)


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_tour_progress_unique_per_user_and_module(client_user):
    """Only one record is allowed per user/module combination."""
    TourProgress.objects.create(
        user=client_user,
        module_name="dynamic_documents",
        completed_at=timezone.now(),
    )

    with pytest.raises(IntegrityError):
        TourProgress.objects.create(
            user=client_user,
            module_name="dynamic_documents",
            completed_at=timezone.now(),
        )


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_is_stale_false_within_threshold(client_user):
    """A completion 29 days ago is not stale."""
    progress = TourProgress.objects.create(
        user=client_user,
        module_name="dynamic_documents",
        completed_at=timezone.now() - timedelta(days=29),
    )

    assert progress.is_stale is False


@pytest.mark.django_db
@freeze_time("2026-07-01 12:00:00")
def test_is_stale_true_past_threshold(client_user):
    """A completion 31 days ago is stale."""
    progress = TourProgress.objects.create(
        user=client_user,
        module_name="dynamic_documents",
        completed_at=timezone.now() - timedelta(days=31),
    )

    assert progress.is_stale is True
