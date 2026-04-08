import json
import re

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from gym_app.models import (
    Service,
    ServiceField,
    ServiceRequest,
    ServiceStage,
)


@pytest.fixture
def admin_user():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        email="admin_services@test.com",
        password="testpassword",
        first_name="Admin",
        last_name="Services",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def sample_service():
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


@pytest.mark.django_db
def test_admin_can_create_service_with_nested_stages(api_client, admin_user):
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
def test_client_can_list_active_services_only(api_client, client_user, sample_service):
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
    assert request_obj.generated_document


@pytest.mark.django_db
def test_lawyer_can_manage_submitted_request(api_client, client_user, lawyer_user, sample_service):
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
    api_client.force_authenticate(user=client_user)

    response = api_client.get(reverse("service-request-inbox-list"))

    assert response.status_code == 403


@pytest.mark.django_db
def test_manage_request_rejects_oversized_file_without_creating_response(
    api_client, client_user, lawyer_user, sample_service
):
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
        b"x" * (30 * 1024 * 1024 + 1),
        content_type="application/pdf",
    )

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
