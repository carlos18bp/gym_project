"""
Tests targeting the remaining uncovered lines in email_notifications.py to reach 100%.

Targets:
  - line 118: subject branch when response.user_type == 'lawyer'
  - lines 137-139: exception path in send_new_response_notification
"""
from unittest import mock

import pytest
from django.contrib.auth import get_user_model

from gym_app.models import (
    LegalRequest,
    LegalRequestType,
    LegalDiscipline,
    LegalRequestResponse,
)
from gym_app.utils import email_notifications

User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_ucov@test.com",
        password="pw",
        first_name="Law",
        last_name="Yer",
        role="lawyer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_ucov@test.com",
        password="pw",
        first_name="Client",
        last_name="User",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def legal_request(client_user):
    req_type = LegalRequestType.objects.create(name="Ucov Type")
    discipline = LegalDiscipline.objects.create(name="Ucov Disc")
    return LegalRequest.objects.create(
        user=client_user,
        request_type=req_type,
        discipline=discipline,
        description="Test request",
    )


@pytest.fixture
@pytest.mark.django_db
def lawyer_response(legal_request, lawyer_user):
    return LegalRequestResponse.objects.create(
        legal_request=legal_request,
        response_text="Lawyer reply",
        user=lawyer_user,
        user_type="lawyer",
    )


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# line 118: subject for lawyer-type response
# ---------------------------------------------------------------------------

class TestSendNewResponseNotificationLawyerSubject:
    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_lawyer_response_uses_abogado_subject(
        self, mock_send, legal_request, lawyer_response
    ):
        """
        When response.user_type == 'lawyer', the subject line should
        contain 'Abogado' (line 118).
        """
        mock_send.return_value = True

        result = email_notifications.send_new_response_notification(
            legal_request=legal_request,
            response=lawyer_response,
            recipient_email="dest@test.com",
            recipient_name="Dest",
            recipient_type="client",
        )

        assert result is True
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        assert "Abogado" in call_kwargs["subject"]
        assert legal_request.request_number in call_kwargs["subject"]


# ---------------------------------------------------------------------------
# lines 137-139: exception path
# ---------------------------------------------------------------------------

class TestSendNewResponseNotificationException:
    @mock.patch("gym_app.utils.email_notifications.send_template_email")
    def test_returns_false_when_exception_is_raised(
        self, mock_send, legal_request, lawyer_response
    ):
        """
        When send_new_response_notification encounters an unexpected
        exception, it logs the error and returns False (lines 137-139).
        """
        mock_send.side_effect = Exception("SMTP connection failed")

        result = email_notifications.send_new_response_notification(
            legal_request=legal_request,
            response=lawyer_response,
            recipient_email="dest@test.com",
            recipient_name="Dest",
            recipient_type="client",
        )

        assert result is False
