"""
Tests for send_email_with_attachments API view in gym_app/views/layouts/sendEmail.py.

Targets uncovered lines: 123-177 (the API endpoint).
"""
import pytest
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        email="sendemail@example.com",
        password="testpassword",
        role="Lawyer",
    )


@pytest.mark.django_db
class TestSendEmailWithAttachments:
    def _url(self):
        return reverse("send_email_with_attachments")

    def test_unauthenticated_returns_401(self, api_client):
        response = api_client.post(self._url(), {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_to_email_returns_400(self, api_client, user):
        api_client.force_authenticate(user=user)
        response = api_client.post(self._url(), {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "to_email" in response.data["error"]

    @patch("gym_app.views.layouts.sendEmail.send_template_email")
    def test_success_without_attachments(self, mock_send, api_client, user):
        api_client.force_authenticate(user=user)
        data = {"to_email": "recipient@example.com"}
        response = api_client.post(self._url(), data, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        mock_send.assert_called_once()

    @patch("gym_app.views.layouts.sendEmail.send_template_email")
    def test_success_with_file_attachment(self, mock_send, api_client, user):
        api_client.force_authenticate(user=user)
        f = SimpleUploadedFile("doc.txt", b"content", content_type="text/plain")
        data = {"to_email": "recipient@example.com", "file1": f}
        response = api_client.post(self._url(), data, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        mock_send.assert_called_once()

    @patch("gym_app.views.layouts.sendEmail.send_template_email")
    def test_context_as_json_string(self, mock_send, api_client, user):
        """Cover lines 134-137: context passed as JSON string."""
        api_client.force_authenticate(user=user)
        import json
        data = {
            "to_email": "recipient@example.com",
            "context": json.dumps({"key": "value"}),
        }
        response = api_client.post(self._url(), data, format="multipart")
        assert response.status_code == status.HTTP_200_OK

    @patch("gym_app.views.layouts.sendEmail.send_template_email")
    def test_context_as_invalid_json_string(self, mock_send, api_client, user):
        """Cover lines 138-139: context is invalid JSON string → empty dict."""
        api_client.force_authenticate(user=user)
        data = {
            "to_email": "recipient@example.com",
            "context": "not-json{{",
        }
        response = api_client.post(self._url(), data, format="multipart")
        assert response.status_code == status.HTTP_200_OK

    @patch("gym_app.views.layouts.sendEmail.send_template_email")
    def test_context_as_non_string_non_dict(self, mock_send, api_client, user):
        """Cover line 142-143: context is not a string or dict → empty dict fallback."""
        api_client.force_authenticate(user=user)
        data = {
            "to_email": "recipient@example.com",
            "context": 12345,
        }
        response = api_client.post(self._url(), data, format="json")
        assert response.status_code == status.HTTP_200_OK
        mock_send.assert_called_once()

    @patch("gym_app.views.layouts.sendEmail.send_template_email", side_effect=FileNotFoundError("template missing"))
    def test_template_not_found_returns_404(self, mock_send, api_client, user):
        """Cover line 174-175: FileNotFoundError returns 404."""
        api_client.force_authenticate(user=user)
        data = {"to_email": "recipient@example.com"}
        response = api_client.post(self._url(), data, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("gym_app.views.layouts.sendEmail.send_template_email", side_effect=Exception("unexpected"))
    def test_unexpected_error_returns_500(self, mock_send, api_client, user):
        """Cover lines 176-177: generic Exception returns 500."""
        api_client.force_authenticate(user=user)
        data = {"to_email": "recipient@example.com"}
        response = api_client.post(self._url(), data, format="multipart")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
