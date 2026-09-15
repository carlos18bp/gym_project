import os
import random

from django.core.files import File
from django.core.management.base import BaseCommand
from faker import Faker
from gym_app.models import User, UserSignature
from ._seeder_constants import (
    CLIENT_OWNED_EMAILS,
    QA_ADMIN_SPEC,
    RESERVED_CLIENT_EMAILS,
    SPECIAL_USERS_SPEC,
)

# Existing example image reused for electronic-signature fake data.
SIGNATURE_IMAGE_PATH = 'media/legal_request_files/img.png'

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
        parser.add_argument(
            '--reset-passwords',
            action='store_true',
            default=False,
            help='Reset passwords to "password" for all users (use with caution)',
        )

    def handle(self, *args, **options):
        """
        Handle the creation of clients and lawyers.
        """
        fake = Faker()
        num_clients = options['num_clients']
        num_lawyers = options['num_lawyers']
        reset_passwords = options.get('reset_passwords', False)

        # Create or reuse clients (idempotent by email)
        for i in range(num_clients):
            email = f'client{i+1}@example.com'
            if email in RESERVED_CLIENT_EMAILS:
                continue
            client, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                    'role': 'client',
                },
            )

            if created or reset_passwords:
                client.set_password('password')
                client.save()
                self.stdout.write(self.style.SUCCESS(f'Client {"created" if created else "password reset"}: {client.email}'))
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

            if created or reset_passwords:
                lawyer.set_password('password')
                lawyer.save()
                self.stdout.write(self.style.SUCCESS(f'Lawyer {"created" if created else "password reset"}: {lawyer.email}'))
            else:
                # Ensure the role is at least lawyer for existing test users
                if lawyer.role != 'lawyer':
                    lawyer.role = 'lawyer'
                    lawyer.save(update_fields=['role'])
                self.stdout.write(self.style.WARNING(f'Lawyer already exists: {lawyer.email}'))

        # Seed one archived lawyer so the reassignment module, its metrics,
        # and archived-user selectors have data to show in staging demos.
        archived, arch_created = User.objects.get_or_create(
            email='abogado.archivado@example.com',
            defaults={
                'first_name': 'Abelardo',
                'last_name': 'Archivado',
                'role': 'lawyer',
                'is_archived': True,
                'is_active': False,
            },
        )
        if arch_created or reset_passwords:
            archived.set_password('password')
            archived.is_archived = True
            archived.is_active = False
            archived.save()
            self.stdout.write(self.style.SUCCESS(f'Archived lawyer seeded: {archived.email}'))

        for email, first_name, last_name, role in SPECIAL_USERS_SPEC:
            special_user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': role,
                },
            )
            if created or reset_passwords:
                special_user.set_password('password')
                special_user.save()
                self.stdout.write(self.style.SUCCESS(f'Special user {"created" if created else "password reset"}: {special_user.email} ({role})'))
            else:
                # For client-owned accounts, never overwrite their role
                if email not in CLIENT_OWNED_EMAILS and special_user.role != role:
                    special_user.role = role
                    special_user.save(update_fields=['role'])
                self.stdout.write(self.style.WARNING(f'Special user already exists: {special_user.email} ({special_user.role})'))

        # ── Platform admin ───────────────────────────────────────────────────
        # Without this account the Reassignment module cannot be tested at all:
        # its gate is is_platform_admin (utils/auth_utils.py), mirrored by the
        # frontend in SlideBar.vue, and no seeder created an admin before.
        admin_email, admin_first, admin_last, admin_role = QA_ADMIN_SPEC
        admin_user, admin_created = User.objects.get_or_create(
            email=admin_email,
            defaults={
                'first_name': admin_first,
                'last_name': admin_last,
                'role': admin_role,
            },
        )
        if admin_created or reset_passwords:
            admin_user.set_password('password')
            admin_user.save()
        # Reconcile the invariants on every run, not only on creation.
        # is_staff/is_superuser stay False on purpose: Django's /admin/ is
        # exposed (gym_project/urls.py) and this account's password is
        # 'password'. is_platform_admin is satisfied by role='admin' alone.
        admin_user.role = admin_role
        admin_user.is_staff = False
        admin_user.is_superuser = False
        admin_user.is_active = True
        admin_user.is_archived = False
        admin_user.is_profile_completed = True
        admin_user.save(update_fields=[
            'role', 'is_staff', 'is_superuser', 'is_active',
            'is_archived', 'is_profile_completed',
        ])
        self.stdout.write(self.style.SUCCESS(
            f'Platform admin {"created" if admin_created else "reconciled"}: {admin_user.email}'
        ))

        # ── Electronic signatures ────────────────────────────────────────────
        # Seed a UserSignature (OneToOne) for the preferred demo users so the
        # electronic-signature flow has real signatures backing it.
        signatures_created = 0
        if os.path.isfile(SIGNATURE_IMAGE_PATH):
            signer_emails = [
                'carlos18bp@gmail.com',
                'info.montreal.studios@gmail.com',
                'core.paginaswebscolombia@gmail.com',
                'corporate1@gmail.com',
            ]
            for email in signer_emails:
                user = User.objects.filter(email=email).first()
                if not user or UserSignature.objects.filter(user=user).exists():
                    continue
                with open(SIGNATURE_IMAGE_PATH, 'rb') as fh:
                    UserSignature.objects.create(
                        user=user,
                        signature_image=File(fh, name=f'signature_{user.id}.png'),
                        method=random.choice(['upload', 'draw']),
                        ip_address=f'192.168.1.{random.randint(1, 254)}',
                    )
                signatures_created += 1
        else:
            self.stdout.write(self.style.WARNING(
                f'Signature image not found at {SIGNATURE_IMAGE_PATH}; skipping UserSignature seeding'
            ))

        self.stdout.write(self.style.SUCCESS(
            f'Successfully ensured {num_clients} clients and {num_lawyers} lawyers '
            f'(+{signatures_created} user signatures)'
        ))
