import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import User, DynamicDocument, DocumentVariable, DocumentSignature

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

        # Get all lawyers and clients
        lawyers = User.objects.filter(role='lawyer')
        clients = User.objects.filter(role='client')

        if not lawyers.exists() or not clients.exists():
            self.stdout.write(self.style.ERROR('No lawyers or clients found. Please create users first.'))
            return

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
            # Randomly select a lawyer and client
            lawyer = random.choice(lawyers)
            client = random.choice(clients)

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

            # Create the document
            document = DynamicDocument.objects.create(
                title=f'Document {i+1}',
                content=f'This is the content of document {i+1}',
                state=random.choice(['Draft', 'Published', 'Progress', 'Completed']),
                created_by=lawyer,
                assigned_to=client,
                created_at=created_at,
                updated_at=updated_at,
                requires_signature=random.choice([True, False])
            )

            # Create some variables for the document
            num_variables = random.randint(1, 5)
            for j in range(num_variables):
                DocumentVariable.objects.create(
                    document=document,
                    name_en=f'variable_{j+1}',
                    name_es=f'variable_{j+1}',
                    tooltip=f'Tooltip for variable {j+1}',
                    field_type=random.choice(['input', 'text_area']),
                    value=f'Value for variable {j+1}'
                )

            # If document requires signature, create signature records
            if document.requires_signature:
                # Randomly select 1-3 signers
                num_signers = random.randint(1, 3)
                signers = random.sample(list(clients), min(num_signers, clients.count()))
                
                for signer in signers:
                    DocumentSignature.objects.create(
                        document=document,
                        signer=signer,
                        signed=random.choice([True, False]),
                        signed_at=timezone.now() if random.choice([True, False]) else None,
                        ip_address=f'192.168.1.{random.randint(1, 255)}' if random.choice([True, False]) else None
                    )

            self.stdout.write(self.style.SUCCESS(f'Successfully created document "{document.title}"'))

        self.stdout.write(self.style.SUCCESS(f'Successfully created {num_documents} dynamic documents')) 