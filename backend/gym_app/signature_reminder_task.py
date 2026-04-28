"""
Huey periodic task for daily signature reminders.

Sends email and in-app notifications to users with pending signatures.
"""

import logging
from huey import crontab
from huey.contrib.djhuey import periodic_task, lock_task

logger = logging.getLogger(__name__)


@periodic_task(crontab(hour='14', minute='0'))  # 9 AM Colombia (UTC-5)
@lock_task('signature-daily-reminder-lock')
def send_daily_signature_reminders():
    """Send daily email reminders to users with pending signatures.
    
    This task runs once daily at 9 AM Colombia time.
    It sends one grouped email per user with all their pending documents
    and creates one in-app notification per user.
    """
    from gym_app.services.signature_notification_service import notify_daily_pending_reminders
    
    try:
        notify_daily_pending_reminders()
        logger.info("Daily signature reminders task completed successfully")
    except Exception as e:
        logger.error(f"Failed to send daily signature reminders: {e}", exc_info=True)
