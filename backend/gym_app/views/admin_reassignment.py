"""
Admin-only API for reassigning a lawyer's data to another lawyer and for
archiving/unarchiving lawyer accounts.

Every endpoint is restricted to platform administrators (``is_platform_admin``
— NOT ``is_gym_staff``, which also grants lawyers). Transfers run atomically:
processes move to the target lawyer, documents' management (``managed_by``)
moves to the target while ``created_by`` stays untouched for audit, and both
lawyers get an ActivityFeed entry. Documents in signature states are never
transferable.
"""

import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from gym_app.models import ActivityFeed, DynamicDocument, Process
from gym_app.serializers.user import UserSerializer
from gym_app.utils.auth_utils import is_platform_admin

logger = logging.getLogger(__name__)
User = get_user_model()

# Documents in these signature states are protected from reassignment.
ELIGIBLE_DOCUMENT_STATES = frozenset(['Draft', 'Published', 'Progress', 'Completed'])
INELIGIBLE_STATE_REASONS = {
    'PendingSignatures': 'En proceso de firma',
    'FullySigned': 'Firmado',
    'Rejected': 'Rechazado',
    'Expired': 'Vencido',
}


def _admin_required(request):
    """Return a 403 Response when the caller is not a platform admin, else None."""
    if not is_platform_admin(request.user):
        return Response(
            {'detail': 'Solo los administradores pueden acceder a este módulo.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _get_lawyer(user_id):
    """Fetch a user by id only if they are a lawyer, else None."""
    user = User.objects.filter(pk=user_id).first()
    if not user or (user.role or '').lower() != 'lawyer':
        return None
    return user


def _full_name(user):
    return user.get_full_name() or user.email


def _lawyer_brief(user):
    return {
        'id': user.id,
        'full_name': _full_name(user),
        'email': user.email,
        'is_archived': user.is_archived,
    }


# ── Summary ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reassignment_summary(request):
    """Return the processes and documents a lawyer would transfer.

    Query param ``lawyer_id`` (required). Documents are split into
    eligible (transferable states) and ineligible (signature states,
    each with a Spanish reason). Archived source lawyers are allowed so
    their data can be migrated after archiving.
    """
    denied = _admin_required(request)
    if denied:
        return denied

    lawyer_id = request.query_params.get('lawyer_id')
    if not lawyer_id or not str(lawyer_id).isdigit():
        return Response({'detail': 'Se requiere el parámetro lawyer_id.'}, status=status.HTTP_400_BAD_REQUEST)

    lawyer = _get_lawyer(int(lawyer_id))
    if not lawyer:
        return Response({'detail': 'Abogado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    processes = (
        Process.objects.filter(lawyer=lawyer)
        .select_related('case')
        .prefetch_related('clients')
        .order_by('-created_at')
    )
    process_rows = [{
        'id': p.id,
        'ref': p.ref,
        'plaintiff': p.plaintiff,
        'defendant': p.defendant,
        'case_type': p.case.type if p.case else None,
        'clients_count': p.clients.count(),
    } for p in processes]

    documents = (
        DynamicDocument.objects.filter(managed_by=lawyer)
        .select_related('assigned_to')
        .order_by('-updated_at')
    )
    eligible, ineligible = [], []
    for doc in documents:
        assigned = doc.assigned_to
        assigned_name = _full_name(assigned) if assigned else None
        if doc.state in ELIGIBLE_DOCUMENT_STATES:
            eligible.append({
                'id': doc.id,
                'title': doc.title,
                'state': doc.state,
                'assigned_to_name': assigned_name,
            })
        else:
            ineligible.append({
                'id': doc.id,
                'title': doc.title,
                'state': doc.state,
                'reason': INELIGIBLE_STATE_REASONS.get(doc.state, 'No transferible'),
            })

    return Response({
        'lawyer': _lawyer_brief(lawyer),
        'processes': process_rows,
        'eligible_documents': eligible,
        'ineligible_documents': ineligible,
        'counts': {
            'processes': len(process_rows),
            'eligible_documents': len(eligible),
            'ineligible_documents': len(ineligible),
        },
    })


# ── Execute ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def execute_reassignment(request):
    """Atomically transfer selected processes and documents to a target lawyer.

    Body: ``{source_lawyer_id, target_lawyer_id, process_ids, document_ids,
    archive_source}``. All-or-nothing: any error rolls the transfer back.
    """
    denied = _admin_required(request)
    if denied:
        return denied

    data = request.data
    source_id = data.get('source_lawyer_id')
    target_id = data.get('target_lawyer_id')
    process_ids = list(data.get('process_ids') or [])
    document_ids = list(data.get('document_ids') or [])
    archive_source = bool(data.get('archive_source'))

    if not source_id or not target_id:
        return Response({'detail': 'Se requieren abogado origen y destino.'}, status=status.HTTP_400_BAD_REQUEST)

    source = _get_lawyer(source_id)
    target = _get_lawyer(target_id)
    if not source or not target:
        return Response({'detail': 'Abogado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if source.id == target.id:
        return Response({'detail': 'El abogado origen y destino no pueden ser el mismo.'}, status=status.HTTP_400_BAD_REQUEST)
    if target.is_archived:
        return Response({'detail': 'El abogado destino está archivado.'}, status=status.HTTP_400_BAD_REQUEST)
    if not process_ids and not document_ids:
        return Response({'detail': 'No hay elementos seleccionados para transferir.'}, status=status.HTTP_400_BAD_REQUEST)

    # Ownership: every selected item must belong to the source lawyer.
    process_ids = list({int(pid) for pid in process_ids})
    document_ids = list({int(did) for did in document_ids})
    if process_ids and Process.objects.filter(id__in=process_ids, lawyer=source).count() != len(process_ids):
        return Response({'detail': 'Algunos procesos no pertenecen al abogado origen.'}, status=status.HTTP_400_BAD_REQUEST)

    owned_docs = list(DynamicDocument.objects.filter(id__in=document_ids, managed_by=source))
    if len(owned_docs) != len(document_ids):
        return Response({'detail': 'Algunos documentos no pertenecen al abogado origen.'}, status=status.HTTP_400_BAD_REQUEST)

    # Eligibility: no signature-state documents may be transferred.
    ineligible_ids = [d.id for d in owned_docs if d.state not in ELIGIBLE_DOCUMENT_STATES]
    if ineligible_ids:
        return Response(
            {
                'detail': 'Algunos documentos seleccionados no son transferibles por su estado de firma.',
                'ineligible_ids': ineligible_ids,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    source_name = _full_name(source)
    target_name = _full_name(target)

    with transaction.atomic():
        if process_ids:
            Process.objects.filter(id__in=process_ids, lawyer=source).update(lawyer=target)

        if document_ids:
            docs = DynamicDocument.objects.select_for_update().filter(
                id__in=document_ids, managed_by=source
            )
            # Personal documents (assigned to the source lawyer) follow the
            # transfer; client-assigned docs keep their client. This filter
            # MUST run before the managed_by update below (which invalidates
            # the managed_by=source predicate).
            docs.filter(assigned_to=source).update(assigned_to=target)
            docs.update(managed_by=target)

        n_p, n_d = len(process_ids), len(document_ids)
        ActivityFeed.objects.create(
            user=source,
            action_type='other',
            description=f"Reasignación de datos: {n_p} proceso(s) y {n_d} documento(s) transferidos a {target_name}.",
        )
        ActivityFeed.objects.create(
            user=target,
            action_type='other',
            description=f"Reasignación de datos: {n_p} proceso(s) y {n_d} documento(s) recibidos de {source_name}.",
        )

        if archive_source:
            source.archive()

    return Response({
        'transferred_processes': len(process_ids),
        'transferred_documents': len(document_ids),
        'source_archived': archive_source,
        'source': {'id': source.id, 'full_name': source_name},
        'target': {'id': target.id, 'full_name': target_name},
    })


# ── Archive / Unarchive ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def archive_lawyer(request, user_id):
    """Archive a lawyer account (blocks login, hides from listings)."""
    denied = _admin_required(request)
    if denied:
        return denied

    lawyer = _get_lawyer(user_id)
    if not lawyer:
        return Response({'detail': 'Abogado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if lawyer.id == request.user.id:
        return Response({'detail': 'No puedes archivar tu propia cuenta.'}, status=status.HTTP_400_BAD_REQUEST)
    if lawyer.is_archived:
        return Response({'detail': 'El abogado ya está archivado.'}, status=status.HTTP_400_BAD_REQUEST)

    lawyer.archive()
    return Response(UserSerializer(lawyer).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unarchive_lawyer(request, user_id):
    """Restore an archived lawyer account (reversible)."""
    denied = _admin_required(request)
    if denied:
        return denied

    lawyer = _get_lawyer(user_id)
    if not lawyer:
        return Response({'detail': 'Abogado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if not lawyer.is_archived:
        return Response({'detail': 'El abogado no está archivado.'}, status=status.HTTP_400_BAD_REQUEST)

    lawyer.unarchive()
    return Response(UserSerializer(lawyer).data)
