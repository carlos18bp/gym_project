from django.core.management.base import BaseCommand
from gym_app.models import (
    Process, Stage, Case, CaseFile, User, LegalRequest, LegalRequestType, 
    LegalDiscipline, LegalRequestFiles, DynamicDocument, 
    DocumentVariable, ActivityFeed, LegalDocument, LegalUpdate, RecentProcess,
    RecentDocument, Organization, OrganizationMembership, OrganizationInvitation, OrganizationPost
)

class Command(BaseCommand):
    help = 'Delete all fake data for clients, lawyers, processes, stages, and case files'

    """
    To delete fake data via console, run:
    python3 manage.py delete_fake_data
    """

    def handle(self, *args, **options):
        # Delete all processes
        for process in Process.objects.all():
            process.delete()
            self.stdout.write(self.style.SUCCESS(f'Process "{process}" deleted'))

        # Delete all stages
        for stage in Stage.objects.all():
            stage.delete()
            self.stdout.write(self.style.SUCCESS(f'Stage "{stage}" deleted'))

        # Delete all cases
        for case in Case.objects.all():
            case.delete()
            self.stdout.write(self.style.SUCCESS(f'Case "{case}" deleted'))

        # Delete all case files
        for case_file in CaseFile.objects.all():
            case_file.delete()
            self.stdout.write(self.style.SUCCESS(f'CaseFile "{case_file}" deleted'))

        # Delete recent processes
        for recent in RecentProcess.objects.all():
            recent.delete()
            self.stdout.write(self.style.SUCCESS(f'RecentProcess "{recent}" deleted'))

        # Delete all dynamic documents and associated variables
        for document in DynamicDocument.objects.all():
            document.delete()
            self.stdout.write(self.style.SUCCESS(f'DynamicDocument "{document}" deleted'))

        for variable in DocumentVariable.objects.all():
            variable.delete()
            self.stdout.write(self.style.SUCCESS(f'DocumentVariable "{variable}" deleted'))

        # Delete recent document references
        for recent in RecentDocument.objects.all():
            recent.delete()
            self.stdout.write(self.style.SUCCESS(f'RecentDocument "{recent}" deleted'))

        # Delete all activity logs
        for activity in ActivityFeed.objects.all():
            activity.delete()
            self.stdout.write(self.style.SUCCESS(f'ActivityFeed "{activity}" deleted'))

        # Delete legal documents
        for doc in LegalDocument.objects.all():
            doc.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalDocument "{doc}" deleted'))

        # Delete legal updates
        for update in LegalUpdate.objects.all():
            update.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalUpdate "{update}" deleted'))

        # Delete organization posts
        for post in OrganizationPost.objects.all():
            post.delete()
            self.stdout.write(self.style.SUCCESS(f'OrganizationPost "{post}" deleted'))

        # Delete organization memberships
        for membership in OrganizationMembership.objects.all():
            membership.delete()
            self.stdout.write(self.style.SUCCESS(f'OrganizationMembership "{membership}" deleted'))

        # Delete organization invitations
        for invitation in OrganizationInvitation.objects.all():
            invitation.delete()
            self.stdout.write(self.style.SUCCESS(f'OrganizationInvitation "{invitation}" deleted'))

        # Delete organizations
        for organization in Organization.objects.all():
            organization.delete()
            self.stdout.write(self.style.SUCCESS(f'Organization "{organization}" deleted'))

        # Delete clients and lawyers, but keep fixed test users and admin.superuser
        protected_emails = {
            'admin@gmail.com',
            'core.paginaswebscolombia@gmail.com',
            'carlos18bp@gmail.com',
            'info.montreal.studios@gmail.com',
        }

        for user in User.objects.filter(role__in=['client', 'lawyer']).exclude(email__in=protected_emails):
            user.delete()
            self.stdout.write(self.style.SUCCESS(f'User "{user}" deleted'))

        # Delete all LegalRequests
        for legal_request in LegalRequest.objects.all():
            legal_request.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequest "{legal_request}" deleted'))

        for legal_request_type in LegalRequestType.objects.all():
            legal_request_type.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequestType "{legal_request_type}" deleted'))

        for legal_discipline in LegalDiscipline.objects.all():
            legal_discipline.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalDiscipline "{legal_discipline}" deleted'))

        for legal_request_files in LegalRequestFiles.objects.all():
            legal_request_files.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequestFiles "{legal_request_files}" deleted'))

        self.stdout.write(self.style.SUCCESS('All fake data deleted successfully'))
