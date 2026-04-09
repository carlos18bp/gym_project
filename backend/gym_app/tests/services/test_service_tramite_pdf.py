"""Tests for gym_app.services.service_tramite_pdf."""

import types
import pytest
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model

from gym_app.services.service_tramite_pdf import (
    _normalize_answer_value,
    generate_service_request_pdf,
    ServiceRequestPDFError,
)
from gym_app.models import (
    Service,
    ServiceStage,
    ServiceField,
    ServiceRequest,
    ServiceRequestAnswer,
    ServiceRequestFieldFile,
)

User = get_user_model()

MOCK_RENDER = "gym_app.services.service_tramite_pdf.render_to_string"
MOCK_PISA = "gym_app.services.service_tramite_pdf.pisa.CreatePDF"


def _mock_answer(field_type, value_text=None, value_json=None):
    """Build a lightweight answer-like namespace for unit tests."""
    return types.SimpleNamespace(field_type=field_type, value_text=value_text, value_json=value_json)


# ============================================================
# Shared fixtures
# ============================================================


@pytest.fixture
def pdf_service():
    service = Service.objects.create(
        name="Servicio PDF",
        short_title="PDF",
        slug="pdf-test-svc",
        is_active=True,
    )
    stage = ServiceStage.objects.create(service=service, title="Datos", order=1, is_active=True)
    ServiceField.objects.create(
        stage=stage, key="nombre", label="Nombre", field_type="input", order=1
    )
    ServiceField.objects.create(
        stage=stage, key="categorias", label="Categorias", field_type="select_multiple",
        order=2, options=["A", "B"],
    )
    ServiceField.objects.create(
        stage=stage, key="soporte", label="Soporte", field_type="file",
        order=3, allowed_extensions=[".pdf"], allow_multiple_files=False, max_files=1,
    )
    return service


@pytest.fixture
def pdf_requester():
    return User.objects.create_user(
        email="pdf_requester@test.com",
        password="testpassword",
        first_name="Pedro",
        last_name="PDF",
        role="client",
    )


@pytest.fixture
def pdf_request(pdf_service, pdf_requester):
    req = ServiceRequest.objects.create(
        service=pdf_service,
        requester=pdf_requester,
        status="OPEN",
        is_submitted=True,
    )
    req.assign_tracking_number()
    req.save()
    return req


@pytest.fixture
def pdf_request_with_answers(pdf_request, pdf_service):
    """Request with one text answer, one select_multiple answer, one file answer."""
    stage = pdf_service.stages.first()
    nombre_field = stage.fields.get(key="nombre")
    categorias_field = stage.fields.get(key="categorias")
    soporte_field = stage.fields.get(key="soporte")

    ServiceRequestAnswer.objects.create(
        service_request=pdf_request, field=nombre_field,
        field_key="nombre", field_label="Nombre", field_type="input",
        stage_title="Datos", stage_order=1, value_text="Juan Garcia",
    )
    ServiceRequestAnswer.objects.create(
        service_request=pdf_request, field=categorias_field,
        field_key="categorias", field_label="Categorias", field_type="select_multiple",
        stage_title="Datos", stage_order=1, value_json=["A", "B"],
    )
    ServiceRequestAnswer.objects.create(
        service_request=pdf_request, field=soporte_field,
        field_key="soporte", field_label="Soporte", field_type="file",
        stage_title="Datos", stage_order=1,
    )
    ServiceRequestFieldFile.objects.create(
        service_request=pdf_request, field=soporte_field,
        file="service_requests/field_files/2026/test.pdf",
        original_name="soporte.pdf",
    )
    return pdf_request


def _make_pisa_ok():
    status = MagicMock()
    status.err = 0
    return status


def _make_pisa_fail():
    status = MagicMock()
    status.err = 1
    return status


# ============================================================
# TestNormalizeAnswerValue
# ============================================================


