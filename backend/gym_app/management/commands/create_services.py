import os
import random

from django.core.files import File
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import (
    Service,
    ServiceStage,
    ServiceField,
    ServiceRequest,
    ServiceRequestAnswer,
    ServiceRequestFieldFile,
    ServiceRequestLawyerResponse,
    ServiceRequestLawyerResponseFile,
    User,
)

EXAMPLE_FILES_DIR = 'media/example_files/'

# Catalog of services to seed (idempotent by slug). One is soft-deleted to
# exercise the is_deleted path; two are featured to exercise ordering.
SERVICE_CATALOG = [
    {'name': 'Derecho de Petición', 'short_title': 'Derecho Petición',
     'is_featured': True, 'featured_order': 1, 'is_deleted': False},
    {'name': 'Acción de Tutela', 'short_title': 'Tutela',
     'is_featured': True, 'featured_order': 2, 'is_deleted': False},
    {'name': 'Constitución de Sociedad', 'short_title': 'Constitución Sociedad',
     'is_featured': False, 'featured_order': 0, 'is_deleted': False},
    {'name': 'Revisión de Contrato', 'short_title': 'Revisión Contrato',
     'is_featured': False, 'featured_order': 0, 'is_deleted': False},
    {'name': 'Consulta Laboral', 'short_title': 'Consulta Laboral',
     'is_featured': False, 'featured_order': 0, 'is_deleted': False},
    {'name': 'Trámite Migratorio', 'short_title': 'Trámite Migratorio',
     'is_featured': False, 'featured_order': 0, 'is_deleted': True},
]

# Every service gets this stage/field template, which covers ALL 8 field types
# in ALLOWED_SERVICE_FIELD_TYPES (input, text_area, number, date, email,
# select_single, select_multiple, file).
STAGE_TEMPLATE = [
    {
        'order': 1,
        'title': 'Datos del solicitante',
        'description': 'Información básica de quien realiza la solicitud.',
        'fields': [
            {'key': 'full_name', 'label': 'Nombre completo', 'field_type': 'input',
             'is_required': True, 'placeholder': 'Nombre y apellidos'},
            {'key': 'summary', 'label': 'Descripción del caso', 'field_type': 'text_area',
             'is_required': True, 'help_text': 'Describa su situación con el mayor detalle posible.'},
            {'key': 'age', 'label': 'Edad', 'field_type': 'number', 'is_required': False},
            {'key': 'incident_date', 'label': 'Fecha del hecho', 'field_type': 'date',
             'is_required': False},
            {'key': 'contact_email', 'label': 'Correo de contacto', 'field_type': 'email',
             'is_required': True},
        ],
    },
    {
        'order': 2,
        'title': 'Detalles del trámite',
        'description': 'Información específica del trámite solicitado.',
        'fields': [
            {'key': 'urgency', 'label': 'Nivel de urgencia', 'field_type': 'select_single',
             'is_required': True,
             'options': [
                 {'value': 'low', 'label': 'Baja'},
                 {'value': 'medium', 'label': 'Media'},
                 {'value': 'high', 'label': 'Alta'},
             ]},
            {'key': 'topics', 'label': 'Temas relacionados', 'field_type': 'select_multiple',
             'is_required': False,
             'options': [
                 {'value': 'civil', 'label': 'Civil'},
                 {'value': 'laboral', 'label': 'Laboral'},
                 {'value': 'penal', 'label': 'Penal'},
                 {'value': 'comercial', 'label': 'Comercial'},
             ]},
            {'key': 'attachment', 'label': 'Documento de soporte', 'field_type': 'file',
             'is_required': False, 'allowed_extensions': ['pdf'], 'max_files': 2},
        ],
    },
]

# (final_status, is_draft) matrix — covers all 6 SERVICE_REQUEST_STATUS_CHOICES.
REQUEST_STATUS_MATRIX = ['DRAFT', 'OPEN', 'IN_STUDY', 'IN_PROGRESS', 'ANSWERED', 'FINALIZED']


