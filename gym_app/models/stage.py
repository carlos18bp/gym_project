from django.db import models

class Stage(models.Model):
    """
    Model representing a stage in the legal process.

    Attributes:
        status (CharField): The current status of the stage.
        date_created (DateTimeField): The date the stage was created.
    """
    status = models.CharField(max_length=100, help_text="The current status of the stage.")
    date_created = models.DateTimeField(auto_now_add=True, help_text="The date the stage was created.")

    def __str__(self):
        """
        String representation of the Stage instance.

        Returns:
            str: The status of the stage.
        """
        return self.status
