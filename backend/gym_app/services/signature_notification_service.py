"""
Centralized service for signature-related notifications.

Handles both email notifications (via send_template_email) and in-app
notifications (via notification_service) for all signature lifecycle events.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from gym_app.models import DynamicDocument, DocumentSignature
from gym_app.services.notification_service import create_notification, create_bulk_notifications
from gym_app.views.layouts.sendEmail import send_template_email

logger = logging.getLogger(__name__)


def _build_document_url(document_id):
    """Build absolute URL to the document for email links."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://gmconsultoresjuridicos.com')
    return f"{frontend_url}/dynamic_document_dashboard?highlight={document_id}"


# Per-signature_type copy used for both email and in-app notifications when a
# document is formalized. Keeps the three modalities (normal/issuer_only/
# informative) reflected verbatim in the Notification Center.
_SIGNATURE_REQUESTED_COPY = {
    'normal': {
        'in_app_title': "Firma solicitada: {title}",
        'in_app_message': "Se ha solicitado tu firma para el documento '{title}'",
        'email_subject': "[Firmas] Solicitud de firma para: {title}",
        'email_card_title': "Solicitud de Firma: {title}",
        'email_badge': 'Firma Solicitada',
        'email_notification_title': "Se ha solicitado tu firma para el documento '{title}'",
        'email_message': (
            "Se te ha solicitado que firmes el documento '{title}'. "
            "Por favor accede a la plataforma para revisar y firmar lo antes posible."
        ),
    },
    'issuer_only': {
        'in_app_title': "Documento Emitido: {title}",
        'in_app_message': (
            "Se ha emitido un documento firmado solamente por el emisor: '{title}'"
        ),
        'email_subject': "[Documento Emitido] {title}",
        'email_card_title': "Documento Emitido: {title}",
        'email_badge': 'Documento Emitido',
        'email_notification_title': (
            "Se ha emitido el documento '{title}' firmado solamente por el emisor"
        ),
        'email_message': (
            "Se te ha notificado el documento '{title}', firmado únicamente por el "
            "emisor. Puedes consultarlo en la plataforma."
        ),
    },
    'informative': {
        'in_app_title': "Documento Informado: {title}",
        'in_app_message': "Se ha emitido e informado el documento: '{title}'",
        'email_subject': "[Documento Informado] {title}",
        'email_card_title': "Documento Informado: {title}",
        'email_badge': 'Documento Informado',
        'email_notification_title': (
            "Se ha emitido e informado el documento '{title}'"
        ),
        'email_message': (
            "Se te ha enviado el documento informativo '{title}'. Este documento "
            "no requiere firma. Puedes consultarlo en la plataforma."
        ),
    },
}


def notify_signature_requested(document, signers, signature_type='normal', send_email=True):
    """Send notifications when signatures are first requested on a document.

    The copy is tailored to the signature modality so the Notification Center
    distinguishes between "Firma Solicitada" (normal), "Documento Emitido"
    (issuer_only) and "Documento Informado" (informative).

    Args:
        document: DynamicDocument instance.
        signers: Iterable of User instances who receive the notification.
        signature_type: 'normal', 'issuer_only' or 'informative'. Falls back to
            'normal' copy if an unknown value is provided.
        send_email: When False, skip the email branch and only create in-app
            notifications. Used when the calling view already sent specific
            emails (e.g. the informative formalize flow).
    """
    if not signers:
        return

    copy = _SIGNATURE_REQUESTED_COPY.get(signature_type, _SIGNATURE_REQUESTED_COPY['normal'])

    try:
        if send_email:
            for signer in signers:
                if not getattr(signer, 'email', None):
                    continue

                context = {
                    'title': copy['email_card_title'].format(title=document.title),
                    'badge_text': copy['email_badge'],
                    'notification_title': copy['email_notification_title'].format(title=document.title),
                    'message': copy['email_message'].format(title=document.title),
                    'additional_info': f"Creado por: {document.created_by.get_full_name() or document.created_by.email}",
                    'action_url': _build_document_url(document.id),
                    'action_text': 'Ver Documento',
                }

                send_template_email(
                    template_name='notification',
                    subject=copy['email_subject'].format(title=document.title),
                    to_emails=[signer.email],
                    context=context,
                )

        create_bulk_notifications(
            users=list(signers),
            title=copy['in_app_title'].format(title=document.title),
            message=copy['in_app_message'].format(title=document.title),
            category='signature_request',
            priority='high',
            link_type='document',
            link_id=document.id,
        )

        logger.info(
            "Sent signature notifications (%s) for document %s to %s signers",
            signature_type, document.id, len(list(signers)) if not hasattr(signers, '__len__') else len(signers),
        )

    except Exception as e:
        logger.error(f"Failed to send signature request notifications for document {document.id}: {e}")


