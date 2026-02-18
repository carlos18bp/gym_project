import json
from unittest import mock

import pytest
from django.urls import reverse
from django.conf import settings


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.contract
def test_get_site_key(client, settings):
    settings.RECAPTCHA_SITE_KEY = "test_site_key_123"
    url = reverse("google-captcha-site-key")

    response = client.get(url)

    assert response.status_code == 200
    data = json.loads(response.content.decode())
    assert data["site_key"] == "test_site_key_123"


@pytest.mark.django_db
@pytest.mark.integration
class TestVerifyRecaptcha:
    @pytest.fixture(autouse=True)
    def setup_settings(self, settings):
        settings.RECAPTCHA_SECRET_KEY = "secret_test_key"

    @pytest.mark.edge
    def test_verify_recaptcha_missing_token(self, client):
        url = reverse("google-captcha-verify")

        # Sin body ni form-data
        response = client.post(url, data={})

        assert response.status_code == 400
        data = json.loads(response.content.decode())
        assert data["success"] is False
        assert data["error"] == "Token not provided."

    @mock.patch("gym_app.views.captcha.requests.post")
    @pytest.mark.contract
    def test_verify_recaptcha_success(self, mock_post, client):
        url = reverse("google-captcha-verify")

        # Mock respuesta de Google
        mock_response = mock.Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response

        response = client.post(url, data={"token": "test_token"})

        assert response.status_code == 200
        data = json.loads(response.content.decode())
        assert data["success"] is True
        assert data["result"]["success"] is True
        mock_post.assert_called_once()

    @mock.patch("gym_app.views.captcha.requests.post")
    @pytest.mark.edge
    def test_verify_recaptcha_failure_from_google(self, mock_post, client):
        url = reverse("google-captcha-verify")

        mock_response = mock.Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"success": False}
        mock_post.return_value = mock_response

        response = client.post(url, data={"token": "test_token"})

        assert response.status_code == 200
        data = json.loads(response.content.decode())
        assert data["success"] is False
        mock_post.assert_called_once()

    @mock.patch("gym_app.views.captcha.requests.post")
    @pytest.mark.edge
    def test_verify_recaptcha_request_exception(self, mock_post, client):
        url = reverse("google-captcha-verify")

        mock_post.side_effect = Exception("network error")

        response = client.post(url, data={"token": "test_token"})

        assert response.status_code == 500
        data = json.loads(response.content.decode())
        assert data["success"] is False
        assert data["error"] == "Error verifying token."


@pytest.mark.django_db
class TestVerifyRecaptchaRest:
    @pytest.fixture(autouse=True)
    def setup_settings(self, settings):
        settings.RECAPTCHA_SECRET_KEY = "rest_secret_key"

    def test_get_site_key_rest(self, client, settings):
        settings.RECAPTCHA_SITE_KEY = "rest_site_key"
        url = reverse("google-captcha-site-key")

        response = client.get(url)

        assert response.status_code == 200
        data = json.loads(response.content.decode())
        assert data["site_key"] == "rest_site_key"

    @mock.patch("gym_app.views.captcha.requests.post")
    def test_verify_recaptcha_json_success(self, mock_post, client):
        url = reverse("google-captcha-verify")

        mock_response = mock.Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response

        response = client.post(
            url,
            data=json.dumps({"token": "test_token"}),
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.content.decode())
        assert data["success"] is True
        assert data["result"]["success"] is True
        mock_post.assert_called_once()

    def test_verify_recaptcha_json_invalid_body(self, client):
        url = reverse("google-captcha-verify")

        response = client.post(
            url,
            data="{bad-json",
            content_type="application/json",
        )

        assert response.status_code == 400
        data = json.loads(response.content.decode())
        assert data["success"] is False
        assert data["error"] == "Token not provided."

    @mock.patch("gym_app.views.captcha.requests.post", side_effect=Exception("boom"))
    def test_verify_recaptcha_request_exception_rest(self, mock_post, client):
        url = reverse("google-captcha-verify")

        response = client.post(url, data={"token": "test_token"})

        assert response.status_code == 500
        data = json.loads(response.content.decode())
        assert data["success"] is False
        assert data["error"] == "Error verifying token."
