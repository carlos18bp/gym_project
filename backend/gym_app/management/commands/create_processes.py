import os
import random
from django.core.files import File
from django.core.management.base import BaseCommand
from faker import Faker
from gym_app.models import Process, Stage, CaseFile, User, Case

class Command(BaseCommand):
    help = 'Create processes with random stages, files, and cases'

    def add_arguments(self, parser):
        """
        Adds arguments to the command line parser.

        Arguments:
            --number_of_processes: Number of processes to be created.
        """
        parser.add_argument(
            '--number_of_processes',
            type=int,
            help='Indicates the number of processes to be created'
        )

    def handle(self, *args, **options):
        """
        Main function to handle the creation of processes, stages, and case files.

        Parameters:
            *args: Additional arguments.
            **options: Options provided through the command line.
        """
        # Get the number of processes to create, default to 30 if not specified
        number_of_processes = options.get('number_of_processes', 30)
        fake = Faker()

        # Get all clients and lawyers from the database
        clients = User.objects.filter(role='client')
        lawyers = User.objects.filter(role='lawyer')

        # Create case types with more details
        case_types = [
            'Juicio Ejecutivo Mercantil',
            'Juicio Ordinario Civil',
            'Juicio Laboral',
            'Amparo Directo',
            'Amparo Indirecto',
            'Proceso Penal Acusatorio',
            'Juicio de Nulidad',
            'Sucesión Testamentaria',
            'Sucesión Intestamentaria',
            'Divorcio Contencioso',
            'Divorcio por Mutuo Consentimiento',
            'Juicio de Alimentos',
            'Juicio de Usucapión',
            'Mediación Familiar',
            'Conciliación Mercantil'
        ]
        
        # Create or get case types
        cases = []
        for case_type in case_types:
            case, created = Case.objects.get_or_create(type=case_type)
            cases.append(case)

        # Possible stages for different process types
        possible_stages = {
            'general': [
                'Presentación de Demanda',
                'Admisión',
                'Emplazamiento',
                'Contestación',
                'Ofrecimiento de Pruebas',
                'Desahogo de Pruebas',
                'Alegatos',
                'Sentencia',
                'Apelación',
                'Ejecución'
            ],
            'penal': [
                'Investigación Inicial',
                'Investigación Complementaria',
                'Etapa Intermedia',
                'Juicio Oral',
                'Sentencia',
                'Impugnación',
                'Ejecución'
            ],
            'familiar': [
                'Solicitud',
                'Conciliación',
                'Audiencia Preliminar',
                'Audiencia Principal',
                'Resolución',
                'Ejecución'
            ]
        }

        # Directory containing example PDF files
        case_files_directory = 'media/example_files/'

        # List all PDF files in the specified directory
        available_files = [
            f for f in os.listdir(case_files_directory) if f.endswith('.pdf')
        ]

        # Check if there are any available files
        if not available_files:
            self.stdout.write(self.style.ERROR(f'No PDF files found in {case_files_directory}'))
            return

        # Loop to create the specified number of processes
        for index in range(number_of_processes):
            # Randomly select a client, lawyer, and case
            client = random.choice(clients)
            lawyer = random.choice(lawyers)
            case = random.choice(cases)

            # Create a new process with random data
            process = Process.objects.create(
                authority=fake.company(),
                plaintiff=fake.name(),
                defendant=fake.name(),
                ref=fake.uuid4(),
                client=client,
                lawyer=lawyer,
                case=case,
                subcase=fake.bs(),
            )

            # Determine which stage set to use based on case type
            if any(term in case.type.lower() for term in ['penal', 'acusatorio']):
                stage_set = possible_stages['penal']
            elif any(term in case.type.lower() for term in ['familiar', 'divorcio', 'alimentos']):
                stage_set = possible_stages['familiar']
            else:
                stage_set = possible_stages['general']
            
            # Create a random number of stages for the process
            # Make more processes have more stages to create richer reports
            num_stages = random.choices(
                [1, 2, 3, 4, 5, 6, 7],
                weights=[0.05, 0.10, 0.15, 0.25, 0.20, 0.15, 0.10],
                k=1
            )[0]
            
            # Use sequential stages from the appropriate set
            stages = []
            for i in range(min(num_stages, len(stage_set))):
                # Create dates with more variation
                days_ago = random.randint(30, 365)
                stage_date = fake.date_time_between(start_date=f'-{days_ago}d', end_date='now')
                
                stage = Stage.objects.create(
                    status=stage_set[i],
                    created_at=stage_date,
                )
                stages.append(stage)

            # For some recent processes (last 20%), add a "Completed" stage to indicate completion
            if index >= number_of_processes - int(number_of_processes * 0.2):
                stage_concluido = Stage.objects.create(
                    status='Concluido',
                    created_at=fake.date_time_between(start_date='-30d', end_date='now'),
                )
                stages.append(stage_concluido)

            # Add all created stages to the process
            process.stages.add(*stages)

            # Create a random number of case files - more variation in number
            num_files = random.randint(2, 10)
            case_files = []
            for i in range(num_files):
                # Choose a random file from the available files
                random_file_name = random.choice(available_files)
                file_path = os.path.join(case_files_directory, random_file_name)

                # Open the file and create a CaseFile object with the file
                with open(file_path, 'rb') as file:  # Open the file in binary mode
                    case_file = CaseFile.objects.create(
                        file=File(file, name=random_file_name)  # Create a File object with the file and its name
                    )
                    case_files.append(case_file)

            # Add all created case files to the process
            process.case_files.add(*case_files)

        # Print success message
        self.stdout.write(self.style.SUCCESS(f'{number_of_processes} processes created successfully'))
