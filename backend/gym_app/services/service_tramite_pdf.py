import io

from django.core.files.base import ContentFile
from django.template.loader import render_to_string
from xhtml2pdf import pisa


class ServiceRequestPDFError(Exception):
    """Raised when PDF generation fails for service requests."""



def _normalize_answer_value(answer):
    if answer.field_type == "select_multiple" and isinstance(answer.value_json, list):
        return ", ".join(str(item) for item in answer.value_json)

    if answer.field_type in {"select_single", "file"} and answer.value_json is not None:
        if isinstance(answer.value_json, list):
            return ", ".join(str(item) for item in answer.value_json)
        return str(answer.value_json)

    if answer.value_text is None:
        return ""
    return str(answer.value_text)



def generate_service_request_pdf(service_request):
    """Render and persist PDF summary for a submitted service request."""
    answers = service_request.answers.all().order_by("stage_order", "id")
    files_by_field_key = {}
    for field_file in service_request.field_files.select_related("field").all():
        field_key = getattr(field_file.field, "key", None)
        if not field_key:
            continue
        files_by_field_key.setdefault(field_key, []).append(
            field_file.original_name or field_file.file.name.split("/")[-1]
        )

    stage_map = {}
    for answer in answers:
        stage = stage_map.setdefault(
            answer.stage_order,
            {
                "title": answer.stage_title,
                "order": answer.stage_order,
                "items": [],
            },
        )
        value = _normalize_answer_value(answer)
        if answer.field_type == "file":
            files = files_by_field_key.get(answer.field_key, [])
            value = ", ".join(files)

        stage["items"].append(
            {
                "label": answer.field_label,
                "value": value,
            }
        )

    context = {
        "request_obj": service_request,
        "service": service_request.service,
        "requester": service_request.requester,
        "stages": [stage_map[key] for key in sorted(stage_map.keys())],
        "legal_note": service_request.legal_note,
    }

    html = render_to_string("service_request_pdf.html", context)
    buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(html.encode("utf-8"), dest=buffer)

    if pisa_status.err:
        raise ServiceRequestPDFError("No se pudo generar el PDF del tramite")

    buffer.seek(0)
    filename = f"solicitud_{service_request.tracking_number or service_request.id}.pdf"
    service_request.generated_document.save(
        filename,
        ContentFile(buffer.getvalue()),
        save=False,
    )

    return service_request.generated_document
