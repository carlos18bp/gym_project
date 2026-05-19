from django.conf import settings
from django.db import models


class Notification(models.Model):
    """In-app notification delivered to a single user.

    Created by ``notification_service`` on behalf of other modules
    (signature alerts, process alerts, etc.).  The Notification Center
    UI consumes these records.
    """

    CATEGORY_CHOICES = [
        ('signature_request', 'Solicitud de Firma'),
        ('signature_completed', 'Firma Completada'),
        ('signature_rejected', 'Firma Rechazada'),
        ('signature_expired', 'Firma Vencida'),
        ('signature_reopened', 'Firma Reabierta'),
        ('signature_reminder', 'Recordatorio de Firma'),
        ('process_alert', 'Alerta de Proceso'),
        ('general', 'General'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Baja'),
        ('medium', 'Media'),
        ('high', 'Alta'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="Owner of this notification.",
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        default='general',
        db_index=True,
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default='medium',
    )

    # State flags
    is_read = models.BooleanField(default=False, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    is_deleted = models.BooleanField(default=False)
    snoozed_until = models.DateTimeField(null=True, blank=True)

    # Deep-linking fields
    link_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Resource type for navigation: 'process', 'document', 'service_request'.",
    )
    link_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="PK of the linked resource.",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'is_archived', 'is_deleted']),
        ]

    def __str__(self):
        return f"[{self.category}] {self.title} → {self.user}"
