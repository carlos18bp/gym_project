"""Tests for the silk_garbage_collect management command."""

import sys
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command

from freezegun import freeze_time


def _mock_silk_request():
    """Create a mock silk.models module with a Request model."""
    mock_request_model = MagicMock()
    mock_silk_models = MagicMock()
    mock_silk_models.Request = mock_request_model
    return mock_silk_models, mock_request_model


@pytest.mark.django_db
def test_silk_garbage_collect_skips_when_silk_disabled(settings):
    """Exit early with warning when ENABLE_SILK is False."""
    settings.ENABLE_SILK = False
    out = StringIO()

    call_command("silk_garbage_collect", stdout=out)

    assert "Silk is not enabled" in out.getvalue()


@freeze_time("2026-01-15 12:00:00")
@pytest.mark.django_db
def test_silk_garbage_collect_dry_run_reports_without_deleting(settings):
    """Report count but do not delete when --dry-run is passed."""
    settings.ENABLE_SILK = True
    out = StringIO()

    mock_silk_models, mock_request_model = _mock_silk_request()
    mock_qs = MagicMock()
    mock_qs.count.return_value = 42
    mock_request_model.objects.filter.return_value = mock_qs

    with patch.dict(sys.modules, {"silk": MagicMock(), "silk.models": mock_silk_models}):
        call_command("silk_garbage_collect", "--dry-run", stdout=out)

    output = out.getvalue()
    assert "Requests to delete: 42" in output
    assert "DRY RUN" in output
    mock_qs.delete.assert_not_called()


@freeze_time("2026-01-15 12:00:00")
@pytest.mark.django_db
def test_silk_garbage_collect_deletes_old_records(settings):
    """Delete old Silk request records when not in dry-run mode."""
    settings.ENABLE_SILK = True
    out = StringIO()

    mock_silk_models, mock_request_model = _mock_silk_request()
    mock_qs = MagicMock()
    mock_qs.count.return_value = 10
    mock_qs.delete.return_value = (10, {})
    mock_request_model.objects.filter.return_value = mock_qs

    with patch.dict(sys.modules, {"silk": MagicMock(), "silk.models": mock_silk_models}):
        call_command("silk_garbage_collect", "--days=3", stdout=out)

    output = out.getvalue()
    assert "Requests to delete: 10" in output
    assert "Deleted 10 records" in output
    mock_qs.delete.assert_called_once()
