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


class IntranetProfile(models.Model):
    """
    Model that represents the intranet profile with cover and profile images.
    Only one instance should exist.
    """
    cover_image = models.ImageField(
        upload_to='intranet/covers/', 
        null=True, 
        blank=True,
        verbose_name="Cover Image",
        help_text="Cover image for the intranet documents section"
    )
    profile_image = models.ImageField(
        upload_to='intranet/profiles/', 
        null=True, 
        blank=True,
        verbose_name="Profile Image",
        help_text="Profile image for the intranet documents section"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        """
        Returns the string representation of the intranet profile.
        """
        return "Intranet Profile"

    class Meta:
        verbose_name = "Intranet Profile"
        verbose_name_plural = "Intranet Profiles"

