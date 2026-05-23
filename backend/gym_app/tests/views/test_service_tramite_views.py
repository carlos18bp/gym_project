"""Tests for service tramite views."""

import json
import re
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from freezegun import freeze_time

from gym_app.models import (
    Service,
    ServiceField,
    ServiceRequest,
    ServiceRequestAnswer,
    ServiceRequestFieldFile,
    ServiceRequestLawyerResponse,
    ServiceRequestLawyerResponseFile,
    ServiceStage,
)

User = get_user_model()


@pytest.fixture
def admin_user():
    """Create an admin/staff user for service views tests."""
    return User.objects.create_user(
        email="admin_services@test.com",
        password="testpassword",
        first_name="Admin",
        last_name="Services",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def second_client_user():
    """Create a second client user for service views tests."""
    return User.objects.create_user(
        email="client2_services@test.com",
        password="testpassword",
        first_name="Client2",
        last_name="Services",
        role="client",
    )


@pytest.fixture
def sample_service():
    """Create a sample Service with stages and fields for views tests."""
    service = Service.objects.create(
        name="Registro Marcario",
        short_title="Registro",
        slug="registro-marcario-test",
        description="Servicio de prueba",
        is_active=True,
        is_featured=True,
        featured_order=1,
    )
    stage = ServiceStage.objects.create(
        service=service,
        title="Datos",
        order=1,
        is_active=True,
    )
    ServiceField.objects.create(
        stage=stage,
        key="nombre",
        label="Nombre",
        field_type="input",
        is_required=True,
        order=1,
    )
    ServiceField.objects.create(
        stage=stage,
        key="soporte",
        label="Soporte",
        field_type="file",
        is_required=True,
        order=2,
        allowed_extensions=[".pdf"],
        allow_multiple_files=False,
        max_files=1,
    )
    return service


@pytest.fixture
def multi_stage_service():
    """Service with multiple stages covering all field types."""
    service = Service.objects.create(
        name="Servicio Completo",
        short_title="Completo",
        slug="servicio-completo-test",
        description="Service with all field types",
        is_active=True,
        is_featured=False,
    )
    stage1 = ServiceStage.objects.create(service=service, title="Datos Basicos", order=1, is_active=True)
    ServiceField.objects.create(stage=stage1, key="email_contacto", label="Email", field_type="email", is_required=True, order=1)
    ServiceField.objects.create(stage=stage1, key="edad", label="Edad", field_type="number", is_required=True, order=2)
    ServiceField.objects.create(stage=stage1, key="fecha_nacimiento", label="Fecha", field_type="date", is_required=False, order=3)

    stage2 = ServiceStage.objects.create(service=service, title="Detalles", order=2, is_active=True)
    ServiceField.objects.create(stage=stage2, key="tipo_marca", label="Tipo", field_type="select_single", is_required=True, order=1, options=["Nominativa", "Figurativa", "Mixta"])
    ServiceField.objects.create(stage=stage2, key="categorias", label="Categorias", field_type="select_multiple", is_required=False, order=2, options=["Alimentos", "Tecnologia", "Moda"])
    ServiceField.objects.create(stage=stage2, key="observaciones", label="Observaciones", field_type="text_area", is_required=False, order=3)

    stage3 = ServiceStage.objects.create(service=service, title="Documentos", order=3, is_active=True)
    ServiceField.objects.create(stage=stage3, key="logo", label="Logo", field_type="file", is_required=False, order=1, allowed_extensions=[".jpg", ".png"], allow_multiple_files=False, max_files=1)
    return service


@pytest.fixture
def submitted_request(sample_service, client_user):
    """Pre-submitted request with tracking number."""
    req = ServiceRequest.objects.create(
        service=sample_service,
        requester=client_user,
        status="OPEN",
        is_submitted=True,
    )
    req.assign_tracking_number()
    req.save()
    return req


@pytest.fixture
def draft_request(sample_service, client_user):
    """Unsaved draft request."""
    return ServiceRequest.objects.create(
        service=sample_service,
        requester=client_user,
        status="DRAFT",
        is_submitted=False,
    )


@pytest.fixture
def request_with_answers(submitted_request, sample_service):
    """Return a submitted request pre-populated with answers."""
    stage = sample_service.stages.first()
    field = stage.fields.first()
    ServiceRequestAnswer.objects.create(
        service_request=submitted_request,
        field=field,
        field_key=field.key,
        field_label=field.label,
        field_type=field.field_type,
        stage_title=stage.title,
        stage_order=stage.order,
        value_text="Valor de Prueba",
    )
    return submitted_request


def _mock_pdf_and_notify(monkeypatch):
    """Monkeypatch PDF generation and notifications for submit tests."""
    def mock_pdf(service_request):
        service_request.generated_document.save(
            f"{service_request.id}.pdf",
            ContentFile(b"%PDF-1.4 mock"),
            save=False,
        )
        return service_request.generated_document

    monkeypatch.setattr("gym_app.views.service_tramite.generate_service_request_pdf", mock_pdf)
    monkeypatch.setattr("gym_app.views.service_tramite.notify_service_request_submission", lambda *_: None)
    monkeypatch.setattr("gym_app.views.service_tramite.notify_service_request_status_change", lambda *_, **__: None)


@pytest.mark.django_db
def test_admin_can_create_service_with_nested_stages(api_client, admin_user):
    """Admin creates a service with stages and fields via the admin endpoint."""
    api_client.force_authenticate(user=admin_user)

    payload = {
        "name": "Nuevo Servicio",
        "short_title": "Nuevo",
        "slug": "nuevo-servicio",
        "description": "Descripcion",
        "is_active": True,
        "is_featured": False,
        "featured_order": 0,
        "stages": [
            {
                "title": "Etapa 1",
                "description": "Datos base",
                "order": 1,
                "is_active": True,
                "fields": [
                    {
                        "key": "campo_1",
                        "label": "Campo 1",
                        "field_type": "input",
                        "is_required": True,
                        "order": 1,
                    }
                ],
            }
        ],
    }

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 201
    assert response.data["name"] == "Nuevo Servicio"
    assert len(response.data["stages"]) == 1
    assert len(response.data["stages"][0]["fields"]) == 1


@pytest.mark.django_db
def test_admin_create_service_auto_generates_slug_when_omitted(api_client, admin_user):
    """Slug is optional in the API; the model's save() auto-derives it from short_title."""
    api_client.force_authenticate(user=admin_user)

    payload = {
        "name": "Servicio Sin Slug",
        "short_title": "SinSlug",
        "stages": [],
    }

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 201
    assert response.data["slug"] == "sinslug"


@pytest.mark.django_db
def test_admin_create_service_returns_400_with_field_errors_on_invalid_payload(api_client, admin_user):
    """Missing required field surfaces a 400 with the field name in the body."""
    api_client.force_authenticate(user=admin_user)

    payload = {
        "short_title": "Sin nombre",
        "stages": [],
    }

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 400
    assert "name" in response.data


@pytest.mark.django_db
def test_admin_create_service_returns_400_when_select_field_missing_options(api_client, admin_user):
    """select_single field without options must yield a 400, never a silent 500."""
    api_client.force_authenticate(user=admin_user)

    payload = {
        "name": "Servicio Select",
        "short_title": "Select",
        "stages": [
            {
                "title": "Etapa",
                "order": 1,
                "is_active": True,
                "fields": [
                    {
                        "key": "tipo",
                        "label": "Tipo",
                        "field_type": "select_single",
                        "is_required": True,
                        "order": 1,
                        # options intentionally omitted
                    }
                ],
            }
        ],
    }

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 400
    assert "errors" in response.data or "detail" in response.data


@pytest.mark.django_db
def test_admin_create_service_returns_400_with_friendly_message_on_duplicate_field_order(api_client, admin_user):
    """Two fields with the same ``order`` in a stage must surface a friendly
    400 that names the conflicting field labels (R3 — error 500 antes opaco).
    """
    api_client.force_authenticate(user=admin_user)

    payload = {
        "name": "Servicio Duplicado",
        "short_title": "Dup",
        "stages": [
            {
                "title": "Etapa Única",
                "order": 1,
                "is_active": True,
                "fields": [
                    {
                        "key": "campo_a",
                        "label": "Campo A",
                        "field_type": "input",
                        "is_required": True,
                        "order": 1,
                    },
                    {
                        "key": "campo_b",
                        "label": "Campo B",
                        "field_type": "input",
                        "is_required": True,
                        "order": 1,
                    },
                ],
            }
        ],
    }

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 400
    body = json.dumps(response.data)
    assert "Campo A" in body
    assert "Campo B" in body
    assert "orden" in body.lower()


@pytest.mark.django_db
def test_admin_create_service_returns_400_on_malformed_json_payload(api_client, admin_user):
    """Malformed JSON in the payload field returns a 400 with `payload` key."""
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": "not-json"},
        format="multipart",
    )

    assert response.status_code == 400
    assert "payload" in response.data


