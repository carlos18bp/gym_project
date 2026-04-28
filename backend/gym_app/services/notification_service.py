"""
Public interface for creating in-app notifications.

Other modules (process alerts, signature alerts, etc.) should use
these functions instead of importing the Notification model directly.
"""

import logging
from django.utils import timezone
from gym_app.models import Notification

logger = logging.getLogger(__name__)


def create_notification(
    user,
    title,
    message,
    category='general',
    priority='medium',
    link_type='',
    link_id=None,
):
    """Create a single in-app notification for *user*.

    Args:
        user: User instance (recipient).
        title: Short title shown in the notification list.
        message: Body text of the notification.
        category: One of Notification.CATEGORY_CHOICES values.
        priority: 'low', 'medium', or 'high'.
        link_type: Resource type for deep-linking ('process', 'document', 'service_request').
        link_id: PK of the linked resource.

    Returns:
        The created Notification instance.
    """
    try:
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            category=category,
            priority=priority,
            link_type=link_type,
            link_id=link_id,
        )
        logger.info("Notification created: [%s] %s → user %s", category, title, user.id)
        return notification
    except Exception:
        logger.error("Failed to create notification for user %s", user.id, exc_info=True)
        return None


def create_bulk_notifications(
    users,
    title,
    message,
    category='general',
    priority='medium',
    link_type='',
    link_id=None,
):
    """Create one notification per user in *users*.

    Args:
        users: Iterable of User instances.
        title, message, category, priority, link_type, link_id: Same as create_notification.

    Returns:
        List of created Notification instances.
    """
    notifications = []
    for user in users:
        n = create_notification(
            user=user,
            title=title,
            message=message,
            category=category,
            priority=priority,
            link_type=link_type,
            link_id=link_id,
        )
        if n is not None:
            notifications.append(n)
    return notifications


def get_unread_count(user):
    """Return the count of visible unread notifications for *user*.

    Excludes archived, soft-deleted, and currently-snoozed notifications.
    """
    now = timezone.now()
    return Notification.objects.filter(
        user=user,
        is_read=False,
        is_archived=False,
        is_deleted=False,
    ).exclude(
        snoozed_until__gt=now,
    ).count()
