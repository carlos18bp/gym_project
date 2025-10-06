from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.core.exceptions import ValidationError
import os
import uuid

def organization_profile_image_path(instance, filename):
    """Generate upload path for organization profile images"""
    ext = filename.split('.')[-1]
    filename = f"organization_{instance.id}_profile.{ext}"
    return os.path.join('organization_images/profiles/', filename)

def organization_cover_image_path(instance, filename):
    """Generate upload path for organization cover images"""
    ext = filename.split('.')[-1]
    filename = f"organization_{instance.id}_cover.{ext}"
    return os.path.join('organization_images/covers/', filename)

class Organization(models.Model):
    """
    Model representing an organization led by a corporate client.
    Organizations group normal clients under corporate client leadership.
    """
    # Basic information
    title = models.CharField(
        max_length=200,
        help_text="Título/nombre de la organización"
    )
    description = models.TextField(
        help_text="Descripción detallada de la organización"
    )
    
    # Corporate client leader
    corporate_client = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='led_organizations',
        limit_choices_to={'role': 'corporate_client'},
        help_text="Cliente corporativo líder de la organización"
    )
    
    # Images
    profile_image = models.ImageField(
        upload_to=organization_profile_image_path,
        null=True,
        blank=True,
        help_text="Imagen de perfil de la organización"
    )
    cover_image = models.ImageField(
        upload_to=organization_cover_image_path,
        null=True,
        blank=True,
        help_text="Imagen de portada de la organización"
    )
    
    # Status and metadata
    is_active = models.BooleanField(
        default=True,
        help_text="Si la organización está activa"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha de creación de la organización"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Fecha de última actualización"
    )
    
    def clean(self):
        """Validate that corporate_client is actually a corporate client"""
        if self.corporate_client and self.corporate_client.role != 'corporate_client':
            raise ValidationError('El líder debe ser un cliente corporativo')
    
    def get_member_count(self):
        """Get the number of active members in the organization"""
        return self.memberships.filter(is_active=True).count()
    
    def get_pending_invitations_count(self):
        """Get the number of pending invitations"""
        return self.invitations.filter(status='PENDING').count()
    
    def __str__(self):
        return f"{self.title} (Leader: {self.corporate_client.email})"
    
    class Meta:
        verbose_name = "Organización"
        verbose_name_plural = "Organizaciones"
        ordering = ['-created_at']

# Signal to delete organization images when the object is deleted
@receiver(post_delete, sender=Organization)
def delete_organization_images(sender, instance, **kwargs):
    """Delete organization images when organization is deleted"""
    if instance.profile_image:
        if os.path.isfile(instance.profile_image.path):
            os.remove(instance.profile_image.path)
    
    if instance.cover_image:
        if os.path.isfile(instance.cover_image.path):
            os.remove(instance.cover_image.path)

