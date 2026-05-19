"""Hard-delete in-app notifications associated with the Services & Solicitudes
module.

Run once after deploying the June/July 2026 release: in-app notifications for
service requests are out of scope and the existing rows pollute the new
Notification Center. The companion service module
``services/service_tramite_notifications.py`` already stopped creating new
in-app notifications, so a one-shot delete is enough.

Usage::

    python manage.py clean_service_notifications           # deletes for real
    python manage.py clean_service_notifications --dry-run # report only
"""

from django.core.management.base import BaseCommand

from gym_app.models import Notification


class Command(BaseCommand):
    help = "Hard-delete in-app notifications with link_type='service_request'."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only report how many rows would be deleted, do not delete.',
        )

    def handle(self, *args, **options):
        qs = Notification.objects.filter(link_type='service_request')
        count = qs.count()

        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING(
                    f"[dry-run] Would delete {count} service-request notifications."
                )
            )
            return

        deleted, _ = qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} service-request notifications."
            )
        )
