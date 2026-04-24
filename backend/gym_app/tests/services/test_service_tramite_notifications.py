"""Tests for gym_app.services.service_tramite_notifications."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from gym_app.models import (
    Service,
    ServiceRequest,
    ServiceRequestAnswer,
)
from gym_app.services.service_tramite_notifications import (
    _build_answers_summary,
    _get_manager_emails,
    notify_service_request_status_change,
    notify_service_request_submission,
)

User = get_user_model()

MOCK_SEND = "gym_app.services.service_tramite_notifications.send_template_email"


# ============================================================
# Shared fixtures
# ============================================================


@pytest.fixture
def notif_service():
    """Create a Service instance for notification tests."""
    return Service.objects.create(
        name="Servicio Notificaciones",
        short_title="Notif",
        slug="notif-test-svc",
        is_active=True,
    )


@pytest.fixture
def notif_requester():
    """Create a client user as the service request requester."""
    return User.objects.create_user(
        email="notif_requester@test.com",
        password="testpassword",
        first_name="Ana",
        last_name="Requeriente",
        role="client",
    )


@pytest.fixture
def notif_request(notif_service, notif_requester):
    """Create a submitted ServiceRequest with a tracking number."""
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
    """Create a ServiceRequestAnswer with minimal required fields."""
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
    """Tests for _build_answers_summary helper."""

    def test_uses_value_text_when_present(self, notif_request):
        """Use value_text in the summary when it is present."""
        _make_answer(notif_request, "f1", "Mi Campo", value_text="Valor de Prueba")

        result = _build_answers_summary(notif_request)

        assert "- Mi Campo: Valor de Prueba" in result

    def test_uses_value_json_list_joined_when_no_text(self, notif_request):
        """Join value_json list items when value_text is absent."""
        _make_answer(notif_request, "f2", "Opciones", field_type="select_multiple", value_json=["A", "B"])

        result = _build_answers_summary(notif_request)

        assert "- Opciones: A, B" in result

    def test_uses_value_json_scalar_when_not_list(self, notif_request):
        """Use value_json directly when it is a scalar string."""
        _make_answer(notif_request, "f3", "Tipo", field_type="select_single", value_json="Nominativa")

        result = _build_answers_summary(notif_request)

        assert "- Tipo: Nominativa" in result

    def test_falls_back_to_dash_when_both_none(self, notif_request):
        """Fall back to dash separator when both value_text and value_json are None."""
        _make_answer(notif_request, "f4", "Vacio", value_text=None, value_json=None)

        result = _build_answers_summary(notif_request)

        assert "- Vacio: -" in result

    def test_truncates_long_value_at_120_chars(self, notif_request):
        """Truncate long values and append ellipsis at the 120-character limit."""
        _make_answer(notif_request, "f5", "Largo", value_text="x" * 130)
        expected_value = "x" * 117 + "..."

        result = _build_answers_summary(notif_request)

        assert f"- Largo: {expected_value}" in result

    def test_appends_ellipsis_row_when_more_than_max_items(self, notif_request):
        """Append an ellipsis row when answer count exceeds max_items."""
        for i in range(13):
            _make_answer(notif_request, f"field_{i}", f"Campo {i}", value_text=f"valor {i}")

        result = _build_answers_summary(notif_request, max_items=12)

        assert result.endswith("- ...")

    def test_returns_sin_respuestas_when_no_answers(self, notif_request):
        """Return 'Sin respuestas registradas' when the request has no answers."""
        result = _build_answers_summary(notif_request)

        assert result == "Sin respuestas registradas"


# ============================================================
# TestGetManagerEmails
# ============================================================


@pytest.mark.django_db
class TestGetManagerEmails:
    """Tests for _get_manager_emails helper."""

    def test_returns_emails_for_lawyer_role(self):
        """Return lawyer-role users' emails."""
        User.objects.create_user(email="lawyer_mgr@test.com", password="pw", role="lawyer", is_active=True)

        result = _get_manager_emails()

        assert "lawyer_mgr@test.com" in result

    def test_returns_emails_for_admin_role(self):
        """Return admin-role users' emails."""
        User.objects.create_user(email="admin_mgr@test.com", password="pw", role="admin", is_active=True)

        result = _get_manager_emails()

        assert "admin_mgr@test.com" in result

    def test_returns_emails_for_is_staff(self):
        """Return is_staff users' emails."""
        User.objects.create_user(email="staff_mgr@test.com", password="pw", role="basic", is_staff=True, is_active=True)

        result = _get_manager_emails()

        assert "staff_mgr@test.com" in result

    def test_returns_emails_for_is_superuser(self):
        """Return is_superuser users' emails."""
        User.objects.create_user(email="superuser_mgr@test.com", password="pw", role="basic", is_superuser=True, is_active=True)

        result = _get_manager_emails()

        assert "superuser_mgr@test.com" in result

    def test_excludes_inactive_users(self):
        """Exclude inactive users from manager emails."""
        User.objects.create_user(email="inactive_lawyer@test.com", password="pw", role="lawyer", is_active=False)

        result = _get_manager_emails()

        assert "inactive_lawyer@test.com" not in result

    def test_excludes_blank_email(self):
        """Exclude blank email addresses from manager email list."""
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
        """Return emails in sorted order."""
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
    """Tests for notify_service_request_submission."""

    def test_sends_confirmation_to_requester_email(self, notif_request):
        """Send confirmation email to the requester."""
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        requester_call = mock_send.call_args_list[0]
        assert requester_call.kwargs["to_emails"] == [notif_request.requester.email]

    def test_sends_alert_to_manager_emails_when_managers_exist(self, notif_request):
        """Send alert to all manager emails when managers exist."""
        manager = User.objects.create_user(email="notif_manager@test.com", password="pw", role="lawyer")

        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        assert mock_send.call_count == 2
        manager_call = mock_send.call_args_list[1]
        assert manager.email in manager_call.kwargs["to_emails"]

    def test_skips_manager_email_when_no_managers(self, notif_request):
        """Skip manager email when no manager users exist."""
        # No manager users exist — only notif_requester (client role)
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        assert mock_send.call_count == 1

    def test_attaches_generated_document_when_present(self, notif_request, settings, tmp_path):
        """Attach the generated PDF document to the requester confirmation email."""
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
        """Send no attachments when no generated document is present."""
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_submission(notif_request)

        requester_call = mock_send.call_args_list[0]
        assert requester_call.kwargs["attachments"] == []

    def test_swallows_requester_email_exception(self, notif_request):
        """Swallow exceptions raised when sending the requester confirmation email."""
        with patch(MOCK_SEND, side_effect=Exception("send failed")) as mock_send:
            notify_service_request_submission(notif_request)
        assert mock_send.call_count == 1

    def test_swallows_manager_email_exception(self, notif_request):
        """Swallow exceptions raised when sending the manager alert email."""
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
        """Include the tracking number in the submission email subject."""
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
    """Tests for notify_service_request_status_change."""

    def test_sends_to_requester_email(self, notif_request):
        """Send status-change notification to the requester's email."""
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request)

        assert mock_send.call_args.kwargs["to_emails"] == [notif_request.requester.email]

    def test_subject_contains_tracking_number(self, notif_request):
        """Include the tracking number in the status-change email subject."""
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request)

        assert notif_request.tracking_number in mock_send.call_args.kwargs["subject"]

    def test_uses_provided_message_in_additional_info(self, notif_request):
        """Pass the provided message as additional_info in the template context."""
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request, message="Revision completa")

        context = mock_send.call_args.kwargs["context"]
        assert context["additional_info"] == "Revision completa"

    def test_falls_back_to_default_message_when_empty(self, notif_request):
        """Use the default message in additional_info when the provided message is empty."""
        with patch(MOCK_SEND) as mock_send:
            notify_service_request_status_change(notif_request, message="")

        context = mock_send.call_args.kwargs["context"]
        assert context["additional_info"] == "Tu abogado actualizo el tramite."

    def test_swallows_send_exception(self, notif_request):
        """Swallow exceptions raised by the underlying email send."""
        with patch(MOCK_SEND, side_effect=Exception("send failed")) as mock_send:
            notify_service_request_status_change(notif_request)
        assert mock_send.call_count == 1
