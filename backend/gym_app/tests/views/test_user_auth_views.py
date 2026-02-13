import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import PasswordCode

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        email="auth@example.com",
        password="testpassword",
        first_name="Auth",
        last_name="User",
        role="client",
    )


def _mock_captcha_success(monkeypatch):
    """Helper to mock successful captcha verification."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"success": True}
    mock_resp.raise_for_status = MagicMock()
    monkeypatch.setattr(
        "gym_app.views.userAuth.requests.post", lambda *a, **kw: mock_resp
    )


def _mock_captcha_failure(monkeypatch):
    """Helper to mock failed captcha verification."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"success": False}
    mock_resp.raise_for_status = MagicMock()
    monkeypatch.setattr(
        "gym_app.views.userAuth.requests.post", lambda *a, **kw: mock_resp
    )


def _mock_captcha_exception(monkeypatch):
    """Helper to mock captcha request exception."""
    import requests as req_lib
    monkeypatch.setattr(
        "gym_app.views.userAuth.requests.post",
        MagicMock(side_effect=req_lib.RequestException("timeout")),
    )


# =========================================================================
# sign_on
# =========================================================================
@pytest.mark.django_db
class TestSignOn:
    def test_sign_on_success(self, api_client):
        url = reverse("sign_on")
        data = {
            "email": "newuser@example.com",
            "password": "securepass123",
            "first_name": "New",
            "last_name": "User",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "access" in response.data
        assert "refresh" in response.data
        assert User.objects.filter(email="newuser@example.com").exists()

    def test_sign_on_duplicate_email(self, api_client, user):
        url = reverse("sign_on")
        data = {
            "email": user.email,
            "password": "securepass123",
            "first_name": "Dup",
            "last_name": "User",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "warning" in response.data

    def test_sign_on_invalid_data(self, api_client):
        url = reverse("sign_on")
        data = {"email": "bad"}  # missing password
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_sign_on_default_role_basic(self, api_client):
        url = reverse("sign_on")
        data = {
            "email": "basic@example.com",
            "password": "securepass123",
            "first_name": "Basic",
            "last_name": "User",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        u = User.objects.get(email="basic@example.com")
        assert u.role == "basic"


# =========================================================================
# send_verification_code
# =========================================================================
@pytest.mark.django_db
class TestSendVerificationCode:
    def test_missing_email(self, api_client):
        url = reverse("send_verification_code")
        response = api_client.post(url, {"captcha_token": "tok"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Email is required"

    def test_missing_captcha(self, api_client):
        url = reverse("send_verification_code")
        response = api_client.post(url, {"email": "x@x.com"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Captcha verification is required"

    def test_captcha_failure(self, api_client, monkeypatch):
        _mock_captcha_failure(monkeypatch)
        url = reverse("send_verification_code")
        response = api_client.post(
            url, {"email": "x@x.com", "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Captcha verification failed"

    def test_captcha_exception(self, api_client, monkeypatch):
        _mock_captcha_exception(monkeypatch)
        url = reverse("send_verification_code")
        response = api_client.post(
            url, {"email": "x@x.com", "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data["error"] == "Error verifying captcha"

    def test_email_already_registered(self, api_client, user, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("send_verification_code")
        response = api_client.post(
            url, {"email": user.email, "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_409_CONFLICT

    @patch("gym_app.views.userAuth.send_template_email")
    def test_success(self, mock_email, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("send_verification_code")
        response = api_client.post(
            url,
            {"email": "new@example.com", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "passcode" in response.data
        assert len(response.data["passcode"]) == 6
        mock_email.assert_called_once()


# =========================================================================
# sign_in
# =========================================================================
@pytest.mark.django_db
class TestSignIn:
    def test_missing_credentials(self, api_client):
        url = reverse("sign_in")
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Email and password are required"

    def test_missing_captcha(self, api_client):
        url = reverse("sign_in")
        response = api_client.post(
            url, {"email": "x@x.com", "password": "pass"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Captcha verification is required"

    def test_captcha_failure(self, api_client, monkeypatch):
        _mock_captcha_failure(monkeypatch)
        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": "x@x.com", "password": "pass", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Captcha verification failed"

    def test_captcha_exception(self, api_client, monkeypatch):
        _mock_captcha_exception(monkeypatch)
        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": "x@x.com", "password": "pass", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_user_not_found(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": "nonexistent@x.com", "password": "pass", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_wrong_password(self, api_client, user, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": user.email, "password": "wrongpass", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_success(self, api_client, user, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": user.email, "password": "testpassword", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data


# =========================================================================
# google_login
# =========================================================================
@pytest.mark.django_db
class TestGoogleLogin:
    def test_missing_email(self, api_client):
        url = reverse("google_login")
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_new_user(self, api_client):
        url = reverse("google_login")
        response = api_client.post(
            url,
            {"email": "google@example.com", "given_name": "G", "family_name": "U"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["created"] is True
        assert "access" in response.data
        assert User.objects.filter(email="google@example.com").exists()

    def test_existing_user(self, api_client, user):
        url = reverse("google_login")
        response = api_client.post(
            url, {"email": user.email}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["created"] is False

    def test_create_user_with_picture_error(self, api_client):
        """Profile picture fetch failure should not break user creation."""
        url = reverse("google_login")
        with patch("gym_app.views.userAuth.urlopen", side_effect=Exception("fail")):
            response = api_client.post(
                url,
                {
                    "email": "picfail@example.com",
                    "given_name": "Pic",
                    "family_name": "Fail",
                    "picture": "http://example.com/pic.jpg",
                },
                format="json",
            )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["created"] is True

    def test_create_user_without_picture(self, api_client):
        url = reverse("google_login")
        response = api_client.post(
            url,
            {"email": "nopic@example.com", "given_name": "No", "family_name": "Pic"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        u = User.objects.get(email="nopic@example.com")
        assert u.photo_profile == "" or u.photo_profile is None


# =========================================================================
# update_password
# =========================================================================
@pytest.mark.django_db
class TestUpdatePassword:
    def test_unauthenticated(self, api_client):
        url = reverse("update_password")
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_passwords(self, api_client, user):
        api_client.force_authenticate(user=user)
        url = reverse("update_password")
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_wrong_current_password(self, api_client, user):
        api_client.force_authenticate(user=user)
        url = reverse("update_password")
        response = api_client.post(
            url,
            {"current_password": "wrongpass", "new_password": "newpass123"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Current password is incorrect" in response.data["error"]

    def test_success(self, api_client, user):
        api_client.force_authenticate(user=user)
        url = reverse("update_password")
        response = api_client.post(
            url,
            {"current_password": "testpassword", "new_password": "newpass123"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("newpass123")


# =========================================================================
# send_passcode (password reset)
# =========================================================================
@pytest.mark.django_db
class TestSendPasscode:
    def test_missing_email(self, api_client):
        url = reverse("send_passcode")
        response = api_client.post(url, {"captcha_token": "tok"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_captcha(self, api_client):
        url = reverse("send_passcode")
        response = api_client.post(url, {"email": "x@x.com"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_captcha_failure(self, api_client, monkeypatch):
        _mock_captcha_failure(monkeypatch)
        url = reverse("send_passcode")
        response = api_client.post(
            url, {"email": "x@x.com", "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_captcha_exception(self, api_client, monkeypatch):
        _mock_captcha_exception(monkeypatch)
        url = reverse("send_passcode")
        response = api_client.post(
            url, {"email": "x@x.com", "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_user_not_found(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("send_passcode")
        response = api_client.post(
            url, {"email": "nobody@x.com", "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("gym_app.views.userAuth.send_template_email")
    def test_success(self, mock_email, api_client, user, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("send_passcode")
        response = api_client.post(
            url,
            {
                "email": user.email,
                "captcha_token": "tok",
                "subject_email": "Reset",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert PasswordCode.objects.filter(user=user).exists()
        mock_email.assert_called_once()


# =========================================================================
# verify_passcode_and_reset_password
# =========================================================================
@pytest.mark.django_db
class TestVerifyPasscodeAndResetPassword:
    def test_missing_fields(self, api_client):
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_captcha(self, api_client):
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url, {"passcode": "123456", "new_password": "pw"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_captcha_failure(self, api_client, monkeypatch):
        _mock_captcha_failure(monkeypatch)
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "123456", "new_password": "pw", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_captcha_exception(self, api_client, monkeypatch):
        _mock_captcha_exception(monkeypatch)
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "123456", "new_password": "pw", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_invalid_passcode(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "000000", "new_password": "newpw", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Invalid or expired code"

    def test_success(self, api_client, user, monkeypatch):
        _mock_captcha_success(monkeypatch)
        code = PasswordCode.objects.create(user=user, code="654321")
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "654321", "new_password": "resetpw", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("resetpw")
        code.refresh_from_db()
        assert code.used is True


# =========================================================================
# validate_token
# =========================================================================
@pytest.mark.django_db
class TestValidateToken:
    def test_unauthenticated(self, api_client):
        url = reverse("validate_token")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated(self, api_client, user):
        api_client.force_authenticate(user=user)
        url = reverse("validate_token")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detail"] == "Token is valid"
