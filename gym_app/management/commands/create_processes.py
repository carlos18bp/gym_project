from django.core.management.base import BaseCommand
from gym_app.models import Process, Stage, CaseFile, User
import random
from faker import Faker

class Command(BaseCommand):
    help = 'Create processes with random stages and files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--number_of_processes',  # Use -- para pasar como opción
            type=int,
            help='Indicates the number of processes to be created'
        )

    def handle(self, *args, **options):
        number_of_processes = options.get('number_of_processes', 30)  # Set a default value of 30
        fake = Faker()

        clients = User.objects.filter(role='client')
        lawyers = User.objects.filter(role='lawyer')

        for _ in range(number_of_processes):
            client = random.choice(clients)
            lawyer = random.choice(lawyers)

            process = Process.objects.create(
                authority=fake.company(),
                plaintiff=fake.name(),
                defendant=fake.name(),
                ref=fake.uuid4(),
                client=client,
                lawyer=lawyer,
                case_type=random.choice(['Criminal', 'Civil', 'Family']),
                subcase=fake.bs(),
            )

            num_stages = random.randint(1, 6)
            stages = []
            for i in range(num_stages):
                stage = Stage.objects.create(
                    status=f'Stage {i+1}',
                    date_created=fake.date_this_year(),
                )
                stages.append(stage)

            process.stages.add(*stages)

            num_files = random.randint(1, 16)
            case_files = []
            for i in range(num_files):
                case_file = CaseFile.objects.create(
                    file=fake.file_name(extension='pdf'),
                    name=f'File {i+1} for {process.ref}',
                    description=fake.text(),
                )
                case_files.append(case_file)

            process.case_files.add(*case_files)

        self.stdout.write(self.style.SUCCESS(f'{number_of_processes} processes created successfully'))
