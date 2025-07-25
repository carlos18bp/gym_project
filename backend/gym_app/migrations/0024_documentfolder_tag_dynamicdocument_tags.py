# Generated by Django 5.0.6 on 2025-07-07 18:07

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gym_app', '0023_documentvariable_select_options_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentFolder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Nombre de la carpeta.', max_length=100)),
                ('color_id', models.PositiveSmallIntegerField(default=0, help_text='Identificador del color predefinido en el frontend.')),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Fecha de creación de la carpeta.')),
                ('documents', models.ManyToManyField(blank=True, help_text='Documentos incluidos en la carpeta.', related_name='folders', to='gym_app.dynamicdocument')),
                ('owner', models.ForeignKey(help_text='Cliente propietario de la carpeta.', on_delete=django.db.models.deletion.CASCADE, related_name='folders', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Carpeta de documentos',
                'verbose_name_plural': 'Carpetas de documentos',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Nombre de la etiqueta.', max_length=50, unique=True)),
                ('color_id', models.PositiveSmallIntegerField(default=0, help_text='Identificador del color predefinido en el frontend.')),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Fecha de creación de la etiqueta.')),
                ('created_by', models.ForeignKey(blank=True, help_text='Abogado que creó la etiqueta.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_tags', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Etiqueta',
                'verbose_name_plural': 'Etiquetas',
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='dynamicdocument',
            name='tags',
            field=models.ManyToManyField(blank=True, help_text='Etiquetas asignadas al documento.', related_name='documents', to='gym_app.tag'),
        ),
    ]
