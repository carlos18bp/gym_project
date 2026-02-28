"""
Management command to clean old Silk profiling data.
Default retention: 7 days.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Delete Silk data older than N days'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Retention period in days (default: 7)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without deleting',
        )

    def handle(self, *args, **options):
        from django.conf import settings

        if not getattr(settings, 'ENABLE_SILK', False):
            self.stdout.write(
                self.style.WARNING("Silk is not enabled. Nothing to clean.")
            )
            return

        from silk.models import Request

        days = options['days']
        dry_run = options['dry_run']
        cutoff = timezone.now() - timedelta(days=days)

        old_requests = Request.objects.filter(start_time__lt=cutoff)
        count = old_requests.count()

        self.stdout.write(f"Silk records older than {cutoff}:")
        self.stdout.write(f"  - Requests to delete: {count}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN: Nothing was deleted")
            )
        else:
            deleted, _ = old_requests.delete()
            self.stdout.write(
                self.style.SUCCESS(f"Deleted {deleted} records")
            )
