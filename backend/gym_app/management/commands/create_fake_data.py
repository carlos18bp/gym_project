from django.core.management import call_command
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Create fake data for clients, lawyers, and processes'

    def add_arguments(self, parser):
        parser.add_argument('number_of_records', type=int, nargs='?', default=30)

    def handle(self, *args, **options):
        number_of_records = options['number_of_records']
        call_command('create_clients_lawyers')
        call_command('create_legal_requests')
        call_command('create_processes', '--number_of_processes', number_of_records)
