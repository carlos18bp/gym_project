from django.db import models

class DynamicDocument(models.Model):
    title = models.CharField(max_length=200, help_text="Title of the dynamic document.")
    content = models.TextField(help_text="Content of the document.")
    variables = models.JSONField(default=list, blank=True, help_text="List of variables used in the document.")
    values = models.JSONField(default=dict, blank=True, help_text="Values of the variables.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="Document creation timestamp.")
    updated_at = models.DateTimeField(auto_now=True, help_text="Document last updated timestamp.")

    def __str__(self):
        return self.title


