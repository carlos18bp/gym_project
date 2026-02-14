import pytest
from decimal import Decimal

from django.utils import timezone
from django.contrib.auth import get_user_model

from gym_app.models import Subscription, PaymentHistory
from gym_app.serializers.subscription import PaymentHistorySerializer, SubscriptionSerializer


User = get_user_model()


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
class TestPaymentHistorySerializer:
    def test_serialize_payment_history(self, subscription_user):
        """PaymentHistorySerializer debe exponer los campos básicos y respetar read_only."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("99000.00"),
        )

        payment = PaymentHistory.objects.create(
            subscription=sub,
            amount=Decimal("99000.00"),
            status="approved",
            transaction_id="trx_123",
            reference="REF-123",
            error_message="",
        )

        serializer = PaymentHistorySerializer(payment)
        data = serializer.data

        assert data["id"] == payment.id
        assert data["amount"] == str(payment.amount)
        assert data["status"] == payment.status
        assert data["transaction_id"] == payment.transaction_id
        assert data["reference"] == payment.reference
        assert "payment_date" in data


@pytest.mark.django_db
class TestSubscriptionSerializer:
    def test_serialize_subscription(self, subscription_user):
        """SubscriptionSerializer debe incluir user_email y user_name derivados."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("99000.00"),
        )

        serializer = SubscriptionSerializer(sub)
        data = serializer.data

        assert data["id"] == sub.id
        assert data["user_email"] == subscription_user.email
        # user_name usa nombre completo o email
        assert data["user_name"] in {f"{subscription_user.first_name} {subscription_user.last_name}", subscription_user.email}
        assert data["plan_type"] == sub.plan_type
        assert data["status"] == sub.status
        assert data["amount"] == str(sub.amount)
        assert "created_at" in data
        assert "updated_at" in data


@pytest.mark.django_db
class TestSubscriptionSerializerEdges:
    def test_user_name_fallback_to_email(self):
        user = User.objects.create_user(
            email="noname-sub@example.com", password="p",
            first_name="", last_name="",
        )
        sub = Subscription.objects.create(
            user=user, plan_type="basico", status="active",
            next_billing_date=timezone.now().date() + timezone.timedelta(days=30),
            amount=Decimal("0.00"),
        )
        s = SubscriptionSerializer(sub)
        assert s.data["user_name"] == user.email

    def test_read_only_fields(self):
        user = User.objects.create_user(
            email="ro@example.com", password="p", role="client",
        )
        sub = Subscription.objects.create(
            user=user, plan_type="cliente", status="active",
            next_billing_date=timezone.now().date() + timezone.timedelta(days=30),
            amount=Decimal("50000.00"),
        )
        s = SubscriptionSerializer(sub)
        assert "id" in s.data
        assert "created_at" in s.data
        assert "updated_at" in s.data

    def test_get_user_name_with_names(self, subscription_user):
        """Cover line 46: user has first and last name."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date() + timezone.timedelta(days=30),
            amount=Decimal("50000.00"),
        )
        serializer = SubscriptionSerializer(sub)
        data = serializer.data
        assert data["user_name"] == "Sub User"
