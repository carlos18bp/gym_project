from django.db import models
from django.conf import settings

class Process(models.Model):
    """
    Model representing a legal process.

    Attributes:
        authority (CharField): The authority handling the case.
        plaintiff (CharField): The person or entity initiating the legal action.
        defendant (CharField): The person or entity against whom the action is brought.
        ref (CharField): Ref unique by process.
        stages (ManyToManyField): The stages associated with the process, related to the Stage model.
        client (ForeignKey): The client related to the process, related to the User model.
        case_files (ManyToManyField): The files associated with the case, related to the CaseFile model.
        case_type (CharField): The type of case being processed.
        subcase (CharField): The subcase classification within the main case type.
        lawyer (ForeignKey): The lawyer handling the case, related to the User model.
    """
    authority = models.CharField(max_length=100, help_text="The authority handling the case.")
    plaintiff = models.CharField(max_length=100, help_text="The person initiating the legal action.")
    defendant = models.CharField(max_length=100, help_text="The person against whom the action is brought.")
    ref = models.CharField(max_length=100, unique=True, help_text="The unique file number or case ID.")
    stages = models.ManyToManyField('Stage', help_text="The stages associated with the process.")
    client = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="client_processes", on_delete=models.CASCADE, help_text="The client associated with the process.")
    case_files = models.ManyToManyField('CaseFile', help_text="The case files associated with the process.")
    case_type = models.CharField(max_length=100, help_text="The type of case.")
    subcase = models.CharField(max_length=100, help_text="The subcase classification.")
    lawyer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="lawyer_processes", on_delete=models.CASCADE, help_text="The lawyer handling the case.")

    def __str__(self):
        """
        String representation of the Process instance.

        Returns:
            str: The unique file number of the process.
        """
        return self.ref
