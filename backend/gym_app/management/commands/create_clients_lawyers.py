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

        # These emails are managed by the special_users_spec block below with
        # non-default roles, so the generic client loop must not touch them (otherwise
        # it would reset their role back to 'client' on every rerun).
        special_reserved_emails = {
            'client1@example.com',
            'client2@example.com',
            'client3@example.com',
        }

        # Create or reuse clients (idempotent by email)
        for i in range(num_clients):
            email = f'client{i+1}@example.com'
            if email in special_reserved_emails:
                continue
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

        # Create or reuse the special weighted test users (referenced by email in
        # create_dynamic_documents.py for weighted document assignment).
        special_users_spec = [
            ('carlos18bp@gmail.com', 'Carlos', 'Cliente Demo', 'client'),
            ('info.montreal.studios@gmail.com', 'Montreal', 'Básico Demo', 'basic'),
            ('corporate1@gmail.com', 'Corporativo', 'Demo', 'corporate_client'),
            ('client1@example.com', 'Usuario', 'Básico Uno', 'basic'),
            ('client2@example.com', 'Usuario', 'Cliente Dos', 'client'),
            ('client3@example.com', 'Usuario', 'Corporativo Tres', 'corporate_client'),
        ]
        for email, first_name, last_name, role in special_users_spec:
            special_user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': role,
                },
            )
            if created:
                special_user.set_password('password')
                special_user.save()
                self.stdout.write(self.style.SUCCESS(f'Special user created: {special_user.email} ({role})'))
            else:
                if special_user.role != role:
                    special_user.role = role
                    special_user.save(update_fields=['role'])
                self.stdout.write(self.style.WARNING(f'Special user already exists: {special_user.email} ({role})'))

        self.stdout.write(self.style.SUCCESS(f'Successfully ensured {num_clients} clients and {num_lawyers} lawyers'))
