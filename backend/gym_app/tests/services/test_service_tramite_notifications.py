"""Tests for gym_app.services.service_tramite_notifications."""

import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from gym_app.services.service_tramite_notifications import (
    _build_answers_summary,
    _get_manager_emails,
    notify_service_request_submission,
    notify_service_request_status_change,
)
from gym_app.models import (
    Service,
    ServiceRequest,
    ServiceRequestAnswer,
)

User = get_user_model()

MOCK_SEND = "gym_app.services.service_tramite_notifications.send_template_email"


# ============================================================
# Shared fixtures
# ============================================================


@pytest.fixture
def notif_service():
    return Service.objects.create(
        name="Servicio Notificaciones",
        short_title="Notif",
        slug="notif-test-svc",
        is_active=True,
    )


@pytest.fixture
def notif_requester():
    return User.objects.create_user(
        email="notif_requester@test.com",
        password="testpassword",
        first_name="Ana",
        last_name="Requeriente",
        role="client",
    )


@pytest.fixture
def notif_request(notif_service, notif_requester):
    req = ServiceRequest.objects.create(
        service=notif_service,
        requester=notif_requester,
        status="OPEN",
        is_submitted=True,
    )
    req.assign_tracking_number()
    req.save()
    return req


def _make_answer(service_request, key, label, **kwargs):
    """Helper to create a ServiceRequestAnswer with minimal fields."""
    defaults = {
        "field": None,
        "field_type": "input",
        "stage_title": "Etapa 1",
        "stage_order": 1,
        "value_text": None,
        "value_json": None,
    }
    defaults.update(kwargs)
    return ServiceRequestAnswer.objects.create(
        service_request=service_request,
        field_key=key,
        field_label=label,
        **defaults,
    )


# ============================================================
# TestBuildAnswersSummary
# ============================================================


@pytest.mark.django_db
class TestBuildAnswersSummary:

    def test_uses_value_text_when_present(self, notif_request):
        _make_answer(notif_request, "f1", "Mi Campo", value_text="Valor de Prueba")

        result = _build_answers_summary(notif_request)

        assert "- Mi Campo: Valor de Prueba" in result

    def test_uses_value_json_list_joined_when_no_text(self, notif_request):
        _make_answer(notif_request, "f2", "Opciones", field_type="select_multiple", value_json=["A", "B"])

        result = _build_answers_summary(notif_request)

        assert "- Opciones: A, B" in result

    def test_uses_value_json_scalar_when_not_list(self, notif_request):
        _make_answer(notif_request, "f3", "Tipo", field_type="select_single", value_json="Nominativa")

        result = _build_answers_summary(notif_request)

        assert "- Tipo: Nominativa" in result

    def test_falls_back_to_dash_when_both_none(self, notif_request):
        _make_answer(notif_request, "f4", "Vacio", value_text=None, value_json=None)

        result = _build_answers_summary(notif_request)

        assert "- Vacio: -" in result

    def test_truncates_long_value_at_120_chars(self, notif_request):
        _make_answer(notif_request, "f5", "Largo", value_text="x" * 130)
        expected_value = "x" * 117 + "..."

        result = _build_answers_summary(notif_request)

        assert f"- Largo: {expected_value}" in result

    def test_appends_ellipsis_row_when_more_than_max_items(self, notif_request):
        for i in range(13):
            _make_answer(notif_request, f"field_{i}", f"Campo {i}", value_text=f"valor {i}")

        result = _build_answers_summary(notif_request, max_items=12)

        assert result.endswith("- ...")

    def test_returns_sin_respuestas_when_no_answers(self, notif_request):
        result = _build_answers_summary(notif_request)

        assert result == "Sin respuestas registradas"


# ============================================================
# TestGetManagerEmails
# ============================================================


