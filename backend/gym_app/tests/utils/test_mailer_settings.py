"""Tests for the Django 6.1 mailer configuration."""

from django.conf import settings
from django.core import mail
from gym_project import settings_dev


def test_default_mailer_is_configured():
    """Expose a usable default mailer alias."""
    assert settings.MAILERS["default"]["BACKEND"]
    assert mail.mailers["default"] is not None


def test_development_mailer_uses_console_backend():
    """Keep development email local to the console backend."""
    assert settings_dev.MAILERS["default"] == {
        "BACKEND": "django.core.mail.backends.console.EmailBackend",
        "OPTIONS": {},
    }
