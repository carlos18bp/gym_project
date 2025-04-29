import os
import random
from django.core.files import File
from django.core.management.base import BaseCommand
from faker import Faker
from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles

class Command(BaseCommand):
    help = 'Create legal requests with random types, disciplines, and files'

    def add_arguments(self, parser):
        """
        Adds arguments to the command line parser.

        Arguments:
            --number_of_requests: Number of legal requests to be created.
        """
        parser.add_argument(
            '--number_of_requests',
            type=int,
            help='Indicates the number of legal requests to be created'
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
        fake = Faker()

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

        # Loop to create the specified number of legal requests
        for _ in range(number_of_requests):
            # Randomly select a type and discipline
            request_type = random.choice(legal_request_types)
            discipline = random.choice(legal_disciplines)

            # Create a new legal request with random data
            legal_request = LegalRequest.objects.create(
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                email=fake.email(),
                request_type=request_type,
                discipline=discipline,
                description=fake.paragraph(nb_sentences=5)
            )

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

        # Print success message
        self.stdout.write(self.style.SUCCESS(f'{number_of_requests} legal requests created successfully'))
