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
        The created Notification instance, or None for archived recipients.
    """
    # Archived accounts receive no notifications (in-app or, transitively,
    # the bulk helper). This is the single in-app choke point.
    if getattr(user, 'is_archived', False):
        return None
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


def build_process_recipients(process, notify_clients=True, actor=None):
    """Return the deduplicated list of users to notify about a process event.

    Centralizes the lawyer + clients - actor logic so callers don't reinvent
    it (and don't issue extra ``process.clients.all()`` queries when they
    already need the recipients themselves).
    """
    recipients = []
    seen_ids = set()

    lawyer = getattr(process, 'lawyer', None)
    if lawyer is not None and not getattr(lawyer, 'is_archived', False) and lawyer.id not in seen_ids:
        recipients.append(lawyer)
        seen_ids.add(lawyer.id)

    if notify_clients:
        for client in process.clients.all():
            if getattr(client, 'is_archived', False):
                continue
            if client.id not in seen_ids:
                recipients.append(client)
                seen_ids.add(client.id)

    if actor is not None:
        recipients = [u for u in recipients if u.id != actor.id]

    return recipients


def notify_process_stakeholders(
    process,
    title,
    message,
    actor=None,
    category='process_alert',
    priority='medium',
    recipients=None,
):
    """Notify lawyer and clients of *process* about an event, excluding *actor*.

    Pass ``recipients`` explicitly to reuse a pre-resolved list and avoid an
    extra ``process.clients.all()`` query when emitting several notifications
    in a row (e.g. one per added stage).
    """
    if recipients is None:
        recipients = build_process_recipients(process, actor=actor)

    if not recipients:
        return []

    return create_bulk_notifications(
        users=recipients,
        title=title,
        message=message,
        category=category,
        priority=priority,
        link_type='process',
        link_id=process.id,
    )
