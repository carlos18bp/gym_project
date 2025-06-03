from django.db import models

class LegalDocument(models.Model):
    """
    Model that represents a legal document with a name and a file.
    """
    name = models.CharField(max_length=255, verbose_name="Document Name")
    file = models.FileField(upload_to='documents/', verbose_name="Document File")

    def __str__(self):
        """
        Returns the string representation of the legal document (its name).
        """
        return self.name

    class Meta:
        verbose_name = "Legal Document"
        verbose_name_plural = "Legal Documents"

