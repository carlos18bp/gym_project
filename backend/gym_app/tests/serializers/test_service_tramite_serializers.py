"""Tests for gym_app.serializers.service_tramite — all 11 serializer classes."""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import RequestFactory

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
from gym_app.serializers.service_tramite import (
    ServiceListSerializer,
    ServiceRequestAnswerSerializer,
    ServiceRequestDetailSerializer,
    ServiceRequestFieldFileSerializer,
    ServiceRequestLawyerResponseFileSerializer,
    ServiceRequestLawyerResponseSerializer,
    ServiceSerializer,
)

User = get_user_model()


# ============================================================
# Shared fixtures
# ============================================================


@pytest.fixture
def ser_admin():
    return User.objects.create_user(
        email="ser_admin@test.com",
        password="pw",
        first_name="Admin",
        last_name="Ser",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def ser_client():
    return User.objects.create_user(
        email="ser_client@test.com",
        password="pw",
        first_name="Client",
        last_name="Ser",
        role="client",
    )


@pytest.fixture
def service_with_stages():
    service = Service.objects.create(
        name="Servicio Serializador",
        short_title="Serializ",
        slug="serializer-test-svc",
        is_active=True,
    )
    stage1 = ServiceStage.objects.create(service=service, title="Etapa Uno", order=1, is_active=True)
    ServiceField.objects.create(stage=stage1, key="campo_uno", label="Campo Uno", field_type="input", order=1)
    stage2 = ServiceStage.objects.create(service=service, title="Etapa Dos", order=2, is_active=True)
    ServiceField.objects.create(stage=stage2, key="campo_dos", label="Campo Dos", field_type="input", order=1)
    return service


@pytest.fixture
def submitted_request_ser(service_with_stages, ser_client):
    req = ServiceRequest.objects.create(
        service=service_with_stages,
        requester=ser_client,
        status="OPEN",
        is_submitted=True,
    )
    req.assign_tracking_number()
    req.save()
    return req


def _make_request(method="get", user=None):
    rf = RequestFactory()
    request = getattr(rf, method)("/")
    request.user = user
    return request


def _service_create_payload(slug="new-ser-svc", with_stages=True):
    payload = {
        "name": "Servicio Nuevo",
        "short_title": "Nuevo",
        "slug": slug,
        "is_active": True,
        "is_featured": False,
        "featured_order": 0,
        "stages": [],
    }
    if with_stages:
        payload["stages"] = [
            {
                "title": "Etapa 1",
                "order": 1,
                "is_active": True,
                "fields": [
                    {
                        "key": "nombre",
                        "label": "Nombre",
                        "field_type": "input",
                        "is_required": True,
                        "order": 1,
                    }
                ],
            }
        ]
    return payload


# ============================================================
# TestServiceIconMixin (tested via ServiceListSerializer)
# ============================================================


@pytest.mark.django_db
class TestServiceIconMixin:

    def test_icon_image_url_returns_none_when_no_image(self, service_with_stages):
        """icon_image_url returns None when no image is set."""
        serializer = ServiceListSerializer(service_with_stages)

        assert serializer.data["icon_image_url"] is None

    def test_icon_image_url_builds_absolute_uri_with_request(self, service_with_stages, ser_admin):
        """icon_image_url returns an absolute URI when request context is provided."""
        request = _make_request(user=ser_admin)
        # Give the service a fake icon_image path (doesn't need to exist on disk for URL test)
        Service.objects.filter(id=service_with_stages.id).update(icon_image="services/icons/test.png")
        service_with_stages.refresh_from_db()

        serializer = ServiceListSerializer(service_with_stages, context={"request": request})

        assert serializer.data["icon_image_url"].startswith("http://")
        assert "test.png" in serializer.data["icon_image_url"]

    def test_icon_image_url_returns_relative_path_without_request(self, service_with_stages):
        """icon_image_url returns a relative path when request context is absent."""
        Service.objects.filter(id=service_with_stages.id).update(icon_image="services/icons/relative.png")
        service_with_stages.refresh_from_db()

        serializer = ServiceListSerializer(service_with_stages)

        url = serializer.data["icon_image_url"]
        assert url is not None
        assert not url.startswith("http://")
        assert "relative.png" in url


# ============================================================
# TestServiceSerializerCreate
# ============================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestServiceSerializerCreate:

    def test_create_service_with_stages_and_fields(self, ser_admin):
        """Create serializer persists service with nested stages and fields."""
        request = _make_request(user=ser_admin)
        payload = _service_create_payload(slug="create-with-stages")

        serializer = ServiceSerializer(data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        service = serializer.save()

        assert Service.objects.filter(id=service.id).exists()
        assert service.stages.count() == 1
        assert service.stages.first().fields.count() == 1

    def test_create_sets_created_by_from_request_user(self, ser_admin):
        """Create serializer sets created_by from the request user."""
        request = _make_request(user=ser_admin)
        payload = _service_create_payload(slug="create-created-by")

        serializer = ServiceSerializer(data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        service = serializer.save()

        service.refresh_from_db()
        assert service.created_by == ser_admin

    def test_create_with_empty_stages_list_creates_no_stages(self, ser_admin):
        """Create with an empty stages list creates no stages."""
        request = _make_request(user=ser_admin)
        payload = _service_create_payload(slug="create-no-stages", with_stages=False)

        serializer = ServiceSerializer(data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        service = serializer.save()

        assert service.stages.count() == 0


# ============================================================
# TestServiceSerializerUpdate
# ============================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestServiceSerializerUpdate:

    def _update_payload(self, service, stages):
        return {
            "name": service.name,
            "short_title": service.short_title,
            "slug": service.slug,
            "is_active": service.is_active,
            "stages": stages,
        }

    def test_update_renames_existing_stage(self, service_with_stages, ser_admin):
        """Update renames an existing stage matched by ID."""
        request = _make_request("put", user=ser_admin)
        stage1 = service_with_stages.stages.order_by("order").first()
        stage2 = service_with_stages.stages.order_by("order").last()

        payload = self._update_payload(service_with_stages, [
            {"id": stage1.id, "title": "Etapa Renombrada", "order": stage1.order, "is_active": True, "fields": []},
            {"id": stage2.id, "title": stage2.title, "order": stage2.order, "is_active": True, "fields": []},
        ])

        serializer = ServiceSerializer(service_with_stages, data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        stage1.refresh_from_db()
        assert stage1.title == "Etapa Renombrada"

    def test_update_deletes_stage_not_in_payload(self, service_with_stages, ser_admin):
        """Update removes a stage that is not included in the payload."""
        request = _make_request("put", user=ser_admin)
        stage1 = service_with_stages.stages.order_by("order").first()
        stage2_id = service_with_stages.stages.order_by("order").last().id

        payload = self._update_payload(service_with_stages, [
            {"id": stage1.id, "title": stage1.title, "order": stage1.order, "is_active": True, "fields": []},
        ])

        serializer = ServiceSerializer(service_with_stages, data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        assert service_with_stages.stages.count() == 1
        assert not ServiceStage.objects.filter(id=stage2_id).exists()

    def test_update_creates_new_stage_when_id_missing(self, service_with_stages, ser_admin):
        """Update creates a new stage when no ID is provided."""
        request = _make_request("put", user=ser_admin)
        stage1 = service_with_stages.stages.order_by("order").first()
        stage2 = service_with_stages.stages.order_by("order").last()

        payload = self._update_payload(service_with_stages, [
            {"id": stage1.id, "title": stage1.title, "order": stage1.order, "is_active": True, "fields": []},
            {"id": stage2.id, "title": stage2.title, "order": stage2.order, "is_active": True, "fields": []},
            {"title": "Nueva Etapa", "order": 3, "is_active": True, "fields": []},
        ])

        serializer = ServiceSerializer(service_with_stages, data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        assert service_with_stages.stages.count() == 3
        assert service_with_stages.stages.filter(title="Nueva Etapa").exists()

    def test_update_upserts_field_within_stage(self, service_with_stages, ser_admin):
        """Update upserts fields within a stage."""
        request = _make_request("put", user=ser_admin)
        stage1 = service_with_stages.stages.order_by("order").first()
        field1 = stage1.fields.first()
        stage2 = service_with_stages.stages.order_by("order").last()

        payload = self._update_payload(service_with_stages, [
            {
                "id": stage1.id,
                "title": stage1.title,
                "order": stage1.order,
                "is_active": True,
                "fields": [
                    {
                        "id": field1.id,
                        "key": field1.key,
                        "label": "Etiqueta Actualizada",
                        "field_type": "input",
                        "is_required": False,
                        "order": field1.order,
                    }
                ],
            },
            {"id": stage2.id, "title": stage2.title, "order": stage2.order, "is_active": True, "fields": []},
        ])

        serializer = ServiceSerializer(service_with_stages, data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        field1.refresh_from_db()
        assert field1.label == "Etiqueta Actualizada"

    def test_update_deletes_field_not_in_payload(self, service_with_stages, ser_admin):
        """Update removes a field that is not included in the payload."""
        request = _make_request("put", user=ser_admin)
        stage1 = service_with_stages.stages.order_by("order").first()
        field1_id = stage1.fields.first().id
        stage2 = service_with_stages.stages.order_by("order").last()

        payload = self._update_payload(service_with_stages, [
            {"id": stage1.id, "title": stage1.title, "order": stage1.order, "is_active": True, "fields": []},
            {"id": stage2.id, "title": stage2.title, "order": stage2.order, "is_active": True, "fields": []},
        ])

        serializer = ServiceSerializer(service_with_stages, data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        assert not ServiceField.objects.filter(id=field1_id).exists()

    def test_update_sets_updated_by_from_request_user(self, service_with_stages, ser_admin):
        """Update serializer sets updated_by from the request user."""
        request = _make_request("put", user=ser_admin)
        stage1 = service_with_stages.stages.order_by("order").first()
        stage2 = service_with_stages.stages.order_by("order").last()

        payload = self._update_payload(service_with_stages, [
            {"id": stage1.id, "title": stage1.title, "order": stage1.order, "is_active": True, "fields": []},
            {"id": stage2.id, "title": stage2.title, "order": stage2.order, "is_active": True, "fields": []},
        ])

        serializer = ServiceSerializer(service_with_stages, data=payload, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        service_with_stages.refresh_from_db()
        assert service_with_stages.updated_by == ser_admin

    def test_update_ignores_stages_when_stages_key_absent(self, service_with_stages, ser_admin):
        """Update skips stage processing when stages key is absent from payload."""
        request = _make_request("put", user=ser_admin)
        original_stage_count = service_with_stages.stages.count()

        payload = {
            "name": service_with_stages.name,
            "short_title": service_with_stages.short_title,
            "slug": service_with_stages.slug,
            "is_active": False,
            # No "stages" key
        }

        serializer = ServiceSerializer(service_with_stages, data=payload, partial=True, context={"request": request})
        assert serializer.is_valid(), serializer.errors
        serializer.save()

        assert service_with_stages.stages.count() == original_stage_count


# ============================================================
# TestServiceRequestFieldFileSerializer
# ============================================================


@pytest.mark.django_db
@pytest.mark.contract
class TestServiceRequestFieldFileSerializer:

    def test_file_name_uses_original_name_when_set(self, submitted_request_ser):
        """file_name returns the original_name when set."""
        ff = ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=None,
            file="service_requests/field_files/2026/uuid123.pdf",
            original_name="documento.pdf",
        )

        serializer = ServiceRequestFieldFileSerializer(ff)

        assert serializer.data["file_name"] == "documento.pdf"

    def test_file_name_falls_back_to_basename_of_file_path(self, submitted_request_ser):
        """file_name falls back to the basename of the file path when original_name is absent."""
        ff = ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=None,
            file="service_requests/field_files/2026/uuid-abc.pdf",
            original_name="",
        )

        serializer = ServiceRequestFieldFileSerializer(ff)

        assert serializer.data["file_name"] == ff.file.name.split("/")[-1]

    def test_download_url_builds_correct_path(self, submitted_request_ser):
        """download_url builds the correct reverse URL path."""
        ff = ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=None,
            file="service_requests/field_files/2026/uuid.pdf",
            original_name="file.pdf",
        )
        request = _make_request()

        serializer = ServiceRequestFieldFileSerializer(ff, context={"request": request})

        expected_path = f"/api/service-requests/{submitted_request_ser.id}/field-files/{ff.id}/download/"
        assert expected_path in serializer.data["download_url"]

    def test_download_url_returns_none_without_request(self, submitted_request_ser):
        """download_url returns None when request context is absent."""
        ff = ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=None,
            file="service_requests/field_files/2026/uuid.pdf",
            original_name="file.pdf",
        )

        serializer = ServiceRequestFieldFileSerializer(ff)

        assert serializer.data["download_url"] is None


# ============================================================
# TestServiceRequestAnswerSerializer
# ============================================================


@pytest.mark.django_db
@pytest.mark.contract
class TestServiceRequestAnswerSerializer:

    def test_files_returned_for_file_type_answer(self, submitted_request_ser, service_with_stages):
        """Nested files are returned for a file-type answer."""
        stage = service_with_stages.stages.first()
        field = stage.fields.first()
        answer = ServiceRequestAnswer.objects.create(
            service_request=submitted_request_ser,
            field=field,
            field_key=field.key,
            field_label=field.label,
            field_type="file",
            stage_title=stage.title,
            stage_order=stage.order,
        )
        ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=field,
            file="service_requests/field_files/2026/test.pdf",
            original_name="doc.pdf",
        )

        serializer = ServiceRequestAnswerSerializer(answer)

        assert len(serializer.data["files"]) == 1

    def test_files_empty_for_non_file_answer(self, submitted_request_ser, service_with_stages):
        """Nested files list is empty for a non-file-type answer."""
        stage = service_with_stages.stages.first()
        field = stage.fields.first()
        answer = ServiceRequestAnswer.objects.create(
            service_request=submitted_request_ser,
            field=field,
            field_key=field.key,
            field_label=field.label,
            field_type="input",
            stage_title=stage.title,
            stage_order=stage.order,
            value_text="Hola",
        )

        serializer = ServiceRequestAnswerSerializer(answer)

        assert serializer.data["files"] == []

    def test_files_matched_by_field_key(self, submitted_request_ser, service_with_stages):
        """Nested files are matched by the answer's field key."""
        stage = service_with_stages.stages.first()
        field1 = stage.fields.first()
        stage2 = service_with_stages.stages.last()
        field2 = stage2.fields.first()

        answer = ServiceRequestAnswer.objects.create(
            service_request=submitted_request_ser,
            field=field1,
            field_key=field1.key,
            field_label=field1.label,
            field_type="file",
            stage_title=stage.title,
            stage_order=stage.order,
        )
        # File matching field1.key
        ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=field1,
            file="service_requests/field_files/2026/match.pdf",
            original_name="match.pdf",
        )
        # File for a different field — should NOT appear
        ServiceRequestFieldFile.objects.create(
            service_request=submitted_request_ser,
            field=field2,
            file="service_requests/field_files/2026/other.pdf",
            original_name="other.pdf",
        )

        serializer = ServiceRequestAnswerSerializer(answer)

        assert len(serializer.data["files"]) == 1
        assert serializer.data["files"][0]["file_name"] == "match.pdf"


# ============================================================
# TestServiceRequestLawyerResponseSerializer
# ============================================================


@pytest.mark.django_db
@pytest.mark.contract
class TestServiceRequestLawyerResponseSerializer:

    def _make_response(self, service_request, responder, **kwargs):
        defaults = {
            "message": "Mensaje de prueba",
            "status_before": "OPEN",
            "status_after": "IN_STUDY",
        }
        defaults.update(kwargs)
        return ServiceRequestLawyerResponse.objects.create(
            service_request=service_request,
            responder=responder,
            **defaults,
        )

    def test_responder_name_returns_full_name(self, submitted_request_ser, ser_admin):
        """responder_name returns the responder's full name."""
        response_obj = self._make_response(submitted_request_ser, ser_admin)

        serializer = ServiceRequestLawyerResponseSerializer(response_obj)

        assert serializer.data["responder_name"] == "Admin Ser"

    def test_responder_name_falls_back_to_email(self, submitted_request_ser):
        """responder_name falls back to email when full name is blank."""
        no_name_user = User.objects.create_user(
            email="noname@test.com", password="pw", role="lawyer", first_name="", last_name=""
        )
        response_obj = self._make_response(submitted_request_ser, no_name_user)

        serializer = ServiceRequestLawyerResponseSerializer(response_obj)

        assert serializer.data["responder_name"] == "noname@test.com"

    def test_responder_name_empty_when_no_responder(self, submitted_request_ser):
        """responder_name is empty string when no responder is set."""
        response_obj = ServiceRequestLawyerResponse.objects.create(
            service_request=submitted_request_ser,
            responder=None,
            message="Sin responder",
            status_before="OPEN",
            status_after="IN_STUDY",
        )

        serializer = ServiceRequestLawyerResponseSerializer(response_obj)

        assert serializer.data["responder_name"] == ""


# ============================================================
# TestServiceRequestDetailSerializer
# ============================================================


@pytest.mark.django_db
@pytest.mark.contract
class TestServiceRequestDetailSerializer:

    def test_document_url_returns_none_when_no_document(self, submitted_request_ser):
        """document_url returns None when no generated document is attached."""
        serializer = ServiceRequestDetailSerializer(submitted_request_ser)

        assert serializer.data["document_url"] is None

    def test_document_url_builds_correct_path(self, submitted_request_ser, settings, tmp_path):
        """document_url builds the correct download URL."""
        settings.MEDIA_ROOT = str(tmp_path)
        submitted_request_ser.generated_document.save(
            "test.pdf", ContentFile(b"test"), save=False
        )
        submitted_request_ser.save()
        request = _make_request()

        serializer = ServiceRequestDetailSerializer(
            submitted_request_ser, context={"request": request}
        )

        expected_path = f"/api/service-requests/{submitted_request_ser.id}/document/download/"
        assert expected_path in serializer.data["document_url"]

    def test_requester_name_full_name(self, submitted_request_ser):
        """requester_name returns the requester's full name."""
        serializer = ServiceRequestDetailSerializer(submitted_request_ser)

        assert serializer.data["requester_name"] == "Client Ser"

    def test_requester_name_email_fallback(self, service_with_stages):
        """requester_name falls back to email when full name is blank."""
        no_name_user = User.objects.create_user(
            email="noname_requester@test.com", password="pw", role="client",
            first_name="", last_name="",
        )
        req = ServiceRequest.objects.create(
            service=service_with_stages,
            requester=no_name_user,
            status="DRAFT",
            is_submitted=False,
        )

        serializer = ServiceRequestDetailSerializer(req)

        assert serializer.data["requester_name"] == "noname_requester@test.com"
