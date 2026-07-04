import os
import random

from django.core.files import File
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import (
    CorporateRequest,
    CorporateRequestType,
    CorporateRequestFiles,
    CorporateRequestResponse,
    Organization,
    OrganizationMembership,
    User,
)

EXAMPLE_FILES_DIR = 'media/example_files/'

REQUEST_TYPES = [
    'Consulta Jurídica',
    'Revisión de Documentos',
    'Asesoría Contractual',
    'Gestión de Trámite',
    'Solicitud de Concepto',
]

STATUSES = ['PENDING', 'IN_REVIEW', 'RESPONDED', 'RESOLVED', 'CLOSED']
PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']


class Command(BaseCommand):
    help = 'Create fake data for the corporate_request domain'

    def handle(self, *args, **options):
        fake = Faker('es_CO')

        organizations = list(Organization.objects.all())
        if not organizations:
            self.stdout.write(self.style.ERROR('No organizations found. Run create_organizations first.'))
            return

        available_files = [
            f for f in os.listdir(EXAMPLE_FILES_DIR) if f.endswith('.pdf')
        ] if os.path.isdir(EXAMPLE_FILES_DIR) else []

        # Request types (idempotent by unique name).
        request_types = []
        for name in REQUEST_TYPES:
            rt, _ = CorporateRequestType.objects.get_or_create(name=name)
            request_types.append(rt)

        requests_created = 0
        for organization in organizations:
            leader = organization.corporate_client
            # Clients that are active members of this org (clean() requires membership).
            client_members = list(
                User.objects.filter(
                    organization_memberships__organization=organization,
                    organization_memberships__is_active=True,
                    role='client',
                ).distinct()
            )
            if not client_members:
                continue

            for client in client_members:
                for idx, status in enumerate(STATUSES):
                    # Idempotency guard: one request per (client, org, status).
                    if CorporateRequest.objects.filter(
                        client=client, organization=organization, status=status
                    ).exists():
                        continue

                    priority = PRIORITIES[idx % len(PRIORITIES)]
                    cr = CorporateRequest(
                        client=client,
                        organization=organization,
                        corporate_client=leader,
                        request_type=random.choice(request_types),
                        title=fake.sentence(nb_words=6).rstrip('.'),
                        description=fake.paragraph(nb_sentences=4),
                        priority=priority,
                        status=status,
                    )
                    # assigned_to / completion dates for advanced statuses.
                    if status != 'PENDING':
                        cr.assigned_to = leader
                    if status in ('RESOLVED', 'CLOSED'):
                        cr.estimated_completion_date = timezone.now() + timezone.timedelta(days=5)
                        cr.actual_completion_date = timezone.now()
                    cr.save()  # save() runs clean() + generates CORP-YYYY-NNN
                    requests_created += 1

                    # Attach a file to some requests.
                    if available_files and random.random() < 0.4:
                        name = random.choice(available_files)
                        with open(os.path.join(EXAMPLE_FILES_DIR, name), 'rb') as fh:
                            crf = CorporateRequestFiles.objects.create(file=File(fh, name=name))
                        cr.files.add(crf)

                    # Conversation thread for statuses beyond the initial one.
                    if status in ('RESPONDED', 'RESOLVED', 'CLOSED'):
                        corp_response = CorporateRequestResponse.objects.create(
                            corporate_request=cr,
                            response_text=fake.paragraph(nb_sentences=2),
                            user=leader,
                            user_type='corporate_client',
                            is_internal_note=False,
                        )
                        if available_files and random.random() < 0.3:
                            name = random.choice(available_files)
                            with open(os.path.join(EXAMPLE_FILES_DIR, name), 'rb') as fh:
                                rf = CorporateRequestFiles.objects.create(file=File(fh, name=name))
                            corp_response.response_files.add(rf)
                        # Internal staff note (only visible to corporate staff).
                        CorporateRequestResponse.objects.create(
                            corporate_request=cr,
                            response_text=fake.sentence(nb_words=10),
                            user=leader,
                            user_type='corporate_client',
                            is_internal_note=True,
                        )
                        # Client reply back on the thread.
                        CorporateRequestResponse.objects.create(
                            corporate_request=cr,
                            response_text=fake.paragraph(nb_sentences=1),
                            user=client,
                            user_type='client',
                            is_internal_note=False,
                        )

        self.stdout.write(self.style.SUCCESS(
            f'Corporate requests seeded: {requests_created} new requests across {len(organizations)} organizations'
        ))