@pytest.mark.django_db
def test_client_can_list_active_services_only(api_client, client_user, sample_service):
    """Client listing only returns active services."""
    Service.objects.create(
        name="Servicio Inactivo",
        short_title="Inactivo",
        slug="servicio-inactivo",
        is_active=False,
    )
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("services-list"))

    assert response.status_code == 200
    slugs = {service["slug"] for service in response.data["services"]}
    assert sample_service.slug in slugs
    assert "servicio-inactivo" not in slugs


@pytest.mark.django_db
def test_client_can_submit_service_request_and_receive_tracking_number(
    api_client, client_user, sample_service, monkeypatch
):
    """Submitting a complete request assigns a tracking number and generates a PDF."""
    api_client.force_authenticate(user=client_user)
    fields = {field.key: field for field in sample_service.stages.first().fields.all()}

    def mock_generate_pdf(service_request):
        service_request.generated_document.save(
            f"{service_request.id}.pdf",
            ContentFile(b"%PDF-1.4 mock"),
            save=False,
        )
        return service_request.generated_document

    monkeypatch.setattr("gym_app.views.service_tramite.generate_service_request_pdf", mock_generate_pdf)
    monkeypatch.setattr("gym_app.views.service_tramite.notify_service_request_submission", lambda *_: None)

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps(
                {
                    "service_id": sample_service.id,
                    "answers": [
                        {
                            "field_id": fields["nombre"].id,
                            "value_text": "Cliente Prueba",
                        }
                    ],
                    "current_stage": 1,
                    "is_submit": True,
                }
            ),
            f"field_files_{fields['soporte'].id}": SimpleUploadedFile(
                "soporte.pdf", b"%PDF-1.4 test", content_type="application/pdf"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["is_submitted"] is True
    assert response.data["tracking_number"]
    assert re.match(r"^\d{4}-\d{5}$", response.data["tracking_number"])
    assert response.data["status"] == "OPEN"

    request_obj = ServiceRequest.objects.get(id=response.data["id"])
    assert request_obj.generated_document.name.endswith(".pdf")


@pytest.mark.django_db
def test_lawyer_can_manage_submitted_request(api_client, client_user, lawyer_user, sample_service):
    """Lawyer can change status and add a message via the manage endpoint."""
    request_obj = ServiceRequest.objects.create(
        service=sample_service,
        requester=client_user,
        status="OPEN",
        is_submitted=True,
    )
    request_obj.assign_tracking_number()
    request_obj.save()

    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": request_obj.id}),
        {
            "status": "IN_STUDY",
            "message": "Solicitud en revision",
        },
        format="multipart",
    )

    assert response.status_code == 200
    request_obj.refresh_from_db()
    assert request_obj.status == "IN_STUDY"
    assert request_obj.lawyer_responses.count() == 1


