import os
from django.db import models
from django.conf import settings
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.core.validators import MinValueValidator, MaxValueValidator

class Case(models.Model):
    """
    Model representing a case type.
    
    Attributes:
        type (CharField): The type of the case.
    """
    type = models.CharField(max_length=100, help_text="The type of the case.")
    
    def __str__(self):
        return self.type

class CaseFile(models.Model):
    """
    Model representing a case file.

    Attributes:
        file (FileField): The file associated with the case.
        date_uploaded (DateTimeField): The date the file was uploaded.
    """
    file = models.FileField(upload_to='case_files/', help_text="The file associated with the case.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the file was uploaded.")

    def __str__(self):
        """
        String representation of the CaseFile instance.

        Returns:
            str: The name of the file.
        """
        return os.path.basename(self.file.name)
    
# Signal to delete the physical file when the CaseFile object is deleted
@receiver(post_delete, sender=CaseFile)
def delete_file(sender, instance, **kwargs):
    """
    Deletes the file from the file system when the CaseFile object is deleted.
    """
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)

class Stage(models.Model):
    """Model representing a stage in the legal process.

    Attributes:
        status (CharField): The current status or description of the stage.
        date (DateField): The logical date of this stage in the process timeline.
        created_at (DateTimeField): The timestamp when the stage record was created.
    """
    status = models.CharField(max_length=100, help_text="The current status of the stage.")
    # Optional explicit date for the stage; if not provided, defaults to today in views
    date = models.DateField(null=True, blank=True, help_text="The date associated with this stage in the process.")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the stage was created.")

    def __str__(self):
        """
        String representation of the Stage instance.

        Returns:
            str: The status of the stage.
        """
        return self.status

class Process(models.Model):
    """
    Model representing a legal process.
    
    Attributes:
        authority (CharField): The authority handling the case.
        plaintiff (CharField): The person or entity initiating the legal action.
        defendant (CharField): The person or entity against whom the action is brought.
        ref (CharField): Ref by process.
        stages (ManyToManyField): The stages associated with the process, related to the Stage model.
        client (ForeignKey): The client related to the process, related to the User model.
        case_files (ManyToManyField): The files associated with the case, related to the CaseFile model.
        case (ForeignKey): The case type being processed, related to the Case model.
        subcase (CharField): The subcase classification within the main case type.
        lawyer (ForeignKey): The lawyer handling the case, related to the User model.
        created_at (DateTimeField): The date the process was created.
    """
    authority = models.CharField(max_length=100, help_text="The authority handling the case.")
    authority_email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Email address of the authority handling the case."
    )
    plaintiff = models.CharField(max_length=100, help_text="The person initiating the legal action.")
    defendant = models.CharField(max_length=100, help_text="The person against whom the action is brought.")
    ref = models.CharField(max_length=100, help_text="The reference number")
    stages = models.ManyToManyField('Stage', help_text="The stages associated with the process.")
    client = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="client_processes", on_delete=models.CASCADE, help_text="The client associated with the process.")
    case_files = models.ManyToManyField('CaseFile', help_text="The case files associated with the process.")
    case = models.ForeignKey(Case, on_delete=models.CASCADE, help_text="The case type being processed.")
    subcase = models.CharField(max_length=100, help_text="The subcase classification.")
    lawyer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="lawyer_processes", on_delete=models.CASCADE, help_text="The lawyer handling the case.")
    progress = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="The process completion percentage (0-100).",
    )
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date the process was created.")

    def __str__(self):
        return self.ref

class RecentProcess(models.Model):
    """
    Model representing the recently viewed processes by a user.
    
    Attributes:
        user (ForeignKey): The user who viewed the process.
        process (ForeignKey): The process that was viewed.
        last_viewed (DateTimeField): The timestamp of when the process was last viewed.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    process = models.ForeignKey('Process', on_delete=models.CASCADE)
    last_viewed = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-last_viewed']
        unique_together = ['user', 'process']
        
    def __str__(self):
        return f"{self.user.username} - {self.process.ref} - {self.last_viewed}"
