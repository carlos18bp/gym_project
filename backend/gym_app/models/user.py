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
        document_type (CharField): The type of document (e.g., NIT, CC).
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

    # New field: document_type
    DOCUMENT_TYPE_CHOICES = [
        ('NIT', 'NIT'),
        ('CC', 'CC'),
        ('NUIP', 'NUIP'),
        ('EIN', 'EIN'),
    ]
    document_type = models.CharField(max_length=10, choices=DOCUMENT_TYPE_CHOICES, blank=True, null=True, help_text="The type of identification document.")

    # Updated field: role
    ROLE_CHOICES = [
        ('client', 'Client'),
        ('lawyer', 'Lawyer'),
        ('corporate_client', 'Corporate Client'),
        ('basic', 'Basic'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='client', help_text="The role of the user within the system (default: 'client').")

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


class UserSignature(models.Model):
    """
    Model to store electronic signatures for users.
    
    A user can have only one signature. The signature can be either uploaded or drawn.
    
    Attributes:
        user (ForeignKey): The user who owns this signature.
        signature_image (ImageField): The image of the electronic signature.
        method (CharField): The method used to create the signature (upload or draw).
        created_at (DateTimeField): When the signature was created.
        ip_address (GenericIPAddressField): The IP address from which the signature was submitted.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='signature')
    
    signature_image = models.ImageField(upload_to='signatures/', help_text="The image of the electronic signature.")
    
    METHOD_CHOICES = [
        ('upload', 'Upload'),
        ('draw', 'Draw'),
    ]
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, help_text="Method used to create the signature.")
    
    created_at = models.DateTimeField(auto_now_add=True, help_text="When the signature was created.")
    ip_address = models.GenericIPAddressField(null=True, blank=True, help_text="IP address from which the signature was submitted.")
    
    def __str__(self):
        """String representation of the signature."""
        return f"Signature for {self.user.email} ({self.method})"


class ActivityFeed(models.Model):
    """
    Activity Feed model to track user actions.
    
    Maintains a maximum of 20 entries per user, with the oldest entry being deleted
    when a new one is added beyond the limit.
    
    Attributes:
        user (ForeignKey): The user who performed the action.
        action_type (CharField): The type of action (create, edit, finish, etc).
        description (TextField): Description of the action that was performed.
        created_at (DateTimeField): When the action was performed.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    
    ACTION_TYPE_CHOICES = [
        ('create', 'Create'),
        ('edit', 'Edit'),
        ('finish', 'Finish'),
        ('delete', 'Delete'),
        ('update', 'Update'),
        ('other', 'Other'),
    ]
    action_type = models.CharField(max_length=10, choices=ACTION_TYPE_CHOICES, default='other')
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Activity'
        verbose_name_plural = 'Activities'
    
    def __str__(self):
        """String representation of an activity."""
        return f"{self.user.email} - {self.action_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
    
    def save(self, *args, **kwargs):
        """
        Override save method to maintain a maximum of 20 activity entries per user.
        When a new entry is added beyond the limit, the oldest one is deleted.
        """
        super().save(*args, **kwargs)
        
        # Check if this user has more than 20 activities
        activities_count = ActivityFeed.objects.filter(user=self.user).count()
        if activities_count > 20:
            # Get the oldest activity and delete it
            oldest_activity = ActivityFeed.objects.filter(user=self.user).order_by('created_at').first()
            if oldest_activity:
                oldest_activity.delete()

