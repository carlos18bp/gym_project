from django.core.management.base import BaseCommand
from faker import Faker
from gym_app.models import User

class Command(BaseCommand):
    help = 'Create fake data for clients and lawyers'

    def add_arguments(self, parser):
        """
        Add command line arguments for the number of clients and lawyers to create.
        """
        parser.add_argument(
            '--num_clients',
            type=int,
            default=15,
            help='Number of clients to create'
        )
        parser.add_argument(
            '--num_lawyers',
            type=int,
            default=10,
            help='Number of lawyers to create'
        )

    def handle(self, *args, **options):
        """
        Handle the creation of clients and lawyers.
        """
        fake = Faker()
        num_clients = options['num_clients']
        num_lawyers = options['num_lawyers']

        # Create or reuse clients (idempotent by email)
        for i in range(num_clients):
            email = f'client{i+1}@example.com'
            client, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                    'role': 'client',
                },
            )

            if created:
                client.set_password('password')
                client.save()
                self.stdout.write(self.style.SUCCESS(f'Client created: {client.email}'))
            else:
                # Ensure the role is at least client for existing test users
                if client.role != 'client':
                    client.role = 'client'
                    client.save(update_fields=['role'])
                self.stdout.write(self.style.WARNING(f'Client already exists: {client.email}'))

        # Create or reuse lawyers (idempotent by email)
        for i in range(num_lawyers):
            email = f'lawyer{i+1}@example.com'
            lawyer, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                    'role': 'lawyer',
                },
            )

            if created:
                lawyer.set_password('password')
                lawyer.save()
                self.stdout.write(self.style.SUCCESS(f'Lawyer created: {lawyer.email}'))
            else:
                # Ensure the role is at least lawyer for existing test users
                if lawyer.role != 'lawyer':
                    lawyer.role = 'lawyer'
                    lawyer.save(update_fields=['role'])
                self.stdout.write(self.style.WARNING(f'Lawyer already exists: {lawyer.email}'))

        self.stdout.write(self.style.SUCCESS(f'Successfully ensured {num_clients} clients and {num_lawyers} lawyers'))