@pytest.mark.django_db
def test_client_cannot_access_lawyer_inbox(api_client, client_user):
    """Client role receives 403 on the lawyer inbox endpoint."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-inbox-list"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_manage_request_rejects_oversized_file_without_creating_response(
    api_client, client_user, lawyer_user, sample_service
):
    """Oversized response file attachment is rejected before any response is created."""
    request_obj = ServiceRequest.objects.create(
        service=sample_service,
        requester=client_user,
        status="OPEN",
        is_submitted=True,
    )
    request_obj.assign_tracking_number()
    request_obj.save()

    api_client.force_authenticate(user=lawyer_user)
    oversized = SimpleUploadedFile(
        "respuesta.pdf",
        b"x",
        content_type="application/pdf",
    )

    with patch("gym_app.views.service_tramite.MAX_UPLOAD_SIZE", 0):
        response = api_client.post(
            reverse("service-request-manage", kwargs={"request_id": request_obj.id}),
            {
                "status": "IN_STUDY",
                "message": "Revisando soporte",
                "response_file": oversized,
            },
            format="multipart",
        )

    assert response.status_code == 400
    request_obj.refresh_from_db()
    assert request_obj.status == "OPEN"
    assert request_obj.lawyer_responses.count() == 0


# ─── A. Service CRUD — Admin ────────────────────────────────────────────────


@pytest.mark.django_db
def test_non_admin_cannot_create_service(api_client, client_user):
    """Non-admin users receive 403 when attempting to create a service."""
    api_client.force_authenticate(user=client_user)

    payload = {
        "name": "Servicio Prohibido",
        "short_title": "Prohibido",
        "slug": "servicio-prohibido",
        "description": "No deberia crearse",
        "is_active": True,
        "stages": [],
    }

    response = api_client.post(
        reverse("services-admin-create"),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_update_service_with_upsert_stages(api_client, admin_user, sample_service):
    """Admin update upserts stages and fields on an existing service."""
    api_client.force_authenticate(user=admin_user)

    stage = sample_service.stages.first()
    field = stage.fields.first()

    payload = {
        "name": "Servicio Actualizado",
        "short_title": "Actualizado",
        "slug": sample_service.slug,
        "description": "Descripcion actualizada",
        "is_active": True,
        "is_featured": True,
        "featured_order": 1,
        "stages": [
            {
                "id": stage.id,
                "title": "Etapa Renombrada",
                "order": 1,
                "is_active": True,
                "fields": [
                    {
                        "id": field.id,
                        "key": field.key,
                        "label": "Nombre Actualizado",
                        "field_type": "input",
                        "is_required": True,
                        "order": 1,
                    }
                ],
            }
        ],
    }

    response = api_client.put(
        reverse("services-admin-update", kwargs={"service_id": sample_service.id}),
        {"payload": json.dumps(payload)},
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["name"] == "Servicio Actualizado"
    assert response.data["stages"][0]["title"] == "Etapa Renombrada"
    assert len(response.data["stages"][0]["fields"]) == 1


@pytest.mark.django_db
def test_admin_can_toggle_service_active(api_client, admin_user, sample_service):
    """Admin toggles the is_active flag on an existing service."""
    api_client.force_authenticate(user=admin_user)
    assert sample_service.is_active is True

    response = api_client.post(
        reverse("services-admin-toggle-active", kwargs={"service_id": sample_service.id}),
    )

    assert response.status_code == 200
    assert response.data["is_active"] is False


@pytest.mark.django_db
def test_admin_can_toggle_service_featured(api_client, admin_user, sample_service):
    """Admin toggles the is_featured flag on an existing service."""
    api_client.force_authenticate(user=admin_user)
    assert sample_service.is_featured is True

    response = api_client.post(
        reverse("services-admin-toggle-featured", kwargs={"service_id": sample_service.id}),
    )

    assert response.status_code == 200
    assert response.data["is_featured"] is False


@pytest.mark.django_db
def test_admin_list_shows_inactive_services(api_client, admin_user):
    """Admin list endpoint includes inactive services."""
    Service.objects.create(name="Activo", short_title="Act", slug="activo-adm", is_active=True)
    Service.objects.create(name="Inactivo", short_title="Ina", slug="inactivo-adm", is_active=False)

    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse("services-admin-list"))

    assert response.status_code == 200
    slugs = {s["slug"] for s in response.data["services"]}
    assert "activo-adm" in slugs
    assert "inactivo-adm" in slugs


# ─── B. Service Listing — Public ────────────────────────────────────────────


@pytest.mark.django_db
def test_featured_services_returns_max_six(api_client, client_user):
    """Featured services endpoint returns at most six results."""
    for i in range(8):
        Service.objects.create(
            name=f"Featured {i}",
            short_title=f"Feat{i}",
            slug=f"featured-{i}",
            is_active=True,
            is_featured=True,
            featured_order=i,
        )

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("services-featured"))

    assert response.status_code == 200
    assert len(response.data["services"]) <= 6


@pytest.mark.django_db
def test_featured_services_fills_fallback_when_fewer_than_four_featured(api_client, client_user):
    """Featured endpoint uses non-featured fallback when fewer than four featured services exist."""
    Service.objects.create(name="Featured Only", short_title="FO", slug="featured-only", is_active=True, is_featured=True, featured_order=1)
    Service.objects.create(name="Non Featured", short_title="NF", slug="non-featured", is_active=True, is_featured=False)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("services-featured"))

    assert response.status_code == 200
    slugs = {s["slug"] for s in response.data["services"]}
    assert "featured-only" in slugs
    assert "non-featured" in slugs


@pytest.mark.django_db
def test_service_detail_returns_stages_and_fields(api_client, client_user, multi_stage_service):
    """Service detail response includes nested stages with their fields."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("services-detail", kwargs={"service_id": multi_stage_service.id}),
    )

    assert response.status_code == 200
    service_data = response.data["service"]
    assert len(service_data["stages"]) == 3
    assert service_data["stages"][0]["title"] == "Datos Basicos"
    assert len(service_data["stages"][0]["fields"]) == 3


