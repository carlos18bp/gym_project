from django.db import models

class LegalLink(models.Model):
    """
    Model representing a legal link with a name and URL.
    """
    name = models.CharField(max_length=255, verbose_name="Nombre")
    url = models.URLField(verbose_name="Hipervínculo")

    def __str__(self):
        """
        Returns the string representation of the legal link, which is its name.
        """
        return self.name

    class Meta:
        verbose_name = "Legal Link"
        verbose_name_plural = "Legal Links"
