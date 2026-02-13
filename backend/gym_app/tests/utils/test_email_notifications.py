from datetime import datetime
from unittest import mock

import pytest
from django.utils import timezone
from django.contrib.auth import get_user_model

from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestResponse
from gym_app.utils import email_notifications


User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        first_name="Client",
        last_name="User",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def legal_request_type():
    return LegalRequestType.objects.create(name="Consulta")


@pytest.fixture
@pytest.mark.django_db
def legal_discipline():
    return LegalDiscipline.objects.create(name="Derecho Civil")


@pytest.fixture
@pytest.mark.django_db
def legal_request(client_user, legal_request_type, legal_discipline):
    return LegalRequest.objects.create(
        user=client_user,
        request_type=legal_request_type,
        discipline=legal_discipline,
        description="Descripción",
    )


@pytest.fixture
@pytest.mark.django_db
def legal_response(legal_request, client_user):
    return LegalRequestResponse.objects.create(
        legal_request=legal_request,
        response_text="Respuesta",
        user=client_user,
        user_type="client",
    )


@pytest.mark.django_db
class TestSendStatusUpdateNotification:
    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_status_update_notification_success(self, mock_send, legal_request):
        mock_send.return_value = True

        result = email_notifications.send_status_update_notification(
            legal_request, previous_status="PENDING", new_status="IN_REVIEW"
        )

        assert result is True
        mock_send.assert_called_once()
        args, kwargs = mock_send.call_args
        assert kwargs["to_emails"] == [legal_request.user.email]
        assert "Solicitud" in kwargs["subject"]
        context = kwargs["context"]
        assert context["request_number"] == legal_request.request_number
        assert context["previous_status"]
        assert context["new_status"] == "IN_REVIEW"
        assert context["status_message"]

    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_status_update_notification_failure(self, mock_send, legal_request):
        mock_send.return_value = False

        result = email_notifications.send_status_update_notification(
            legal_request, previous_status="PENDING", new_status="CLOSED"
        )

        assert result is False

    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_status_update_notification_exception_returns_false(
        self, mock_send, legal_request
    ):
        mock_send.side_effect = Exception("boom")

        result = email_notifications.send_status_update_notification(
            legal_request, previous_status="PENDING", new_status="CLOSED"
        )

        assert result is False


@pytest.mark.django_db
class TestSendNewResponseNotification:
    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_new_response_notification_to_client(self, mock_send, legal_request, legal_response):
        mock_send.return_value = True

        result = email_notifications.send_new_response_notification(
            legal_request=legal_request,
            response=legal_response,
            recipient_email=legal_request.user.email,
            recipient_name="Client User",
            recipient_type="client",
        )

        assert result is True
        mock_send.assert_called_once()
        _, kwargs = mock_send.call_args
        context = kwargs["context"]
        assert context["request_number"] == legal_request.request_number
        assert context["response_text"] == legal_response.response_text
        assert context["is_client_recipient"] is True

    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_new_response_notification_returns_false_on_failure(
        self, mock_send, legal_request, legal_response
    ):
        mock_send.return_value = False

        result = email_notifications.send_new_response_notification(
            legal_request=legal_request,
            response=legal_response,
            recipient_email=legal_request.user.email,
            recipient_name="Client User",
            recipient_type="client",
        )

        assert result is False

    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_new_response_notification_prefers_response_user_name(
        self, mock_send, legal_request, legal_response
    ):
        mock_send.return_value = True
        legal_response.user_name = "Custom Author"

        result = email_notifications.send_new_response_notification(
            legal_request=legal_request,
            response=legal_response,
            recipient_email=legal_request.user.email,
            recipient_name="Client User",
            recipient_type="client",
        )

        assert result is True
        _, kwargs = mock_send.call_args
        assert kwargs["context"]["response_author"] == "Custom Author"

    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_send_new_response_notification_falls_back_to_user_email(
        self, mock_send, legal_request_type, legal_discipline
    ):
        mock_send.return_value = True
        nameless_user = User.objects.create_user(
            email="nameless@example.com",
            password="testpassword",
            role="client",
        )
        request = LegalRequest.objects.create(
            user=nameless_user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description="Descripcion",
        )
        response = LegalRequestResponse.objects.create(
            legal_request=request,
            response_text="Respuesta",
            user=nameless_user,
            user_type="client",
        )

        result = email_notifications.send_new_response_notification(
            legal_request=request,
            response=response,
            recipient_email=request.user.email,
            recipient_name="Client User",
            recipient_type="client",
        )

        assert result is True
        _, kwargs = mock_send.call_args
        assert kwargs["context"]["response_author"] == nameless_user.email


