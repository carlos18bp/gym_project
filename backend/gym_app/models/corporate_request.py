from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone
import os

class CorporateRequestType(models.Model):
    """
    Model representing a type of corporate request.
    """
    name = models.CharField(max_length=100, unique=True, help_text="The name of the corporate request type.")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Tipo de Solicitud Corporativa"
        verbose_name_plural = "Tipos de Solicitudes Corporativas"

class CorporateRequestFiles(models.Model):
    """
    Model representing files associated with a corporate request.
    """
    file = models.FileField(upload_to='corporate_request_files/', help_text="The file associated with the corporate request.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the file was uploaded.")

    def __str__(self):
        return os.path.basename(self.file.name)

    class Meta:
        verbose_name = "Archivo de Solicitud Corporativa"
        verbose_name_plural = "Archivos de Solicitudes Corporativas"

# Signal to delete the physical file when the CorporateRequestFiles object is deleted
@receiver(post_delete, sender=CorporateRequestFiles)
def delete_corporate_request_file(sender, instance, **kwargs):
    """
    Deletes the file from the file system when the CorporateRequestFiles object is deleted.
    """
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)

class CorporateRequest(models.Model):
    """
    Model representing a corporate request from normal client to corporate client.
    Normal clients send requests and corporate clients receive and manage them.
    """
    # Status choices for corporate requests
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('IN_REVIEW', 'En Revisión'),
        ('RESPONDED', 'Respondida'),
        ('RESOLVED', 'Resuelta'),
        ('CLOSED', 'Cerrada'),
    ]
    
    # Priority choices
    PRIORITY_CHOICES = [
        ('LOW', 'Baja'),
        ('MEDIUM', 'Media'),
        ('HIGH', 'Alta'),
        ('URGENT', 'Urgente'),
    ]
    
    # Client who sends the request (must be 'client' role)
    client = models.ForeignKey(
        'User', 
        on_delete=models.CASCADE,
        related_name='sent_corporate_requests',
        limit_choices_to={'role': 'client'},
        help_text="The normal client who created this corporate request"
    )
    
    # Organization context for the request
    organization = models.ForeignKey(
        'Organization',
        on_delete=models.CASCADE,
        related_name='corporate_requests',
        null=True,
        blank=True,
        help_text="Organization through which this request is made"
    )
    
    # Corporate client who receives the request (derived from organization)
    corporate_client = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='received_corporate_requests',
        limit_choices_to={'role': 'corporate_client'},
        help_text="The corporate client who will handle this request (should be organization leader)"
    )
    
    # Request details
    request_type = models.ForeignKey(
        CorporateRequestType, 
        on_delete=models.CASCADE, 
        help_text="The type of the corporate request."
    )
    title = models.CharField(
        max_length=200, 
        help_text="Brief title/subject of the request"
    )
    description = models.TextField(
        help_text="A detailed description of the request."
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='MEDIUM',
        help_text="Priority level of the request"
    )
    
    # File attachments
    files = models.ManyToManyField(
        CorporateRequestFiles, 
        blank=True, 
        help_text="Files associated with the corporate request."
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True, 
        help_text="The date the request was created."
    )
    
    # Management fields
    request_number = models.CharField(
        max_length=20, 
        unique=True, 
        blank=True,
        null=True,
        help_text="Unique identifier for the corporate request (e.g., CORP-2024-001)"
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='PENDING',
        help_text="Current status of the corporate request"
    )
    status_updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the status was last updated"
    )
    
    # Assignment and handling
    assigned_to = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_corporate_requests',
        help_text="User from corporate client assigned to handle this request"
    )
    estimated_completion_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Estimated date for request completion"
    )
    actual_completion_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Actual date when request was completed"
    )

    def clean(self):
        """Validate corporate request constraints"""
        from django.core.exceptions import ValidationError
        
        # Ensure client is a member of the organization
        if self.client and self.organization:
            from .organization import OrganizationMembership
            is_member = OrganizationMembership.objects.filter(
                organization=self.organization,
                user=self.client,
                is_active=True
            ).exists()
            if not is_member:
                raise ValidationError('El cliente debe ser miembro de la organización')
        
        # Ensure corporate_client is the leader of the organization
        if self.organization and self.corporate_client:
            if self.organization.corporate_client != self.corporate_client:
                raise ValidationError('El cliente corporativo debe ser el líder de la organización')

    def save(self, *args, **kwargs):
        """
        Override save method to auto-generate request_number and set corporate_client.
        """
        # Auto-set corporate_client from organization
        if self.organization and not self.corporate_client_id:
            self.corporate_client = self.organization.corporate_client
        
        if not self.request_number:
            self.request_number = self._generate_request_number()
        
        # Run validations
        self.clean()
        
        super().save(*args, **kwargs)

    def _generate_request_number(self):
        """
        Generate a unique request number in format: CORP-YYYY-NNN
        """
        current_year = timezone.now().year
        
        # Get the last request number for the current year
        last_request = CorporateRequest.objects.filter(
            request_number__startswith=f'CORP-{current_year}-'
        ).order_by('request_number').last()
        
        if last_request:
            # Extract the sequence number and increment
            last_sequence = int(last_request.request_number.split('-')[-1])
            new_sequence = last_sequence + 1
        else:
            # First request of the year
            new_sequence = 1
        
        # Format: CORP-2024-001
        return f'CORP-{current_year}-{new_sequence:03d}'

    def __str__(self):
        return f"{self.request_number} - {self.title} ({self.client.email} → {self.corporate_client.email})"

    class Meta:
        verbose_name = "Solicitud Corporativa"
        verbose_name_plural = "Solicitudes Corporativas"
        ordering = ['-created_at']


class CorporateRequestResponse(models.Model):
    """
    Model representing responses to corporate requests.
    Both corporate clients and normal clients can create responses to maintain a conversation thread.
    """
    USER_TYPE_CHOICES = [
        ('corporate_client', 'Cliente Corporativo'),
        ('client', 'Cliente Normal'),
    ]
    
    corporate_request = models.ForeignKey(
        CorporateRequest, 
        on_delete=models.CASCADE, 
        related_name='responses',
        help_text="The corporate request this response belongs to"
    )
    response_text = models.TextField(
        help_text="The response message content"
    )
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        help_text="The user who created this response"
    )
    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        help_text="Type of user who created the response"
    )
    is_internal_note = models.BooleanField(
        default=False,
        help_text="If true, this response is only visible to corporate client staff"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the response was created"
    )
    
    # File attachments for responses
    response_files = models.ManyToManyField(
        CorporateRequestFiles,
        blank=True,
        related_name='response_files',
        help_text="Files attached to this response"
    )
    
    class Meta:
        ordering = ['created_at']  # Order responses chronologically
        verbose_name = "Respuesta de Solicitud Corporativa"
        verbose_name_plural = "Respuestas de Solicitudes Corporativas"
        
    def __str__(self):
        return f"{self.corporate_request.request_number} - {self.user_type} response"
