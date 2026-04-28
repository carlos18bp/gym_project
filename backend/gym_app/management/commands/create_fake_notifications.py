import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from gym_app.models import (
    User,
    Notification,
    Process,
    DynamicDocument,
    ServiceRequest,
)


class Command(BaseCommand):
    help = (
        "Seed fake Notifications across users covering all categories, priorities, "
        "states (unread/read/archived/snoozed/deleted), and deep-link types. "
        "Idempotent: clears prior fake notifications for the affected users before re-creating."
    )

    NOTIFICATIONS_PER_USER = 8

    CATEGORY_TEMPLATES = {
        'signature_request': (
            'Solicitud de firma pendiente',
            'Tienes un documento "{doc_title}" que requiere tu firma electrónica.',
            'high',
            'document',
        ),
        'signature_completed': (
            'Documento firmado',
            'Todos los firmantes completaron la firma de "{doc_title}".',
            'medium',
            'document',
        ),
        'signature_rejected': (
            'Firma rechazada',
            'Un firmante rechazó el documento "{doc_title}".',
            'high',
            'document',
        ),
        'signature_expired': (
            'Solicitud de firma vencida',
            'La solicitud de firma del documento "{doc_title}" ha expirado.',
            'medium',
            'document',
        ),
        'signature_reopened': (
            'Firma reabierta',
            'La solicitud de firma de "{doc_title}" fue reabierta para corrección.',
            'medium',
            'document',
        ),
        'signature_reminder': (
            'Recordatorio: firmas pendientes',
            'Tienes documentos pendientes de firma en tu bandeja.',
            'low',
            'document',
        ),
        'process_alert': (
            'Alerta de proceso',
            'El proceso "{process_name}" se aproxima a una fecha importante.',
            'high',
            'process',
        ),
        'general': (
            'Solicitud actualizada',
            'Hay novedades en tu solicitud {tracking_number}.',
            'medium',
            'service_request',
        ),
    }

    def add_arguments(self, parser):
        parser.add_argument(
            '--per_user',
            type=int,
            default=self.NOTIFICATIONS_PER_USER,
            help='Average number of notifications to create per non-staff user.',
        )

    def handle(self, *args, **options):
        random.seed(42)
        per_user = options['per_user']

        users = list(
            User.objects.filter(role__in=['client', 'lawyer', 'basic', 'corporate_client'])
        )
        if not users:
            self.stdout.write(self.style.ERROR(
                'No users found. Run create_clients_lawyers first.'
            ))
            return

        processes = list(Process.objects.values_list('id', 'case__type')[:50])
        documents = list(DynamicDocument.objects.values_list('id', 'title')[:50])
        service_requests = list(
            ServiceRequest.objects.values_list('id', 'tracking_number')[:50]
        )

        deleted = Notification.objects.filter(user__in=users).delete()[0]
        if deleted:
            self.stdout.write(f'Cleared {deleted} prior notifications for these users.')

        now = timezone.now()
        created = 0

        for user in users:
            count = max(1, per_user)
            categories = random.choices(
                list(self.CATEGORY_TEMPLATES.keys()),
                k=count,
            )

            for idx, category in enumerate(categories):
                title, message_tpl, priority, link_type = self.CATEGORY_TEMPLATES[category]

                link_id = None
                resolved_message = message_tpl
                if link_type == 'document' and documents:
                    doc_id, doc_title = random.choice(documents)
                    link_id = doc_id
                    resolved_message = message_tpl.format(doc_title=doc_title or f'Documento #{doc_id}')
                elif link_type == 'process' and processes:
                    process_id, process_name = random.choice(processes)
                    link_id = process_id
                    resolved_message = message_tpl.format(process_name=process_name or f'Proceso #{process_id}')
                elif link_type == 'service_request' and service_requests:
                    sr_id, tracking_number = random.choice(service_requests)
                    link_id = sr_id
                    resolved_message = message_tpl.format(
                        tracking_number=tracking_number or f'#{sr_id}'
                    )
                else:
                    link_type_value = ''
                    link_type = link_type_value
                    resolved_message = title

                # State distribution: 40% unread/active, 25% read, 20% archived, 10% snoozed, 5% deleted
                roll = random.random()
                is_read = False
                is_archived = False
                is_deleted = False
                snoozed_until = None

                if roll < 0.40:
                    pass  # unread + active
                elif roll < 0.65:
                    is_read = True
                elif roll < 0.85:
                    is_archived = True
                    is_read = True
                elif roll < 0.95:
                    snoozed_until = now + timedelta(hours=random.choice([1, 3, 24, 72]))
                else:
                    is_deleted = True

                notification = Notification.objects.create(
                    user=user,
                    title=title,
                    message=resolved_message,
                    category=category,
                    priority=priority,
                    is_read=is_read,
                    is_archived=is_archived,
                    is_deleted=is_deleted,
                    snoozed_until=snoozed_until,
                    link_type=link_type if link_id else '',
                    link_id=link_id,
                )

                # Spread created_at across the last 30 days for realistic ordering
                offset = timedelta(
                    days=random.randint(0, 29),
                    hours=random.randint(0, 23),
                    minutes=random.randint(0, 59),
                )
                Notification.objects.filter(pk=notification.pk).update(
                    created_at=now - offset
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Created {created} notifications across {len(users)} users.'
        ))
