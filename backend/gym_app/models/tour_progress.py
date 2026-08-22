from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class TourProgress(models.Model):
    """Guided-tour completion record for a single user and module.

    One row per user/module combination.  ``completed_at`` is refreshed
    every time the user finishes (or skips) the tour, so the frontend
    can re-offer the guide after ``STALE_AFTER_DAYS`` days.
    """

    STALE_AFTER_DAYS = 30

    MODULE_CHOICES = [
        ('dynamic_documents', 'Archivos Jurídicos'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tour_progress',
        help_text="Owner of this tour progress record.",
    )
    module_name = models.CharField(
        max_length=50,
        choices=MODULE_CHOICES,
        db_index=True,
        help_text="Module this tour belongs to.",
    )
    completed_at = models.DateTimeField(
        help_text="Last time the user completed or skipped the tour.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'module_name']
        ordering = ['-completed_at']
        indexes = [
            models.Index(fields=['user', 'module_name']),
        ]

    def __str__(self):
        return f"[{self.module_name}] {self.user} → {self.completed_at:%Y-%m-%d}"

    @property
    def is_stale(self):
        """True when the last completion is older than ``STALE_AFTER_DAYS``."""
        return timezone.now() - self.completed_at > timedelta(days=self.STALE_AFTER_DAYS)
