"""
Huey periodic task for sending legal-process stage alerts.

Runs daily at 14:00 UTC (9:00 AM Colombia, UTC-5).
For each active process whose last stage has an active StageAlert,
sends reminders 3 days and 1 day before the stage date via email
and in-app notification.
"""

import logging
from datetime import timedelta

from huey import crontab
from huey.contrib.djhuey import periodic_task, lock_task
from django.db.models import Prefetch
from django.utils import timezone

from gym_app.views.layouts.sendEmail import send_template_email

logger = logging.getLogger(__name__)


@periodic_task(crontab(hour='14', minute='0'))
@lock_task('process-alert-daily-lock')
def send_process_alerts():
    """Check every active process and send 3-day / 1-day reminders."""
    from gym_app.models import Process, Stage, StageAlert
    from gym_app.services.notification_service import create_notification

    today = timezone.now().date()
    processed = 0
    sent = 0

    # Prefetch stages with explicit ordering so the per-process loop reuses
    # the cache instead of issuing a fresh query per process.
    processes = (
        Process.objects
        .prefetch_related(
            Prefetch('stages', queryset=Stage.objects.order_by('id').select_related('alert')),
            'clients',
        )
        .select_related('lawyer')
        .all()
    )

    for process in processes:
        stages = list(process.stages.all())
        if not stages:
            continue

        last_stage = stages[-1]

        # Skip finished processes
        if last_stage.status == 'Fallo':
            continue

        # Must have a date
        if not last_stage.date:
            continue

        # Must have an active alert
        try:
            alert = last_stage.alert
        except StageAlert.DoesNotExist:
            continue

        if not alert.is_active:
            continue

        days_until = (last_stage.date - today).days
        processed += 1

        # Determine which reminder to send
        should_send_3 = (days_until == 3 and not alert.notified_3_days)
        should_send_1 = (days_until == 1 and not alert.notified_1_day)

        if not should_send_3 and not should_send_1:
            continue

        # Build recipients
        recipients = _build_recipients(process, alert)
        if not recipients:
            continue

        reminder_label = '3 días' if should_send_3 else '1 día'
        description = alert.description or f'Recordatorio de etapa procesal: {last_stage.status}'

        # Send email to all recipients
        _send_alert_email(
            process=process,
            stage=last_stage,
            description=description,
            reminder_label=reminder_label,
            recipient_emails=[r['email'] for r in recipients],
        )

        # Create in-app notifications
        for r in recipients:
            create_notification(
                user=r['user'],
                title=f'Alerta de Proceso — {reminder_label} restante',
                message=(
                    f'El proceso {process.ref} ({process.subcase}) tiene '
                    f'la etapa "{last_stage.status}" programada para '
                    f'{last_stage.date.strftime("%d/%m/%Y")}. {description}'
                ),
                category='process_alert',
                priority='high',
                link_type='process',
                link_id=process.id,
            )

        # Update alert flags
        if should_send_3:
            alert.notified_3_days = True
        if should_send_1:
            alert.notified_1_day = True
        alert.save(update_fields=['notified_3_days', 'notified_1_day', 'updated_at'])

        sent += 1

    logger.info("Process alert task: processed=%d, sent=%d", processed, sent)
    return f"processed={processed}, sent={sent}"


def _build_recipients(process, alert):
    """Return list of dicts ``{'user': <User>, 'email': <str>}``."""
    recipients = []

    # Always include the lawyer
    lawyer = process.lawyer
    if lawyer and lawyer.email:
        recipients.append({'user': lawyer, 'email': lawyer.email})

    # Optionally include clients
    if alert.notify_clients:
        for client in process.clients.all():
            if client.email and client.id != lawyer.id:
                recipients.append({'user': client, 'email': client.email})

    return recipients


def _send_alert_email(process, stage, description, reminder_label, recipient_emails):
    """Send the alert email using the notification template."""
    from django.conf import settings

    frontend_url = getattr(settings, 'FRONTEND_BASE_URL', 'https://gmconsultoresjuridicos.com')
    process_url = f'{frontend_url}/process_detail/{process.id}'

    try:
        send_template_email(
            template_name='notification',
            subject=f'Alerta de Proceso — {reminder_label} restante — {process.ref}',
            to_emails=recipient_emails,
            context={
                'title': 'Alerta de Proceso Jurídico',
                'badge_text': f'{reminder_label} restante',
                'notification_title': f'Proceso: {process.ref}',
                'message': (
                    f'La etapa <strong>{stage.status}</strong> del proceso '
                    f'<strong>{process.subcase}</strong> (Ref: {process.ref}) '
                    f'está programada para el <strong>{stage.date.strftime("%d/%m/%Y")}</strong>.'
                ),
                'additional_info': description,
                'action_url': process_url,
                'action_text': 'Ver Proceso',
            },
        )
    except Exception:
        logger.error(
            "Failed to send process alert email for process %s",
            process.id,
            exc_info=True,
        )
