from django.db import models

class CaseFile(models.Model):
    """
    Model representing a case file.

    Attributes:
        file (FileField): The file associated with the case.
        name (CharField): The name of the file.
        date_uploaded (DateTimeField): The date the file was uploaded.
        description (TextField): A brief description of the file's content.
    """
    file = models.FileField(upload_to='case_files/', help_text="The file associated with the case.")
    name = models.CharField(max_length=255, help_text="The name of the file.")
    date_uploaded = models.DateTimeField(auto_now_add=True, help_text="The date the file was uploaded.")
    description = models.TextField(help_text="A brief description of the file's content.")

    def __str__(self):
        """
        String representation of the CaseFile instance.

        Returns:
            str: The name of the file.
        """
        return self.name