@pytest.mark.django_db
def test_inactive_service_returns_404_for_non_manager(api_client, client_user, lawyer_user):
    """Inactive service returns 404 for clients and non-manager users."""
    service = Service.objects.create(
        name="Inactivo",
        short_title="Ina",
        slug="inactivo-detail",
        is_active=False,
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("services-detail", kwargs={"service_id": service.id}))
    assert response.status_code == 404

    api_client.force_authenticate(user=lawyer_user)
    response = api_client.get(reverse("services-detail", kwargs={"service_id": service.id}))
    assert response.status_code == 200


# ─── C. Service Request — Save/Submit ────────────────────────────────────────


@pytest.mark.django_db
def test_client_can_save_draft_without_required_fields(api_client, client_user, sample_service):
    """Client can persist a draft with required fields missing."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": sample_service.id,
                "answers": [],
                "current_stage": 1,
                "is_submit": False,
            }),
        },
        format="multipart",
    )

    assert response.status_code == 200
    assert response.data["status"] == "DRAFT"
    assert response.data["tracking_number"] is None
    assert response.data["is_submitted"] is False


@pytest.mark.django_db
def test_draft_loaded_when_existing_for_service(api_client, client_user, draft_request):
    """Existing draft data is returned when a draft already exists for the service."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("services-detail", kwargs={"service_id": draft_request.service_id}),
    )

    assert response.status_code == 200
    assert response.data["draft"] is not None
    assert response.data["draft"]["id"] == draft_request.id


@pytest.mark.django_db
def test_submit_rejects_missing_required_text_field(api_client, client_user, sample_service, monkeypatch):
    """Submit fails with 400 when a required text field is empty."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for f in sample_service.stages.first().fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": sample_service.id,
                "answers": [],
                "current_stage": 1,
                "is_submit": True,
            }),
            f"field_files_{fields['soporte'].id}": SimpleUploadedFile(
                "soporte.pdf", b"%PDF-1.4 test", content_type="application/pdf"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 400
    assert "nombre" in str(response.data["detail"])


@pytest.mark.django_db
def test_submit_rejects_missing_required_file_field(api_client, client_user, sample_service, monkeypatch):
    """Submit fails with 400 when a required file field has no upload."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for f in sample_service.stages.first().fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": sample_service.id,
                "answers": [
                    {"field_id": fields["nombre"].id, "value_text": "Test"},
                ],
                "current_stage": 1,
                "is_submit": True,
            }),
        },
        format="multipart",
    )

    assert response.status_code == 400
    assert "soporte" in str(response.data["detail"])


@pytest.mark.django_db
def test_submit_validates_email_field_format(api_client, client_user, multi_stage_service, monkeypatch):
    """Submit rejects an invalid email format on an email-type field."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    email_field = ServiceField.objects.get(stage__service=multi_stage_service, key="email_contacto")

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": email_field.id, "value_text": "not-an-email"},
                ],
                "current_stage": 1,
                "is_submit": True,
            }),
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_submit_validates_number_field_format(api_client, client_user, multi_stage_service, monkeypatch):
    """Submit rejects a non-numeric value on a number-type field."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    number_field = ServiceField.objects.get(stage__service=multi_stage_service, key="edad")

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": number_field.id, "value_text": "not-a-number"},
                ],
                "current_stage": 1,
                "is_submit": True,
            }),
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_submit_validates_select_options(api_client, client_user, multi_stage_service, monkeypatch):
    """Submit rejects a value not in the allowed options list."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    select_field = ServiceField.objects.get(stage__service=multi_stage_service, key="tipo_marca")

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": select_field.id, "value_text": "Opcion Invalida"},
                ],
                "current_stage": 1,
                "is_submit": True,
            }),
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_file_upload_rejects_disallowed_extension(api_client, client_user, sample_service, monkeypatch):
    """File uploads with disallowed extensions are rejected."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for f in sample_service.stages.first().fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": sample_service.id,
                "answers": [
                    {"field_id": fields["nombre"].id, "value_text": "Test"},
                ],
                "current_stage": 1,
                "is_submit": True,
            }),
            f"field_files_{fields['soporte'].id}": SimpleUploadedFile(
                "virus.exe", b"MZ fake binary", content_type="application/octet-stream"
            ),
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_single_file_field_rejects_multiple_uploads(api_client, client_user, sample_service, monkeypatch):
    """Single-file fields reject more than one uploaded file."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for f in sample_service.stages.first().fields.all()}
    file_field = fields["soporte"]

    file1 = SimpleUploadedFile("doc1.pdf", b"%PDF-1.4 one", content_type="application/pdf")
    file2 = SimpleUploadedFile("doc2.pdf", b"%PDF-1.4 two", content_type="application/pdf")

    from django.test.client import BOUNDARY, encode_multipart

    payload_str = json.dumps({
        "service_id": sample_service.id,
        "answers": [{"field_id": fields["nombre"].id, "value_text": "Test"}],
        "current_stage": 1,
        "is_submit": True,
    })

    data = encode_multipart(
        BOUNDARY,
        {
            "payload": payload_str,
            f"field_files_{file_field.id}": [file1, file2],
        },
    )

    response = api_client.post(
        reverse("service-request-save"),
        data,
        content_type=f"multipart/form-data; boundary={BOUNDARY}",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_already_submitted_request_cannot_be_resubmitted_by_client(
    api_client, client_user, submitted_request, monkeypatch
):
    """A submitted request cannot be resubmitted by the originating client."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": submitted_request.service_id,
                "request_id": submitted_request.id,
                "answers": [],
                "current_stage": 1,
                "is_submit": True,
            }),
        },
        format="multipart",
    )

    assert response.status_code == 400


