import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import User, DynamicDocument, DocumentVariable

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
        num_documents = options['num_documents']
        
        # Get users for assignment
        lawyers = list(User.objects.filter(role='lawyer'))
        clients = list(User.objects.filter(role='client'))
        all_users = lawyers + clients
        
        if not all_users:
            self.stdout.write(self.style.ERROR('No users found. Please run create_clients_lawyers first.'))
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
        documents_created = 0
        variables_created = 0
        
        for i in range(num_documents):
            # Select random template
            template = random.choice(document_templates)
            
            # Select random users
            created_by = random.choice(lawyers)  # Only lawyers create documents
            assigned_to = random.choice(all_users) if random.random() > 0.2 else None  # 20% chance of no assignment
            
            # Generate random dates (within last 120 days)
            days_ago = random.randint(0, 180)
            created_at = timezone.now() - timedelta(days=days_ago)
            
            # For updated_at, either same as created_at or more recent
            if random.random() > 0.5:  # 50% chance of having been updated
                updated_at = created_at + timedelta(days=random.randint(1, min(days_ago, 60)))
            else:
                updated_at = created_at
            
            # Select random state with more balanced distribution
            # Draft: 25%, Published: 20%, Progress: 25%, Completed: 15%, Rejected: 10%, Pending Review: 5%
            state_weights = [0.25, 0.20, 0.25, 0.15, 0.10, 0.05]
            state = random.choices(states, weights=state_weights, k=1)[0]
            
            # Create a unique title
            title = f"{template['title_prefix']} - {fake.company()} ({i+1})"
            
            # Create the document
            document = DynamicDocument.objects.create(
                title=title,
                content=template['content'],
                state=state,
                created_by=created_by,
                assigned_to=assigned_to,
                created_at=created_at,
                updated_at=updated_at
            )
            documents_created += 1
            
            # Add 3-7 variables to the document (more variables for better reports)
            num_variables = random.randint(3, 7)
            var_templates = random.sample(variable_templates, num_variables)
            
            for var_template in var_templates:
                # Generate random value depending on field type
                if var_template['field_type'] == 'input':
                    if 'name' in var_template['name_en']:
                        value = fake.name()
                    elif 'date' in var_template['name_en']:
                        value = fake.date()
                    elif 'amount' in var_template['name_en'] or 'fee' in var_template['name_en'] or 'price' in var_template['name_en']:
                        value = f"${fake.random_int(min=1000, max=100000)}"
                    elif 'number' in var_template['name_en']:
                        value = fake.random_int(min=1000, max=9999)
                    elif 'address' in var_template['name_en']:
                        value = fake.address()
                    elif 'court' in var_template['name_en'] or 'tribunal' in var_template['name_en']:
                        value = f"Tribunal {fake.city()} de {fake.random_element(['Civil', 'Penal', 'Familiar', 'Mercantil'])}"
                    else:
                        value = fake.word()
                else:  # text_area
                    value = fake.paragraph()
                
                DocumentVariable.objects.create(
                    document=document,
                    name_en=var_template['name_en'],
                    name_es=var_template['name_es'],
                    tooltip=var_template['tooltip'],
                    field_type=var_template['field_type'],
                    value=value
                )
                variables_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {documents_created} documents with {variables_created} variables'
            )
        ) 