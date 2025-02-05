from django.db import models
from django.conf import settings

class DynamicDocument(models.Model):
    FIELD_TYPE_CHOICES = [
        ('input', 'Input'),
        ('text_area', 'Text Area'),
    ]

    STATE_CHOICES = [
        ('Published', 'Published'),
        ('Draft', 'Draft'),
        ('Progress', 'Progress'),
        ('Completed', 'Completed'),
    ]

    title = models.CharField(max_length=200, help_text="Title of the dynamic document.")
    content = models.TextField(help_text="Content of the document.")
    variables_en = models.JSONField(default=list, blank=True, help_text="List of variables (in English) used in the document.")
    variables_es = models.JSONField(default=list, blank=True, help_text="List of variables (in Spanish) used in the document.")
    values = models.JSONField(default=dict, blank=True, help_text="Values of the variables.")
    field_type = models.CharField(
        max_length=20,
        choices=FIELD_TYPE_CHOICES,
        default='input',
        help_text="Field type for the document (input or text_area)."
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

    def __str__(self):
        return self.title
