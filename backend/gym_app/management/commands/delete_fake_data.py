from django.core.management.base import BaseCommand
from gym_app.models import Process, Stage, Case, CaseFile, User, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalUserLink

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

        # Delete all case files
        for case in Case.objects.all():
            case.delete()
            self.stdout.write(self.style.SUCCESS(f'Case "{case}" deleted'))

        # Delete all case files
        for case_file in CaseFile.objects.all():
            case_file.delete()
            self.stdout.write(self.style.SUCCESS(f'CaseFile "{case_file}" deleted'))

        # Delete clients and lawyers
        for user in User.objects.filter(role__in=['client', 'lawyer']):
            user.delete()
            self.stdout.write(self.style.SUCCESS(f'User "{user}" deleted'))

        # Delete all LegalRequests
        for legal_request in LegalRequest.objects.all():
            legal_request.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequest "{legal_request}" deleted'))

        for legal_request_type in LegalRequestType.objects.all():
            legal_request_type.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRquestType "{legal_request_type}" deleted'))

        for legal_discipline in LegalDiscipline.objects.all():
            legal_discipline.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalDiscipline "{legal_discipline}" deleted'))

        for legal_request_files in LegalRequestFiles.objects.all():
            legal_request_files.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequestFiles "{legal_request_files}" deleted'))

        # Delete all LegalUserLink
        for legal_user_link in LegalUserLink.objects.all():
            legal_user_link.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalUserLink "{legal_user_link}" deleted'))


        self.stdout.write(self.style.SUCCESS('All fake data deleted successfully'))
