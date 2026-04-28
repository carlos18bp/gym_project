"""
REST API views for the Notification Center.

All endpoints require authentication and automatically filter by
``request.user`` to enforce data isolation.
"""

import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from gym_app.models import Notification
from gym_app.serializers.notification import NotificationSerializer

logger = logging.getLogger(__name__)

PAGE_SIZE = 20


def _visible_qs(user):
    """Base queryset: non-deleted notifications owned by *user*."""
    return Notification.objects.filter(user=user, is_deleted=False)


def _active_qs(user):
    """Visible + not snoozed (snoozed_until in the past counts as active)."""
    now = timezone.now()
    return _visible_qs(user).exclude(snoozed_until__gt=now)


# ── List ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    """Return paginated notifications for the authenticated user.

    Query params:
        tab   – 'all' (default), 'unread', 'archived'
        page  – 1-indexed page number (default 1)
    """
    tab = request.query_params.get('tab', 'all')
    page = request.query_params.get('page', 1)
    try:
        page = max(int(page), 1)
    except (ValueError, TypeError):
        page = 1

    qs = _active_qs(request.user)

    if tab == 'unread':
        qs = qs.filter(is_read=False, is_archived=False)
    elif tab == 'archived':
        qs = qs.filter(is_archived=True)
    else:
        qs = qs.filter(is_archived=False)

    total = qs.count()
    start = (page - 1) * PAGE_SIZE
    notifications = qs[start:start + PAGE_SIZE]
    serializer = NotificationSerializer(notifications, many=True)

    return Response({
        'results': serializer.data,
        'count': total,
        'page': page,
        'page_size': PAGE_SIZE,
    })


# ── Unread count (for bell badge) ──────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_unread_count(request):
    """Return the number of unread, non-archived, non-snoozed notifications."""
    from gym_app.services.notification_service import get_unread_count
    count = get_unread_count(request.user)
    return Response({'unread_count': count})


# ── Mark as read ────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_read(request, pk):
    """Mark a single notification as read."""
    try:
        notif = _visible_qs(request.user).get(pk=pk)
    except Notification.DoesNotExist:
        return Response({'detail': 'Notificación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    notif.is_read = True
    notif.save(update_fields=['is_read', 'updated_at'])
    return Response({'status': 'ok'})


# ── Mark all as read ────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_all_read(request):
    """Mark every visible, non-archived notification as read."""
    updated = _active_qs(request.user).filter(
        is_read=False,
        is_archived=False,
    ).update(is_read=True, updated_at=timezone.now())
    return Response({'updated': updated})


# ── Archive ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_archive(request, pk):
    """Archive a notification (move to "Archivadas" tab)."""
    try:
        notif = _visible_qs(request.user).get(pk=pk)
    except Notification.DoesNotExist:
        return Response({'detail': 'Notificación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    notif.is_archived = True
    notif.is_read = True
    notif.save(update_fields=['is_archived', 'is_read', 'updated_at'])
    return Response({'status': 'ok'})


# ── Snooze ──────────────────────────────────────────────────────────

SNOOZE_DURATIONS = {
    '1h': timedelta(hours=1),
    '3h': timedelta(hours=3),
    '1d': timedelta(days=1),
    '3d': timedelta(days=3),
}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_snooze(request, pk):
    """Snooze a notification for a predefined duration.

    Body: ``{ "duration": "1h" | "3h" | "1d" | "3d" }``
    """
    duration_key = request.data.get('duration', '')
    delta = SNOOZE_DURATIONS.get(duration_key)
    if delta is None:
        return Response(
            {'detail': f'Duración inválida. Opciones: {", ".join(SNOOZE_DURATIONS)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        notif = _visible_qs(request.user).get(pk=pk)
    except Notification.DoesNotExist:
        return Response({'detail': 'Notificación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    notif.snoozed_until = timezone.now() + delta
    notif.is_read = True
    notif.save(update_fields=['snoozed_until', 'is_read', 'updated_at'])
    return Response({'status': 'ok', 'snoozed_until': notif.snoozed_until.isoformat()})


# ── Delete (soft) ───────────────────────────────────────────────────

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_delete(request, pk):
    """Soft-delete a notification (permanent, not recoverable)."""
    try:
        notif = _visible_qs(request.user).get(pk=pk)
    except Notification.DoesNotExist:
        return Response({'detail': 'Notificación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    notif.is_deleted = True
    notif.save(update_fields=['is_deleted', 'updated_at'])
    return Response(status=status.HTTP_204_NO_CONTENT)
