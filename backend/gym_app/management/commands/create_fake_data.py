from django.core.management import call_command
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Create fake data for clients, lawyers, and processes'

    def add_arguments(self, parser):
        parser.add_argument('number_of_records', type=int, nargs='?', default=50)
        parser.add_argument('--activities_per_user', type=int, default=40,
                            help='Number of activities to create per user')
        parser.add_argument('--num_documents', type=int, default=60,
                            help='Number of documents to create')
        parser.add_argument('--num_legal_requests', type=int, default=40,
                            help='Number of legal requests to create')

    def handle(self, *args, **options):
        number_of_records = options['number_of_records']
        activities_per_user = options['activities_per_user']
        num_documents = options['num_documents']
        num_legal_requests = options['num_legal_requests']
        
        call_command('create_clients_lawyers')
        call_command('create_organizations')
        call_command('create_legal_requests', '--number_of_requests', num_legal_requests)
        call_command('create_processes', '--number_of_processes', number_of_records)
        call_command('create_dynamic_documents', '--num_documents', num_documents)
        call_command('create_activity_logs', '--activities_per_user', activities_per_user)
        
        self.stdout.write(self.style.SUCCESS(
            f'Successfully created fake data with {number_of_records} processes, '
            f'{num_documents} documents, {num_legal_requests} legal requests, '
            f'and ~{activities_per_user} activities per user'
        ))
