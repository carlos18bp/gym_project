import pytest
from decimal import Decimal
from datetime import timedelta

from django.utils import timezone

from gym_app.models.subscription import Subscription, PaymentHistory
from gym_app.models.user import User


@pytest.fixture
@pytest.mark.django_db
def subscription_user():
    return User.objects.create_user(
        email="subscriber@example.com",
        password="testpassword",
        first_name="Sub",
        last_name="User",
        role="client",
    )


@pytest.mark.django_db
class TestSubscription:
    """Tests for the Subscription model."""

    def test_create_subscription_and_str(self, subscription_user):
        """Create a subscription and verify fields and __str__."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            payment_source_id="src_test_123",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("99000.00"),
        )

        assert sub.id is not None
        assert sub.user == subscription_user
        assert sub.plan_type == "cliente"
        assert sub.status == "active"
        assert sub.amount == Decimal("99000.00")

        # __str__ debe usar el display del plan ("Cliente")
        expected = f"{subscription_user.email} - {sub.get_plan_type_display()} ({sub.status})"
        assert str(sub) == expected

    def test_subscription_payments_related_name(self, subscription_user):
        """Los pagos deben estar enlazados vía related_name 'payments'."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="basico",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("10000.00"),
        )

        PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("10000.00"),
            status="approved",
            reference="REF-1",
        )
        PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("10000.00"),
            status="approved",
            reference="REF-2",
        )

        payments = sub.payments.all()
        assert payments.count() == 2


@pytest.mark.django_db
class TestPaymentHistory:
    """Tests for the PaymentHistory model."""

    def test_create_payment_history_and_str(self, subscription_user):
        """Create a payment history entry and verify fields and __str__."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="corporativo",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("250000.00"),
        )

        payment = PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("250000.00"),
            status="approved",
            transaction_id="trx_123",
            reference="REF-123",
        )

        assert payment.id is not None
        assert payment.subscription == sub
        assert payment.status == "approved"
        assert payment.amount == Decimal("250000.00")

        s = str(payment)
        assert subscription_user.email in s
        assert "approved" in s

    def test_payment_history_ordering_by_payment_date(self, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )

        older = PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("50000.00"),
            status="approved",
            reference="REF-OLD",
        )
        newer = PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("50000.00"),
            status="approved",
            reference="REF-NEW",
        )

        older_time = timezone.now() - timedelta(days=1)
        newer_time = timezone.now()
        PaymentHistory.objects.filter(pk=older.pk).update(payment_date=older_time)
        PaymentHistory.objects.filter(pk=newer.pk).update(payment_date=newer_time)

        payments = list(PaymentHistory.objects.all())

        assert payments[0].id == newer.id
        assert payments[1].id == older.id
