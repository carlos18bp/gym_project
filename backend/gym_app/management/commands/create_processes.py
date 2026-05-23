import os
import random
from datetime import timedelta
from django.core.files import File
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker
from gym_app.models import Process, Stage, StageAlert, CaseFile, User, Case

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
        clients = list(User.objects.filter(role='client'))
        lawyers = list(User.objects.filter(role='lawyer'))

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

        # Build candidate pools, giving more weight to preferred users when present
        client_candidates = clients.copy()
        for user, weight in [(special_client, 5), (special_basic, 3)]:
            if user and user not in client_candidates:
                client_candidates.extend([user] * weight)

        lawyer_candidates = lawyers.copy()
        if special_lawyer and special_lawyer not in lawyer_candidates:
            lawyer_candidates.extend([special_lawyer] * 5)

        # Abort early if there is no suitable client or lawyer
        if not client_candidates or not lawyer_candidates:
            self.stdout.write(self.style.ERROR('No clients or lawyers found. Please create them first.'))
            return

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
            # Select a client, lawyer, and case, prioritizing preferred test users when available
            client = random.choice(client_candidates)
            lawyer = random.choice(lawyer_candidates)
            case = random.choice(cases)

            # Create a new process with random data, including a random progress percentage (0-100)
            authority_name = fake.company()
            process = Process.objects.create(
                authority=authority_name,
                authority_email=fake.company_email(),
                plaintiff=fake.name(),
                defendant=fake.name(),
                ref=fake.uuid4(),
                lawyer=lawyer,
                case=case,
                subcase=fake.bs(),
                progress=random.randint(0, 100),
            )

            # Associate at least one client with the process
            process.clients.add(client)

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
                # Generate a realistic date in the past for this stage
                days_ago = random.randint(30, 365)
                stage_datetime = fake.date_time_between(start_date=f'-{days_ago}d', end_date='now')
                stage_date = stage_datetime.date()

                stage = Stage.objects.create(
                    status=stage_set[i],
                    date=stage_date,
                )
                stages.append(stage)

            # For some recent processes (last 20%), add a "Concluido" stage to indicate completion
            if index >= number_of_processes - int(number_of_processes * 0.2):
                concluido_datetime = fake.date_time_between(start_date='-30d', end_date='now')
                stage_concluido = Stage.objects.create(
                    status='Concluido',
                    date=concluido_datetime.date(),
                )
                stages.append(stage_concluido)

            # Add all created stages to the process
            process.stages.add(*stages)

            # Auto-create StageAlert for every stage (matches the runtime
            # contract enforced by `_create_stage_alerts` in views/process.py).
            # Non-last stages always use defaults.
            for stage in stages[:-1]:
                StageAlert.objects.create(stage=stage)
            # Last stage: vary configuration to exercise all UI states.
            if stages:
                last = stages[-1]
                _is_active = random.choices([True, False], weights=[80, 20])[0]
                _notify = random.choices([True, False], weights=[70, 30])[0]
                _custom_descriptions = [
                    'Llevar documentos originales',
                    'Audiencia de conciliación — confirmar asistencia',
                    'Revisar memorial antes de la audiencia',
                    '',
                    '',
                    '',
                ]
                _desc = random.choice(_custom_descriptions)
                StageAlert.objects.create(
                    stage=last,
                    is_active=_is_active,
                    notify_clients=_notify,
                    description=_desc,
                )

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

        # Helper to create a simple extra process
        def create_simple_process(client_user, lawyer_user, label):
            process = Process.objects.create(
                authority=fake.company(),
                authority_email=fake.company_email(),
                plaintiff=fake.name(),
                defendant=fake.name(),
                ref=fake.uuid4(),
                lawyer=lawyer_user,
                case=random.choice(cases),
                subcase=fake.bs(),
                progress=random.randint(0, 100),
            )
            process.clients.add(client_user)
            # Add one stage with a near-future date so the process has a
            # visible alert indicator and is coherent with the runtime contract.
            stage = Stage.objects.create(
                status=random.choice(['Audiencia', 'Conciliación', 'Sentencia']),
                date=(timezone.now().date() + timedelta(days=random.randint(5, 30))),
            )
            process.stages.add(stage)
            StageAlert.objects.create(stage=stage)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Extra test process for {label}: {process.ref} (client={client_user.email}, lawyer={lawyer_user.email})'
                )
            )

        EXTRA_PER_USER = 10

        # Extra processes where the special lawyer actúa como abogado
        if special_lawyer and client_candidates:
            for _ in range(EXTRA_PER_USER):
                client = random.choice(client_candidates)
                create_simple_process(client, special_lawyer, f'abogado {special_lawyer.email}')

        # Extra processes donde el cliente especial es la parte cliente
        if special_client and lawyer_candidates:
            for _ in range(EXTRA_PER_USER):
                lawyer = random.choice(lawyer_candidates)
                create_simple_process(special_client, lawyer, f'cliente {special_client.email}')

        # Extra processes donde el usuario básico especial es la parte cliente
        if special_basic and lawyer_candidates:
            for _ in range(EXTRA_PER_USER):
                lawyer = random.choice(lawyer_candidates)
                create_simple_process(special_basic, lawyer, f'básico {special_basic.email}')

        # ── Alert-ready processes ────────────────────────────────────────────
        # Create a small set of processes whose last stage falls exactly 3 days
        # or 1 day from today so that `send_process_alerts` can be triggered in
        # local/staging environments without waiting for real dates.
        today = timezone.now().date()
        alert_scenarios = [
            {'days': 3, 'notify_clients': True,  'desc': 'Audiencia — llevar expediente completo'},
            {'days': 3, 'notify_clients': False, 'desc': 'Sentencia — preparar alegatos'},
            {'days': 3, 'notify_clients': True,  'desc': ''},
            {'days': 1, 'notify_clients': True,  'desc': 'Urgente: conciliación mañana'},
            {'days': 1, 'notify_clients': False, 'desc': ''},
            {'days': 1, 'notify_clients': True,  'desc': 'Revisión de memorial'},
        ]
        alert_stage_statuses = ['Audiencia', 'Conciliación', 'Sentencia', 'Notificación', 'Apelación', 'Resolución']
        alert_ready_count = 0
        for scenario in alert_scenarios:
            if not client_candidates or not lawyer_candidates:
                break
            client_u = random.choice(client_candidates)
            lawyer_u = random.choice(lawyer_candidates)
            alert_process = Process.objects.create(
                authority=fake.company(),
                authority_email=fake.company_email(),
                plaintiff=fake.name(),
                defendant=fake.name(),
                ref=f'ALERTA-{scenario["days"]}D-{fake.uuid4()[:8].upper()}',
                lawyer=lawyer_u,
                case=random.choice(cases),
                subcase=fake.bs(),
                progress=random.randint(10, 90),
            )
            alert_process.clients.add(client_u)
            # Preceding stage in the past to simulate a realistic history
            prev_stage = Stage.objects.create(
                status='Apertura',
                date=today - timedelta(days=random.randint(30, 90)),
            )
            alert_process.stages.add(prev_stage)
            StageAlert.objects.create(stage=prev_stage)
            # Last stage: upcoming date exactly N days from today
            upcoming_stage = Stage.objects.create(
                status=random.choice(alert_stage_statuses),
                date=today + timedelta(days=scenario['days']),
            )
            alert_process.stages.add(upcoming_stage)
            StageAlert.objects.create(
                stage=upcoming_stage,
                is_active=True,
                notify_clients=scenario['notify_clients'],
                description=scenario['desc'],
            )
            alert_ready_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'{number_of_processes} processes created successfully '
            f'(+{alert_ready_count} alert-ready with upcoming dates)'
        ))
