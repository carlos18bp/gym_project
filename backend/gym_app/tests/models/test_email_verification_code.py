import pytest

from gym_app.models import EmailVerificationCode


@pytest.mark.django_db
class TestEmailVerificationCode:
    """Tests for EmailVerificationCode model behavior."""

    def test_str_reflects_used_status(self):
        """Ensure __str__ reflects whether the code is active or used."""
        code = EmailVerificationCode.objects.create(
            email="verify@example.com",
            code="123456",
        )

        assert str(code) == "EmailVerificationCode for verify@example.com - Active"

        code.used = True
        code.save(update_fields=["used"])

        assert str(code) == "EmailVerificationCode for verify@example.com - Used"
