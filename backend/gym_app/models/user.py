from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    """
    Custom user manager to handle user creation with email as the unique identifier.
    """
    def create_user(self, email, password=None, **extra_fields):
        """
        Creates and returns a regular user with the given email and password.

        Args:
            email (str): The email of the user.
            password (str, optional): The password for the user. Defaults to None.
            **extra_fields: Additional fields for the user model.

        Raises:
            ValueError: If the email is not provided.

        Returns:
            User: The created user instance.
        """
        if not email:
            raise ValueError('The email must be defined')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Creates and returns a superuser with the given email and password.

        Args:
            email (str): The email of the superuser.
            password (str, optional): The password for the superuser. Defaults to None.
            **extra_fields: Additional fields for the superuser model.

        Raises:
            ValueError: If is_staff or is_superuser is not set to True.

        Returns:
            User: The created superuser instance.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user model extending AbstractUser. Uses email as the unique identifier instead of username.

    Attributes:
        email (EmailField): The unique email of the user.
        first_name (CharField): The first name of the user (optional).
        last_name (CharField): The last name of the user (optional).
        contact (CharField): The contact number of the user (optional).
        birthday (DateField): The birth date of the user (optional).
        identification (CharField): The identification number of the user (optional).
        marital_status (CharField): The marital status of the user (optional).
        role (CharField): The role of the user within the system (default: 'client').
        photo_profile (ImageField): The profile picture of the user (optional).
        created_at (DateTimeField): The date the user was created.
    """
    # Remove the username, groups, and user_permissions fields
    username = None
    groups = None
    user_permissions = None

    # Use email as the unique identifier (email is required)
    email = models.EmailField(unique=True)

    # Optional fields
    first_name = models.CharField(max_length=60, blank=True, null=True)
    last_name = models.CharField(max_length=60, blank=True, null=True)
    contact = models.CharField(max_length=15, blank=True, null=True, help_text="The contact number of the user.")
    birthday = models.DateField(blank=True, null=True, help_text="The birth date of the user.")
    identification = models.CharField(max_length=20, blank=True, null=True, help_text="The identification number of the user.")
    marital_status = models.CharField(max_length=20, blank=True, null=True, help_text="The marital status of the user (e.g., single, married).")
    role = models.CharField(max_length=50, blank=True, null=True, default='client', help_text="The role of the user within the system (default: 'client').")
    photo_profile = models.ImageField(upload_to='profile_photos/', null=True, blank=True, help_text="The profile picture of the user.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the user was created.")
    is_gym_lawyer = models.BooleanField(default=False, help_text="Indicates if the user is a GYM lawyer.")
    is_profile_completed = models.BooleanField(default=False, help_text="Indicates if the user's profile is completed.")


    # Set email as the username field and define required fields
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    # Use the custom user manager
    objects = UserManager()

    def __str__(self):
        """
        String representation of the User instance.

        Returns:
            str: The email of the user.
        """
        return f"{self.email} ({self.last_name} {self.first_name})"