def notify_signature_progress(document, signing_user):
    """Send notifications when a signer signs the document.
    
    Args:
        document: DynamicDocument instance
        signing_user: User instance who just signed
    """
    try:
        # Get all signers
        all_signatures = document.signatures.all()
        signed_signatures = all_signatures.filter(signed=True)
        unsigned_signatures = all_signatures.filter(signed=False)
        
        all_signers = [sig.signer for sig in all_signatures if getattr(sig.signer, 'email', None)]
        signer_name = signing_user.get_full_name() or signing_user.email
        signed_count = signed_signatures.count()
        total_count = all_signatures.count()
        
        # Email notifications to all signers
        context = {
            'title': f"Progreso de Firma: {document.title}",
            'badge_text': 'Progreso de Firma',
            'notification_title': f"Actualización de firma: {signer_name} ha firmado '{document.title}'",
            'message': f"El usuario {signer_name} ha firmado el documento '{document.title}'. "
                      f"Progreso: {signed_count} de {total_count} firmas completadas.",
            'additional_info': f"Firmantes que faltan: " + 
                              ", ".join([sig.signer.get_full_name() or sig.signer.email 
                                       for sig in unsigned_signatures]) if unsigned_signatures.exists() 
                              else "Ninguno. El documento está completamente firmado.",
            'action_url': _build_document_url(document.id),
            'action_text': 'Ver Documento',
        }
        
        send_template_email(
            template_name='notification',
            subject=f"[Firmas] Progreso en la firma del documento '{document.title}'",
            to_emails=[s.email for s in all_signers],
            context=context,
        )
        
        # In-app notifications to all signers
        create_bulk_notifications(
            users=all_signers,
            title=f"Progreso de firma: {document.title}",
            message=f"{signer_name} ha firmado el documento ({signed_count}/{total_count} completadas)",
            category='signature_completed',
            priority='medium',
            link_type='document',
            link_id=document.id,
        )
        
        logger.info(f"Sent signature progress notifications for document {document.id}")
        
    except Exception as e:
        logger.error(f"Failed to send signature progress notifications for document {document.id}: {e}")


def notify_signature_completed(document, signing_user):
    """Send notifications when all signatures are complete.
    
    Args:
        document: DynamicDocument instance (now fully signed)
        signing_user: User instance who completed the final signature
    """
    try:
        # Get all signers and document creator
        all_signers = [sig.signer for sig in document.signatures.all() if getattr(sig.signer, 'email', None)]
        creator = document.created_by
        
        # Include creator if they're not already in signers
        recipients = list(set(all_signers + ([creator] if creator and creator not in all_signers else [])))
        
        signer_name = signing_user.get_full_name() or signing_user.email
        
        # Email notifications
        context = {
            'title': f"Firma Completada: {document.title}",
            'badge_text': 'Firma Completada',
            'notification_title': f"¡Firma completada! '{document.title}' está completamente firmado",
            'message': f"El usuario {signer_name} ha completado la firma final del documento '{document.title}'. "
                      f"El documento ahora está completamente firmado y formalizado.",
            'additional_info': f"Total de firmantes: {document.signatures.count()}",
            'action_url': _build_document_url(document.id),
            'action_text': 'Ver Documento',
        }
        
        send_template_email(
            template_name='notification',
            subject=f"[Firmas] Documento completamente firmado: {document.title}",
            to_emails=[r.email for r in recipients],
            context=context,
        )
        
        # In-app notifications
        create_bulk_notifications(
            users=recipients,
            title=f"Firma completada: {document.title}",
            message=f"El documento ha sido completamente firmado por todos los firmantes",
            category='signature_completed',
            priority='high',
            link_type='document',
            link_id=document.id,
        )
        
        logger.info(f"Sent signature completion notifications for document {document.id}")
        
    except Exception as e:
        logger.error(f"Failed to send signature completion notifications for document {document.id}: {e}")