class OrganizationInvitation(models.Model):
    """
    Model representing invitations sent to normal clients to join organizations.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('ACCEPTED', 'Aceptada'),
        ('REJECTED', 'Rechazada'),
        ('EXPIRED', 'Expirada'),
        ('CANCELLED', 'Cancelada'),
    ]
    
    # Core relationships
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='invitations',
        help_text="Organización a la que se invita"
    )
    invited_user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='received_invitations',
        limit_choices_to={'role__in': ['client', 'basic']},
        help_text="Usuario invitado (cliente normal o básico)"
    )
    invited_by = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='sent_invitations',
        limit_choices_to={'role': 'corporate_client'},
        help_text="Cliente corporativo que envió la invitación"
    )
    
    # Invitation details
    invitation_token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        help_text="Token único para la invitación"
    )
    message = models.TextField(
        blank=True,
        null=True,
        help_text="Mensaje personalizado de invitación"
    )
    
    # Status and timestamps
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        help_text="Estado de la invitación"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha de envío de la invitación"
    )
    expires_at = models.DateTimeField(
        help_text="Fecha de expiración de la invitación"
    )
    responded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha de respuesta a la invitación"
    )
    
    def save(self, *args, **kwargs):
        """Set expiration date if not provided"""
        if not self.expires_at:
            # Invitations expire after 30 days
            self.expires_at = timezone.now() + timezone.timedelta(days=30)
        super().save(*args, **kwargs)
    
    def clean(self):
        """Validate invitation constraints"""
        # Check that invited user is a normal client or basic user
        if self.invited_user and self.invited_user.role not in ['client', 'basic']:
            raise ValidationError('Solo se puede invitar a clientes normales y usuarios básicos')
        
        # Check that inviter is a corporate client
        if self.invited_by and self.invited_by.role != 'corporate_client':
            raise ValidationError('Solo los clientes corporativos pueden enviar invitaciones')
        
        # Check that inviter is the leader of the organization
        if self.organization and self.invited_by and self.organization.corporate_client != self.invited_by:
            raise ValidationError('Solo el líder de la organización puede enviar invitaciones')
        
        # Check for duplicate pending invitations
        if self.pk is None:  # New invitation
            existing = OrganizationInvitation.objects.filter(
                organization=self.organization,
                invited_user=self.invited_user,
                status='PENDING'
            ).exists()
            if existing:
                raise ValidationError('Ya existe una invitación pendiente para este usuario en esta organización')
    
    def is_expired(self):
        """Check if invitation has expired"""
        return timezone.now() > self.expires_at
    
    def can_be_responded(self):
        """Check if invitation can still be accepted/rejected"""
        return self.status == 'PENDING' and not self.is_expired()
    
    def accept(self):
        """Accept the invitation and create membership"""
        if not self.can_be_responded():
            raise ValidationError('La invitación no puede ser aceptada')
        
        # Check if user is already a member
        existing_membership = OrganizationMembership.objects.filter(
            organization=self.organization,
            user=self.invited_user,
            is_active=True
        ).exists()
        
        if existing_membership:
            raise ValidationError('El usuario ya es miembro de esta organización')
        
        # Create membership
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.invited_user,
            role='MEMBER'
        )
        
        # Update invitation status
        self.status = 'ACCEPTED'
        self.responded_at = timezone.now()
        self.save()
    
    def reject(self):
        """Reject the invitation"""
        if not self.can_be_responded():
            raise ValidationError('La invitación no puede ser rechazada')
        
        self.status = 'REJECTED'
        self.responded_at = timezone.now()
        self.save()
    
    def __str__(self):
        return f"{self.organization.title} → {self.invited_user.email} ({self.status})"
    
    class Meta:
        verbose_name = "Invitación de Organización"
        verbose_name_plural = "Invitaciones de Organización"
        ordering = ['-created_at']
        unique_together = [['organization', 'invited_user', 'status']]

class OrganizationMembership(models.Model):
    """
    Model representing membership of users in organizations.
    """
    ROLE_CHOICES = [
        ('LEADER', 'Líder'),
        ('ADMIN', 'Administrador'),
        ('MEMBER', 'Miembro'),
    ]
    
    # Core relationships
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='memberships',
        help_text="Organización"
    )
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='organization_memberships',
        help_text="Usuario miembro"
    )
    
    # Membership details
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='MEMBER',
        help_text="Rol del usuario en la organización"
    )
    joined_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha de unión a la organización"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Si la membresía está activa"
    )
    deactivated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha de desactivación de la membresía"
    )
    
    def clean(self):
        """Validate membership constraints"""
        # Check that only one leader per organization
        if self.role == 'LEADER':
            existing_leader = OrganizationMembership.objects.filter(
                organization=self.organization,
                role='LEADER',
                is_active=True
            ).exclude(pk=self.pk).exists()
            
            if existing_leader:
                raise ValidationError('Solo puede haber un líder por organización')
    
    def deactivate(self):
        """Deactivate membership"""
        self.is_active = False
        self.deactivated_at = timezone.now()
        self.save()
    
    def reactivate(self):
        """Reactivate membership"""
        self.is_active = True
        self.deactivated_at = None
        self.save()
    
    def __str__(self):
        return f"{self.user.email} → {self.organization.title} ({self.role})"
    
    class Meta:
        verbose_name = "Membresía de Organización"
        verbose_name_plural = "Membresías de Organización"
        ordering = ['-joined_at']
        unique_together = [['organization', 'user']]


class OrganizationPost(models.Model):
    """
    Model representing informational posts created by corporate clients for their organizations.
    These posts can contain text content and optional hyperlinks.
    """
    
    # Core content
    title = models.CharField(
        max_length=200,
        help_text="Título del post"
    )
    content = models.TextField(
        help_text="Contenido del post"
    )
    
    # Optional hyperlink
    link_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Nombre del hipervínculo (opcional)"
    )
    link_url = models.URLField(
        null=True,
        blank=True,
        help_text="URL del hipervínculo (opcional)"
    )
    
    # Relationships
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='posts',
        help_text="Organización a la que pertenece el post"
    )
    author = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='authored_organization_posts',
        limit_choices_to={'role': 'corporate_client'},
        help_text="Cliente corporativo que creó el post"
    )
    
    # Status and visibility
    is_active = models.BooleanField(
        default=True,
        help_text="Si el post está activo/visible"
    )
    is_pinned = models.BooleanField(
        default=False,
        help_text="Si el post está fijado en la parte superior"
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha de creación del post"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Fecha de última actualización"
    )
    
    def clean(self):
        """Validate post constraints"""
        # Ensure author is the leader of the organization
        if self.author and self.organization:
            if self.organization.corporate_client != self.author:
                raise ValidationError('Solo el líder de la organización puede crear posts')
        
        # If link_name is provided, link_url should also be provided
        if self.link_name and not self.link_url:
            raise ValidationError('Si se proporciona un nombre de enlace, también debe proporcionar la URL')
        
        # If link_url is provided, link_name should also be provided
        if self.link_url and not self.link_name:
            raise ValidationError('Si se proporciona una URL, también debe proporcionar un nombre para el enlace')
    
    def save(self, *args, **kwargs):
        """Override save to ensure validations"""
        self.clean()
        super().save(*args, **kwargs)
    
    def toggle_pin(self):
        """Toggle the pinned status of the post"""
        self.is_pinned = not self.is_pinned
        self.save()
    
    def deactivate(self):
        """Deactivate the post"""
        self.is_active = False
        self.save()
    
    def reactivate(self):
        """Reactivate the post"""
        self.is_active = True
        self.save()
    
    @property
    def has_link(self):
        """Check if post has a hyperlink"""
        return bool(self.link_name and self.link_url)
    
    def __str__(self):
        pinned_indicator = " 📌" if self.is_pinned else ""
        return f"{self.title} - {self.organization.title}{pinned_indicator}"
    
    class Meta:
        verbose_name = "Post de Organización"
        verbose_name_plural = "Posts de Organización"
        ordering = ['-is_pinned', '-created_at']  # Pinned posts first, then by creation date
