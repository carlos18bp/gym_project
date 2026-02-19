import pytest
from decimal import Decimal
from datetime import date, datetime, timedelta, timezone as dt_timezone

from gym_app.models.subscription import Subscription, PaymentHistory
from gym_app.models.user import User


@pytest.fixture
def fixed_today():
    return date(2026, 1, 15)


@pytest.fixture
def fixed_now():
    return datetime(2026, 1, 15, 10, 0, tzinfo=dt_timezone.utc)


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

    def test_create_subscription_and_str(self, subscription_user, fixed_today):
        """Create a subscription and verify fields and __str__."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            payment_source_id="src_test_123",
            status="active",
            next_billing_date=fixed_today,
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

    def test_subscription_payments_related_name(self, subscription_user, fixed_today):
        """Los pagos deben estar enlazados vía related_name 'payments'."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="basico",
            status="active",
            next_billing_date=fixed_today,
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

    def test_create_payment_history_and_str(self, subscription_user, fixed_today):
        """Create a payment history entry and verify fields and __str__."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="corporativo",
            status="active",
            next_billing_date=fixed_today,
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

    def test_payment_history_ordering_by_payment_date(self, subscription_user, fixed_today, fixed_now):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=fixed_today,
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

        older_time = fixed_now - timedelta(days=1)
        newer_time = fixed_now
        PaymentHistory.objects.filter(pk=older.pk).update(payment_date=older_time)
        PaymentHistory.objects.filter(pk=newer.pk).update(payment_date=newer_time)

        payments = list(PaymentHistory.objects.all())

        assert payments[0].id == newer.id
        assert payments[1].id == older.id


# ======================================================================
# Tests moved from test_model_consolidated.py
# ======================================================================

# ── Subscription & PaymentHistory ────────────────────────────────────────────

@pytest.mark.django_db
class TestSubscriptionEdges:
    def test_subscription_str(self, client_user, fixed_today):
        sub = Subscription.objects.create(
            user=client_user, plan_type="cliente", status="active",
            next_billing_date=fixed_today + timedelta(days=30),
            amount=Decimal("50000.00"),
        )
        s = str(sub)
        assert client_user.email in s
        assert "Cliente" in s

    def test_payment_history_str(self, client_user, fixed_today):
        sub = Subscription.objects.create(
            user=client_user, plan_type="basico", status="active",
            next_billing_date=fixed_today + timedelta(days=30),
            amount=Decimal("0.00"),
        )
        ph = PaymentHistory.objects.create(
            subscription=sub, amount=Decimal("50000.00"),
            status="approved", reference="REF-001",
        )
        s = str(ph)
        assert "approved" in s
        assert client_user.email in s


# ── CorporateRequestFiles str and signal ─────────────────────────────────────


