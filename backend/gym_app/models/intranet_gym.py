from django.db import models

class LegalDocument(models.Model):
    """
    Modelo que representa un documento legal con un nombre y un archivo.
    """
    name = models.CharField(max_length=255, verbose_name="Nombre del Documento")
    file = models.FileField(upload_to='documents/', verbose_name="Archivo del Documento")

    def __str__(self):
        """
        Devuelve la representación en cadena del documento legal (su nombre).
        """
        return self.name

    class Meta:
        verbose_name = "Legal Document"
        verbose_name_plural = "Legal Documents"

