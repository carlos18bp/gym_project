from django.core.management.base import BaseCommand
from faker import Faker
from gym_app.models import User, LegalUserLink

class Command(BaseCommand):
    help = 'Generate random LegalUserLinks for existing users'

    def handle(self, *args, **options):
        fake = Faker()
        users = User.objects.all()

        for user in users:
            for _ in range(5):
                LegalUserLink.objects.create(
                    user=user,
                    name=fake.sentence(nb_words=3),
                    link=fake.url()
                )

        self.stdout.write(self.style.SUCCESS('LegalUserLinks created successfully!'))
