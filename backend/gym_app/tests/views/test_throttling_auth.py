"""Rate-limit regression tests for authentication endpoints.

These tests verify that anonymous brute-force attempts hit DRF throttling.
The auto-applied `reset_throttle_cache` fixture (from conftest.py) gives each
test a clean cache, so rates here reflect a single attacker.
"""
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status


@pytest.mark.django_db
class TestAuthThrottling:
    """LoginRateThrottle / PasscodeRateThrottle / SignupRateThrottle enforcement."""

    def _hammer(self, api_client, url, payload, n):
        """Send the same request n times and return the list of status codes."""
        return [api_client.post(url, data=payload, format="json").status_code for _ in range(n)]

    def test_sign_in_throttles_after_10_per_minute(self, api_client, settings):
        """Sign in throttles after 10 per minute."""
        # Force the configured rate even if a runner overrode it.
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
                "auth_login": "10/min",
            },
        }
        url = reverse("sign_in")
        # Bad credentials so we don't hit the captcha path / DB writes.
        payload = {"email": "nobody@example.com", "password": "wrong", "captcha_token": "x"}

        # Bypass captcha verification so we exercise the throttle, not captcha.
        with patch("gym_app.views.userAuth.verify_captcha", return_value=(True, None)):
            codes = self._hammer(api_client, url, payload, 12)

        assert codes[:10].count(status.HTTP_429_TOO_MANY_REQUESTS) == 0
        assert status.HTTP_429_TOO_MANY_REQUESTS in codes[10:]

    def test_send_passcode_throttles_after_5_per_minute(self, api_client, settings):
        """Send passcode throttles after 5 per minute."""
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
                "auth_passcode": "5/min",
            },
        }
        url = reverse("send_passcode")
        payload = {"email": "nobody@example.com", "captcha_token": "x"}

        with patch("gym_app.views.userAuth.verify_captcha", return_value=(True, None)):
            codes = self._hammer(api_client, url, payload, 7)

        assert codes[:5].count(status.HTTP_429_TOO_MANY_REQUESTS) == 0
        assert status.HTTP_429_TOO_MANY_REQUESTS in codes[5:]

    def test_send_verification_code_throttles_after_5_per_minute(
        self, api_client, settings
    ):
        """Send verification code throttles after 5 per minute."""
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
                "auth_signup": "5/min",
            },
        }
        url = reverse("send_verification_code")
        payload = {"email": "nobody@example.com", "captcha_token": "x"}

        with patch("gym_app.views.userAuth.verify_captcha", return_value=(True, None)):
            codes = self._hammer(api_client, url, payload, 7)

        assert codes[:5].count(status.HTTP_429_TOO_MANY_REQUESTS) == 0
        assert status.HTTP_429_TOO_MANY_REQUESTS in codes[5:]