# ─── D. Request Management — Lawyer ─────────────────────────────────────────


@pytest.mark.django_db
def test_invalid_status_transition_returns_400(api_client, lawyer_user, submitted_request):
    """An invalid status transition returns 400."""
    submitted_request.status = "FINALIZED"
    submitted_request.save(update_fields=["status"])

    api_client.force_authenticate(user=lawyer_user)

    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_request.id}),
        {"status": "IN_STUDY", "message": "Intentando reabrir"},
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_manage_without_message_file_or_status_change_returns_400(api_client, lawyer_user, submitted_request):
    """Manage endpoint returns 400 when no meaningful change is provided."""
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_request.id}),
        {"status": "OPEN", "message": ""},
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_lawyer_can_attach_response_file_with_status_change(api_client, lawyer_user, submitted_request):
    """Lawyer attaches a file with a status change via the manage endpoint."""
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_request.id}),
        {
            "status": "ANSWERED",
            "message": "Adjunto respuesta",
            "response_file": SimpleUploadedFile("resp.pdf", b"%PDF-1.4 resp", content_type="application/pdf"),
        },
        format="multipart",
    )

    assert response.status_code == 200
    submitted_request.refresh_from_db()
    assert submitted_request.status == "ANSWERED"
    lr = submitted_request.lawyer_responses.first()
    assert lr.files.count() == 1


@pytest.mark.django_db
def test_admin_can_manage_request(api_client, admin_user, submitted_request):
    """Admin can manage any service request."""
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_request.id}),
        {"status": "IN_STUDY", "message": "Admin revisando"},
        format="multipart",
    )

    assert response.status_code == 200
    submitted_request.refresh_from_db()
    assert submitted_request.status == "IN_STUDY"


@pytest.mark.django_db
def test_client_cannot_manage_request(api_client, client_user, submitted_request):
    """Client role cannot access the manage endpoint."""
    api_client.force_authenticate(user=client_user)

    response = api_client.post(
        reverse("service-request-manage", kwargs={"request_id": submitted_request.id}),
        {"status": "IN_STUDY", "message": "Intento"},
        format="multipart",
    )

    assert response.status_code == 403


# ─── E. Access Control ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_client_cannot_view_other_users_request(
    api_client, second_client_user, submitted_request
):
    """Client cannot retrieve another user's service request."""
    api_client.force_authenticate(user=second_client_user)

    response = api_client.get(
        reverse("service-request-detail", kwargs={"request_id": submitted_request.id}),
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_lawyer_can_view_any_request(api_client, lawyer_user, submitted_request):
    """Lawyer can retrieve any client's service request."""
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.get(
        reverse("service-request-detail", kwargs={"request_id": submitted_request.id}),
    )

    assert response.status_code == 200
    assert response.data["tracking_number"] == submitted_request.tracking_number


@pytest.mark.django_db
def test_request_detail_includes_answers_and_responses(
    api_client, client_user, request_with_answers
):
    """Request detail response includes nested answers and lawyer responses."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("service-request-detail", kwargs={"request_id": request_with_answers.id}),
    )

    assert response.status_code == 200
    assert len(response.data["answers"]) >= 1
    assert response.data["answers"][0]["field_key"] == "nombre"


# ─── F. My Requests Filtering ───────────────────────────────────────────────


@pytest.mark.django_db
def test_my_requests_filters_by_status(api_client, client_user, sample_service):
    """My-requests list can be filtered by status."""
    open_req = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="OPEN", is_submitted=True,
    )
    open_req.assign_tracking_number()
    open_req.save()

    study_req = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="IN_STUDY", is_submitted=True,
    )
    study_req.assign_tracking_number()
    study_req.save()

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("service-request-my-list"), {"status": "OPEN"})

    assert response.status_code == 200
    results = response.data.get("results", response.data.get("requests", []))
    statuses = {r["status"] for r in results}
    assert statuses == {"OPEN"}


@pytest.mark.django_db
def test_my_requests_filters_by_tracking_number(api_client, client_user, submitted_request):
    """My-requests list can be filtered by tracking number substring."""
    api_client.force_authenticate(user=client_user)

    partial = submitted_request.tracking_number[-3:]
    response = api_client.get(reverse("service-request-my-list"), {"tracking": partial})

    assert response.status_code == 200
    results = response.data.get("results", response.data.get("requests", []))
    assert len(results) >= 1
    assert submitted_request.tracking_number in {r["tracking_number"] for r in results}


@pytest.mark.django_db
def test_my_requests_excludes_other_users_requests(
    api_client, second_client_user, submitted_request
):
    """My-requests list only returns the authenticated user's own requests."""
    api_client.force_authenticate(user=second_client_user)

    response = api_client.get(reverse("service-request-my-list"))

    assert response.status_code == 200
    results = response.data.get("results", response.data.get("requests", []))
    request_ids = {r["id"] for r in results}
    assert submitted_request.id not in request_ids


# ─── G. get_latest_service_draft ────────────────────────────────────────────


@pytest.mark.django_db
def test_latest_draft_returns_draft_data_when_draft_exists(
    api_client, client_user, sample_service, draft_request
):
    """Latest-draft endpoint returns serialized draft when one exists."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 200
    assert response.data["draft"]["id"] == draft_request.id


@pytest.mark.django_db
def test_latest_draft_returns_null_when_no_draft_exists(api_client, client_user, sample_service):
    """Latest-draft endpoint returns null when no draft exists."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 200
    assert response.data["draft"] is None


@freeze_time("2026-01-15 12:00:00")
@pytest.mark.django_db
def test_latest_draft_returns_only_most_recent_draft(api_client, client_user, sample_service):
    """Latest-draft endpoint returns the most recently updated draft."""
    from datetime import timedelta

    from django.utils import timezone

    draft_old = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="DRAFT", is_submitted=False
    )
    draft_new = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="DRAFT", is_submitted=False
    )
    # Backdate the older draft so ordering by -updated_at is deterministic
    ServiceRequest.objects.filter(id=draft_old.id).update(
        updated_at=timezone.now() - timedelta(hours=1)
    )

    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 200
    assert response.data["draft"]["id"] == draft_new.id


