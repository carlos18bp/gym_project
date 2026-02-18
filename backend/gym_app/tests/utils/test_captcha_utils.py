"""Tests for gym_app.utils.captcha.verify_captcha utility function.

Moved from test_user_auth_views.py (T16) — these test the utility directly,
not a view endpoint.
"""
import pytest
from unittest.mock import MagicMock
from rest_framework import status


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
        from types import SimpleNamespace
        mock_resp = SimpleNamespace(
            json=lambda: {"success": True},
            raise_for_status=lambda: None
        )
        monkeypatch.setattr(
            "gym_app.utils.captcha.requests.post", lambda *a, **kw: mock_resp
        )
        success, error_response = verify_captcha("valid_token", "127.0.0.1")
        assert success is True
        assert error_response is None

    def test_google_rejects(self, monkeypatch):
        """verify_captcha returns error when Google rejects token."""
        from gym_app.utils.captcha import verify_captcha
        from types import SimpleNamespace
        mock_resp = SimpleNamespace(
            json=lambda: {"success": False},
            raise_for_status=lambda: None
        )
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
        mock_post = MagicMock(side_effect=req_lib.RequestException("timeout"))
        monkeypatch.setattr("gym_app.utils.captcha.requests.post", mock_post)
        success, error_response = verify_captcha("tok", "127.0.0.1")
        assert success is False
        assert error_response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert error_response.data["error"] == "Error verifying captcha"
        mock_post.assert_called_once()
