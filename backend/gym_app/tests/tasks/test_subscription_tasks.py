from datetime import datetime, timedelta
from decimal import Decimal
from unittest import mock

import pytest
import requests
from django.utils import timezone
from django.contrib.auth import get_user_model

from gym_app.models import Subscription
from gym_app.tasks import (
    process_monthly_subscriptions,
    process_subscription_payment,
    cancel_subscription,
)


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
class TestProcessSubscriptionPayment:
    @mock.patch("gym_app.tasks.requests.post")
    def test_free_plan_skips_wompi_and_updates_next_billing(
        self, mock_post, subscription_user
    ):
        today = datetime.now().date()
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="basico",
            status="active",
            next_billing_date=today,
            amount=Decimal("0.00"),
        )

        process_subscription_payment(sub)

        sub.refresh_from_db()
        assert sub.next_billing_date == today + timedelta(days=30)
        # No llamada a Wompi para planes gratis
        mock_post.assert_not_called()

    @mock.patch("gym_app.tasks.requests.post")
    def test_paid_plan_approved_updates_next_billing(
        self, mock_post, subscription_user, settings
    ):
        settings.WOMPI_API_URL = "https://sandbox.wompi.co/v1"
        settings.WOMPI_PRIVATE_KEY = "priv_test"
        settings.WOMPI_INTEGRITY_KEY = "integrity_test"

        today = datetime.now().date()
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )

        # Mock respuesta de Wompi
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        sub.refresh_from_db()
        assert sub.status == "active"
        assert sub.next_billing_date == today + timedelta(days=30)
        # No debe cambiar el rol del usuario en este flujo
        subscription_user.refresh_from_db()
        assert subscription_user.role == "client"
        mock_post.assert_called_once()

    @mock.patch("gym_app.tasks.requests.post")
    def test_paid_plan_declined_expires_subscription_and_downgrades_user(
        self, mock_post, subscription_user, settings
    ):
        settings.WOMPI_API_URL = "https://sandbox.wompi.co/v1"
        settings.WOMPI_PRIVATE_KEY = "priv_test"
        settings.WOMPI_INTEGRITY_KEY = "integrity_test"

        today = datetime.now().date()
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )

        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "DECLINED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        sub.refresh_from_db()
        assert sub.status == "expired"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"

    @mock.patch("gym_app.tasks.requests.post")
    def test_paid_plan_pending_leaves_subscription_unchanged(
        self, mock_post, subscription_user, settings
    ):
        settings.WOMPI_API_URL = "https://sandbox.wompi.co/v1"
        settings.WOMPI_PRIVATE_KEY = "priv_test"
        settings.WOMPI_INTEGRITY_KEY = "integrity_test"

        today = datetime.now().date()
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )

        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "PENDING"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        sub.refresh_from_db()
        assert sub.status == "active"
        assert sub.next_billing_date == today
        subscription_user.refresh_from_db()
        assert subscription_user.role == "client"
        mock_post.assert_called_once()

    @mock.patch("gym_app.tasks.requests.post")
    def test_paid_plan_request_exception_raises(
        self, mock_post, subscription_user, settings
    ):
        settings.WOMPI_API_URL = "https://sandbox.wompi.co/v1"
        settings.WOMPI_PRIVATE_KEY = "priv_test"
        settings.WOMPI_INTEGRITY_KEY = "integrity_test"

        today = datetime.now().date()
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )

        mock_post.side_effect = requests.RequestException("boom")

        with pytest.raises(requests.RequestException):
            process_subscription_payment(sub)


@pytest.mark.django_db
class TestProcessMonthlySubscriptions:
    @mock.patch("gym_app.tasks.process_subscription_payment")
    def test_process_monthly_subscriptions_filters_due_and_calls_processor(
        self, mock_processor, subscription_user
    ):
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)

        due1 = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=yesterday,
            amount=Decimal("50000.00"),
        )
        due2 = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
        )
        not_due = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=tomorrow,
            amount=Decimal("50000.00"),
        )

        # Llamamos al método run de la tarea compartida para ejecutar la lógica síncrona
        result = process_monthly_subscriptions.run()

        # Debe procesar solo las suscripciones con next_billing_date <= today
        processed_ids = {call.args[0].id for call in mock_processor.call_args_list}
        assert processed_ids == {due1.id, due2.id}
        assert f"Processed 2 subscriptions" in result

    @mock.patch("gym_app.tasks.process_subscription_payment")
    def test_process_monthly_subscriptions_continues_on_exception(
        self, mock_processor, subscription_user
    ):
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)

        due1 = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=yesterday,
            amount=Decimal("50000.00"),
        )
        due2 = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
        )

        mock_processor.side_effect = [Exception("boom"), None]

        result = process_monthly_subscriptions.run()

        assert mock_processor.call_count == 2
        processed_ids = {call.args[0].id for call in mock_processor.call_args_list}
        assert processed_ids == {due1.id, due2.id}
        assert f"Processed 2 subscriptions" in result


@pytest.mark.django_db
class TestCancelSubscriptionTask:
    def test_cancel_subscription_task_success(self, subscription_user):
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=timezone.now().date(),
            amount=Decimal("50000.00"),
        )

        result = cancel_subscription.run(sub.id)

        sub.refresh_from_db()
        assert sub.status == "cancelled"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"
        assert str(sub.id) in result

    def test_cancel_subscription_task_not_found_raises(self):
        with pytest.raises(Subscription.DoesNotExist):
            cancel_subscription.run(9999)