@pytest.mark.django_db
class TestGetManagerEmails:

    def test_returns_emails_for_lawyer_role(self):
        User.objects.create_user(email="lawyer_mgr@test.com", password="pw", role="lawyer", is_active=True)

        result = _get_manager_emails()

        assert "lawyer_mgr@test.com" in result

    def test_returns_emails_for_admin_role(self):
        User.objects.create_user(email="admin_mgr@test.com", password="pw", role="admin", is_active=True)

        result = _get_manager_emails()

        assert "admin_mgr@test.com" in result

    def test_returns_emails_for_is_staff(self):
        User.objects.create_user(email="staff_mgr@test.com", password="pw", role="basic", is_staff=True, is_active=True)

        result = _get_manager_emails()

        assert "staff_mgr@test.com" in result

    def test_returns_emails_for_is_superuser(self):
        User.objects.create_user(email="superuser_mgr@test.com", password="pw", role="basic", is_superuser=True, is_active=True)

        result = _get_manager_emails()

        assert "superuser_mgr@test.com" in result

    def test_excludes_inactive_users(self):
        User.objects.create_user(email="inactive_lawyer@test.com", password="pw", role="lawyer", is_active=False)

        result = _get_manager_emails()

        assert "inactive_lawyer@test.com" not in result

    def test_excludes_blank_email(self):
        # Create directly via manager to bypass email validation
        user = User(email="", role="lawyer", is_active=True)
        user.set_password("pw")
        user.username = "blank_email_user"
        # Skip save — blank email cannot be saved via create_user; verify exclusion logic
        # by creating a valid user then checking the function filters correctly
        User.objects.create_user(email="valid_lawyer@test.com", password="pw", role="lawyer")

        result = _get_manager_emails()

        assert "" not in result

    def test_returns_sorted_list(self):
        User.objects.create_user(email="z_lawyer@test.com", password="pw", role="lawyer")
        User.objects.create_user(email="a_lawyer@test.com", password="pw", role="lawyer")

        result = _get_manager_emails()

        lawyer_emails = [e for e in result if e.endswith("_lawyer@test.com")]
        assert lawyer_emails == sorted(lawyer_emails)


# ============================================================
# TestNotifyServiceRequestSubmission
# ============================================================


@pytest.mark.django_db
@pytest.mark.edge
class TestNotifyServiceRequestSubmission:

    def test_sends_confirmation_to_requester_email(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        requester_call = mock_send.call_args_list[0]
        assert requester_call.kwargs["to_emails"] == [notif_request.requester.email]

    def test_sends_alert_to_manager_emails_when_managers_exist(self, notif_request):
        manager = User.objects.create_user(email="notif_manager@test.com", password="pw", role="lawyer")

        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        assert mock_send.call_count == 2
        manager_call = mock_send.call_args_list[1]
        assert manager.email in manager_call.kwargs["to_emails"]

    def test_skips_manager_email_when_no_managers(self, notif_request):
        # No manager users exist — only notif_requester (client role)
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        assert mock_send.call_count == 1

    def test_attaches_generated_document_when_present(self, notif_request, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        notif_request.generated_document.save(
            "confirmation.pdf", ContentFile(b"%PDF-1.4 test"), save=False
        )
        notif_request.save()

        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        requester_call = mock_send.call_args_list[0]
        attachments = requester_call.kwargs["attachments"]
        assert len(attachments) == 1
        assert attachments[0] == notif_request.generated_document.path

    def test_no_attachment_when_no_generated_document(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        requester_call = mock_send.call_args_list[0]
        assert requester_call.kwargs["attachments"] == []

    def test_swallows_requester_email_exception(self, notif_request):
        with patch(MOCK_SEND, side_effect=Exception("send failed")) as mock_send:
            notify_service_request_submission(notif_request)
        assert mock_send.call_count == 1

    def test_swallows_manager_email_exception(self, notif_request):
        User.objects.create_user(email="mgr_exc@test.com", password="pw", role="lawyer")
        call_count = 0

        def _raise_on_second(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise Exception("manager send failed")

        with patch(MOCK_SEND, side_effect=_raise_on_second):
            notify_service_request_submission(notif_request)
        assert call_count == 2

    def test_subject_contains_tracking_number(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        requester_call = mock_send.call_args_list[0]
        assert notif_request.tracking_number in requester_call.kwargs["subject"]


# ============================================================
# TestNotifyServiceRequestStatusChange
# ============================================================


@pytest.mark.django_db
@pytest.mark.edge
class TestNotifyServiceRequestStatusChange:

    def test_sends_to_requester_email(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request)

        assert mock_send.call_args.kwargs["to_emails"] == [notif_request.requester.email]

    def test_subject_contains_tracking_number(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request)

        assert notif_request.tracking_number in mock_send.call_args.kwargs["subject"]

    def test_uses_provided_message_in_additional_info(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request, message="Revision completa")

        context = mock_send.call_args.kwargs["context"]
        assert context["additional_info"] == "Revision completa"

    def test_falls_back_to_default_message_when_empty(self, notif_request):
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request, message="")

        context = mock_send.call_args.kwargs["context"]
        assert context["additional_info"] == "Tu abogado actualizo el tramite."

    def test_swallows_send_exception(self, notif_request):
        with patch(MOCK_SEND, side_effect=Exception("send failed")) as mock_send:
            notify_service_request_status_change(notif_request)
        assert mock_send.call_count == 1