@pytest.mark.django_db
class TestNotifyHelpers:
    @mock.patch("gym_app.utils.email_notifications.send_new_response_notification")
    def test_notify_lawyers_of_client_response(self, mock_send_new, legal_request):
        # Crear un par de abogados activos y uno inactivo
        lawyer1 = User.objects.create_user(
            email="lawyer1@example.com",
            password="testpassword",
            role="lawyer",
            first_name="L1",
            last_name="Lawyer",
            is_active=True,
        )
        lawyer2 = User.objects.create_user(
            email="lawyer2@example.com",
            password="testpassword",
            role="lawyer",
            first_name="L2",
            last_name="Lawyer",
            is_active=True,
        )
        inactive_lawyer = User.objects.create_user(
            email="inactive@example.com",
            password="testpassword",
            role="lawyer",
            is_active=False,
        )

        response = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Respuesta de cliente",
            user=legal_request.user,
            user_type="client",
        )

        mock_send_new.return_value = True

        emails = email_notifications.notify_lawyers_of_client_response(
            legal_request, response
        )

        assert set(emails) == {lawyer1.email, lawyer2.email}
        # Debe llamarse a send_new_response_notification por cada abogado activo
        assert mock_send_new.call_count == 2

    @mock.patch("gym_app.utils.email_notifications.send_new_response_notification")
    def test_notify_lawyers_of_client_response_partial_success(
        self, mock_send_new, legal_request
    ):
        lawyer1 = User.objects.create_user(
            email="lawyer-success@example.com",
            password="testpassword",
            role="lawyer",
            is_active=True,
        )
        lawyer2 = User.objects.create_user(
            email="lawyer-fail@example.com",
            password="testpassword",
            role="lawyer",
            is_active=True,
        )
        response = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Respuesta de cliente",
            user=legal_request.user,
            user_type="client",
        )

        def side_effect(*args, **kwargs):
            return kwargs["recipient_email"] == lawyer1.email

        mock_send_new.side_effect = side_effect

        emails = email_notifications.notify_lawyers_of_client_response(
            legal_request, response
        )

        assert set(emails) == {lawyer1.email}
        assert mock_send_new.call_count == 2

    @mock.patch("gym_app.models.User.objects.filter")
    def test_notify_lawyers_of_client_response_exception_returns_empty(
        self, mock_filter, legal_request
    ):
        mock_filter.side_effect = Exception("boom")
        response = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Respuesta de cliente",
            user=legal_request.user,
            user_type="client",
        )

        emails = email_notifications.notify_lawyers_of_client_response(
            legal_request, response
        )

        assert emails == []

    @mock.patch("gym_app.utils.email_notifications.send_new_response_notification")
    def test_notify_client_of_lawyer_response(self, mock_send_new, legal_request, client_user):
        response = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Respuesta de abogado",
            user=client_user,
            user_type="lawyer",
        )
        mock_send_new.return_value = True

        result = email_notifications.notify_client_of_lawyer_response(
            legal_request, response
        )

        assert result is True
        mock_send_new.assert_called_once()
        args, kwargs = mock_send_new.call_args
        assert kwargs["recipient_email"] == legal_request.user.email
        assert kwargs["recipient_name"] == f"{legal_request.user.first_name} {legal_request.user.last_name}"

    @mock.patch("gym_app.utils.email_notifications.send_new_response_notification")
    def test_notify_client_of_lawyer_response_exception_returns_false(
        self, mock_send_new, legal_request, client_user
    ):
        response = LegalRequestResponse.objects.create(
            legal_request=legal_request,
            response_text="Respuesta de abogado",
            user=client_user,
            user_type="lawyer",
        )
        mock_send_new.side_effect = Exception("boom")

        result = email_notifications.notify_client_of_lawyer_response(
            legal_request, response
        )

        assert result is False


def test_get_request_detail_url_uses_frontend_base_url(settings):
    settings.FRONTEND_BASE_URL = "https://frontend.example.com"
    url = email_notifications._get_request_detail_url(123)
    assert url == "https://frontend.example.com/legal-requests/123"


def test_get_request_detail_url_returns_hash_on_exception(monkeypatch):
    class BrokenSettings:
        def __getattribute__(self, name):
            if name == "__class__":
                return type(self)
            raise RuntimeError("boom")

    monkeypatch.setattr(email_notifications, "settings", BrokenSettings())

    assert email_notifications._get_request_detail_url(123) == "#"


def test_get_status_message_returns_expected_strings():
    assert email_notifications._get_status_message("PENDING").startswith("Tu solicitud está pendiente")
    assert email_notifications._get_status_message("IN_REVIEW").startswith("Tu solicitud está siendo revisada")
    assert email_notifications._get_status_message("RESPONDED").startswith("Hemos respondido")
    assert email_notifications._get_status_message("CLOSED").startswith("Tu solicitud ha sido cerrada")
    # Valor por defecto para estados desconocidos
    assert email_notifications._get_status_message("UNKNOWN").startswith("El estado de tu solicitud ha sido actualizado")
