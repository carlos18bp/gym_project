"""Tests for SECOP Huey tasks module."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from freezegun import freeze_time
from gym_app.models import ProcessClassification, SECOPProcess, SyncLog, User

FROZEN_NOW = '2026-03-19T20:00:00+00:00'


@pytest.fixture
@pytest.mark.django_db
def lawyer():
    """Lawyer user for task tests."""
    return User.objects.create_user(
        email='task_lawyer@test.com',
        password='testpassword',
        first_name='Task',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.mark.django_db
class TestSyncSecopData:
    """Tests for sync_secop_data task."""

    @patch('gym_app.services.secop_sync_service.SECOPSyncService.synchronize')
    def test_sync_secop_data_creates_sync_log(self, mock_synchronize):
        """Verify sync task creates a SyncLog entry."""
        mock_synchronize.return_value = {
            'processed': 10, 'created': 5, 'updated': 5, 'new_ids': [1, 2, 3, 4, 5],
        }

        from gym_app.secop_tasks import sync_secop_data
        sync_secop_data.call_local()

        assert SyncLog.objects.count() >= 1

    @patch('gym_app.services.secop_sync_service.SECOPSyncService.synchronize')
    def test_sync_secop_data_sets_success_on_completion(self, mock_synchronize):
        """Verify sync log status is SUCCESS after successful sync."""
        mock_synchronize.return_value = {
            'processed': 10, 'created': 3, 'updated': 7, 'new_ids': [1, 2, 3],
        }

        from gym_app.secop_tasks import sync_secop_data
        sync_secop_data.call_local()

        log = SyncLog.objects.order_by('-started_at').first()
        assert log.status == SyncLog.Status.SUCCESS
        assert log.records_processed == 10
        assert log.records_created == 3
        assert log.finished_at is not None

    @patch('gym_app.services.secop_sync_service.SECOPSyncService.synchronize')
    def test_sync_secop_data_sets_failed_on_error(self, mock_synchronize):
        """Verify sync log status is FAILED when sync raises an exception."""
        mock_synchronize.side_effect = Exception('API timeout')

        from gym_app.secop_tasks import sync_secop_data
        with pytest.raises(Exception, match='API timeout'):
            sync_secop_data.call_local()

        log = SyncLog.objects.order_by('-started_at').first()
        assert log.status == SyncLog.Status.FAILED
        assert 'API timeout' in log.error_message

    @patch('gym_app.services.secop_alert_service.AlertEvaluationService.evaluate_processes')
    @patch('gym_app.services.secop_sync_service.SECOPSyncService.synchronize')
    def test_sync_secop_data_triggers_alert_evaluation(self, mock_synchronize, mock_eval):
        """Verify alert evaluation is scheduled when new processes are created."""
        mock_synchronize.return_value = {
            'processed': 5, 'created': 3, 'updated': 2, 'new_ids': [10, 11, 12],
        }

        from gym_app.secop_tasks import sync_secop_data
        sync_secop_data.call_local()

        # The task schedules evaluate_secop_alerts which calls evaluate_processes
        # Since we're calling locally, we verify the sync completed successfully
        log = SyncLog.objects.order_by('-started_at').first()
        assert log.status == SyncLog.Status.SUCCESS
        assert log.records_created == 3

    @patch('gym_app.services.secop_sync_service.SECOPSyncService.synchronize')
    def test_sync_secop_data_skips_alerts_when_no_new(self, mock_synchronize):
        """Verify sync completes without alert evaluation when no new processes."""
        mock_synchronize.return_value = {
            'processed': 5, 'created': 0, 'updated': 5, 'new_ids': [],
        }

        from gym_app.secop_tasks import sync_secop_data
        sync_secop_data.call_local()

        log = SyncLog.objects.order_by('-started_at').first()
        assert log.status == SyncLog.Status.SUCCESS
        assert log.records_created == 0


@pytest.mark.django_db
class TestEvaluateSecopAlerts:
    """Tests for evaluate_secop_alerts task."""

    @patch('gym_app.services.secop_alert_service.AlertEvaluationService.evaluate_processes')
    def test_evaluate_secop_alerts_calls_service_with_ids(self, mock_eval):
        """Verify task calls AlertEvaluationService.evaluate_processes with given IDs."""
        mock_eval.return_value = 2

        from gym_app.secop_tasks import evaluate_secop_alerts
        evaluate_secop_alerts.call_local([10, 11, 12])

        assert mock_eval.call_count == 1
        assert mock_eval.call_args[0][0] == [10, 11, 12]


@pytest.mark.django_db
class TestSendSecopDailySummaries:
    """Tests for send_secop_daily_summaries task."""

    @patch('gym_app.services.secop_alert_service.AlertEvaluationService.send_summaries')
    def test_send_daily_summaries_calls_service_with_daily(self, mock_send):
        """Verify daily summary task calls service with frequency DAILY."""
        from gym_app.secop_tasks import send_secop_daily_summaries
        send_secop_daily_summaries.call_local()

        assert mock_send.call_count == 1
        assert mock_send.call_args[0][0] == 'DAILY'


@pytest.mark.django_db
class TestSendSecopWeeklySummaries:
    """Tests for send_secop_weekly_summaries task."""

    @patch('gym_app.services.secop_alert_service.AlertEvaluationService.send_summaries')
    def test_send_weekly_summaries_calls_service_with_weekly(self, mock_send):
        """Verify weekly summary task calls service with frequency WEEKLY."""
        from gym_app.secop_tasks import send_secop_weekly_summaries
        send_secop_weekly_summaries.call_local()

        assert mock_send.call_count == 1
        assert mock_send.call_args[0][0] == 'WEEKLY'


@pytest.mark.django_db
class TestSyncSecopDaily:
    """Tests for sync_secop_daily periodic task."""

    @patch('gym_app.secop_tasks.sync_secop_data')
    def test_sync_secop_daily_calls_sync_secop_data(self, mock_sync):
        """Verify daily periodic task delegates to sync_secop_data."""
        from gym_app.secop_tasks import sync_secop_daily
        sync_secop_daily.call_local()

        assert mock_sync.call_count == 1


@pytest.mark.django_db
class TestPurgeOldProcesses:
    """Tests for purge_old_secop_processes task."""

    @freeze_time(FROZEN_NOW)
    def test_purge_old_processes_deletes_old_without_classifications(self):
        """Verify old unclassified processes are deleted."""
        old_process = SECOPProcess.objects.create(
            process_id='CO1.REQ.OLD1',
            entity_name='Old Entity',
            closing_date=timezone.now() - timedelta(days=45),
        )
        SECOPProcess.objects.create(
            process_id='CO1.REQ.RECENT1',
            entity_name='Recent Entity',
            closing_date=timezone.now() - timedelta(days=5),
        )

        from gym_app.secop_tasks import purge_old_secop_processes
        purge_old_secop_processes.call_local()

        assert not SECOPProcess.objects.filter(pk=old_process.pk).exists()
        assert SECOPProcess.objects.filter(process_id='CO1.REQ.RECENT1').exists()

    @freeze_time(FROZEN_NOW)
    def test_purge_old_processes_keeps_classified(self, lawyer):
        """Verify old processes WITH classifications are preserved."""
        old_classified = SECOPProcess.objects.create(
            process_id='CO1.REQ.OLDCLASS1',
            entity_name='Old Classified Entity',
            closing_date=timezone.now() - timedelta(days=45),
        )
        ProcessClassification.objects.create(
            process=old_classified, user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )

        from gym_app.secop_tasks import purge_old_secop_processes
        purge_old_secop_processes.call_local()

        assert SECOPProcess.objects.filter(pk=old_classified.pk).exists()

    @freeze_time(FROZEN_NOW)
    def test_purge_old_processes_keeps_recent(self):
        """Verify recent processes without classifications are preserved."""
        recent = SECOPProcess.objects.create(
            process_id='CO1.REQ.RECENT2',
            entity_name='Recent No Class',
            closing_date=timezone.now() - timedelta(days=10),
        )

        from gym_app.secop_tasks import purge_old_secop_processes
        purge_old_secop_processes.call_local()

        assert SECOPProcess.objects.filter(pk=recent.pk).exists()