def notify_signature_rejected(document, rejecting_user, comment=None):
    """Send notifications when a signer rejects a document.
    
    Args:
        document: DynamicDocument instance (now rejected)
        rejecting_user: User instance who rejected
        comment: Optional rejection comment
    """
    try:
        # Notify the document creator
        creator = document.created_by
        if not creator or not getattr(creator, 'email', None):
            return
        
        rejecter_name = rejecting_user.get_full_name() or rejecting_user.email
        
        # Email notification
        message = f"El usuario {rejecter_name} ha rechazado el documento '{document.title}'."
        if comment:
            message += f"\n\nMotivo del rechazo:\n{comment}"
        
        context = {
            'title': f"Documento Rechazado: {document.title}",
            'badge_text': 'Firma Rechazada',
            'notification_title': f"El documento '{document.title}' ha sido rechazado",
            'message': message,
            'additional_info': f"Rechazado por: {rejecter_name}",
            'action_url': _build_document_url(document.id),
            'action_text': 'Ver Documento',
        }
        
        send_template_email(
            template_name='notification',
            subject=f"[Firmas] Documento rechazado: {document.title}",
            to_emails=[creator.email],
            context=context,
        )
        
        # In-app notification
        create_notification(
            user=creator,
            title=f"Documento rechazado: {document.title}",
            message=f"{rejecter_name} ha rechazado el documento" + (f" con el motivo: {comment}" if comment else ""),
            category='signature_rejected',
            priority='high',
            link_type='document',
            link_id=document.id,
        )
        
        logger.info(f"Sent signature rejection notifications for document {document.id}")
        
    except Exception as e:
        logger.error(f"Failed to send signature rejection notifications for document {document.id}: {e}")


def notify_signature_expired(document):
    """Send notifications when a document expires due date.
    
    Args:
        document: DynamicDocument instance (now expired)
    """
    try:
        # Notify the document creator
        creator = document.created_by
        if not creator or not getattr(creator, 'email', None):
            return
        
        # Email notification
        context = {
            'title': f"Documento Vencido: {document.title}",
            'badge_text': 'Firma Vencida',
            'notification_title': f"El documento '{document.title}' ha vencido",
            'message': f"El documento '{document.title}' tenía una fecha límite de firma "
                      f"establecida para {document.signature_due_date} y ha expirado sin ser firmado completamente.\n\n"
                      f"Ahora puedes revisarlo, editarlo o eliminarlo desde tu bandeja.",
            'additional_info': f"Fecha límite: {document.signature_due_date}",
            'action_url': _build_document_url(document.id),
            'action_text': 'Ver Documento',
        }
        
        send_template_email(
            template_name='notification',
            subject=f"[Firmas] Documento vencido: {document.title}",
            to_emails=[creator.email],
            context=context,
        )
        
        # In-app notification
        create_notification(
            user=creator,
            title=f"Documento vencido: {document.title}",
            message=f"El documento ha vencido sin recibir todas las firmas requeridas",
            category='signature_expired',
            priority='high',
            link_type='document',
            link_id=document.id,
        )
        
        logger.info(f"Sent signature expiration notifications for document {document.id}")
        
    except Exception as e:
        logger.error(f"Failed to send signature expiration notifications for document {document.id}: {e}")


