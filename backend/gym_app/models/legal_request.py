from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone
import os

class LegalRequestType(models.Model):
    """
    Model representing a type of legal request.
    """
    name = models.CharField(max_length=100, unique=True, help_text="The name of the legal request type.")

    def __str__(self):
        return self.name

class LegalDiscipline(models.Model):
    """
    Model representing a legal discipline.
    """
    name = models.CharField(max_length=100, unique=True, help_text="The name of the legal discipline.")

    def __str__(self):
        return self.name

class LegalRequestFiles(models.Model):
    """
    Model representing files associated with a legal request.
    """
    file = models.FileField(upload_to='legal_request_files/', help_text="The file associated with the legal request.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the file was uploaded.")

    def __str__(self):
        return os.path.basename(self.file.name)

# Signal to delete the physical file when the LegalRequestFiles object is deleted
@receiver(post_delete, sender=LegalRequestFiles)
def delete_legal_request_file(sender, instance, **kwargs):
    """
    Deletes the file from the file system when the LegalRequestFiles object is deleted.
    """
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)

class LegalRequest(models.Model):
    """
    Model representing a legal request with user details, request type, discipline, description, and associated files.
    """
    # Status choices for legal requests
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('IN_REVIEW', 'En Revisión'),
        ('RESPONDED', 'Respondida'),
        ('CLOSED', 'Cerrada'),
    ]
    
    # User reference - the user who created this legal request
    user = models.ForeignKey(
        'User', 
        on_delete=models.CASCADE, 
        help_text="The user who created this legal request"
    )
    request_type = models.ForeignKey(LegalRequestType, on_delete=models.CASCADE, help_text="The type of the legal request.")
    discipline = models.ForeignKey(LegalDiscipline, on_delete=models.CASCADE, help_text="The legal discipline for the request.")
    description = models.TextField(help_text="A detailed description of the request.")
    files = models.ManyToManyField(LegalRequestFiles, blank=True, help_text="Files associated with the legal request.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the request was created.")
    
    # New fields for management system
    request_number = models.CharField(
        max_length=20, 
        unique=True, 
        blank=True,
        null=True,
        help_text="Unique identifier for the legal request (e.g., SOL-2024-001)"
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='PENDING',
        help_text="Current status of the legal request"
    )
    status_updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the status was last updated"
    )

    def save(self, *args, **kwargs):
        """
        Override save method to auto-generate request_number if not provided.
        """
        if not self.request_number:
            self.request_number = self._generate_request_number()
        super().save(*args, **kwargs)

    def _generate_request_number(self):
        """
        Generate a unique request number in format: SOL-YYYY-NNN
        """
        current_year = timezone.now().year
        
        # Get the last request number for the current year
        last_request = LegalRequest.objects.filter(
            request_number__startswith=f'SOL-{current_year}-'
        ).order_by('request_number').last()
        
        if last_request:
            # Extract the sequence number and increment
            last_sequence = int(last_request.request_number.split('-')[-1])
            new_sequence = last_sequence + 1
        else:
            # First request of the year
            new_sequence = 1
        
        # Format: SOL-2024-001
        return f'SOL-{current_year}-{new_sequence:03d}'

    def __str__(self):
        if self.user:
            return f"{self.request_number} - {self.user.first_name} {self.user.last_name}"
        return f"{self.request_number}"


class LegalRequestResponse(models.Model):
    """
    Model representing responses to legal requests.
    Both lawyers and clients can create responses to maintain a conversation thread.
    """
    USER_TYPE_CHOICES = [
        ('lawyer', 'Abogado'),
        ('client', 'Cliente'),
    ]
    
    legal_request = models.ForeignKey(
        LegalRequest, 
        on_delete=models.CASCADE, 
        related_name='responses',
        help_text="The legal request this response belongs to"
    )
    response_text = models.TextField(help_text="The response message content")
    user = models.ForeignKey(
        'User',  # Reference to your User model
        on_delete=models.CASCADE,
        help_text="The user who created this response"
    )
    user_type = models.CharField(
        max_length=10,
        choices=USER_TYPE_CHOICES,
        help_text="Type of user who created the response"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the response was created"
    )
    
    class Meta:
        ordering = ['created_at']  # Order responses chronologically
        
    def __str__(self):
        return f"{self.legal_request.request_number} - {self.user_type} response"