class TestNormalizeAnswerValue:

    def test_select_multiple_list_joined(self):
        answer = _mock_answer("select_multiple", value_json=["A", "B"])

        result = _normalize_answer_value(answer)

        assert result == "A, B"

    def test_select_single_with_json_string(self):
        answer = _mock_answer("select_single", value_json="Nominativa")

        result = _normalize_answer_value(answer)

        assert result == "Nominativa"

    def test_select_single_with_json_list(self):
        answer = _mock_answer("select_single", value_json=["Nominativa", "Figurativa"])

        result = _normalize_answer_value(answer)

        assert result == "Nominativa, Figurativa"

    def test_file_with_json_returns_string(self):
        answer = _mock_answer("file", value_json="doc.pdf")

        result = _normalize_answer_value(answer)

        assert result == "doc.pdf"

    def test_returns_empty_string_when_value_text_none(self):
        answer = _mock_answer("input", value_text=None)

        result = _normalize_answer_value(answer)

        assert result == ""

    def test_returns_string_of_value_text(self):
        answer = _mock_answer("input", value_text="Hola")

        result = _normalize_answer_value(answer)

        assert result == "Hola"


# ============================================================
# TestGenerateServiceRequestPdf
# ============================================================


@pytest.mark.django_db
@pytest.mark.integration
class TestGenerateServiceRequestPdf:

    def test_saves_document_as_pdf_file(self, pdf_request_with_answers, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        with patch(MOCK_RENDER, return_value="<html></html>"):
            with patch(MOCK_PISA, return_value=_make_pisa_ok()):
                generate_service_request_pdf(pdf_request_with_answers)

        assert pdf_request_with_answers.generated_document.name.endswith(".pdf")

    def test_groups_answers_by_stage_order(self, pdf_request_with_answers, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        captured_context = {}

        def capture_render(template, context):
            captured_context.update(context)
            return "<html></html>"

        with patch(MOCK_RENDER, side_effect=capture_render):
            with patch(MOCK_PISA, return_value=_make_pisa_ok()):
                generate_service_request_pdf(pdf_request_with_answers)

        stages = captured_context["stages"]
        orders = [s["order"] for s in stages]
        assert orders == sorted(orders)

    def test_file_answer_value_replaced_by_uploaded_filenames(self, pdf_request_with_answers, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        captured_context = {}

        def capture_render(template, context):
            captured_context.update(context)
            return "<html></html>"

        with patch(MOCK_RENDER, side_effect=capture_render):
            with patch(MOCK_PISA, return_value=_make_pisa_ok()):
                generate_service_request_pdf(pdf_request_with_answers)

        stage_items = captured_context["stages"][0]["items"]
        soporte_item = next(item for item in stage_items if item["label"] == "Soporte")
        assert "soporte.pdf" in soporte_item["value"]

    def test_select_multiple_value_joined(self, pdf_request_with_answers, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        captured_context = {}

        def capture_render(template, context):
            captured_context.update(context)
            return "<html></html>"

        with patch(MOCK_RENDER, side_effect=capture_render):
            with patch(MOCK_PISA, return_value=_make_pisa_ok()):
                generate_service_request_pdf(pdf_request_with_answers)

        stage_items = captured_context["stages"][0]["items"]
        categorias_item = next(item for item in stage_items if item["label"] == "Categorias")
        assert categorias_item["value"] == "A, B"

    def test_raises_service_request_pdf_error_on_pisa_failure(self, pdf_request_with_answers, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        with patch(MOCK_RENDER, return_value="<html></html>"):
            with patch(MOCK_PISA, return_value=_make_pisa_fail()):
                with pytest.raises(ServiceRequestPDFError) as exc_info:
                    generate_service_request_pdf(pdf_request_with_answers)
        assert exc_info.type is ServiceRequestPDFError

    def test_context_includes_requester_and_service(self, pdf_request_with_answers, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        captured_context = {}

        def capture_render(template, context):
            captured_context.update(context)
            return "<html></html>"

        with patch(MOCK_RENDER, side_effect=capture_render):
            with patch(MOCK_PISA, return_value=_make_pisa_ok()):
                generate_service_request_pdf(pdf_request_with_answers)

        assert captured_context["requester"] == pdf_request_with_answers.requester
        assert captured_context["service"] == pdf_request_with_answers.service

    def test_field_without_key_skipped_in_files_by_field_key(self, pdf_request, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        # Create a field file whose field FK is None (simulates SET_NULL after field deletion)
        ServiceRequestFieldFile.objects.create(
            service_request=pdf_request,
            field=None,
            file="service_requests/field_files/2026/orphan.pdf",
            original_name="orphan.pdf",
        )

        with patch(MOCK_RENDER, return_value="<html></html>"):
            with patch(MOCK_PISA, return_value=_make_pisa_ok()):
                generate_service_request_pdf(pdf_request)

        assert pdf_request.generated_document.name.endswith(".pdf")
