from django.conf import settings
from django.db import migrations, models


def forwards_copy_client_to_clients(apps, schema_editor):
    Process = apps.get_model('gym_app', 'Process')
    # For each existing process, copy the single client FK into the new clients M2M
    for process in Process.objects.all():
        client_id = getattr(process, 'client_id', None)
        if client_id:
            process.clients.add(client_id)


def reverse_noop(apps, schema_editor):
    # We don't attempt to reconstruct the old client FK when rolling back
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('gym_app', '0048_process_authority_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='process',
            name='clients',
            field=models.ManyToManyField(
                blank=True,
                help_text='The clients associated with the process.',
                related_name='client_processes',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(forwards_copy_client_to_clients, reverse_noop),
        migrations.RemoveField(
            model_name='process',
            name='client',
        ),
    ]
