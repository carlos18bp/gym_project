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

        # Create clients
        for i in range(num_clients):
            client = User.objects.create(
                email=f'client{i+1}@example.com',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                role='client'
            )
            client.set_password('password')
            client.save()
            self.stdout.write(self.style.SUCCESS(f'Client created: {client.email}'))

        # Create lawyers
        for i in range(num_lawyers):
            lawyer = User.objects.create(
                email=f'lawyer{i+1}@example.com',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                role='lawyer'
            )
            lawyer.set_password('password')
            lawyer.save()
            self.stdout.write(self.style.SUCCESS(f'Lawyer created: {lawyer.email}'))

        self.stdout.write(self.style.SUCCESS(f'Successfully created {num_clients} clients and {num_lawyers} lawyers'))
