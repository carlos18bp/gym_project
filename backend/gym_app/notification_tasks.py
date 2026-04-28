"""
Huey periodic tasks for the Notification Center.
"""

import logging
from huey import crontab
from huey.contrib.djhuey import periodic_task, lock_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@periodic_task(crontab(minute='*/15'))
@lock_task('notification-snooze-reactivation-lock')
def reactivate_snoozed_notifications():
    """Reactivate notifications whose snooze period has elapsed.

    Runs every 15 minutes.  Snoozed notifications whose
    ``snoozed_until`` is in the past are set back to unread.
    """
    from gym_app.models import Notification

    now = timezone.now()
    qs = Notification.objects.filter(
        snoozed_until__lte=now,
        is_deleted=False,
    ).exclude(snoozed_until__isnull=True)

    count = qs.update(snoozed_until=None, is_read=False, updated_at=now)
    if count:
        logger.info("Reactivated %d snoozed notifications", count)
    return count
