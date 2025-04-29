import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker

from gym_app.models import User, Process, DynamicDocument, ActivityFeed

class Command(BaseCommand):
    help = 'Create fake activity logs for testing the activity report functionality'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--activities_per_user',
            type=int,
            default=20,
            help='Number of activities to create per user'
        )
    
    def handle(self, *args, **options):
        fake = Faker()
        activities_per_user = options['activities_per_user']
        
        # Get all users
        users = User.objects.all()
        
        if not users.exists():
            self.stdout.write(self.style.ERROR('No users found. Please run create_clients_lawyers first.'))
            return
        
        # Get some processes and documents for reference in activity descriptions
        processes = list(Process.objects.all())
        documents = list(DynamicDocument.objects.all())
        
        # Define possible action types
        action_types = ['create', 'edit', 'finish', 'delete', 'update', 'other']
        
        # Define activity templates for different action types
        activity_templates = {
            'create': [
                'Created new process: {process_ref}',
                'Created new document: {document_title}',
                'Created new client profile',
                'Created new request form',
                'Started new legal procedure'
            ],
            'edit': [
                'Updated process details: {process_ref}',
                'Modified document: {document_title}',
                'Edited client information',
                'Revised legal request',
                'Changed case status'
            ],
            'finish': [
                'Completed process: {process_ref}',
                'Finalized document: {document_title}',
                'Closed client case',
                'Concluded legal procedure',
                'Marked request as resolved'
            ],
            'delete': [
                'Removed draft document: {document_title}',
                'Deleted outdated version',
                'Removed unnecessary attachment',
                'Cancelled pending request',
                'Deleted invalid record'
            ],
            'update': [
                'Updated status of process: {process_ref}',
                'Refreshed document content: {document_title}',
                'Updated client contact details',
                'Added new information to case',
                'Updated case documentation'
            ],
            'other': [
                'Logged into system',
                'Viewed process details: {process_ref}',
                'Downloaded document: {document_title}',
                'Generated report',
                'Sent email notification',
                'Scheduled meeting with client',
                'Reviewed case status'
            ]
        }
        
        # Clear existing activities if needed
        ActivityFeed.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Cleared existing activity logs'))
        
        # Create activities for each user
        total_created = 0
        for user in users:
            # Create a random number of activities for this user
            num_activities = random.randint(activities_per_user // 2, activities_per_user)
            
            for i in range(num_activities):
                # Select a random action type
                action_type = random.choice(action_types)
                
                # Select a random template for this action type
                template = random.choice(activity_templates[action_type])
                
                # Format the template with random data
                if '{process_ref}' in template and processes:
                    process = random.choice(processes)
                    description = template.format(process_ref=process.ref)
                elif '{document_title}' in template and documents:
                    document = random.choice(documents)
                    description = template.format(document_title=document.title)
                else:
                    description = template
                
                # Generate a random timestamp within the last 60 days
                days_ago = random.randint(0, 60)
                timestamp = timezone.now() - timedelta(days=days_ago)
                
                # Create the activity
                ActivityFeed.objects.create(
                    user=user,
                    action_type=action_type,
                    description=description,
                    created_at=timestamp
                )
                total_created += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {total_created} activity logs for {users.count()} users')
        ) 