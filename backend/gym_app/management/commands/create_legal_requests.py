import os
import random
from django.core.files import File
from django.core.management.base import BaseCommand
from faker import Faker
from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequestResponse, User

class Command(BaseCommand):
    help = 'Create legal requests with random types, disciplines, and files'

    def add_arguments(self, parser):
        """
        Adds arguments to the command line parser.

        Arguments:
            --number_of_requests: Number of legal requests to be created.
            --with_responses: Include sample responses for requests.
        """
        parser.add_argument(
            '--number_of_requests',
            type=int,
            help='Indicates the number of legal requests to be created'
        )
        parser.add_argument(
            '--with_responses',
            action='store_true',
            help='Create sample responses for the legal requests'
        )

    def handle(self, *args, **options):
        """
        Main function to handle the creation of legal requests and related data.

        Parameters:
            *args: Additional arguments.
            **options: Options provided through the command line.
        """
        # Get the number of requests to create, default to 10 if not specified
        number_of_requests = options.get('number_of_requests') or 10
        with_responses = options.get('with_responses', False)
        fake = Faker()
        
        # Status choices for random assignment
        status_choices = ['PENDING', 'IN_REVIEW', 'RESPONDED', 'CLOSED']

        # Create random LegalRequestTypes if they do not already exist
        request_types = [
            'Consulta Legal', 
            'Representación', 
            'Documentación', 
            'Asesoría Legal',
            'Mediación',
            'Arbitraje',
            'Negociación',
            'Dictamen Jurídico',
            'Resolución de Disputas',
            'Auditoría Legal'
        ]
        for request_type in request_types:
            LegalRequestType.objects.get_or_create(name=request_type)

        # Create random LegalDisciplines if they do not already exist
        disciplines = [
            'Derecho Penal', 
            'Derecho Civil', 
            'Derecho Familiar', 
            'Derecho Corporativo', 
            'Derecho Laboral', 
            'Derecho Fiscal', 
            'Propiedad Intelectual',
            'Derecho Mercantil',
            'Derecho Administrativo',
            'Derecho Ambiental',
            'Derecho Internacional',
            'Derecho Migratorio',
            'Derecho Inmobiliario'
        ]
        for discipline in disciplines:
            LegalDiscipline.objects.get_or_create(name=discipline)

        # Retrieve all request types and disciplines
        legal_request_types = list(LegalRequestType.objects.all())
        legal_disciplines = list(LegalDiscipline.objects.all())

        # Directory containing example files for requests
        request_files_directory = 'media/example_files/'

        # List all files in the directory
        available_files = [
            f for f in os.listdir(request_files_directory) if f.endswith('.pdf')
        ]

        # Check if there are any available files
        if not available_files:
            self.stdout.write(self.style.ERROR(f'No files found in {request_files_directory}'))
            return

        # Get users for creating requests and responses
        all_clients = list(User.objects.filter(role='client'))
        lawyers = list(User.objects.filter(role='lawyer')) if with_responses else []

        # Preferred test users by email (if they already exist)
        # Note: Search by email only to handle role changes gracefully
        special_lawyer = User.objects.filter(
            email='core.paginaswebscolombia@gmail.com',
            role='lawyer'
        ).first()
        special_client = User.objects.filter(
            email='carlos18bp@gmail.com',
        ).first()
        special_basic = User.objects.filter(
            email='info.montreal.studios@gmail.com',
        ).first()

        # Enrich client pool so these users more often get requests
        for user, weight in [(special_client, 5), (special_basic, 3)]:
            if user:
                all_clients.extend([user] * weight)

        # Enrich lawyers pool so preferred lawyer more often answers
        if with_responses and special_lawyer:
            lawyers.extend([special_lawyer] * 5)

        # Ensure we have at least one client to create requests
        if not all_clients:
            self.stdout.write(self.style.ERROR('No client users found. Please create client users first.'))
            return
        
        # Loop to create the specified number of legal requests
        for i in range(number_of_requests):
            # Randomly select a type and discipline
            request_type = random.choice(legal_request_types)
            discipline = random.choice(legal_disciplines)
            
            # Randomly assign status (80% PENDING for new requests, 20% others)
            if random.random() < 0.8:
                status = 'PENDING'
            else:
                status = random.choice(status_choices)

            # Randomly select a client user for this request
            client_user = random.choice(all_clients)
            
            # Create a new legal request with the selected client user
            legal_request = LegalRequest.objects.create(
                user=client_user,
                request_type=request_type,
                discipline=discipline,
                description=fake.paragraph(nb_sentences=5),
                status=status
            )
            
            self.stdout.write(f'Created request {legal_request.request_number} with status {status}')

            # Create a random number of files for the legal request
            num_files = random.randint(1, 5)
            for _ in range(num_files):
                # Choose a random file from the available files
                random_file_name = random.choice(available_files)
                file_path = os.path.join(request_files_directory, random_file_name)

                # Open the file and create a LegalRequestFiles object
                with open(file_path, 'rb') as file:
                    legal_request_file = LegalRequestFiles.objects.create(
                        file=File(file, name=random_file_name)
                    )
                    legal_request.files.add(legal_request_file)
            
            # Create sample responses if requested
            if with_responses and (lawyers or all_clients):
                # Create responses based on status
                if status in ['IN_REVIEW', 'RESPONDED', 'CLOSED']:
                    # Create lawyer response
                    if lawyers:
                        lawyer = random.choice(lawyers)
                        lawyer_responses = [
                            "Hemos recibido su solicitud y estamos revisando la documentación.",
                            "Necesitamos información adicional para proceder con su caso.",
                            "Su caso ha sido asignado a nuestro equipo especializado.",
                            "Hemos completado el análisis inicial de su solicitud.",
                            "Le informamos que su caso requiere documentación adicional."
                        ]
                        
                        LegalRequestResponse.objects.create(
                            legal_request=legal_request,
                            response_text=random.choice(lawyer_responses),
                            user=lawyer,
                            user_type='lawyer'
                        )
                        
                        # Sometimes add a client response back (from the request owner)
                        if random.random() < 0.4:  # 40% chance
                            # Use the same client who created the request
                            client_responses = [
                                "Gracias por la información. Adjunto la documentación solicitada.",
                                "¿Podrían proporcionarme más detalles sobre los próximos pasos?",
                                "He enviado los documentos adicionales por correo.",
                                "¿Cuál es el tiempo estimado para resolver mi caso?",
                                "Agradezco su pronta respuesta y seguimiento."
                            ]
                            
                            LegalRequestResponse.objects.create(
                                legal_request=legal_request,
                                response_text=random.choice(client_responses),
                                user=client_user,  # Use the client who created the request
                                user_type='client'
                            )

        # Create additional simple legal requests explicitly for preferred client/basic users
        EXTRA_PER_USER = 10

        def create_simple_request(for_user, label):
            request_type = random.choice(legal_request_types)
            discipline = random.choice(legal_disciplines)
            status = 'PENDING'

            lr = LegalRequest.objects.create(
                user=for_user,
                request_type=request_type,
                discipline=discipline,
                description=fake.paragraph(nb_sentences=3),
                status=status,
            )
            self.stdout.write(
                f'Extra test legal request for {label}: {lr.request_number} (user={for_user.email})'
            )

        if special_client:
            for _ in range(EXTRA_PER_USER):
                create_simple_request(special_client, f'cliente {special_client.email}')

        if special_basic:
            for _ in range(EXTRA_PER_USER):
                create_simple_request(special_basic, f'básico {special_basic.email}')

        # Print success message
        response_msg = f" with sample responses" if with_responses else ""
        self.stdout.write(self.style.SUCCESS(f'{number_of_requests} legal requests created successfully{response_msg}'))
