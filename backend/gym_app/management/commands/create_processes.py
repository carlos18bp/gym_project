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

        # Create 10 case types
        cases = []
        for i in range(1, 11):
            case = Case.objects.create(
                type=f'Case Type {i}'
            )
            cases.append(case)

        # Directory containing example PDF files
        case_files_directory = 'media/example_case_files/'

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

            # Create a random number of stages for the process
            num_stages = random.randint(1, 6)
            stages = []
            for i in range(num_stages):
                stage = Stage.objects.create(
                    status=f'Stage {i+1}',
                    date_created=fake.date_this_year(),
                )
                stages.append(stage)

            # For the last 10 processes, add a final stage with status "Fallo"
            if index >= number_of_processes - 10:
                stage_fallo = Stage.objects.create(
                    status='Fallo',
                    date_created=fake.date_this_year(),
                )
                stages.append(stage_fallo)

            # Add all created stages to the process
            process.stages.add(*stages)

            # Create a random number of case files
            num_files = random.randint(1, 16)
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