@pytest.mark.django_db
def test_latest_draft_does_not_return_submitted_requests(
    api_client, client_user, sample_service, submitted_request
):
    """Latest-draft endpoint ignores submitted requests."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 200
    assert response.data["draft"] is None


@pytest.mark.django_db
def test_latest_draft_requires_authentication(api_client, sample_service):
    """Latest-draft endpoint requires authentication."""
    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 401


@pytest.mark.django_db
def test_latest_draft_returns_404_for_nonexistent_service(api_client, client_user):
    """Latest-draft returns 404 for a service that does not exist."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": 999999}))

    assert response.status_code == 404


@pytest.mark.django_db
def test_latest_draft_isolates_per_user(
    api_client, second_client_user, sample_service, draft_request
):
    """Latest-draft endpoint is scoped to the authenticated user."""
    # draft_request belongs to client_user — second_client_user should see no draft
    api_client.force_authenticate(user=second_client_user)

    response = api_client.get(reverse("service-request-draft", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 200
    assert response.data["draft"] is None


# ─── H. download_service_request_field_file ─────────────────────────────────


@pytest.fixture
def field_file_on_disk(submitted_request, sample_service, settings, tmp_path):
    """Create a ServiceRequestFieldFile backed by a real file on disk."""
    settings.MEDIA_ROOT = str(tmp_path)
    from django.core.files.base import ContentFile as CF
    ff = ServiceRequestFieldFile(service_request=submitted_request, field=None, original_name="doc.pdf")
    ff.file.save("doc.pdf", CF(b"dummy content"), save=False)
    ff.save()
    return ff


@pytest.fixture
def lawyer_response_file_on_disk(submitted_request, lawyer_user, settings, tmp_path):
    """Create a ServiceRequestLawyerResponseFile backed by a real file on disk."""
    settings.MEDIA_ROOT = str(tmp_path)
    from django.core.files.base import ContentFile as CF
    resp = ServiceRequestLawyerResponse.objects.create(
        service_request=submitted_request,
        responder=lawyer_user,
        message="Respuesta de prueba",
        status_before="OPEN",
        status_after="IN_STUDY",
    )
    resp_file = ServiceRequestLawyerResponseFile(response=resp, original_name="respuesta.pdf")
    resp_file.file.save("respuesta.pdf", CF(b"dummy response"), save=False)
    resp_file.save()
    return resp_file


@pytest.mark.django_db
@pytest.mark.integration
def test_owner_can_download_field_file(api_client, client_user, submitted_request, field_file_on_disk):
    """Request owner can download their own uploaded field file."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("service-request-field-file-download", kwargs={
            "request_id": submitted_request.id,
            "file_id": field_file_on_disk.id,
        })
    )

    assert response.status_code == 200
    assert "attachment" in response.get("Content-Disposition", "")


@pytest.mark.django_db
@pytest.mark.integration
def test_lawyer_can_download_field_file(api_client, lawyer_user, submitted_request, field_file_on_disk):
    """Lawyer can download any client's field file."""
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.get(
        reverse("service-request-field-file-download", kwargs={
            "request_id": submitted_request.id,
            "file_id": field_file_on_disk.id,
        })
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_other_client_cannot_download_field_file(
    api_client, second_client_user, submitted_request, field_file_on_disk
):
    """Another client cannot download a field file that belongs to a different user."""
    api_client.force_authenticate(user=second_client_user)

    response = api_client.get(
        reverse("service-request-field-file-download", kwargs={
            "request_id": submitted_request.id,
            "file_id": field_file_on_disk.id,
        })
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.edge
def test_download_field_file_returns_404_for_wrong_service_request(
    api_client, client_user, submitted_request, sample_service, field_file_on_disk
):
    """Download returns 404 when the file does not belong to the given service request."""
    # Create a second request belonging to client_user — file belongs to submitted_request, not this one
    second_req = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="OPEN", is_submitted=True
    )
    second_req.assign_tracking_number()
    second_req.save()

    api_client.force_authenticate(user=client_user)
    response = api_client.get(
        reverse("service-request-field-file-download", kwargs={
            "request_id": second_req.id,
            "file_id": field_file_on_disk.id,
        })
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.edge
def test_download_field_file_returns_404_when_file_missing_on_disk(
    api_client, client_user, submitted_request, field_file_on_disk
):
    """Download returns 404 when the physical file is missing from disk."""
    import os
    os.unlink(field_file_on_disk.file.path)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(
        reverse("service-request-field-file-download", kwargs={
            "request_id": submitted_request.id,
            "file_id": field_file_on_disk.id,
        })
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_unauthenticated_cannot_download_field_file(api_client, submitted_request, field_file_on_disk):
    """Unauthenticated requests to download a field file are rejected."""
    response = api_client.get(
        reverse("service-request-field-file-download", kwargs={
            "request_id": submitted_request.id,
            "file_id": field_file_on_disk.id,
        })
    )

    assert response.status_code == 401


# ─── I. download_service_request_response_file ──────────────────────────────


@pytest.mark.django_db
@pytest.mark.integration
def test_owner_can_download_response_file(
    api_client, client_user, submitted_request, lawyer_response_file_on_disk
):
    """Request owner can download a lawyer response file."""
    resp_file = lawyer_response_file_on_disk
    api_client.force_authenticate(user=client_user)

    response = api_client.get(
        reverse("service-request-response-file-download", kwargs={
            "request_id": submitted_request.id,
            "response_id": resp_file.response_id,
            "file_id": resp_file.id,
        })
    )

    assert response.status_code == 200
    assert "attachment" in response.get("Content-Disposition", "")


@pytest.mark.django_db
@pytest.mark.integration
def test_lawyer_can_download_response_file(
    api_client, lawyer_user, submitted_request, lawyer_response_file_on_disk
):
    """Lawyer can download their own response file."""
    resp_file = lawyer_response_file_on_disk
    api_client.force_authenticate(user=lawyer_user)

    response = api_client.get(
        reverse("service-request-response-file-download", kwargs={
            "request_id": submitted_request.id,
            "response_id": resp_file.response_id,
            "file_id": resp_file.id,
        })
    )

    assert response.status_code == 200


@pytest.mark.django_db
def test_other_client_cannot_download_response_file(
    api_client, second_client_user, submitted_request, lawyer_response_file_on_disk
):
    """Another client cannot download a response file belonging to a different user."""
    resp_file = lawyer_response_file_on_disk
    api_client.force_authenticate(user=second_client_user)

    response = api_client.get(
        reverse("service-request-response-file-download", kwargs={
            "request_id": submitted_request.id,
            "response_id": resp_file.response_id,
            "file_id": resp_file.id,
        })
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.edge
def test_download_response_file_wrong_response_id_returns_404(
    api_client, client_user, submitted_request, sample_service, lawyer_response_file_on_disk
):
    """Download returns 404 when the response ID does not match the service request."""
    # Create a second request and try to fetch the response file via its ID
    second_req = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="OPEN", is_submitted=True
    )
    second_req.assign_tracking_number()
    second_req.save()

    resp_file = lawyer_response_file_on_disk
    api_client.force_authenticate(user=client_user)
    response = api_client.get(
        reverse("service-request-response-file-download", kwargs={
            "request_id": second_req.id,
            "response_id": resp_file.response_id,
            "file_id": resp_file.id,
        })
    )

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.edge
def test_download_response_file_missing_on_disk_returns_404(
    api_client, client_user, submitted_request, lawyer_response_file_on_disk
):
    """Download returns 404 when the response file is missing from disk."""
    import os
    resp_file = lawyer_response_file_on_disk
    os.unlink(resp_file.file.path)

    api_client.force_authenticate(user=client_user)
    response = api_client.get(
        reverse("service-request-response-file-download", kwargs={
            "request_id": submitted_request.id,
            "response_id": resp_file.response_id,
            "file_id": resp_file.id,
        })
    )

    assert response.status_code == 404


# ─── J. Date filtering in list_my_service_requests ──────────────────────────


@freeze_time("2026-01-15 12:00:00")
@pytest.mark.django_db
@pytest.mark.integration
def test_date_from_filters_out_older_requests(
    api_client, client_user, sample_service, submitted_request
):
    """date_from filter excludes requests created before the given date."""
    from datetime import timedelta

    from django.utils import timezone

    old_req = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="OPEN", is_submitted=True
    )
    old_req.assign_tracking_number()
    old_req.save()
    ServiceRequest.objects.filter(id=old_req.id).update(
        created_at=timezone.now() - timedelta(days=10)
    )

    yesterday = (timezone.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("service-request-my-list"), {"date_from": yesterday})

    assert response.status_code == 200
    result_ids = {r["id"] for r in response.data["results"]}
    assert old_req.id not in result_ids
    assert submitted_request.id in result_ids


@freeze_time("2026-01-15 12:00:00")
@pytest.mark.django_db
@pytest.mark.integration
def test_date_to_filters_out_newer_requests(
    api_client, client_user, sample_service, submitted_request
):
    """date_to filter excludes requests created after the given date."""
    from datetime import timedelta

    from django.utils import timezone

    old_req = ServiceRequest.objects.create(
        service=sample_service, requester=client_user, status="OPEN", is_submitted=True
    )
    old_req.assign_tracking_number()
    old_req.save()
    ServiceRequest.objects.filter(id=old_req.id).update(
        created_at=timezone.now() - timedelta(days=10)
    )

    yesterday = (timezone.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    api_client.force_authenticate(user=client_user)
    response = api_client.get(reverse("service-request-my-list"), {"date_to": yesterday})

    assert response.status_code == 200
    result_ids = {r["id"] for r in response.data["results"]}
    assert submitted_request.id not in result_ids
    assert old_req.id in result_ids


@pytest.mark.django_db
@pytest.mark.edge
def test_invalid_date_format_is_silently_ignored(
    api_client, client_user, submitted_request
):
    """Invalid date format in filters is silently ignored."""
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-my-list"), {"date_from": "not-a-date"})

    assert response.status_code == 200
    result_ids = {r["id"] for r in response.data["results"]}
    assert submitted_request.id in result_ids


# ─── K. _validate_answer_value — date and select_multiple branches ───────────


@pytest.mark.django_db
@pytest.mark.edge
def test_submit_rejects_invalid_date_format(api_client, client_user, multi_stage_service, monkeypatch):
    """Submit rejects a value in the wrong format for a date-type field."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for stage in multi_stage_service.stages.all() for f in stage.fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": fields["email_contacto"].id, "value_text": "test@test.com"},
                    {"field_id": fields["edad"].id, "value_text": "25"},
                    {"field_id": fields["fecha_nacimiento"].id, "value_text": "32/13/2024"},
                    {"field_id": fields["tipo_marca"].id, "value_text": "Nominativa"},
                ],
                "current_stage": 1,
                "is_submit": True,
            })
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.edge
def test_submit_accepts_valid_date_format(api_client, client_user, multi_stage_service, monkeypatch):
    """Submit accepts a correctly formatted date value."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for stage in multi_stage_service.stages.all() for f in stage.fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": fields["email_contacto"].id, "value_text": "test@test.com"},
                    {"field_id": fields["edad"].id, "value_text": "25"},
                    {"field_id": fields["fecha_nacimiento"].id, "value_text": "2024-06-15"},
                    {"field_id": fields["tipo_marca"].id, "value_text": "Nominativa"},
                ],
                "current_stage": 1,
                "is_submit": True,
            })
        },
        format="multipart",
    )

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.edge
def test_submit_rejects_select_multiple_with_non_list_value_json(
    api_client, client_user, multi_stage_service, monkeypatch
):
    """Submit rejects a non-list value_json for a select_multiple field."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for stage in multi_stage_service.stages.all() for f in stage.fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": fields["email_contacto"].id, "value_text": "test@test.com"},
                    {"field_id": fields["edad"].id, "value_text": "25"},
                    {"field_id": fields["tipo_marca"].id, "value_text": "Nominativa"},
                    {"field_id": fields["categorias"].id, "value_json": "Alimentos"},
                ],
                "current_stage": 1,
                "is_submit": True,
            })
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.edge
def test_submit_rejects_select_multiple_with_invalid_option(
    api_client, client_user, multi_stage_service, monkeypatch
):
    """Submit rejects a value not in the allowed options for a select_multiple field."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for stage in multi_stage_service.stages.all() for f in stage.fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": fields["email_contacto"].id, "value_text": "test@test.com"},
                    {"field_id": fields["edad"].id, "value_text": "25"},
                    {"field_id": fields["tipo_marca"].id, "value_text": "Nominativa"},
                    {"field_id": fields["categorias"].id, "value_json": ["Invalido"]},
                ],
                "current_stage": 1,
                "is_submit": True,
            })
        },
        format="multipart",
    )

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.edge
def test_submit_accepts_valid_select_multiple_options(
    api_client, client_user, multi_stage_service, monkeypatch
):
    """Submit accepts valid options for a select_multiple field."""
    _mock_pdf_and_notify(monkeypatch)
    api_client.force_authenticate(user=client_user)
    fields = {f.key: f for stage in multi_stage_service.stages.all() for f in stage.fields.all()}

    response = api_client.post(
        reverse("service-request-save"),
        {
            "payload": json.dumps({
                "service_id": multi_stage_service.id,
                "answers": [
                    {"field_id": fields["email_contacto"].id, "value_text": "test@test.com"},
                    {"field_id": fields["edad"].id, "value_text": "25"},
                    {"field_id": fields["tipo_marca"].id, "value_text": "Nominativa"},
                    {"field_id": fields["categorias"].id, "value_json": ["Alimentos", "Tecnologia"]},
                ],
                "current_stage": 1,
                "is_submit": True,
            })
        },
        format="multipart",
    )

    assert response.status_code == 200


