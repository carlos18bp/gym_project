# Generated by Django 5.0.6 on 2025-04-08 20:49

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gym_app', '0011_recentdocument'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityFeed',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action_type', models.CharField(choices=[('create', 'Create'), ('edit', 'Edit'), ('finish', 'Finish'), ('delete', 'Delete'), ('update', 'Update'), ('other', 'Other')], default='other', max_length=10)),
                ('description', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Activity',
                'verbose_name_plural': 'Activities',
                'ordering': ['-created_at'],
            },
        ),
    ]
