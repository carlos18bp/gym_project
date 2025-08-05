from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid
import os
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator

def document_version_path(instance, filename):
    """Generate unique path for document version files"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('document_versions', str(instance.document.id), filename)

def letterhead_image_path(instance, filename):
    """Generate unique path for letterhead images"""
    ext = filename.split('.')[-1].lower()
    filename = f"letterhead_{uuid.uuid4().hex}.{ext}"
    return os.path.join('letterheads', str(instance.id), filename)


class Tag(models.Model):
    """
    Model representing a tag that lawyers can assign to document templates (formats).
    """
    name = models.CharField(
        max_length=50,
        unique=True,
        help_text="Nombre de la etiqueta."
    )
    color_id = models.PositiveSmallIntegerField(
        default=0,
        help_text="Identificador del color predefinido en el frontend."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tags",
        help_text="Abogado que creó la etiqueta."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha de creación de la etiqueta."
    )

    class Meta:
        verbose_name = "Etiqueta"
        verbose_name_plural = "Etiquetas"
        ordering = ["name"]

    def __str__(self):
        """Return the tag name."""
        return self.name


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
    # NEW FIELD – manual tags assigned by lawyers
    tags = models.ManyToManyField(
        'Tag',
        related_name='documents',
        blank=True,
        help_text="Etiquetas asignadas al documento."
    )
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
    is_public = models.BooleanField(
        default=False, 
        help_text="If True, all users can view and use this document without explicit permissions."
    )
    letterhead_image = models.ImageField(
        upload_to=letterhead_image_path,
        null=True,
        blank=True,
        help_text="Imagen PNG para membrete que se mostrará como fondo centrado en cada página del documento. Recomendado: 612x792 píxeles para tamaño oficio."
    )

    def __str__(self):
        """
        Returns the string representation of the document, which is its title.
        """
        return self.title

    def is_lawyer(self, user):
        """
        Check if user is a lawyer (has full access to all documents).
        
        Args:
            user: User instance to check
            
        Returns:
            bool: True if user is a lawyer, False otherwise
        """
        return user.role == 'lawyer' or user.is_gym_lawyer

    def can_view(self, user):
        """
        Check if user has visibility permissions for this document.
        
        Lawyers always have access. Public documents are accessible to all users.
        For other users, check visibility permissions.
        
        Args:
            user: User instance to check
            
        Returns:
            bool: True if user can view the document, False otherwise
        """
        # Lawyers always have access
        if self.is_lawyer(user):
            return True
            
        # Document creator always has access
        if self.created_by == user:
            return True
            
        # Public documents are accessible to all authenticated users
        if self.is_public:
            return True
            
        # Check if user has explicit visibility permission
        return self.visibility_permissions.filter(user=user).exists()

    def can_use(self, user):
        """
        Check if user has usability permissions for this document.
        
        Lawyers always have access. Public documents grant edit access to all users.
        For other users, check usability permissions.
        
        Args:
            user: User instance to check
            
        Returns:
            bool: True if user can use the document, False otherwise
        """
        # Lawyers always have access
        if self.is_lawyer(user):
            return True
            
        # Document creator always has access
        if self.created_by == user:
            return True
            
        # Public documents grant edit access to all authenticated users
        if self.is_public:
            return True
            
        # Check if user has explicit usability permission
        return self.usability_permissions.filter(user=user).exists()

    def get_user_permission_level(self, user):
        """
        Get the permission level for a specific user.
        
        Args:
            user: User instance to check
            
        Returns:
            str: Permission level ('owner', 'lawyer', 'public_access', 'usability', 'view_only', None)
        """
        # Lawyers have full access
        if self.is_lawyer(user):
            return 'lawyer'
            
        # Document creator is owner
        if self.created_by == user:
            return 'owner'
        
        # Check usability permissions (explicit permissions take precedence over public access)
        if self.usability_permissions.filter(user=user).exists():
            return 'usability'
        
        # Check visibility permissions (explicit permissions take precedence over public access)
        if self.visibility_permissions.filter(user=user).exists():
            return 'view_only'
        
        # Public documents grant usability access to all authenticated users
        if self.is_public:
            return 'public_access'
        
        return None

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

    def delete(self, *args, **kwargs):
        """
        Custom delete method to ensure proper cleanup when a document is deleted.
        
        When a document is deleted:
        - Removes the document from all folders (this happens automatically with M2M relationships)
        - Can add additional cleanup logic here if needed
        """
        # Get folder count before deletion for logging purposes
        folder_count = self.folders.count()
        
        # Django automatically handles M2M relationship cleanup, but we can log it
        if folder_count > 0:
            # Optional: Add logging here if you want to track when documents are removed from folders
            # Example: logger.info(f"Document '{self.title}' removed from {folder_count} folder(s)")
            pass
        
        # Call the parent delete method
        super().delete(*args, **kwargs)


class DocumentVisibilityPermission(models.Model):
    """
    Model to manage which users can VIEW a specific document.
    
    Lawyers automatically have visibility to all documents and don't need explicit permissions.
    This model is used to grant visibility permissions to clients.
    """
    document = models.ForeignKey(
        DynamicDocument,
        on_delete=models.CASCADE,
        related_name='visibility_permissions',
        help_text="The document this permission applies to"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        help_text="The user who can view the document"
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='granted_visibility_permissions',
        help_text="The lawyer who granted this permission"
    )
    granted_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this permission was granted"
    )

    class Meta:
        unique_together = ('document', 'user')
        verbose_name = "Document Visibility Permission"
        verbose_name_plural = "Document Visibility Permissions"
        ordering = ['-granted_at']

    def __str__(self):
        return f"{self.user.email} can view '{self.document.title}'"


class DocumentUsabilityPermission(models.Model):
    """
    Model to manage which users can USE/EDIT a specific document.
    
    Users can only have usability permissions if they already have visibility permissions.
    Lawyers automatically have usability access to all documents.
    """
    document = models.ForeignKey(
        DynamicDocument,
        on_delete=models.CASCADE,
        related_name='usability_permissions',
        help_text="The document this permission applies to"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        help_text="The user who can use the document"
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='granted_usability_permissions',
        help_text="The lawyer who granted this permission"
    )
    granted_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this permission was granted"
    )

    class Meta:
        unique_together = ('document', 'user')
        verbose_name = "Document Usability Permission"
        verbose_name_plural = "Document Usability Permissions"
        ordering = ['-granted_at']

    def __str__(self):
        return f"{self.user.email} can use '{self.document.title}'"

    def clean(self):
        """
        Validate that user has visibility permission before granting usability permission.
        """
        # Skip validation for lawyers as they have automatic access
        if self.user.role == 'lawyer' or self.user.is_gym_lawyer:
            return

        # Check if user has visibility permission
        if not self.document.visibility_permissions.filter(user=self.user).exists():
            raise ValidationError(
                "User must have visibility permission before granting usability permission."
            )

    def save(self, *args, **kwargs):
        """
        Validate before saving.
        """
        self.clean()
        super().save(*args, **kwargs)


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
    created_at = models.DateTimeField(
        default=timezone.now,
        help_text="When the signature record was created"
    )
    
    class Meta:
        unique_together = ('document', 'signer')
        ordering = ['signer__email']
    
    def __str__(self):
        status = "Signed" if self.signed else "Pending"
        return f"{self.document.title} - {self.signer.email} ({status})"

    def save(self, *args, **kwargs):
        """Override save to check document signature status after signature changes"""
        super().save(*args, **kwargs)
        # Check if the document is now fully signed
        self.document.check_fully_signed()


class DocumentVariable(models.Model):
    """
    Model representing a variable within a dynamic document.
    """
    FIELD_TYPE_CHOICES = [
        ('input', 'Input'),
        ('text_area', 'Text Area'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('email', 'Email'),
        ('select', 'Select'),
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
    select_options = models.JSONField(
        null=True,
        blank=True,
        help_text="Options for select type fields."
    )
    value = models.TextField(blank=True, null=True, help_text="Value filled by the user.")

    def clean(self):
        """
        Validate the field value based on its type.
        """
        if self.value:
            if self.field_type == 'number':
                try:
                    float(self.value)
                except ValueError:
                    raise ValidationError({'value': 'El valor debe ser un número válido.'})
            elif self.field_type == 'date':
                try:
                    from datetime import datetime
                    datetime.strptime(self.value, '%Y-%m-%d')
                except ValueError:
                    raise ValidationError({'value': 'El valor debe ser una fecha válida en formato YYYY-MM-DD.'})
            elif self.field_type == 'email':
                validator = EmailValidator()
                try:
                    validator(self.value)
                except ValidationError:
                    raise ValidationError({'value': 'El valor debe ser un correo electrónico válido.'})

    def save(self, *args, **kwargs):
        """
        Clean and validate the data before saving.
        """
        self.clean()
        super().save(*args, **kwargs)

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


class DocumentFolder(models.Model):
    """
    Model representing a manual folder created by a client to organise documents or templates.
    """
    name = models.CharField(
        max_length=100,
        help_text="Nombre de la carpeta."
    )
    color_id = models.PositiveSmallIntegerField(
        default=0,
        help_text="Identificador del color predefinido en el frontend."
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='folders',
        help_text="Cliente propietario de la carpeta."
    )
    documents = models.ManyToManyField(
        'DynamicDocument',
        related_name='folders',
        blank=True,
        help_text="Documentos incluidos en la carpeta."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha de creación de la carpeta."
    )

    class Meta:
        verbose_name = "Carpeta de documentos"
        verbose_name_plural = "Carpetas de documentos"
        ordering = ['-created_at']

    def __str__(self):
        """Return folder name and owner email."""
        return f"{self.name} ({self.owner.email})"
