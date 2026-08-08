from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from gym_app.models import Subscription, PaymentHistory, User

# Monthly plan prices in COP.
PLAN_AMOUNT = {
    'basico': Decimal('50000.00'),
    'cliente': Decimal('150000.00'),
    'corporativo': Decimal('500000.00'),
}

# (plan_type, status) combos so all 3 plan types x 3 statuses are represented.
SUBSCRIPTION_MATRIX = [
    ('basico', 'active'),
    ('basico', 'cancelled'),
    ('basico', 'expired'),
    ('cliente', 'active'),
    ('cliente', 'cancelled'),
    ('cliente', 'expired'),
    ('corporativo', 'active'),
    ('corporativo', 'cancelled'),
    ('corporativo', 'expired'),
]

# Payment status is derived from subscription status so error/declined states
# are exercised explicitly (required by the checklist).
PAYMENTS_BY_STATUS = {
    'active': ['approved', 'pending'],
    'cancelled': ['approved', 'declined'],
    'expired': ['approved', 'error'],
}


class Command(BaseCommand):
    help = 'Create fake data for the subscription domain (Subscription + PaymentHistory)'

    def handle(self, *args, **options):
        # Prefer role-appropriate demo users, fall back to any user per plan.
        by_plan = {
            'basico': self._pick_users(['info.montreal.studios@gmail.com'], role='basic'),
            'cliente': self._pick_users(['carlos18bp@gmail.com'], role='client'),
            'corporativo': self._pick_users(['corporate1@gmail.com'], role='corporate_client'),
        }
        if not any(by_plan.values()):
            self.stdout.write(self.style.ERROR('No users found. Run create_clients_lawyers first.'))
            return

        subs_created = 0
        payments_created = 0
        for plan_type, status in SUBSCRIPTION_MATRIX:
            candidates = by_plan.get(plan_type) or [u for us in by_plan.values() for u in us]
            if not candidates:
                continue
            user = candidates[0]

            # Idempotency guard: one subscription per (user, plan_type, status).
            if Subscription.objects.filter(user=user, plan_type=plan_type, status=status).exists():
                continue

            today = timezone.now().date()
            next_billing = (
                today - timezone.timedelta(days=15) if status == 'expired'
                else today + timezone.timedelta(days=30)
            )
            subscription = Subscription.objects.create(
                user=user,
                plan_type=plan_type,
                status=status,
                amount=PLAN_AMOUNT[plan_type],
                next_billing_date=next_billing,
                payment_source_id=f'FAKE-SRC-{plan_type}-{status}',
            )
            subs_created += 1

            for i, pay_status in enumerate(PAYMENTS_BY_STATUS[status]):
                reference = f'REF-{subscription.id}-{i}'
                _, created = PaymentHistory.objects.get_or_create(
                    subscription=subscription,
                    reference=reference,
                    defaults={
                        'amount': PLAN_AMOUNT[plan_type],
                        'status': pay_status,
                        'transaction_id': f'FAKE-TXN-{subscription.id}-{i}',
                        'error_message': (
                            'Fondos insuficientes' if pay_status == 'declined'
                            else 'Error de comunicación con la pasarela' if pay_status == 'error'
                            else None
                        ),
                    },
                )
                if created:
                    payments_created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Subscriptions seeded: {subs_created} subscriptions, {payments_created} payments'
        ))

    @staticmethod
    def _pick_users(preferred_emails, role):
        """Return preferred demo users if present, else any user with the role."""
        users = [u for e in preferred_emails if (u := User.objects.filter(email=e).first())]
        if not users:
            users = list(User.objects.filter(role=role)[:1])
        return users
