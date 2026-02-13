from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator

class PasswordCode(models.Model):
    """
    Model to store password reset codes associated with a user.
    
    Attributes:
        user (ForeignKey): A foreign key linking the code to a user.
        code (CharField): A 6-digit code used for password reset.
        created_at (DateTimeField): Timestamp of when the code was created.
        used (BooleanField): Flag to indicate if the code has been used.
    """
    # Link each password code to a user
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # The reset code, restricted to a maximum length of 6 digits
    code = models.CharField(
        max_length=6,
        validators=[RegexValidator(regex=r'^\d{6}$', message='Code must be 6 digits', code='invalid_code')]
    )
    
    # Timestamp of when the password code was created
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Flag to indicate whether the code has been used
    used = models.BooleanField(default=False)

    def __str__(self):
        """
        String representation of the PasswordCode instance.
        
        Returns:
            str: The user's email and the password reset code.
        """
        return f'{self.user.email} - {self.code}'

    class Meta:
        """
        Meta options for the PasswordCode model.
        
        Attributes:
            ordering (list): Default ordering for querysets.
            verbose_name (str): Human-readable singular name for the model.
            verbose_name_plural (str): Human-readable plural name for the model.
        """
        ordering = ['-created_at']
        verbose_name = 'Password Code'
        verbose_name_plural = 'Password Codes'
