import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import PasswordCode, EmailVerificationCode

User = get_user_model()
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
        "gym_app.utils.captcha.requests.post", lambda *a, **kw: mock_resp
    )


def _mock_captcha_failure(monkeypatch):
    """Helper to mock failed captcha verification."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"success": False}
    mock_resp.raise_for_status = MagicMock()
    monkeypatch.setattr(
        "gym_app.utils.captcha.requests.post", lambda *a, **kw: mock_resp
    )


def _mock_captcha_exception(monkeypatch):
    """Helper to mock captcha request exception."""
    import requests as req_lib
    monkeypatch.setattr(
        "gym_app.utils.captcha.requests.post",
        MagicMock(side_effect=req_lib.RequestException("timeout")),
    )


# =========================================================================
# sign_on
# =========================================================================
@pytest.mark.django_db
class TestSignOn:
    def test_sign_on_success(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="newuser@example.com", code="123456")
        url = reverse("sign_on")
        data = {
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "first_name": "New",
            "last_name": "User",
            "passcode": "123456",
            "captcha_token": "tok",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert "access" in response.data
        assert "refresh" in response.data
        assert User.objects.filter(email="newuser@example.com").exists()
        # Verify verification code was marked as used
        assert EmailVerificationCode.objects.get(email="newuser@example.com").used is True

    def test_sign_on_duplicate_email(self, api_client, user, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("sign_on")
        data = {
            "email": user.email,
            "password": "SecurePass123!",
            "first_name": "Dup",
            "last_name": "User",
            "passcode": "123456",
            "captcha_token": "tok",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "warning" in response.data

    def test_sign_on_invalid_data(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="bad", code="123456")
        url = reverse("sign_on")
        data = {"email": "bad", "passcode": "123456", "captcha_token": "tok"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_sign_on_default_role_basic(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="basic@example.com", code="654321")
        url = reverse("sign_on")
        data = {
            "email": "basic@example.com",
            "password": "SecurePass123!",
            "first_name": "Basic",
            "last_name": "User",
            "passcode": "654321",
            "captcha_token": "tok",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        u = User.objects.get(email="basic@example.com")
        assert u.role == "basic"

    def test_sign_on_missing_captcha(self, api_client):
        url = reverse("sign_on")
        data = {
            "email": "x@x.com",
            "password": "SecurePass123!",
            "passcode": "123456",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Captcha verification is required"

    def test_sign_on_missing_passcode(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("sign_on")
        data = {
            "email": "nopcode@example.com",
            "password": "SecurePass123!",
            "first_name": "No",
            "last_name": "Code",
            "captcha_token": "tok",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Verification code is required"

    def test_sign_on_wrong_passcode(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="wrong@example.com", code="111111")
        url = reverse("sign_on")
        data = {
            "email": "wrong@example.com",
            "password": "SecurePass123!",
            "first_name": "Wrong",
            "last_name": "Code",
            "passcode": "999999",
            "captcha_token": "tok",
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Invalid or expired verification code"


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
        assert "message" in response.data
        assert "passcode" not in response.data
        # Verify code was saved in DB
        assert EmailVerificationCode.objects.filter(email="new@example.com").exists()
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
# T11: sign_in — Google user without usable password (BUG-11)
# =========================================================================
@pytest.mark.django_db
class TestSignInGoogleUser:
    def test_google_user_no_password(self, api_client, monkeypatch):
        """T11: Google-registered user without password gets descriptive error."""
        _mock_captcha_success(monkeypatch)
        # Create a user without a usable password (simulates Google registration)
        google_user = User.objects.create(
            email="google@example.com",
            first_name="Google",
            last_name="User",
            role="basic",
        )
        google_user.set_unusable_password()
        google_user.save()

        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": "google@example.com", "password": "anypassword", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Google" in response.data["error"]
        assert "Forgot Password" in response.data["error"]

    def test_google_user_with_set_password_can_login(self, api_client, monkeypatch):
        """T11: Google user who has set a password via Forgot Password can log in."""
        _mock_captcha_success(monkeypatch)
        google_user = User.objects.create_user(
            email="google2@example.com",
            password="SetViaForgotPw123!",
            first_name="Google",
            last_name="User2",
            role="basic",
        )
        url = reverse("sign_in")
        response = api_client.post(
            url,
            {"email": "google2@example.com", "password": "SetViaForgotPw123!", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data


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
            url, {"passcode": "123456", "new_password": "pw", "email": "x@x.com"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_captcha_failure(self, api_client, monkeypatch):
        _mock_captcha_failure(monkeypatch)
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "123456", "new_password": "pw", "email": "x@x.com", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_captcha_exception(self, api_client, monkeypatch):
        _mock_captcha_exception(monkeypatch)
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "123456", "new_password": "pw", "email": "x@x.com", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_invalid_passcode(self, api_client, monkeypatch):
        _mock_captcha_success(monkeypatch)
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "000000", "new_password": "newpw", "email": "x@x.com", "captcha_token": "tok"},
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
            {"passcode": "654321", "new_password": "SecureReset123!", "email": user.email, "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("SecureReset123!")
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


# =========================================================================
# T1: send_verification_code — email sending failure
# =========================================================================
@pytest.mark.django_db
class TestSendVerificationCodeEmailFailure:
    def test_email_failure_returns_500(self, api_client, monkeypatch):
        """T1: send_verification_code returns 500 when send_template_email raises."""
        _mock_captcha_success(monkeypatch)
        monkeypatch.setattr(
            "gym_app.views.userAuth.send_template_email",
            MagicMock(side_effect=Exception("SMTP error")),
        )
        url = reverse("send_verification_code")
        response = api_client.post(
            url, {"email": "new@test.com", "captcha_token": "tok"}, format="json"
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data["error"] == "Error sending verification email"


# =========================================================================
# T2: send_passcode — email sending failure
# =========================================================================
@pytest.mark.django_db
class TestSendPasscodeEmailFailure:
    def test_email_failure_returns_500(self, api_client, user, monkeypatch):
        """T2: send_passcode returns 500 when send_template_email raises."""
        _mock_captcha_success(monkeypatch)
        monkeypatch.setattr(
            "gym_app.views.userAuth.send_template_email",
            MagicMock(side_effect=Exception("SMTP error")),
        )
        url = reverse("send_passcode")
        response = api_client.post(
            url,
            {"email": user.email, "subject_email": "Reset", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data["error"] == "Error sending verification email"


# =========================================================================
# T3: sign_on — mass assignment prevention
# =========================================================================
@pytest.mark.django_db
class TestSignOnMassAssignment:
    def test_is_staff_ignored(self, api_client, monkeypatch):
        """T3: sign_on ignores is_staff=True in payload."""
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="hacker@evil.com", code="123456")
        url = reverse("sign_on")
        response = api_client.post(
            url,
            {
                "email": "hacker@evil.com",
                "password": "SecurePass123!",
                "first_name": "Hack",
                "last_name": "Er",
                "is_staff": True,
                "is_superuser": True,
                "passcode": "123456",
                "captcha_token": "tok",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        from django.contrib.auth import get_user_model
        created_user = get_user_model().objects.get(email="hacker@evil.com")
        assert created_user.is_staff is False
        assert created_user.is_superuser is False
        assert created_user.is_active is True


# =========================================================================
# T4: sign_on — weak password rejected
# =========================================================================
@pytest.mark.django_db
class TestSignOnWeakPassword:
    def test_short_password_rejected(self, api_client, monkeypatch):
        """T4: sign_on rejects password that is too short."""
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="weak@test.com", code="123456")
        url = reverse("sign_on")
        response = api_client.post(
            url,
            {
                "email": "weak@test.com",
                "password": "1",
                "first_name": "Weak",
                "last_name": "Pass",
                "passcode": "123456",
                "captcha_token": "tok",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data

    def test_common_password_rejected(self, api_client, monkeypatch):
        """T4: sign_on rejects common passwords."""
        _mock_captcha_success(monkeypatch)
        EmailVerificationCode.objects.create(email="common@test.com", code="123456")
        url = reverse("sign_on")
        response = api_client.post(
            url,
            {
                "email": "common@test.com",
                "password": "password",
                "first_name": "Common",
                "last_name": "Pass",
                "passcode": "123456",
                "captcha_token": "tok",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data


# =========================================================================
# T8: verify_passcode_and_reset_password — expired code (>30 min)
# =========================================================================
@pytest.mark.django_db
class TestResetPasswordExpiredCode:
    def test_expired_code_rejected(self, api_client, user, monkeypatch):
        """T8: verify_passcode_and_reset_password rejects codes older than 30 minutes."""
        _mock_captcha_success(monkeypatch)
        code = PasswordCode.objects.create(user=user, code="999888")
        # Manually set created_at to 31 minutes ago
        from django.utils import timezone
        from datetime import timedelta
        PasswordCode.objects.filter(pk=code.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "999888", "new_password": "SecurePass123!", "email": user.email, "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Invalid or expired code"
        # Verify password was NOT changed
        user.refresh_from_db()
        assert user.check_password("testpassword")

    def test_code_within_ttl_accepted(self, api_client, user, monkeypatch):
        """T8: Code within 30 min TTL is accepted."""
        _mock_captcha_success(monkeypatch)
        code = PasswordCode.objects.create(user=user, code="999777")
        # Set created_at to 29 minutes ago (within TTL)
        from django.utils import timezone
        from datetime import timedelta
        PasswordCode.objects.filter(pk=code.pk).update(
            created_at=timezone.now() - timedelta(minutes=29)
        )
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "999777", "new_password": "SecurePass123!", "email": user.email, "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.check_password("SecurePass123!")


# =========================================================================
# T9: verify_passcode_and_reset_password — email mismatch (collision prevention)
# =========================================================================
@pytest.mark.django_db
class TestResetPasswordEmailMismatch:
    def test_wrong_email_rejected(self, api_client, user, monkeypatch):
        """T9: verify_passcode_and_reset_password rejects when email doesn't match code's user."""
        _mock_captcha_success(monkeypatch)
        PasswordCode.objects.create(user=user, code="555666")
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "555666", "new_password": "SecurePass123!", "email": "wrong@example.com", "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["error"] == "Invalid or expired code"
        # Verify password was NOT changed
        user.refresh_from_db()
        assert user.check_password("testpassword")


# =========================================================================
# T5: verify_passcode_and_reset_password — weak password rejected
# =========================================================================
@pytest.mark.django_db
class TestResetPasswordWeakPassword:
    def test_weak_password_rejected(self, api_client, user, monkeypatch):
        """T5: verify_passcode_and_reset_password rejects weak passwords."""
        _mock_captcha_success(monkeypatch)
        code = PasswordCode.objects.create(user=user, code="111111")
        url = reverse("verify_passcode_and_reset_password")
        response = api_client.post(
            url,
            {"passcode": "111111", "new_password": "1", "email": user.email, "captcha_token": "tok"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in response.data
        # Verify password was NOT changed
        user.refresh_from_db()
        assert not user.check_password("1")
        # Verify code was NOT marked as used
        code.refresh_from_db()
        assert code.used is False


# =========================================================================
# T16: verify_captcha utility tests
# =========================================================================
@pytest.mark.django_db
class TestVerifyCaptchaUtility:
    def test_missing_token(self):
        """verify_captcha returns error when token is None."""
        from gym_app.utils.captcha import verify_captcha
        success, error_response = verify_captcha(None, "127.0.0.1")
        assert success is False
        assert error_response.status_code == status.HTTP_400_BAD_REQUEST
        assert error_response.data["error"] == "Captcha verification is required"

    def test_empty_token(self):
        """verify_captcha returns error when token is empty string."""
        from gym_app.utils.captcha import verify_captcha
        success, error_response = verify_captcha("", "127.0.0.1")
        assert success is False
        assert error_response.status_code == status.HTTP_400_BAD_REQUEST

    def test_success(self, monkeypatch):
        """verify_captcha returns (True, None) on success."""
        from gym_app.utils.captcha import verify_captcha
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"success": True}
        mock_resp.raise_for_status = MagicMock()
        monkeypatch.setattr(
            "gym_app.utils.captcha.requests.post", lambda *a, **kw: mock_resp
        )
        success, error_response = verify_captcha("valid_token", "127.0.0.1")
        assert success is True
        assert error_response is None

    def test_google_rejects(self, monkeypatch):
        """verify_captcha returns error when Google rejects token."""
        from gym_app.utils.captcha import verify_captcha
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"success": False}
        mock_resp.raise_for_status = MagicMock()
        monkeypatch.setattr(
            "gym_app.utils.captcha.requests.post", lambda *a, **kw: mock_resp
        )
        success, error_response = verify_captcha("bad_token", "127.0.0.1")
        assert success is False
        assert error_response.status_code == status.HTTP_400_BAD_REQUEST
        assert error_response.data["error"] == "Captcha verification failed"

    def test_timeout(self, monkeypatch):
        """verify_captcha returns 500 on request timeout."""
        import requests as req_lib
        from gym_app.utils.captcha import verify_captcha
        monkeypatch.setattr(
            "gym_app.utils.captcha.requests.post",
            MagicMock(side_effect=req_lib.RequestException("timeout")),
        )
        success, error_response = verify_captcha("tok", "127.0.0.1")
        assert success is False
        assert error_response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert error_response.data["error"] == "Error verifying captcha"