def notify_signature_reopened(document):
    """Send notifications when signatures are reopened after rejection/expiry.
    
    Args:
        document: DynamicDocument instance (signatures reopened)
    """
    try:
        # Per spec: signature_reopened is in-app only — no email is sent.
        all_signers = [sig.signer for sig in document.signatures.all()]

        if not all_signers:
            return

        create_bulk_notifications(
            users=all_signers,
            title=f"Firmas reabiertas: {document.title}",
            message=f"Las firmas para este documento han sido reabiertas y están pendientes de tu firma",
            category='signature_reopened',
            priority='high',
            link_type='document',
            link_id=document.id,
        )

        logger.info(f"Sent signature reopening notifications for document {document.id}")

    except Exception as e:
        logger.error(f"Failed to send signature reopening notifications for document {document.id}: {e}")


def notify_daily_pending_reminders():
    """Send daily email reminders to users with pending signatures.
    
    This is called by the daily Huey task.
    """
    try:
        # Per spec: exclude documents created in the last 24h to avoid premature reminders.
        cutoff = timezone.now() - timedelta(hours=24)

        user_ids = list(
            DocumentSignature.objects.filter(
                signed=False,
                rejected=False,
                document__state='PendingSignatures',
                document__requires_signature=True,
                document__created_at__lte=cutoff,
            )
            .values_list('signer_id', flat=True)
            .distinct()
        )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        users_with_pending = User.objects.filter(id__in=user_ids).exclude(email__isnull=True).exclude(email='').exclude(is_archived=True)

        for user in users_with_pending:
            pending_signatures = (
                DocumentSignature.objects.filter(
                    signer=user,
                    signed=False,
                    rejected=False,
                    document__state='PendingSignatures',
                    document__requires_signature=True,
                    document__created_at__lte=cutoff,
                )
                .select_related('document', 'document__created_by')
                .order_by('document__created_at')
            )
            
            if not pending_signatures.exists():
                continue
            
            # Build document list
            document_list = []
            for sig in pending_signatures:
                doc = sig.document
                doc_info = {
                    'title': doc.title,
                    'created_by': doc.created_by.get_full_name() or doc.created_by.email,
                    'created_at': doc.created_at.strftime('%d/%m/%Y'),
                    'days_pending': (timezone.now().date() - doc.created_at.date()).days,
                    'has_due_date': doc.signature_due_date is not None,
                    'due_date': doc.signature_due_date.strftime('%d/%m/%Y') if doc.signature_due_date else None,
                    'is_overdue': doc.signature_due_date and doc.signature_due_date < timezone.now().date(),
                }
                document_list.append(doc_info)
            
            # Email notification
            context = {
                'title': "Recordatorio de Firmas Pendientes",
                'badge_text': 'Recordatorio Diario',
                'notification_title': f"Tienes {pending_signatures.count()} documento(s) pendiente(s) de firma",
                'message': f"Tienes {pending_signatures.count()} documento(s) que requieren tu firma. "
                          f"Por favor accede a la plataforma para firmarlos lo antes posible.",
                'additional_info': "\n".join([
                    f"• {doc['title']} (creado por {doc['created_by']}, hace {doc['days_pending']} días)"
                    + (f" - Vence: {doc['due_date']}" if doc['has_due_date'] else "")
                    + (" ⚠️ VENCIDO" if doc['is_overdue'] else "")
                    for doc in document_list
                ]),
                'action_url': f"{getattr(settings, 'FRONTEND_URL', 'https://gmconsultoresjuridicos.com')}/dynamic_document_dashboard",
                'action_text': 'Ver Documentos Pendientes',
            }
            
            send_template_email(
                template_name='notification',
                subject="[Firmas] Recordatorio diario de documentos pendientes de firma",
                to_emails=[user.email],
                context=context,
            )
            
            # In-app notification (only one per user per day)
            create_notification(
                user=user,
                title=f"Recordatorio de firmas pendientes",
                message=f"Tienes {pending_signatures.count()} documento(s) pendiente(s) de firma",
                category='signature_reminder',
                priority='medium',
                link_type='document',  # Generic link to documents page
                link_id=None,  # No specific document ID
            )
        
        logger.info(f"Sent daily signature reminders to {users_with_pending.count()} users")
        
    except Exception as e:
        logger.error(f"Failed to send daily signature reminders: {e}")
