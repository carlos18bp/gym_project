"""
Management command for manual SECOP data synchronization.

Usage:
    python manage.py sync_secop          # Incremental sync
    python manage.py sync_secop --full   # Full sync (all open processes)
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from gym_app.models import SyncLog
from gym_app.services.secop_sync_service import SECOPSyncService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Synchronize SECOP procurement data from datos.gov.co'

    def add_arguments(self, parser):
        parser.add_argument(
            '--full',
            action='store_true',
            help='Full sync instead of incremental (ignores last sync date)',
        )

    def handle(self, *args, **options):
        is_full = options['full']
        sync_type = 'full' if is_full else 'incremental'

        self.stdout.write(
            f"Starting {sync_type} SECOP sync..."
        )

        sync_log = SyncLog.objects.create()

        try:
            service = SECOPSyncService()
            result = service.synchronize(incremental=not is_full)

            sync_log.status = SyncLog.Status.SUCCESS
            sync_log.records_processed = result['processed']
            sync_log.records_created = result['created']
            sync_log.records_updated = result['updated']

            self.stdout.write(self.style.SUCCESS(
                f"SECOP sync completed: "
                f"{result['processed']} processed, "
                f"{result['created']} created, "
                f"{result['updated']} updated"
            ))

        except Exception as e:
            sync_log.status = SyncLog.Status.FAILED
            sync_log.error_message = str(e)

            self.stdout.write(self.style.ERROR(
                f"SECOP sync failed: {e}"
            ))
            raise

        finally:
            sync_log.finished_at = timezone.now()
            sync_log.save()
