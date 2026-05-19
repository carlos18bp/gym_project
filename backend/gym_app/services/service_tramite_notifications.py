import logging
import os
from django.db.models import Q

from gym_app.models import User
from gym_app.views.layouts.sendEmail import send_template_email

# NOTE: In-app notifications for the Services & Solicitudes module are out of
# scope for the June/July 2026 deliverable. Email notifications stay as before;
# the Notification Center only surfaces Procesos and Archivos Jurídicos events.
# To re-enable in-app service notifications later, restore the
# create_notification / create_bulk_notifications imports and call sites.


logger = logging.getLogger(__name__)


def _build_answers_summary(service_request, max_items=12):
    answer_lines = []
    for answer in service_request.answers.all().order_by("stage_order", "id")[:max_items]:
        if answer.value_text:
            value = answer.value_text
        elif answer.value_json is not None:
            if isinstance(answer.value_json, list):
                value = ", ".join(str(item) for item in answer.value_json)
            else:
                value = str(answer.value_json)
        else:
            value = "-"

        value = str(value).strip() or "-"
        if len(value) > 120:
            value = f"{value[:117]}..."

        answer_lines.append(f"- {answer.field_label}: {value}")

    if service_request.answers.count() > max_items:
        answer_lines.append("- ...")

    return "\n".join(answer_lines) if answer_lines else "Sin respuestas registradas"



def _get_manager_emails():
    queryset = User.objects.filter(
        Q(role="lawyer") | Q(role="admin") | Q(is_staff=True) | Q(is_superuser=True),
        is_active=True,
    ).exclude(email__isnull=True).exclude(email="")
    return sorted(set(queryset.values_list("email", flat=True)))


def _get_manager_users():
    """Return User instances for lawyers/admins (for in-app notifications)."""
    return list(
        User.objects.filter(
            Q(role="lawyer") | Q(role="admin") | Q(is_staff=True) | Q(is_superuser=True),
            is_active=True,
        ).exclude(email__isnull=True).exclude(email="")
    )



def notify_service_request_submission(service_request):
    """Send confirmation email to requester and alert to lawyers/admins."""
    summary = _build_answers_summary(service_request)
    requester_name = (
        f"{service_request.requester.first_name or ''} {service_request.requester.last_name or ''}".strip()
        or service_request.requester.email
    )

    base_context = {
        "title": "Nueva solicitud de servicio radicada",
        "badge_text": "Servicios",
        "notification_title": f"Solicitud {service_request.tracking_number}",
        "message": (
            f"Servicio: {service_request.service.name}\n"
            f"Solicitante: {requester_name}\n"
            f"Estado inicial: {service_request.get_status_display()}"
        ),
        "additional_info": summary,
    }

    requester_attachments = []
    if service_request.generated_document and getattr(service_request.generated_document, "path", None):
        requester_attachments = [service_request.generated_document.path]

    try:
        send_template_email(
            template_name="notification",
            subject=f"Confirmacion de envio - {service_request.tracking_number}",
            to_emails=[service_request.requester.email],
            context=base_context,
            attachments=requester_attachments,
        )
    except Exception:
        logger.error(
            "Error sending requester confirmation for service request %s",
            service_request.id,
            exc_info=True,
        )

    # In-app notification for the requester intentionally omitted — see module
    # docstring for rationale.

    manager_emails = _get_manager_emails()
    if manager_emails:
        try:
            send_template_email(
                template_name="notification",
                subject=f"Nueva solicitud recibida - {service_request.tracking_number}",
                to_emails=manager_emails,
                context=base_context,
            )
        except Exception:
            logger.error(
                "Error notifying managers for service request %s",
                service_request.id,
                exc_info=True,
            )

    # In-app notifications for lawyers/admins intentionally omitted — see
    # module docstring for rationale.



def notify_service_request_status_change(service_request, message=""):
    """Notify requester that the service request status changed or got a response."""
    status_label = service_request.get_status_display()
    context = {
        "title": "Actualizacion de solicitud de servicio",
        "badge_text": "Servicios",
        "notification_title": f"Solicitud {service_request.tracking_number}",
        "message": f"El estado de tu solicitud ahora es: <strong style='font-weight: 700; text-transform: uppercase; color: #1f2937;'>{status_label}</strong>",
        "additional_info": message or "Tu abogado actualizo el tramite.",
    }

    # Recopilar archivos de la respuesta más reciente del abogado (si existe)
    attachments = []
    latest_response = (
        service_request.lawyer_responses
        .prefetch_related("files")
        .order_by("-created_at")
        .first()
    )
    if latest_response and latest_response.files.exists():
        for response_file in latest_response.files.all():
            if response_file.file and hasattr(response_file.file, "path"):
                if os.path.isfile(response_file.file.path):
                    attachments.append(response_file.file.path)

    try:
        send_template_email(
            template_name="notification",
            subject=f"Actualizacion de tramite - {service_request.tracking_number}",
            to_emails=[service_request.requester.email],
            context=context,
            attachments=attachments,
        )
    except Exception:
        logger.error(
            "Error notifying requester status change for service request %s",
            service_request.id,
            exc_info=True,
        )

    # In-app notification for the requester intentionally omitted — see
    # module docstring for rationale.
