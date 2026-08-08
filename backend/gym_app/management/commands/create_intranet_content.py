import os
import random

from django.core.files import File
from django.core.management.base import BaseCommand
from faker import Faker

from gym_app.models import LegalUpdate, LegalDocument, IntranetProfile

EXAMPLE_FILES_DIR = 'media/example_files/'

LEGAL_UPDATES = [
    ('Nueva reforma tributaria 2026', 'Ver decreto', 'https://www.example.com/reforma-tributaria', True),
    ('Actualización del Código Laboral', 'Leer más', 'https://www.example.com/codigo-laboral', True),
    ('Cambios en el régimen de contratación estatal', 'Consultar', 'https://www.example.com/secop', True),
    ('Circular sobre protección de datos', 'Descargar', 'https://www.example.com/habeas-data', False),
]

LEGAL_DOCUMENTS = [
    'Manual de Convivencia',
    'Política de Tratamiento de Datos',
    'Reglamento Interno de Trabajo',
]


class Command(BaseCommand):
    help = 'Create fake intranet content (LegalUpdate, LegalDocument, IntranetProfile)'

    def handle(self, *args, **options):
        fake = Faker('es_CO')

        available_files = [
            f for f in os.listdir(EXAMPLE_FILES_DIR) if f.endswith('.pdf')
        ] if os.path.isdir(EXAMPLE_FILES_DIR) else []

        # Legal updates (news feed). Idempotent by title.
        updates_created = 0
        for title, link_text, link_url, is_active in LEGAL_UPDATES:
            _, created = LegalUpdate.objects.get_or_create(
                title=title,
                defaults={
                    'content': fake.paragraph(nb_sentences=4),
                    'link_text': link_text,
                    'link_url': link_url,
                    'is_active': is_active,
                },
            )
            updates_created += int(created)

        # Intranet legal documents. Idempotent by name.
        docs_created = 0
        for name in LEGAL_DOCUMENTS:
            if LegalDocument.objects.filter(name=name).exists():
                continue
            if not available_files:
                break
            file_name = random.choice(available_files)
            with open(os.path.join(EXAMPLE_FILES_DIR, file_name), 'rb') as fh:
                LegalDocument.objects.create(name=name, file=File(fh, name=file_name))
            docs_created += 1

        # Singleton intranet profile.
        profile_created = False
        if not IntranetProfile.objects.exists():
            IntranetProfile.objects.create()
            profile_created = True

        self.stdout.write(self.style.SUCCESS(
            f'Intranet content seeded: {updates_created} legal updates, '
            f'{docs_created} documents, profile_created={profile_created}'
        ))
