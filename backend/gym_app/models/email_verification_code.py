from django.db import models
from django.core.validators import RegexValidator


class EmailVerificationCode(models.Model):
    """
    Model to store email verification codes for user registration.

    Unlike PasswordCode which is linked to an existing user, this model
    stores codes associated with an email address (pre-registration).

    Attributes:
        email (EmailField): The email address the code was sent to.
        code (CharField): A 6-digit verification code.
        created_at (DateTimeField): Timestamp of when the code was created.
        used (BooleanField): Flag to indicate if the code has been used.
    """
    email = models.EmailField()

    code = models.CharField(
        max_length=6,
        validators=[RegexValidator(regex=r'^\d{6}$', message='Code must be 6 digits', code='invalid_code')]
    )

    created_at = models.DateTimeField(auto_now_add=True)

    used = models.BooleanField(default=False)

    def __str__(self):
        return f"EmailVerificationCode for {self.email} - {'Used' if self.used else 'Active'}"
