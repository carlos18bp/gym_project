# Generated manually for adding date field to Stage model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gym_app", "0044_documentsignature_rejected_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="stage",
            name="date",
            field=models.DateField(null=True, blank=True, help_text="The date associated with this stage in the process."),
        ),
    ]
