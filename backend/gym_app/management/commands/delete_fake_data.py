from django.core.management.base import BaseCommand
from gym_app.models import Process, Stage, Case, CaseFile, User

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

        self.stdout.write(self.style.SUCCESS('All fake data deleted successfully'))
