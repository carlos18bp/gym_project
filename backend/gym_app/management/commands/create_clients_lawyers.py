import random
from faker import Faker
from django.core.management.base import BaseCommand
from gym_app.models import User

class Command(BaseCommand):
    help = 'Create 24 client users and 4 lawyer users with predefined emails and the same password'

    def handle(self, *args, **options):
        fake = Faker()
        password = 'password'  # Define the same password for all users

        # Create clients with emails cliente_1@example.com, cliente_2@example.com, etc.
        for i in range(1, 25):
            client = User.objects.create_user(
                email=f'cliente_{i}@example.com',
                password=password,
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                contact=fake.phone_number(),
                birthday=fake.date_of_birth(),
                identification=fake.random_number(digits=10),
                role='client',
            )
            self.stdout.write(self.style.SUCCESS(f'Client "{client}" created'))

        # Create lawyers with emails lawyer_1@example.com, lawyer_2@example.com, etc.
        for i in range(1, 5):
            lawyer = User.objects.create_user(
                email=f'lawyer_{i}@example.com',
                password=password,
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                contact=fake.phone_number(),
                birthday=fake.date_of_birth(),
                identification=fake.random_number(digits=10),
                role='lawyer',
            )
            self.stdout.write(self.style.SUCCESS(f'Lawyer "{lawyer}" created'))

        self.stdout.write(self.style.SUCCESS(f'24 Clients and 4 Lawyers created successfully with the same password'))
