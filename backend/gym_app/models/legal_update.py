from django.db import models

class LegalUpdate(models.Model):
    title = models.CharField(max_length=200, blank=True, null=True)
    content = models.TextField()
    image = models.ImageField(upload_to='legal_updates/', blank=True, null=True)
    link_text = models.CharField(max_length=100)
    link_url = models.URLField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Legal Update'
        verbose_name_plural = 'Legal Updates'

    def __str__(self):
        return self.title or f"Legal Update - {self.created_at.strftime('%Y-%m-%d')}" 