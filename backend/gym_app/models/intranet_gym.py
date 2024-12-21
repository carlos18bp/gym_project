from django.db import models

class LegalLink(models.Model):
    name = models.CharField(max_length=255, verbose_name="Nombre")
    url = models.URLField(verbose_name="Hipervínculo")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Legal Link"
        verbose_name_plural = "Legal Links"
