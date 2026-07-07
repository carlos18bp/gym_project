"""
Centralized service for contract-execution (cuentas de cobro) notifications.

Handles both email notifications (via send_template_email) and in-app
notifications (via notification_service) for the payment-record lifecycle:
upload -> lawyer review (accept / reject). Mirrors the structure of
signature_notification_service.
"""

import logging

from django.conf import settings

from gym_app.services.notification_service import create_notification
from gym_app.views.layouts.sendEmail import send_template_email

logger = logging.getLogger(__name__)


def _build_document_url(document_id):
    """Build absolute URL to the document for email links."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://gmconsultoresjuridicos.com')
    return f"{frontend_url}/dynamic_document_dashboard?highlight={document_id}"


def notify_payment_record_uploaded(document, record):
    """Notify the creator lawyer that a cuenta de cobro awaits review.

    Skipped when the lawyer uploaded on the client's behalf (no
    self-notification noise).
    """
    try:
        creator = document.created_by
        if not creator:
            return
        if record.uploaded_by_id == document.created_by_id:
            return

        uploader = record.uploaded_by
        uploader_name = (
            (uploader.get_full_name() or uploader.email) if uploader else 'El cliente'
        )
        number = record.installment_number
        title = f"Cuota {number} cargada: {document.title}"
        message = (
            f"{uploader_name} cargó la cuenta de cobro de la cuota {number} "
            f"del documento '{document.title}'. Revísala para aceptarla o rechazarla."
        )

        if getattr(creator, 'email', None):
            context = {
                'title': title,
                'badge_text': 'Cuenta de Cobro',
                'notification_title': f"Nueva cuenta de cobro en '{document.title}'",
                'message': message,
                'additional_info': f"Cargada por: {uploader_name}",
                'action_url': _build_document_url(document.id),
                'action_text': 'Ver Documento',
            }
            send_template_email(
                'notification',
                f"[Cuentas de Cobro] {title}",
                [creator.email],
                context,
            )

        create_notification(
            user=creator,
            title=title,
            message=message,
            category='general',
            priority='medium',
            link_type='document',
            link_id=document.id,
        )
    except Exception as exc:
        logger.error(
            f"Failed to send payment-uploaded notifications for document {document.id}: {exc}"
        )


def notify_payment_record_reviewed(document, record, accepted):
    """Notify the assigned client about the lawyer's accept/reject decision."""
    try:
        client = document.assigned_to
        if not client:
            return
        # Self-assigned edge case: the reviewer is also the assignee
        if client.id == document.created_by_id:
            return

        number = record.installment_number
        if accepted:
            title = f"Cuota {number} aceptada: {document.title}"
            message = (
                f"El abogado aceptó la cuenta de cobro de la cuota {number} "
                f"del documento '{document.title}'."
            )
            badge_text = 'Cuenta Aceptada'
            priority = 'medium'
        else:
            title = f"Cuota {number} rechazada: {document.title}"
            message = (
                f"El abogado rechazó la cuenta de cobro de la cuota {number} "
                f"del documento '{document.title}'.\n\n"
                f"Motivo del rechazo:\n{record.rejection_reason}"
            )
            badge_text = 'Cuenta Rechazada'
            priority = 'high'

        if getattr(client, 'email', None):
            context = {
                'title': title,
                'badge_text': badge_text,
                'notification_title': title,
                'message': message,
                'additional_info': None,
                'action_url': _build_document_url(document.id),
                'action_text': 'Ver Documento',
            }
            send_template_email(
                'notification',
                f"[Cuentas de Cobro] {title}",
                [client.email],
                context,
            )

        create_notification(
            user=client,
            title=title,
            message=message,
            category='general',
            priority=priority,
            link_type='document',
            link_id=document.id,
        )
    except Exception as exc:
        logger.error(
            f"Failed to send payment-reviewed notifications for document {document.id}: {exc}"
        )
