from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import (
    User,
    Organization,
    OrganizationMembership,
    OrganizationInvitation,
    OrganizationPost,
)


class Command(BaseCommand):
    help = 'Create fake organizations, memberships and posts for testing corporate features'

    def add_arguments(self, parser):
        parser.add_argument(
            '--num_organizations',
            type=int,
            default=2,
            help='Number of organizations to create'
        )

    def handle(self, *args, **options):
        fake = Faker()
        num_organizations = options.get('num_organizations', 2)

        self.stdout.write(f'Creating {num_organizations} organizations...')

        # Ensure we have at least one corporate client to act as leader
        corporate_clients = list(User.objects.filter(role='corporate_client'))

        if not corporate_clients:
            # Create a default corporate client user if none exists
            email = 'corporate1@example.com'
            corporate_client, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                    'role': 'corporate_client',
                },
            )
            if created:
                corporate_client.set_password('password')
                corporate_client.save()
                self.stdout.write(self.style.SUCCESS(f'Corporate client created: {corporate_client.email}'))
            else:
                self.stdout.write(self.style.WARNING(f'Corporate client already exists: {corporate_client.email}'))
            corporate_clients.append(corporate_client)

        # Special test users (if they exist)
        special_client = User.objects.filter(email='carlos18bp@gmail.com').first()
        special_basic = User.objects.filter(email='info.montreal.studios@gmail.com').first()

        # Create or reuse a small set of organizations
        organizations = []
        for i in range(num_organizations):
            leader = corporate_clients[i % len(corporate_clients)]
            title = f'Organización Demo {i + 1}'
            description = fake.paragraph(nb_sentences=3)

            organization, created = Organization.objects.get_or_create(
                title=title,
                defaults={
                    'description': description,
                    'corporate_client': leader,
                },
            )

            # If the organization existed but had another leader, keep existing leader
            if not created and organization.corporate_client != leader:
                leader = organization.corporate_client

            organizations.append(organization)

            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'Organization created: "{organization.title}" (leader={leader.email})'
                ))
            else:
                self.stdout.write(self.style.WARNING(
                    f'Organization already exists: "{organization.title}" (leader={leader.email})'
                ))

            # Ensure leader membership
            OrganizationMembership.objects.get_or_create(
                organization=organization,
                user=leader,
                defaults={'role': 'LEADER'},
            )

            # Ensure special client and basic are members of at least one organization
            for user, role_label in [
                (special_client, 'MEMBER'),
                (special_basic, 'MEMBER'),
            ]:
                if user:
                    membership, m_created = OrganizationMembership.objects.get_or_create(
                        organization=organization,
                        user=user,
                        defaults={'role': role_label},
                    )
                    if m_created:
                        self.stdout.write(self.style.SUCCESS(
                            f'Added {user.email} as {role_label} of "{organization.title}"'
                        ))

            # Create a couple of informational posts per organization (idempotent by title)
            post_specs = [
                ('Bienvenida a la organización',
                 'Esta es una organización de prueba para explorar las funcionalidades corporativas.'),
                ('Actualización de políticas internas',
                 'Recuerde revisar las políticas internas antes de compartir documentos sensibles.'),
            ]

            for title_suffix, content in post_specs:
                post_title = f'{title_suffix} - {organization.title}'
                post, p_created = OrganizationPost.objects.get_or_create(
                    organization=organization,
                    title=post_title,
                    defaults={
                        'content': content,
                        'author': leader,
                        'is_active': True,
                    },
                )
                if p_created:
                    self.stdout.write(self.style.SUCCESS(
                        f'Created post "{post.title}" for organization "{organization.title}"'
                    ))

        # ── Invitations ──────────────────────────────────────────────────────
        # Seed OrganizationInvitation in every lifecycle state so the invitations
        # inbox and history are populated. Only client/basic users that are not
        # already members or invitees of the org are used (respects clean()).
        invitations_created = 0
        for organization in organizations:
            leader = organization.corporate_client
            member_ids = set(
                OrganizationMembership.objects.filter(organization=organization)
                .values_list('user_id', flat=True)
            )
            invited_ids = set(
                OrganizationInvitation.objects.filter(organization=organization)
                .values_list('invited_user_id', flat=True)
            )
            candidates = list(
                User.objects.filter(role__in=['client', 'basic'])
                .exclude(id__in=member_ids | invited_ids)
                .exclude(id=leader.id)
                .order_by('id')
            )

            for state, invited_user in zip(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], candidates):
                invitation = OrganizationInvitation(
                    organization=organization,
                    invited_user=invited_user,
                    invited_by=leader,
                    message='Le invitamos a unirse a nuestra organización.',
                )
                if state == 'EXPIRED':
                    invitation.status = 'EXPIRED'
                    invitation.expires_at = timezone.now() - timezone.timedelta(days=1)
                    invitation.save()
                else:
                    invitation.clean()  # honor role/leader/duplicate-pending rules
                    invitation.save()   # PENDING (save() sets expires_at = now + 30d)
                    if state == 'ACCEPTED':
                        invitation.accept()   # creates a MEMBER membership
                    elif state == 'REJECTED':
                        invitation.reject()
                invitations_created += 1
                self.stdout.write(self.style.SUCCESS(
                    f'Invitation {state}: {invited_user.email} → "{organization.title}"'
                ))

        self.stdout.write(self.style.SUCCESS(
            f'Successfully ensured {len(organizations)} organizations with memberships, posts '
            f'and {invitations_created} invitations'
        ))
