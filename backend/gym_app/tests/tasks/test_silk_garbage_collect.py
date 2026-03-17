"""Tests for silk_garbage_collect management command."""
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command
from gym_app.management.commands.silk_garbage_collect import Command as SilkGCCommand

FIXED_NOW = datetime(2026, 2, 26, 12, 0, 0, tzinfo=dt_timezone.utc)
_CMD_MODULE = "gym_app.management.commands.silk_garbage_collect"


def _make_qs(count=0, deleted=0):
    """Return a mock QuerySet with configurable count and delete results."""
    mock_qs = mock.MagicMock()
    mock_qs.count.return_value = count
    mock_qs.delete.return_value = (deleted, {})
    return mock_qs


@pytest.mark.django_db
class TestSilkGarbageCollectCommand:
    """Tests for silk_garbage_collect management command."""

    @mock.patch('silk.models.Request')
    def test_default_retention_filters_records_older_than_seven_days(
        self, mock_request, settings
    ):
        """Verify filter uses 7-day cutoff when --days is not specified."""
        settings.ENABLE_SILK = True
        mock_request.objects.filter.return_value = _make_qs(count=0)

        out = StringIO()
        with mock.patch(f"{_CMD_MODULE}.timezone") as mock_tz:
            mock_tz.now.return_value = FIXED_NOW
            call_command(SilkGCCommand(), stdout=out)

        expected_cutoff = FIXED_NOW - timedelta(days=7)
        mock_request.objects.filter.assert_called_once_with(
            start_time__lt=expected_cutoff
        )
        assert "Requests to delete: 0" in out.getvalue()

    @mock.patch('silk.models.Request')
    def test_custom_days_filters_with_given_retention_period(
        self, mock_request, settings
    ):
        """Verify --days=14 uses a 14-day cutoff in the filter."""
        settings.ENABLE_SILK = True
        mock_request.objects.filter.return_value = _make_qs(count=0)

        out = StringIO()
        with mock.patch(f"{_CMD_MODULE}.timezone") as mock_tz:
            mock_tz.now.return_value = FIXED_NOW
            call_command(SilkGCCommand(), days=14, stdout=out)

        expected_cutoff = FIXED_NOW - timedelta(days=14)
        mock_request.objects.filter.assert_called_once_with(
            start_time__lt=expected_cutoff
        )
        assert "Requests to delete: 0" in out.getvalue()

    @mock.patch('silk.models.Request')
    def test_records_are_deleted_without_dry_run(self, mock_request, settings):
        """Verify delete() is called when --dry-run is not specified."""
        settings.ENABLE_SILK = True
        mock_qs = _make_qs(count=3, deleted=3)
        mock_request.objects.filter.return_value = mock_qs

        out = StringIO()
        call_command(SilkGCCommand(), stdout=out)

        mock_qs.delete.assert_called_once()
        assert "Deleted 3 records" in out.getvalue()

    @mock.patch('silk.models.Request')
    def test_dry_run_skips_deletion(self, mock_request, settings):
        """Verify delete() is not called when --dry-run is specified."""
        settings.ENABLE_SILK = True
        mock_qs = _make_qs(count=3)
        mock_request.objects.filter.return_value = mock_qs

        out = StringIO()
        call_command(SilkGCCommand(), dry_run=True, stdout=out)

        mock_qs.delete.assert_not_called()
        assert "Requests to delete: 3" in out.getvalue()

    @mock.patch('silk.models.Request')
    def test_dry_run_prints_warning_message(self, mock_request, settings):
        """Verify dry-run outputs a DRY RUN warning."""
        settings.ENABLE_SILK = True
        mock_request.objects.filter.return_value = _make_qs(count=2)

        out = StringIO()
        call_command(SilkGCCommand(), dry_run=True, stdout=out)

        assert "DRY RUN" in out.getvalue()

    @mock.patch('silk.models.Request')
    def test_deletion_prints_deleted_count(self, mock_request, settings):
        """Verify stdout reports the number of deleted records after deletion."""
        settings.ENABLE_SILK = True
        mock_request.objects.filter.return_value = _make_qs(count=5, deleted=5)

        out = StringIO()
        call_command(SilkGCCommand(), stdout=out)

        assert "Deleted 5 records" in out.getvalue()

    @mock.patch('silk.models.Request')
    def test_zero_records_reports_zero_in_output(self, mock_request, settings):
        """Verify output shows zero when no records match the cutoff."""
        settings.ENABLE_SILK = True
        mock_request.objects.filter.return_value = _make_qs(count=0, deleted=0)

        out = StringIO()
        call_command(SilkGCCommand(), stdout=out)

        assert "Requests to delete: 0" in out.getvalue()