# ── Soft-delete service ────────────────────────────────────────────


@pytest.mark.django_db
def test_admin_delete_service_marks_is_deleted_true(api_client, admin_user, sample_service):
    api_client.force_authenticate(user=admin_user)
    url = reverse("services-admin-delete", kwargs={"service_id": sample_service.id})

    response = api_client.delete(url)

    assert response.status_code == 204
    sample_service.refresh_from_db()
    assert sample_service.is_deleted is True
    assert sample_service.is_active is False


@pytest.mark.django_db
def test_admin_delete_service_requires_admin(api_client, client_user, sample_service):
    api_client.force_authenticate(user=client_user)
    url = reverse("services-admin-delete", kwargs={"service_id": sample_service.id})

    response = api_client.delete(url)

    assert response.status_code == 403
    sample_service.refresh_from_db()
    assert sample_service.is_deleted is False


@pytest.mark.django_db
def test_admin_delete_service_already_deleted_returns_404(api_client, admin_user, sample_service):
    sample_service.is_deleted = True
    sample_service.save(update_fields=["is_deleted"])
    api_client.force_authenticate(user=admin_user)
    url = reverse("services-admin-delete", kwargs={"service_id": sample_service.id})

    response = api_client.delete(url)

    assert response.status_code == 404


@pytest.mark.django_db
def test_deleted_service_excluded_from_list_services(api_client, client_user, sample_service):
    sample_service.is_deleted = True
    sample_service.save(update_fields=["is_deleted"])
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("services-list"))

    assert response.status_code == 200
    ids = [s["id"] for s in response.data["services"]]
    assert sample_service.id not in ids


@pytest.mark.django_db
def test_deleted_service_excluded_from_admin_list(api_client, admin_user, sample_service):
    sample_service.is_deleted = True
    sample_service.save(update_fields=["is_deleted"])
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse("services-admin-list"))

    assert response.status_code == 200
    ids = [s["id"] for s in response.data["services"]]
    assert sample_service.id not in ids


@pytest.mark.django_db
def test_deleted_service_returns_404_on_detail(api_client, client_user, sample_service):
    sample_service.is_deleted = True
    sample_service.save(update_fields=["is_deleted"])
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("services-detail", kwargs={"service_id": sample_service.id}))

    assert response.status_code == 404
