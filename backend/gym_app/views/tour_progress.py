"""
REST API views for guided-tour progress tracking.

All endpoints require authentication and automatically filter by
``request.user`` to enforce data isolation.  The 30-day staleness rule
lives on the model (``TourProgress.STALE_AFTER_DAYS``) so the backend
clock is the single source of truth.
"""

import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from gym_app.models import TourProgress
from gym_app.serializers.tour_progress import TourProgressSerializer

logger = logging.getLogger(__name__)

VALID_MODULES = {choice[0] for choice in TourProgress.MODULE_CHOICES}


# ── Status ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tour_progress_status(request):
    """Return the tour status for the authenticated user and a module.

    Query params:
        module – module identifier, e.g. 'dynamic_documents'

    Response:
        ``{"module_name": ..., "status": "never"|"recent"|"stale", "completed_at": iso|null}``
    """
    module_name = request.query_params.get('module', '')
    if module_name not in VALID_MODULES:
        return Response({'detail': 'Módulo inválido.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        progress = TourProgress.objects.get(user=request.user, module_name=module_name)
    except TourProgress.DoesNotExist:
        return Response({
            'module_name': module_name,
            'status': 'never',
            'completed_at': None,
        })

    return Response(TourProgressSerializer(progress).data)


# ── Complete ────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def tour_progress_complete(request):
    """Mark a module tour as completed (finished, skipped or declined).

    Body: ``{"module_name": "dynamic_documents"}``

    Creates the record on first completion and refreshes
    ``completed_at`` on subsequent ones (single row per user/module).
    """
    module_name = request.data.get('module_name', '')
    if module_name not in VALID_MODULES:
        return Response({'detail': 'Módulo inválido.'}, status=status.HTTP_400_BAD_REQUEST)

    progress, _created = TourProgress.objects.update_or_create(
        user=request.user,
        module_name=module_name,
        defaults={'completed_at': timezone.now()},
    )

    return Response(TourProgressSerializer(progress).data)
