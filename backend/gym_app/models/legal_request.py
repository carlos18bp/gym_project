from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
import os

class LegalRequestType(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="The name of the legal request type.")

    def __str__(self):
        return self.name

class LegalDiscipline(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="The name of the legal discipline.")

    def __str__(self):
        return self.name

class LegalRequestFiles(models.Model):
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
    first_name = models.CharField(max_length=100, help_text="The first name of the user.")
    last_name = models.CharField(max_length=100, help_text="The last name of the user.")
    email = models.EmailField(help_text="The email address of the user.")
    request_type = models.ForeignKey(LegalRequestType, on_delete=models.CASCADE, help_text="The type of the legal request.")
    discipline = models.ForeignKey(LegalDiscipline, on_delete=models.CASCADE, help_text="The legal discipline for the request.")
    description = models.TextField(help_text="A detailed description of the request.")
    files = models.ManyToManyField(LegalRequestFiles, blank=True, help_text="Files associated with the legal request.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the request was created.")

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.request_type.name}"