class Command(BaseCommand):
    help = 'Create fake data for the services/trámites domain (Service + requests)'

    def handle(self, *args, **options):
        fake = Faker('es_CO')

        available_files = [
            f for f in os.listdir(EXAMPLE_FILES_DIR) if f.endswith('.pdf')
        ] if os.path.isdir(EXAMPLE_FILES_DIR) else []

        # Creator/admin for the catalog: prefer the special GYM lawyer, else any lawyer.
        creator = (
            User.objects.filter(email='core.paginaswebscolombia@gmail.com').first()
            or User.objects.filter(role='lawyer').first()
        )

        # Requester pool (weighted toward the demo users so their dashboards fill up).
        requesters = []
        for email in ('carlos18bp@gmail.com', 'info.montreal.studios@gmail.com'):
            u = User.objects.filter(email=email).first()
            if u:
                requesters.append(u)
        requesters.extend(list(User.objects.filter(role='client')[:3]))
        # Deduplicate while preserving order.
        requesters = list(dict.fromkeys(requesters))

        # Responders (lawyers) for lawyer responses.
        responders = list(User.objects.filter(role='lawyer'))
        special_lawyer = User.objects.filter(
            email='core.paginaswebscolombia@gmail.com', role='lawyer'
        ).first()
        if special_lawyer and special_lawyer not in responders:
            responders.append(special_lawyer)

        if not requesters:
            self.stdout.write(self.style.ERROR('No client users found. Run create_clients_lawyers first.'))
            return

        # ── 1. Catalog: Service + ServiceStage + ServiceField ────────────────
        services = []
        for spec in SERVICE_CATALOG:
            from django.utils.text import slugify
            slug = slugify(spec['short_title'])
            service, created = Service.objects.get_or_create(
                slug=slug,
                defaults={
                    'name': spec['name'],
                    'short_title': spec['short_title'],
                    'description': fake.paragraph(nb_sentences=3),
                    'is_active': True,
                    'is_featured': spec['is_featured'],
                    'featured_order': spec['featured_order'],
                    'is_deleted': spec['is_deleted'],
                    'created_by': creator,
                    'updated_by': creator,
                },
            )
            services.append(service)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Service created: {service.name}'))

            for stage_spec in STAGE_TEMPLATE:
                stage, _ = ServiceStage.objects.get_or_create(
                    service=service,
                    order=stage_spec['order'],
                    defaults={
                        'title': stage_spec['title'],
                        'description': stage_spec['description'],
                        'is_active': True,
                    },
                )
                for order, field_spec in enumerate(stage_spec['fields'], start=1):
                    ServiceField.objects.get_or_create(
                        stage=stage,
                        key=field_spec['key'],
                        defaults={
                            'label': field_spec['label'],
                            'field_type': field_spec['field_type'],
                            'placeholder': field_spec.get('placeholder'),
                            'help_text': field_spec.get('help_text'),
                            'is_required': field_spec.get('is_required', False),
                            'order': order,
                            'options': field_spec.get('options'),
                            'allowed_extensions': field_spec.get('allowed_extensions'),
                            'allow_multiple_files': field_spec.get('field_type') == 'file'
                            and field_spec.get('max_files', 1) > 1,
                            'max_files': field_spec.get('max_files', 1),
                        },
                    )

        # Services that accept requests (soft-deleted ones do not).
        active_services = [s for s in services if not s.is_deleted]

        # ── 2. ServiceRequest across all 6 statuses (+ answers/files/responses) ─
        requests_created = 0
        for requester in requesters:
            for idx, status in enumerate(REQUEST_STATUS_MATRIX):
                # Deterministic service per (requester, status) so re-runs are
                # idempotent (a random pick would dodge the guard below).
                service = active_services[idx % len(active_services)]
                # Idempotency guard: one request per (requester, service, status).
                if ServiceRequest.objects.filter(
                    requester=requester, service=service, status=status
                ).exists():
                    continue

                sr = ServiceRequest(service=service, requester=requester, current_stage=1)
                if status == 'DRAFT':
                    sr.save()  # stays DRAFT, no tracking number
                else:
                    sr.mark_submitted()  # assigns tracking_number, sets status OPEN
                    sr.status = status
                    sr.current_stage = len(STAGE_TEMPLATE)
                    sr.save()
                requests_created += 1

                self._create_answers(sr, service, fake)

                # Attach a support file to submitted requests (file-type field).
                if status != 'DRAFT' and available_files:
                    file_field = ServiceField.objects.filter(
                        stage__service=service, field_type='file'
                    ).first()
                    if file_field:
                        name = random.choice(available_files)
                        with open(os.path.join(EXAMPLE_FILES_DIR, name), 'rb') as fh:
                            ServiceRequestFieldFile.objects.create(
                                service_request=sr,
                                field=file_field,
                                file=File(fh, name=name),
                                original_name=name,
                            )

                # Lawyer responses with status transitions for advanced statuses.
                if status in ('IN_STUDY', 'IN_PROGRESS', 'ANSWERED', 'FINALIZED') and responders:
                    response = ServiceRequestLawyerResponse.objects.create(
                        service_request=sr,
                        responder=random.choice(responders),
                        message=fake.paragraph(nb_sentences=2),
                        status_before='OPEN',
                        status_after=status,
                    )
                    if available_files and random.random() < 0.4:
                        name = random.choice(available_files)
                        with open(os.path.join(EXAMPLE_FILES_DIR, name), 'rb') as fh:
                            ServiceRequestLawyerResponseFile.objects.create(
                                response=response,
                                file=File(fh, name=name),
                                original_name=name,
                            )

        self.stdout.write(self.style.SUCCESS(
            f'Services seeded: {len(services)} services, {requests_created} new requests'
        ))

    def _create_answers(self, service_request, service, fake):
        """Create one snapshot answer per field of the request's service."""
        fields = ServiceField.objects.filter(stage__service=service).select_related('stage')
        for field in fields:
            if ServiceRequestAnswer.objects.filter(
                service_request=service_request, field_key=field.key
            ).exists():
                continue
            value_text, value_json = self._sample_value(field, fake)
            ServiceRequestAnswer.objects.create(
                service_request=service_request,
                field=field,
                field_key=field.key,
                field_label=field.label,
                field_type=field.field_type,
                stage_title=field.stage.title,
                stage_order=field.stage.order,
                value_text=value_text,
                value_json=value_json,
            )

    @staticmethod
    def _sample_value(field, fake):
        """Return (value_text, value_json) coherent with the field type."""
        ft = field.field_type
        if ft == 'input':
            return fake.name(), None
        if ft == 'text_area':
            return fake.paragraph(nb_sentences=3), None
        if ft == 'number':
            return str(fake.random_int(min=18, max=80)), None
        if ft == 'date':
            return fake.date_this_decade().isoformat(), None
        if ft == 'email':
            return fake.email(), None
        if ft == 'select_single':
            opt = random.choice(field.options or [{'value': 'medium'}])
            return opt.get('value', ''), None
        if ft == 'select_multiple':
            opts = field.options or []
            chosen = random.sample(opts, k=min(2, len(opts))) if opts else []
            return None, [o.get('value') for o in chosen]
        if ft == 'file':
            return 'documento.pdf', None
        return '', None
