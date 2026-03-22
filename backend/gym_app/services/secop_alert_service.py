import logging

from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

from gym_app.models import SECOPAlert, SECOPProcess, AlertNotification

logger = logging.getLogger(__name__)


class AlertEvaluationService:
    """
    Service for evaluating alerts and sending notifications.

    Handles matching new processes against user-configured alerts
    and sending notifications via email.
    """

    def evaluate_processes(self, process_ids):
        """
        Evaluate a list of new processes against all active alerts.

        Args:
            process_ids: List of SECOPProcess IDs to evaluate

        Returns:
            int: Number of notifications created
        """
        processes = SECOPProcess.objects.filter(id__in=process_ids)
        alerts = SECOPAlert.objects.filter(
            is_active=True
        ).select_related('user')

        notifications_created = 0

        for process in processes:
            for alert in alerts:
                if alert.evaluate_process(process):
                    notification, created = AlertNotification.objects.get_or_create(
                        alert=alert,
                        process=process
                    )

                    if created:
                        notifications_created += 1

                        # Send immediate notification if configured
                        if alert.frequency == SECOPAlert.Frequency.IMMEDIATE:
                            self._send_immediate_notification(
                                alert, process, notification
                            )

        logger.info(f"Created {notifications_created} SECOP alert notifications")
        return notifications_created

    def _send_immediate_notification(self, alert, process, notification):
        """
        Send immediate email notification for a single process match.

        Args:
            alert: The SECOPAlert that matched
            process: The matching SECOPProcess
            notification: The AlertNotification record
        """
        try:
            context = {
                'alert': alert,
                'process': process,
                'process_url': process.process_url,
                'user': alert.user,
            }

            html_message = render_to_string(
                'gym_app/emails/secop_immediate_alert.html',
                context
            )

            subject = (
                f"[SECOP] Nueva oportunidad: "
                f"{process.procedure_name[:50]}"
            )

            send_mail(
                subject=subject,
                message=(
                    f"Nueva oportunidad detectada: {process.procedure_name}"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[alert.user.email],
                html_message=html_message,
                fail_silently=False,
            )

            notification.is_sent = True
            notification.sent_at = timezone.now()
            notification.save()

        except Exception as e:
            logger.error(
                f"Failed to send SECOP immediate notification: {e}"
            )

    def send_summaries(self, frequency):
        """
        Send summary notifications for a given frequency.

        Collects all pending notifications and sends grouped by user.

        Args:
            frequency: 'DAILY' or 'WEEKLY'
        """
        notifications = AlertNotification.objects.filter(
            is_sent=False,
            alert__frequency=frequency,
            alert__is_active=True
        ).select_related('alert__user', 'process')

        # Group by user
        by_user = {}
        for notification in notifications:
            user = notification.alert.user
            if user.id not in by_user:
                by_user[user.id] = {
                    'user': user,
                    'notifications': []
                }
            by_user[user.id]['notifications'].append(notification)

        # Send grouped notifications
        for user_data in by_user.values():
            self._send_user_summary(
                user_data['user'],
                user_data['notifications'],
                frequency
            )

    def _send_user_summary(self, user, notifications, frequency):
        """
        Send summary email to a single user.

        Args:
            user: User instance
            notifications: List of AlertNotification instances
            frequency: Notification frequency for subject line
        """
        try:
            processes = [n.process for n in notifications]
            period = "diario" if frequency == 'DAILY' else "semanal"

            context = {
                'user': user,
                'processes': processes,
                'total': len(processes),
                'period': period,
            }

            html_message = render_to_string(
                'gym_app/emails/secop_alert_summary.html',
                context
            )

            subject = (
                f"[SECOP] Resumen {period}: "
                f"{len(processes)} nuevas oportunidades"
            )

            send_mail(
                subject=subject,
                message=f"Se encontraron {len(processes)} nuevas oportunidades.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )

            # Mark all as sent in a single query
            now = timezone.now()
            for notification in notifications:
                notification.is_sent = True
                notification.sent_at = now
            AlertNotification.objects.bulk_update(
                notifications, ['is_sent', 'sent_at']
            )

        except Exception as e:
            logger.error(f"Failed to send SECOP summary to {user}: {e}")
