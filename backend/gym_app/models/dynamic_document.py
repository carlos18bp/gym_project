from django.db import models
from django.conf import settings
import uuid
import os

def document_version_path(instance, filename):
    """Generate unique path for document version files"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('document_versions', str(instance.document.id), filename)


class DynamicDocument(models.Model):
    """
    Model representing a dynamic document that can be created, edited, and assigned to users.
    """
    STATE_CHOICES = [
        ('Published', 'Published'),
        ('Draft', 'Draft'),
        ('Progress', 'Progress'),
        ('Completed', 'Completed'),
        ('PendingSignatures', 'Pending Signatures'),
        ('FullySigned', 'Fully Signed'),
    ]

    title = models.CharField(max_length=200, help_text="Title of the dynamic document.")
    content = models.TextField(help_text="Content of the document.")
    state = models.CharField(
        max_length=20,
        choices=STATE_CHOICES,
        default='Draft',
        help_text="State of the document."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_documents",
        on_delete=models.SET_NULL,
        null=True,
        help_text="The user who created the document."
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="assigned_documents",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="The user to whom the document is assigned."
    )
    created_at = models.DateTimeField(auto_now_add=True, help_text="Document creation timestamp.")
    updated_at = models.DateTimeField(auto_now=True, help_text="Document last updated timestamp.")
    requires_signature = models.BooleanField(default=False, help_text="Indicates if this document requires signatures.")
    fully_signed = models.BooleanField(default=False, help_text="Indicates if the document has been signed by all required signers.")

    def __str__(self):
        """
        Returns the string representation of the document, which is its title.
        """
        return self.title

    def check_fully_signed(self):
        """
        Checks if all required signatures have been collected.
        Updates the fully_signed status.
        
        Returns:
            bool: True if all signatures are complete, False otherwise
        """
        if not self.requires_signature:
            return False
            
        # If no signatures are required, it's not considered fully signed
        signature_count = self.signatures.count()
        if signature_count == 0:
            return False
            
        # Check if all signatures have been completed
        pending_signatures = self.signatures.filter(signed=False).exists()
        
        # Update the fully_signed status
        was_fully_signed = self.fully_signed
        self.fully_signed = not pending_signatures
        
        # If status changed, update the document state as well
        if not was_fully_signed and self.fully_signed:
            self.state = 'FullySigned'
            self.save(update_fields=['fully_signed', 'state'])
        elif self.fully_signed != was_fully_signed:
            self.save(update_fields=['fully_signed'])
            
        return self.fully_signed


class DocumentVersion(models.Model):
    """
    Model to store different versions of a document including original and signed versions.
    """
    VERSION_TYPES = [
        ('original', 'Original Document'),
        ('signed', 'Signed Version'),
    ]
    
    document = models.ForeignKey(
        DynamicDocument,
        on_delete=models.CASCADE,
        related_name='versions',
        help_text="The document this version belongs to"
    )
    version_type = models.CharField(
        max_length=20,
        choices=VERSION_TYPES,
        default='original',
        help_text="Type of document version"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this version was created"
    )
    file = models.FileField(
        upload_to=document_version_path,
        help_text="The document file in PDF or Word format"
    )
    content_type = models.CharField(
        max_length=100,
        help_text="The MIME type of the file"
    )
    version_number = models.PositiveIntegerField(
        default=1,
        help_text="Version number, incremented with each signature"
    )
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='signed_document_versions',
        help_text="The user who added their signature in this version"
    )
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ('document', 'version_number', 'version_type')
        
    def __str__(self):
        signer_info = f" (signed by {self.signed_by.email})" if self.signed_by else ""
        return f"{self.document.title} - {self.get_version_type_display()} v{self.version_number}{signer_info}"
    
    def filename(self):
        """Returns a filename for this version when downloading"""
        doc_title = self.document.title.replace(' ', '_')
        version_type = "original" if self.version_type == 'original' else "signed"
        return f"{doc_title}_{version_type}_v{self.version_number}.{self.file.name.split('.')[-1]}"


class DocumentVariable(models.Model):
    """
    Model representing a variable within a dynamic document.
    """
    FIELD_TYPE_CHOICES = [
        ('input', 'Input'),
        ('text_area', 'Text Area'),
    ]

    document = models.ForeignKey(
        DynamicDocument,
        related_name='variables',
        on_delete=models.CASCADE,
        help_text="The dynamic document this variable belongs to."
    )
    name_en = models.CharField(
        max_length=100,
        help_text="Variable name in English.",
        null=True,
        blank=True
    )

    name_es = models.CharField(
        max_length=100,
        help_text="Display name in Spanish.",
        null=True,
        blank=True
    )

    tooltip = models.CharField(
        max_length=200,
        help_text="Display a tooltip message.",
        null=True,
        blank=True
    )
    field_type = models.CharField(
        max_length=20,
        choices=FIELD_TYPE_CHOICES,
        default='input',
        help_text="Field type for the variable."
    )
    value = models.TextField(blank=True, null=True, help_text="Value filled by the user.")

    def __str__(self):
        """
        Returns the string representation of the variable, which is its English name.
        """
        return self.name_en


class RecentDocument(models.Model):
    """
    Model for tracking recently viewed documents by users.
    
    This model maintains a history of which documents a user has viewed recently,
    allowing the system to display a personalized list of recently accessed documents.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
                           help_text="The user who viewed the document.")
    document = models.ForeignKey(DynamicDocument, on_delete=models.CASCADE,
                               help_text="The document that was viewed.")
    last_visited = models.DateTimeField(auto_now=True, 
                                      help_text="Timestamp of when the document was last viewed.")
    
    class Meta:
        unique_together = ('user', 'document')
        ordering = ['-last_visited']
    
    def __str__(self):
        """
        Returns a string representation of the recent document record.
        """
        return f"{self.user.email} - {self.document.title} - {self.last_visited}"


class DocumentSignature(models.Model):
    """
    Model to track signatures required for a document and their status.
    """
    document = models.ForeignKey(
        DynamicDocument, 
        on_delete=models.CASCADE, 
        related_name='signatures',
        help_text="The document that requires signature"
    )
    signer = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='pending_signatures',
        help_text="The user who needs to sign the document"
    )
    signed = models.BooleanField(
        default=False,
        help_text="Whether the document has been signed by this user"
    )
    signed_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When the document was signed"
    )
    ip_address = models.GenericIPAddressField(
        null=True, 
        blank=True, 
        help_text="IP address from which the signature was submitted"
    )
    signature_position = models.PositiveIntegerField(
        default=0,
        help_text="Position in the signing sequence (0 means no specific order)"
    )
    
    class Meta:
        unique_together = ('document', 'signer')
        ordering = ['signature_position', 'signer__email']
    
    def __str__(self):
        status = "Signed" if self.signed else "Pending"
        return f"{self.document.title} - {self.signer.email} ({status})"

    def save(self, *args, **kwargs):
        """Override save to check document signature status after signature changes"""
        super().save(*args, **kwargs)
        # Check if the document is now fully signed
        self.document.check_fully_signed()
