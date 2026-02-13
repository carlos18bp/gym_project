import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import (
    User,
    DynamicDocument,
    DocumentVariable,
    DocumentSignature,
    Tag,
    DocumentFolder,
    DocumentRelationship,
    DocumentVisibilityPermission,
)

class Command(BaseCommand):
    help = 'Create fake dynamic documents for testing the documents report functionality'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--num_documents',
            type=int,
            default=30,
            help='Number of documents to create'
        )
    
    def handle(self, *args, **options):
        fake = Faker()
        num_documents = options.get('num_documents', 10)
        self.stdout.write(f'Creating {num_documents} dynamic documents...')

        # Get all lawyers and potential client-side users (client, basic, corporate_client)
        lawyers = list(User.objects.filter(role='lawyer'))
        clients = list(User.objects.filter(role__in=['client', 'basic', 'corporate_client']))

        if not lawyers or not clients:
            self.stdout.write(self.style.ERROR('No lawyers or client-side users found. Please create users first.'))
            return

        # Preferred test users by email (if they already exist)
        special_lawyer = User.objects.filter(
            email='core.paginaswebscolombia@gmail.com',
            role='lawyer'
        ).first()
        # Locate special client by email ONLY so it works even if role changes (client/basic/corporate_client)
        special_client = User.objects.filter(
            email='carlos18bp@gmail.com',
        ).first()
        # Same for basic test user
        special_basic = User.objects.filter(
            email='info.montreal.studios@gmail.com',
        ).first()

        # Build weighted candidate pools so these users receive more documents
        lawyer_candidates = lawyers.copy()
        if special_lawyer and special_lawyer not in lawyer_candidates:
            lawyer_candidates.extend([special_lawyer] * 5)

        client_candidates = clients.copy()
        for user in [special_client, special_basic]:
            if user and user not in client_candidates:
                client_candidates.extend([user] * 4)

        # Document state choices
        states = ['Draft', 'Published', 'Progress', 'Completed', 'Rejected', 'Pending Review']
        
        # Document template titles and content patterns
        document_templates = [
            {
                'title_prefix': 'Contrato de Servicios Legales',
                'content': 'Este contrato establece los términos y condiciones para la prestación de servicios legales...'
            },
            {
                'title_prefix': 'Poder General',
                'content': 'Por medio del presente documento, se otorga poder amplio y suficiente a...'
            },
            {
                'title_prefix': 'Acuerdo de Confidencialidad',
                'content': 'Las partes acuerdan mantener la confidencialidad de toda información compartida...'
            },
            {
                'title_prefix': 'Demanda por Incumplimiento',
                'content': 'Ante el tribunal competente, se presenta formal demanda por incumplimiento de contrato...'
            },
            {
                'title_prefix': 'Contestación de Demanda',
                'content': 'En respuesta a la demanda presentada, mi representado manifiesta lo siguiente...'
            },
            {
                'title_prefix': 'Recurso de Apelación',
                'content': 'Se interpone formal recurso de apelación contra la sentencia dictada...'
            },
            {
                'title_prefix': 'Dictamen Legal',
                'content': 'Habiendo analizado los hechos y la legislación aplicable, se emite el siguiente dictamen...'
            },
            {
                'title_prefix': 'Escritura Pública',
                'content': 'ESCRITURA PÚBLICA NÚMERO _____. En la ciudad de _____, a los ___ días del mes de _____ del año _____...'
            },
            {
                'title_prefix': 'Testamento',
                'content': 'Yo, _____, en pleno uso de mis facultades mentales, otorgo el presente testamento...'
            },
            {
                'title_prefix': 'Contrato de Compraventa',
                'content': 'CONTRATO DE COMPRAVENTA que celebran por una parte _____ como "EL VENDEDOR" y por otra parte _____ como "EL COMPRADOR"...'
            },
            {
                'title_prefix': 'Contrato de Arrendamiento',
                'content': 'CONTRATO DE ARRENDAMIENTO que celebran _____ como "EL ARRENDADOR" y _____ como "EL ARRENDATARIO"...'
            },
            {
                'title_prefix': 'Convenio de Terminación Laboral',
                'content': 'CONVENIO DE TERMINACIÓN LABORAL que celebran por una parte _____ como "EL PATRÓN" y por otra parte _____ como "EL TRABAJADOR"...'
            }
        ]
        
        # Variable names for document templates
        variable_templates = [
            {'name_en': 'client_name', 'name_es': 'nombre_cliente', 'tooltip': 'Nombre completo del cliente', 'field_type': 'input'},
            {'name_en': 'lawyer_name', 'name_es': 'nombre_abogado', 'tooltip': 'Nombre completo del abogado', 'field_type': 'input'},
            {'name_en': 'start_date', 'name_es': 'fecha_inicio', 'tooltip': 'Fecha de inicio', 'field_type': 'input'},
            {'name_en': 'end_date', 'name_es': 'fecha_fin', 'tooltip': 'Fecha de fin', 'field_type': 'input'},
            {'name_en': 'fee_amount', 'name_es': 'monto_honorarios', 'tooltip': 'Monto de honorarios', 'field_type': 'input'},
            {'name_en': 'details', 'name_es': 'detalles', 'tooltip': 'Detalles adicionales', 'field_type': 'text_area'},
            {'name_en': 'contract_number', 'name_es': 'numero_contrato', 'tooltip': 'Número de contrato', 'field_type': 'input'},
            {'name_en': 'case_description', 'name_es': 'descripcion_caso', 'tooltip': 'Descripción del caso', 'field_type': 'text_area'},
            {'name_en': 'property_address', 'name_es': 'direccion_propiedad', 'tooltip': 'Dirección de la propiedad', 'field_type': 'input'},
            {'name_en': 'price', 'name_es': 'precio', 'tooltip': 'Precio o monto', 'field_type': 'input'},
            {'name_en': 'deadline', 'name_es': 'fecha_limite', 'tooltip': 'Fecha límite', 'field_type': 'input'},
            {'name_en': 'court_name', 'name_es': 'nombre_tribunal', 'tooltip': 'Nombre del tribunal', 'field_type': 'input'},
            {'name_en': 'judge_name', 'name_es': 'nombre_juez', 'tooltip': 'Nombre del juez', 'field_type': 'input'},
            {'name_en': 'hearing_date', 'name_es': 'fecha_audiencia', 'tooltip': 'Fecha de audiencia', 'field_type': 'input'},
            {'name_en': 'payment_terms', 'name_es': 'terminos_pago', 'tooltip': 'Términos de pago', 'field_type': 'text_area'}
        ]
        
        # Clear existing documents if needed (uncomment if you want to start fresh)
        # DynamicDocument.objects.all().delete()
        # self.stdout.write(self.style.SUCCESS('Cleared existing documents'))
        
        # Create documents
        for i in range(num_documents):
            # Select a lawyer and client, prioritizing preferred test users when available
            lawyer = random.choice(lawyer_candidates)
            client = random.choice(client_candidates)

            # Generate random dates within the last year
            days_ago = random.randint(0, 365)  # Random day in the last year
            created_at = timezone.now() - timedelta(days=days_ago)
            
            # Ensure updated_at is after created_at
            days_since_creation = min(days_ago, 60)  # Limit to 60 days or less
            if days_since_creation > 0:
                update_days = random.randint(1, days_since_creation)
                updated_at = created_at + timedelta(days=update_days)
            else:
                updated_at = created_at

            # Pick a base template and build rich content with variables
            base_template = random.choice(document_templates)
            title = f"{base_template['title_prefix']} #{i+1}"

            content = (
                f"{base_template['content']}\n\n"
                "PARTES DEL CONTRATO\n"
                "Cliente: {{client_name}}\n"
                "Contraparte: {{counterparty_name}}\n"
                "Abogado responsable: {{lawyer_name}}\n\n"
                "DATOS PRINCIPALES\n"
                "Objeto: {{contract_object}}\n"
                "Valor del contrato: {{contract_value}}\n"
                "Plazo: {{contract_term}}\n"
                "Fecha de suscripción: {{subscription_date}}\n"
                "Fecha de inicio: {{start_date}}\n"
                "Fecha de terminación: {{end_date}}\n\n"
                "INFORMACIÓN ADICIONAL\n"
                "Número de contrato: {{contract_number}}\n"
                "Honorarios: {{fee_amount}}\n"
                "Condiciones de pago: {{payment_terms}}\n"
            )

            # Create the document
            # Business rule for fake data:
            # - All documents always have values for: objeto, valor, plazo,
            #   fecha de expiración (end_date) and 1-2 etiquetas (tags).
            # - Other variables (client_name, lawyer_name, etc.) are only
            #   filled for Progress / Completed documents.
            document_state = random.choice(['Draft', 'Published', 'Progress', 'Completed'])

            document = DynamicDocument.objects.create(
                title=title,
                content=content,
                state=document_state,
                created_by=lawyer,
                assigned_to=client,
                created_at=created_at,
                updated_at=updated_at,
                requires_signature=random.choice([True, False])
            )

            # Attach some tags for filtering in lists
            tag_names = [
                'Urgente',
                'Renovación',
                'Alto valor',
                'Cliente nuevo',
                'Confidencial',
            ]
            available_tags = []
            for name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=name)
                available_tags.append(tag)

            # Always assign 1-2 tags so every document has etiquetas
            num_tags = random.randint(1, 2)
            document.tags.set(random.sample(available_tags, k=num_tags))

            # Determine if this document should have variable values
            # Only Progress / Completed documents represent datos llenados
            should_fill_values = document_state in ['Progress', 'Completed']

            # Create core variables aligned with the content
            # Non-classified basic parties
            DocumentVariable.objects.create(
                document=document,
                name_en='client_name',
                name_es='Nombre del cliente',
                tooltip='Nombre completo del cliente',
                field_type='input',
                value=(client.get_full_name() or client.email) if should_fill_values else '',
                summary_field='none'
            )

            DocumentVariable.objects.create(
                document=document,
                name_en='lawyer_name',
                name_es='Nombre del abogado',
                tooltip='Nombre completo del abogado responsable',
                field_type='input',
                value=(lawyer.get_full_name() or lawyer.email) if should_fill_values else '',
                summary_field='none'
            )

            # Counterparty / Usuario
            DocumentVariable.objects.create(
                document=document,
                name_en='counterparty_name',
                name_es='Nombre Contraparte',
                tooltip='Nombre de la contraparte o contratista',
                field_type='input',
                value=fake.name() if should_fill_values else '',
                summary_field='counterparty'
            )

            # Objeto (always populated)
            DocumentVariable.objects.create(
                document=document,
                name_en='contract_object',
                name_es='Objeto del contrato',
                tooltip='Objeto principal del documento',
                field_type='text_area',
                value=fake.sentence(nb_words=8),
                summary_field='object'
            )

            # Valor (with currency – always populated)
            amount = random.randint(1_000_000, 50_000_000)
            currency = random.choice(['COP', 'USD', 'EUR'])
            DocumentVariable.objects.create(
                document=document,
                name_en='contract_value',
                name_es='Valor del contrato',
                tooltip='Valor económico principal del documento',
                field_type='number',
                value=str(amount),
                summary_field='value',
                currency=currency
            )

            # Plazo (always populated)
            term_text = random.choice([
                '12 meses',
                '6 meses',
                'Indefinido',
                'Hasta nueva orden',
            ])
            DocumentVariable.objects.create(
                document=document,
                name_en='contract_term',
                name_es='Plazo del contrato',
                tooltip='Duración o plazo del documento',
                field_type='input',
                value=term_text,
                summary_field='term'
            )

            # Fechas: suscripción, inicio, fin (tipo date)
            base_date = created_at.date()

            DocumentVariable.objects.create(
                document=document,
                name_en='subscription_date',
                name_es='Fecha de suscripción',
                tooltip='Fecha de suscripción del documento',
                field_type='date',
                value=base_date.strftime('%Y-%m-%d') if should_fill_values else '',
                summary_field='subscription_date'
            )

            start_date = base_date + timedelta(days=random.randint(0, 30))
            DocumentVariable.objects.create(
                document=document,
                name_en='start_date',
                name_es='Fecha de inicio',
                tooltip='Fecha de inicio de vigencia',
                field_type='date',
                value=start_date.strftime('%Y-%m-%d') if should_fill_values else '',
                summary_field='start_date'
            )

            # Fecha de expiración / terminación (always populated)
            end_date = base_date + timedelta(days=random.randint(60, 365))
            DocumentVariable.objects.create(
                document=document,
                name_en='end_date',
                name_es='Fecha de terminación',
                tooltip='Fecha de terminación de vigencia',
                field_type='date',
                value=end_date.strftime('%Y-%m-%d'),
                summary_field='end_date'
            )

            # Additional generic variables referenced in the content
            contract_number = f"CONT-{created_at.year}-{i+1:03d}"
            DocumentVariable.objects.create(
                document=document,
                name_en='contract_number',
                name_es='Número de contrato',
                tooltip='Identificador del contrato',
                field_type='input',
                value=contract_number if should_fill_values else '',
                summary_field='none'
            )

            # Honorarios (también tratados como valor con moneda, igual que contract_value)
            fee_amount = random.randint(500_000, 10_000_000)
            DocumentVariable.objects.create(
                document=document,
                name_en='fee_amount',
                name_es='Honorarios',
                tooltip='Monto de honorarios profesionales',
                field_type='number',
                value=str(fee_amount) if should_fill_values else '',
                summary_field='value',
                currency=currency if should_fill_values else None
            )

            DocumentVariable.objects.create(
                document=document,
                name_en='payment_terms',
                name_es='Condiciones de pago',
                tooltip='Condiciones y plazos de pago',
                field_type='text_area',
                value=random.choice([
                    'Pago único al inicio del contrato.',
                    '50% al inicio y 50% a la firma.',
                    'Mensualidades durante la vigencia del contrato.',
                ]) if should_fill_values else '',
                summary_field='none'
            )

            # If document requires signature, create signature records
            if document.requires_signature:
                # Randomly select 1-3 signers
                num_signers = random.randint(1, 3)
                signers_pool = client_candidates
                signers = random.sample(signers_pool, min(num_signers, len(signers_pool)))
                
                for signer in signers:
                    DocumentSignature.objects.create(
                        document=document,
                        signer=signer,
                        signed=random.choice([True, False]),
                        signed_at=timezone.now() if random.choice([True, False]) else None,
                        ip_address=f'192.168.1.{random.randint(1, 255)}' if random.choice([True, False]) else None
                    )

            self.stdout.write(self.style.SUCCESS(f'Successfully created document "{document.title}"'))

        # Create additional full-featured documents explicitly linked to preferred test users
        # so that they always have a reasonable batch of templates (minutas) y documentos.
        EXTRA_PER_USER = 20  # Aumentado de 10 a 20 para tener más variedad

        def create_full_document_for(created_by_user, assigned_to_user, as_template, label_suffix):
            """Create an extra dynamic document with the same structure and variables as the main ones.

            Business rule:
            - All documents always have values for: objeto, valor, plazo,
              fecha de expiración (end_date) and 1-2 etiquetas (tags).
            - Other variables (client_name, lawyer_name, etc.) are only
              filled when as_template=False.
            """
            base_template = random.choice(document_templates)
            created_at = timezone.now()
            # Para minutas (templates), usar título limpio sin sufijo
            # Para documentos asignados, agregar número de contrato profesional
            if as_template:
                title = f"{base_template['title_prefix']} {random.randint(1, 999):03d}"
            else:
                contract_number = f"CONT-{created_at.year}-{random.randint(1000, 9999)}"
                title = f"{base_template['title_prefix']} {contract_number}"

            content = (
                f"{base_template['content']}\n\n"
                "PARTES DEL CONTRATO\n"
                "Cliente: {{client_name}}\n"
                "Contraparte: {{counterparty_name}}\n"
                "Abogado responsable: {{lawyer_name}}\n\n"
                "DATOS PRINCIPALES\n"
                "Objeto: {{contract_object}}\n"
                "Valor del contrato: {{contract_value}}\n"
                "Plazo: {{contract_term}}\n"
                "Fecha de suscripción: {{subscription_date}}\n"
                "Fecha de inicio: {{start_date}}\n"
                "Fecha de terminación: {{end_date}}\n\n"
                "INFORMACIÓN ADICIONAL\n"
                "Número de contrato: {{contract_number}}\n"
                "Honorarios: {{fee_amount}}\n"
                "Condiciones de pago: {{payment_terms}}\n"
            )

            # For templates (minutas) we keep state Published and no assigned_to
            if as_template:
                state = 'Published'
                assigned = None
            else:
                state = random.choice(['Draft', 'Progress', 'Completed'])
                assigned = assigned_to_user

            doc = DynamicDocument.objects.create(
                title=title,
                content=content,
                state=state,
                created_by=created_by_user,
                assigned_to=assigned,
                created_at=created_at,
                updated_at=created_at,
                requires_signature=random.choice([True, False])
            )

            # Attach some tags similar to main documents
            tag_names = ['Urgente', 'Renovación', 'Alto valor', 'Cliente nuevo', 'Confidencial']
            available_tags = []
            for name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=name)
                available_tags.append(tag)
            # Always assign 1-2 tags so every document has etiquetas
            num_tags = random.randint(1, 2)
            doc.tags.set(random.sample(available_tags, k=num_tags))

            # Determine if this document should have variable values for non-core fields.
            # Templates (as_template=True) keep non-core variables without values.
            # Core fields (objeto, valor, plazo, end_date) are ALWAYS populated.
            should_fill_values = not as_template

            # client_name / lawyer_name
            # Regla especial: si el documento está asignado a un usuario con rol 'lawyer'
            # (por ejemplo, el abogado de pruebas), no usamos su nombre como "cliente".
            # En ese caso:
            #   - client_name: nombre ficticio de cliente
            #   - lawyer_name: nombre del abogado asignado (assigned_to_user)
            if assigned_to_user and getattr(assigned_to_user, 'role', None) == 'lawyer':
                client_name_value = fake.name() if should_fill_values else ''
                lawyer_name_value = (assigned_to_user.get_full_name() or assigned_to_user.email) if should_fill_values else ''
            else:
                client_name_value = ((assigned_to_user.get_full_name() or assigned_to_user.email) if assigned_to_user else '') if should_fill_values else ''
                lawyer_name_value = (created_by_user.get_full_name() or created_by_user.email) if should_fill_values else ''

            DocumentVariable.objects.create(
                document=doc,
                name_en='client_name',
                name_es='Nombre del cliente',
                tooltip='Nombre completo del cliente',
                field_type='input',
                value=client_name_value,
                summary_field='none'
            )
            DocumentVariable.objects.create(
                document=doc,
                name_en='lawyer_name',
                name_es='Nombre del abogado',
                tooltip='Nombre completo del abogado responsable',
                field_type='input',
                value=lawyer_name_value,
                summary_field='none'
            )

            # Counterparty / Usuario
            DocumentVariable.objects.create(
                document=doc,
                name_en='counterparty_name',
                name_es='Nombre Contraparte',
                tooltip='Nombre de la contraparte o contratista',
                field_type='input',
                value=fake.name() if should_fill_values else '',
                summary_field='counterparty'
            )

            # Objeto (always populated)
            DocumentVariable.objects.create(
                document=doc,
                name_en='contract_object',
                name_es='Objeto del contrato',
                tooltip='Objeto principal del documento',
                field_type='text_area',
                value=fake.sentence(nb_words=8),
                summary_field='object'
            )

            # Valor (with currency – always populated)
            amount = random.randint(1_000_000, 50_000_000)
            currency = random.choice(['COP', 'USD', 'EUR'])
            DocumentVariable.objects.create(
                document=doc,
                name_en='contract_value',
                name_es='Valor del contrato',
                tooltip='Valor económico principal del documento',
                field_type='number',
                value=str(amount),
                summary_field='value',
                currency=currency
            )

            # Plazo (always populated)
            term_text = random.choice(['12 meses', '6 meses', 'Indefinido', 'Hasta nueva orden'])
            DocumentVariable.objects.create(
                document=doc,
                name_en='contract_term',
                name_es='Plazo del contrato',
                tooltip='Duración o plazo del documento',
                field_type='input',
                value=term_text,
                summary_field='term'
            )

            # Fechas: suscripción, inicio, fin
            base_date = created_at.date()
            DocumentVariable.objects.create(
                document=doc,
                name_en='subscription_date',
                name_es='Fecha de suscripción',
                tooltip='Fecha de suscripción del documento',
                field_type='date',
                value=base_date.strftime('%Y-%m-%d') if should_fill_values else '',
                summary_field='subscription_date'
            )
            start_date = base_date + timedelta(days=random.randint(0, 30))
            DocumentVariable.objects.create(
                document=doc,
                name_en='start_date',
                name_es='Fecha de inicio',
                tooltip='Fecha de inicio de vigencia',
                field_type='date',
                value=start_date.strftime('%Y-%m-%d') if should_fill_values else '',
                summary_field='start_date'
            )
            # Fecha de expiración / terminación (always populated)
            end_date = base_date + timedelta(days=random.randint(60, 365))
            DocumentVariable.objects.create(
                document=doc,
                name_en='end_date',
                name_es='Fecha de terminación',
                tooltip='Fecha de terminación de vigencia',
                field_type='date',
                value=end_date.strftime('%Y-%m-%d'),
                summary_field='end_date'
            )

            # Variables adicionales
            contract_number = f"CONT-{created_at.year}-{random.randint(1, 999):03d}"
            DocumentVariable.objects.create(
                document=doc,
                name_en='contract_number',
                name_es='Número de contrato',
                tooltip='Identificador del contrato',
                field_type='input',
                value=contract_number if should_fill_values else '',
                summary_field='none'
            )
            # Honorarios (también con moneda, igual que contract_value)
            fee_amount = random.randint(500_000, 10_000_000)
            DocumentVariable.objects.create(
                document=doc,
                name_en='fee_amount',
                name_es='Honorarios',
                tooltip='Monto de honorarios profesionales',
                field_type='number',
                value=str(fee_amount) if should_fill_values else '',
                summary_field='value',
                currency=currency if should_fill_values else None
            )
            DocumentVariable.objects.create(
                document=doc,
                name_en='payment_terms',
                name_es='Condiciones de pago',
                tooltip='Condiciones y plazos de pago',
                field_type='text_area',
                value=random.choice([
                    'Pago único al inicio del contrato.',
                    '50% al inicio y 50% a la firma.',
                    'Mensualidades durante la vigencia del contrato.',
                ]) if should_fill_values else '',
                summary_field='none'
            )

            self.stdout.write(self.style.SUCCESS(
                f'Extra test document for {label_suffix}: "{doc.title}" (created_by={created_by_user.email}, assigned_to={assigned_to_user.email if assigned_to_user else "None"})'
            ))

        def create_document_from_template(template_doc, assigned_to_user, state, requires_signature, label_suffix, create_signature_for_client=False):
            """Create a client document starting from an existing template (minuta)."""
            if not template_doc or not assigned_to_user:
                return None

            created_at = timezone.now()
            # Usar solo el título base de la plantilla, sin concatenar información técnica
            # Agregar solo un número de contrato profesional
            contract_number = f"CONT-{created_at.year}-{random.randint(1000, 9999)}"
            title = f"{template_doc.title.split(' - ')[0]} {contract_number}"

            doc = DynamicDocument.objects.create(
                title=title,
                content=template_doc.content,
                state=state,
                created_by=template_doc.created_by,
                assigned_to=assigned_to_user,
                created_at=created_at,
                updated_at=created_at,
                requires_signature=requires_signature,
            )

            # Copy tags from template; ensure at least 1-2 tags
            template_tags = list(template_doc.tags.all())
            if template_tags:
                doc.tags.set(template_tags)
            # Backfill: guarantee 1-2 tags even if template had none
            if doc.tags.count() == 0:
                tag_names_fallback = ['Urgente', 'Renovación', 'Alto valor', 'Cliente nuevo', 'Confidencial']
                fallback_tags = []
                for tn in tag_names_fallback:
                    t, _ = Tag.objects.get_or_create(name=tn)
                    fallback_tags.append(t)
                doc.tags.set(random.sample(fallback_tags, k=random.randint(1, 2)))

            # Clone variables, adapting party names and ensuring core fields are always populated
            base_date = created_at.date()
            for var in template_doc.variables.all():
                value = var.value
                var_currency = var.currency

                if var.name_en == 'client_name':
                    value = assigned_to_user.get_full_name() or assigned_to_user.email
                elif var.name_en == 'lawyer_name' and template_doc.created_by:
                    value = template_doc.created_by.get_full_name() or template_doc.created_by.email

                # Backfill core fields if empty (e.g. cloned from a template with no values)
                if not value:
                    if var.summary_field == 'object':
                        value = fake.sentence(nb_words=8)
                    elif var.summary_field == 'value':
                        value = str(random.randint(1_000_000, 50_000_000))
                        if not var_currency:
                            var_currency = random.choice(['COP', 'USD', 'EUR'])
                    elif var.summary_field == 'term':
                        value = random.choice(['12 meses', '6 meses', 'Indefinido', 'Hasta nueva orden'])
                    elif var.summary_field == 'end_date':
                        value = (base_date + timedelta(days=random.randint(60, 365))).strftime('%Y-%m-%d')

                DocumentVariable.objects.create(
                    document=doc,
                    name_en=var.name_en,
                    name_es=var.name_es,
                    tooltip=var.tooltip,
                    field_type=var.field_type,
                    select_options=var.select_options,
                    value=value,
                    summary_field=var.summary_field,
                    currency=var_currency,
                )

            # Optionally create a pending signature for the client
            if requires_signature and create_signature_for_client:
                # Always include the client as signer
                DocumentSignature.objects.create(
                    document=doc,
                    signer=assigned_to_user,
                    signed=False,
                )

                # Optionally add the lawyer as additional signer
                signer_lawyer = template_doc.created_by or (lawyer_candidates[0] if lawyer_candidates else None)
                if signer_lawyer and signer_lawyer != assigned_to_user:
                    DocumentSignature.objects.get_or_create(
                        document=doc,
                        signer=signer_lawyer,
                        defaults={'signed': False},
                    )

            self.stdout.write(self.style.SUCCESS(
                f'Client document from template for {assigned_to_user.email}: "{doc.title}" (state={state})'
            ))

            return doc

        # 10 minutas (templates) creadas por el abogado especial
        if special_lawyer:
            for i in range(EXTRA_PER_USER):
                create_full_document_for(
                    created_by_user=special_lawyer,
                    assigned_to_user=None,
                    as_template=True,
                    label_suffix=f"Minuta {i+1} - {special_lawyer.email}"
                )

        # 10 documentos asignados directamente al cliente especial
        if special_client and lawyer_candidates:
            for i in range(EXTRA_PER_USER):
                lawyer = random.choice(lawyer_candidates)
                create_full_document_for(
                    created_by_user=lawyer,
                    assigned_to_user=special_client,
                    as_template=False,
                    label_suffix=f"Documento cliente {special_client.email} #{i+1}"
                )

        # 10 documentos asignados directamente al usuario básico especial
        if special_basic and lawyer_candidates:
            for i in range(EXTRA_PER_USER):
                lawyer = random.choice(lawyer_candidates)
                create_full_document_for(
                    created_by_user=lawyer,
                    assigned_to_user=special_basic,
                    as_template=False,
                    label_suffix=f"Documento básico {special_basic.email} #{i+1}"
                )

        # Documentos asignados directamente al abogado especial para pruebas
        # Estos documentos permiten poblar la pestaña "Mis Documentos" cuando se inicia sesión
        # como el abogado de pruebas (special_lawyer).
        if special_lawyer and lawyer_candidates:
            for i in range(EXTRA_PER_USER):
                # El documento puede ser creado por el propio abogado especial o por otro abogado
                created_by_user = random.choice(lawyer_candidates)
                create_full_document_for(
                    created_by_user=created_by_user,
                    assigned_to_user=special_lawyer,
                    as_template=False,
                    label_suffix=f"Documento abogado {special_lawyer.email} #{i+1}"
                )

        # Extra documentos creados realmente desde minutas para el cliente especial
        if special_client:
            templates = list(
                DynamicDocument.objects.filter(
                    state='Published',
                    assigned_to__isnull=True,
                )
            )

            if templates:
                CLIENT_DOCS_FROM_TEMPLATES = 20  # Aumentado de 10 a 20
                for i in range(CLIENT_DOCS_FROM_TEMPLATES):
                    template_doc = random.choice(templates)

                    # Ciclo de estados para tener mezcla balanceada:
                    # 40% PendingSignatures, 30% FullySigned, 20% Completed, 10% Progress
                    cycle = i % 10
                    if cycle < 4:  # 40% PendingSignatures
                        state = 'PendingSignatures'
                        requires_signature = True
                        create_sig = True
                    elif cycle < 7:  # 30% FullySigned (firmas completadas)
                        state = 'PendingSignatures'  # Inicialmente pending
                        requires_signature = True
                        create_sig = True  # Crearemos firmas y las marcaremos como firmadas
                    elif cycle < 9:  # 20% Completed
                        state = 'Completed'
                        requires_signature = False
                        create_sig = False
                    else:  # 10% Progress
                        state = 'Progress'
                        requires_signature = False
                        create_sig = False

                    doc = create_document_from_template(
                        template_doc=template_doc,
                        assigned_to_user=special_client,
                        state=state,
                        requires_signature=requires_signature,
                        label_suffix=f"Desde plantilla #{i+1} para {special_client.email}",
                        create_signature_for_client=create_sig,
                    )
                    
                    # Si el ciclo indica que debe estar FullySigned, marcar todas las firmas como firmadas
                    if doc and cycle >= 4 and cycle < 7:
                        for sig in doc.signatures.all():
                            sig.signed = True
                            sig.signed_at = timezone.now() - timedelta(days=random.randint(1, 15))
                            sig.ip_address = f'192.168.1.{random.randint(1, 255)}'
                            sig.save()
                        doc.state = 'FullySigned'
                        doc.fully_signed = True
                        doc.save(update_fields=['state', 'fully_signed'])

        # Crear algunos documentos de ejemplo en estados Rejected y Expired para pruebas del flujo de firmas
        # IMPORTANTE: Solo convertir una porción de los documentos, dejando otros en PendingSignatures
        # para que los usuarios de prueba tengan documentos reales por firmar
        signature_docs = list(DynamicDocument.objects.filter(requires_signature=True))

        # Separar documentos PendingSignatures de los demás
        pending_docs = [doc for doc in signature_docs if doc.state == 'PendingSignatures']
        
        # Solo marcar como Rejected/Expired hasta el 40% de los documentos pendientes
        # para dejar suficientes documentos en PendingSignatures para pruebas
        max_to_convert = max(3, int(len(pending_docs) * 0.4))

        # Marcar algunos documentos como Rejected con un comentario de rechazo
        rejected_count = 0
        rejected_limit = min(max_to_convert // 2, 5)  # Máximo 5 rechazados
        for doc in signature_docs:
            if rejected_count >= rejected_limit:
                break
            # Evitar pisar documentos ya completamente firmados o ya procesados
            if doc.state in ['FullySigned', 'Rejected', 'Expired']:
                continue
            # Solo procesar si está en PendingSignatures
            if doc.state != 'PendingSignatures':
                continue
            sig = doc.signatures.filter(signed=False).first()
            if not sig:
                continue
            sig.rejected = True
            sig.rejected_at = timezone.now() - timedelta(days=random.randint(1, 30))
            sig.rejection_comment = fake.sentence(nb_words=12)
            sig.save(update_fields=['rejected', 'rejected_at', 'rejection_comment'])
            doc.state = 'Rejected'
            doc.fully_signed = False
            doc.save(update_fields=['state', 'fully_signed'])
            rejected_count += 1

        # Marcar algunos documentos como Expired asignando una fecha límite en el pasado
        expired_count = 0
        expired_limit = min(max_to_convert // 2, 5)  # Máximo 5 expirados
        for doc in signature_docs:
            if expired_count >= expired_limit:
                break
            # Solo procesar documentos que aún estén en PendingSignatures y no hayan sido rechazados
            if doc.state != 'PendingSignatures':
                continue
            doc.signature_due_date = timezone.now().date() - timedelta(days=random.randint(5, 30))
            doc.state = 'Expired'
            doc.fully_signed = False
            doc.save(update_fields=['signature_due_date', 'state', 'fully_signed'])
            expired_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Created {rejected_count} rejected and {expired_count} expired documents for testing. '
            f'Remaining PendingSignatures: {DynamicDocument.objects.filter(state="PendingSignatures").count()}'
        ))

        # Ensure visibility permissions for all assigned documents so clients/basic/corporate can see them
        all_docs_with_assignee = DynamicDocument.objects.filter(assigned_to__isnull=False)
        for doc in all_docs_with_assignee.select_related('assigned_to'):
            try:
                DocumentVisibilityPermission.objects.get_or_create(
                    document=doc,
                    user=doc.assigned_to,
                    defaults={'granted_by': doc.created_by},
                )
            except Exception:
                # Fake data helper: swallow any unexpected errors here
                continue

        # Create folders (DocumentFolder) for users with assigned documents
        owners = (
            User.objects
            .exclude(role='lawyer')
            .filter(assigned_documents__isnull=False)
            .distinct()
        )

        for owner in owners:
            owner_docs_qs = DynamicDocument.objects.filter(assigned_to=owner)
            owner_docs = list(owner_docs_qs)
            if not owner_docs:
                continue

            folder_specs = [
                ("Contratos en curso", 0),
                ("Contratos completados", 1),
                ("Borradores", 2),
            ]

            for name, color_id in folder_specs:
                if len(owner_docs) == 0:
                    break
                sample_size = min(len(owner_docs), max(1, random.randint(1, len(owner_docs))))
                docs_sample = random.sample(owner_docs, sample_size)
                folder = DocumentFolder.objects.create(
                    name=name,
                    color_id=color_id,
                    owner=owner,
                )
                folder.documents.set(docs_sample)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created folder "{folder.name}" for {owner.email} with {folder.documents.count()} documents'
                    )
                )

        # Create realistic document relationships following the new rules:
        # - Draft/Published (Minutas) CANNOT have relationships
        # - Only Completed documents can be associated in "Mis Documentos" context
        # - FullySigned documents can be associated in signature workflows
        # - PendingSignatures documents can view but not edit relationships
        
        relationships_created = 0
        
        # Get documents by state
        completed_docs = list(DynamicDocument.objects.filter(state='Completed'))
        fully_signed_docs = list(DynamicDocument.objects.filter(state='FullySigned'))
        
        self.stdout.write(f'Creating relationships for {len(completed_docs)} completed and {len(fully_signed_docs)} signed documents...')
        
        # Scenario 1: Associate Completed documents with other Completed documents
        # This simulates the "Mis Documentos" workflow where users associate completed documents
        if len(completed_docs) >= 2:
            # 40-50% of completed documents get associations
            num_to_associate = int(len(completed_docs) * random.uniform(0.4, 0.5))
            docs_to_associate = random.sample(completed_docs, min(num_to_associate, len(completed_docs)))
            
            for completed_doc in docs_to_associate:
                # Each completed document can be associated with 1-2 other completed documents
                other_completed = [d for d in completed_docs if d.id != completed_doc.id]
                if not other_completed:
                    continue
                
                num_associations = random.randint(1, min(2, len(other_completed)))
                docs_to_link = random.sample(other_completed, num_associations)
                
                for other_doc in docs_to_link:
                    created_by_for_rel = (
                        completed_doc.created_by
                        or other_doc.created_by
                        or special_lawyer
                        or (lawyers[0] if lawyers else None)
                    )
                    if not created_by_for_rel:
                        continue
                    
                    # Avoid duplicate relationships
                    existing = DocumentRelationship.objects.filter(
                        source_document=completed_doc,
                        target_document=other_doc
                    ).exists() or DocumentRelationship.objects.filter(
                        source_document=other_doc,
                        target_document=completed_doc
                    ).exists()
                    
                    if not existing:
                        rel = DocumentRelationship.objects.create(
                            source_document=completed_doc,
                            target_document=other_doc,
                            created_by=created_by_for_rel
                        )
                        relationships_created += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✓ Linked completed "{completed_doc.title[:40]}" with "{other_doc.title[:40]}"'
                            )
                        )
        
        # Scenario 2: Create relationships between signed documents (historical associations)
        # This simulates contracts that were associated before being signed
        if len(fully_signed_docs) >= 2:
            # Create 30-40% of signed documents with associations to other signed documents
            num_to_associate = int(len(fully_signed_docs) * random.uniform(0.3, 0.4))
            signed_docs_sample = random.sample(fully_signed_docs, min(num_to_associate, len(fully_signed_docs)))
            
            for signed_doc in signed_docs_sample:
                # Each signed document can reference 1-2 other signed documents
                other_signed_docs = [d for d in fully_signed_docs if d.id != signed_doc.id]
                if not other_signed_docs:
                    continue
                
                num_refs = random.randint(1, min(2, len(other_signed_docs)))
                refs_to_create = random.sample(other_signed_docs, num_refs)
                
                for ref_doc in refs_to_create:
                    created_by_for_rel = (
                        signed_doc.created_by
                        or ref_doc.created_by
                        or special_lawyer
                        or (lawyers[0] if lawyers else None)
                    )
                    if not created_by_for_rel:
                        continue
                    
                    # Avoid duplicate relationships (check both directions)
                    existing = DocumentRelationship.objects.filter(
                        source_document=signed_doc,
                        target_document=ref_doc
                    ).exists() or DocumentRelationship.objects.filter(
                        source_document=ref_doc,
                        target_document=signed_doc
                    ).exists()
                    
                    if not existing:
                        rel = DocumentRelationship.objects.create(
                            source_document=signed_doc,
                            target_document=ref_doc,
                            created_by=created_by_for_rel
                        )
                        relationships_created += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✓ Linked signed "{signed_doc.title[:40]}" with "{ref_doc.title[:40]}"'
                            )
                        )
        
        # NOTE: Draft, Published, and Progress documents CANNOT have relationships
        # This follows the new business rules where:
        # - Minutas (Draft/Published) don't have the associations column
        # - Progress documents have the button disabled
        # Only Completed and FullySigned documents can be associated
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Created {relationships_created} document relationships simulating signature workflow scenarios'
            )
        )

        self.stdout.write(self.style.SUCCESS(f'Successfully created dynamic documents (base={num_documents}, extras={EXTRA_PER_USER})'))