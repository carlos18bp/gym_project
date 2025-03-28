# Generated by Django 5.0.6 on 2024-12-23 21:56

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gym_app', '0003_alter_legallink_options'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='marital_status',
        ),
        migrations.AddField(
            model_name='user',
            name='document_type',
            field=models.CharField(blank=True, choices=[('NIT', 'NIT'), ('CC', 'Cédula de Ciudadanía'), ('TI', 'Tarjeta de Identidad')], help_text='The type of identification document.', max_length=10, null=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('client', 'Client'), ('lawyer', 'Lawyer')], default='client', help_text="The role of the user within the system (default: 'client').", max_length=10),
        ),
    ]
