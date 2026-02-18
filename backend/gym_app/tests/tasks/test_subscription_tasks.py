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
        mock_post.assert_called_once()

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

        with pytest.raises(requests.RequestException) as exc_info:
            process_subscription_payment(sub)
        assert exc_info.value is not None
        sub.refresh_from_db()
        assert sub.status == "active"


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
        with pytest.raises(Subscription.DoesNotExist) as exc_info:
            cancel_subscription.run(9999)
        assert exc_info.value is not None


# ======================================================================
# Tests migrated from test_views_batch27.py
# ======================================================================

"""Batch 27 – 20 tests: tasks.py – subscription payment processing & cancellation."""
import datetime
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.auth import get_user_model
from gym_app.models import Subscription
from gym_app.tasks import (
    process_monthly_subscriptions,
    process_subscription_payment,
    cancel_subscription,
)

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return User.objects.create_user(email="task@t.com", password="pw", role="client")


@pytest.fixture
def active_sub(user):
    return Subscription.objects.create(
        user=user,
        plan_type="cliente",
        status="active",
        amount=Decimal("50000.00"),
        next_billing_date=datetime.date.today(),
        payment_source_id="src_123",
    )


@pytest.fixture
def free_sub(user):
    return Subscription.objects.create(
        user=user,
        plan_type="basico",
        status="active",
        amount=Decimal("0"),
        next_billing_date=datetime.date.today(),
    )


# ── process_monthly_subscriptions ──────────────────────────────────

class TestProcessMonthlySubscriptions:
    def test_no_due_subscriptions(self):
        result = process_monthly_subscriptions()
        assert "0 subscriptions" in result

    @patch("gym_app.tasks.process_subscription_payment")
    def test_processes_due_subscriptions(self, mock_pay, active_sub):
        result = process_monthly_subscriptions()
        mock_pay.assert_called_once_with(active_sub)
        assert "1 subscriptions" in result

    @patch("gym_app.tasks.process_subscription_payment")
    def test_skips_future_subscriptions(self, mock_pay, user):
        Subscription.objects.create(
            user=user, plan_type="cliente", status="active",
            amount=Decimal("1000"), next_billing_date=datetime.date.today() + datetime.timedelta(days=5),
        )
        result = process_monthly_subscriptions()
        mock_pay.assert_not_called()
        assert "0 subscriptions" in result

    @patch("gym_app.tasks.process_subscription_payment", side_effect=Exception("boom"))
    def test_continues_on_exception(self, mock_pay, active_sub, user):
        Subscription.objects.create(
            user=user, plan_type="corporativo", status="active",
            amount=Decimal("1000"), next_billing_date=datetime.date.today(),
            payment_source_id="src_456",
        )
        result = process_monthly_subscriptions()
        assert mock_pay.call_count == 2
        assert "subscriptions" in result

    @patch("gym_app.tasks.process_subscription_payment")
    def test_ignores_cancelled_subscriptions(self, mock_pay, user):
        Subscription.objects.create(
            user=user, plan_type="cliente", status="cancelled",
            amount=Decimal("1000"), next_billing_date=datetime.date.today(),
        )
        result = process_monthly_subscriptions()
        mock_pay.assert_not_called()
        assert "0 subscriptions" in result


# ── process_subscription_payment ───────────────────────────────────

class TestProcessSubscriptionPayment:
    def test_free_plan_skips_payment(self, free_sub):
        process_subscription_payment(free_sub)
        free_sub.refresh_from_db()
        assert free_sub.next_billing_date > datetime.date.today()

    @patch("gym_app.tasks.requests.post")
    def test_approved_payment_updates_billing(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        active_sub.refresh_from_db()
        assert active_sub.next_billing_date > datetime.date.today()
        assert active_sub.status == "active"
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_declined_payment_expires_subscription(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "DECLINED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        active_sub.refresh_from_db()
        assert active_sub.status == "expired"
        active_sub.user.refresh_from_db()
        assert active_sub.user.role == "basic"
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_pending_status_no_change(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "PENDING"}},
            raise_for_status=lambda: None,
        )
        old_date = active_sub.next_billing_date
        process_subscription_payment(active_sub)
        active_sub.refresh_from_db()
        assert active_sub.next_billing_date == old_date
        assert active_sub.status == "active"
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_request_exception_raises(self, mock_post, active_sub):
        import requests as req_lib
        mock_post.side_effect = req_lib.RequestException("timeout")
        with pytest.raises(req_lib.RequestException) as exc_info:
            process_subscription_payment(active_sub)
        assert exc_info.value is not None
        active_sub.refresh_from_db()
        assert active_sub.status == "active"
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_amount_converted_to_cents(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        call_kwargs = mock_post.call_args
        sent_amount = call_kwargs.kwargs["json"]["amount_in_cents"]
        assert sent_amount == 5000000  # 50000.00 * 100
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_reference_contains_sub_id(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        ref = mock_post.call_args.kwargs["json"]["reference"]
        assert f"SUB-{active_sub.id}-" in ref
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_payment_source_id_sent(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        payload = mock_post.call_args.kwargs["json"]
        assert payload["payment_source_id"] == "src_123"
        assert payload["currency"] == "COP"
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_signature_sent_in_payload(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        payload = mock_post.call_args.kwargs["json"]
        assert "signature" in payload
        assert len(payload["signature"]) == 64  # SHA256 hex
        mock_post.assert_called_once()


# ── cancel_subscription ────────────────────────────────────────────

class TestCancelSubscription:
    def test_cancel_success(self, active_sub):
        result = cancel_subscription(active_sub.id)
        active_sub.refresh_from_db()
        assert active_sub.status == "cancelled"
        active_sub.user.refresh_from_db()
        assert active_sub.user.role == "basic"
        assert str(active_sub.id) in result

    def test_cancel_not_found_raises(self):
        with pytest.raises(Subscription.DoesNotExist) as exc_info:
            cancel_subscription(999999)
        assert exc_info.value is not None

    def test_cancel_already_cancelled(self, user):
        sub = Subscription.objects.create(
            user=user, plan_type="cliente", status="cancelled",
            amount=Decimal("1000"), next_billing_date=datetime.date.today(),
        )
        result = cancel_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == "cancelled"
        assert "cancelled" in result


class TestTasksEdgeCases:
    @patch("gym_app.tasks.process_subscription_payment")
    def test_expired_sub_not_processed(self, mock_pay, user):
        Subscription.objects.create(
            user=user, plan_type="cliente", status="expired",
            amount=Decimal("1000"), next_billing_date=datetime.date.today(),
        )
        result = process_monthly_subscriptions()
        mock_pay.assert_not_called()
        assert "0 subscriptions" in result

    @patch("gym_app.tasks.requests.post")
    def test_auth_header_uses_private_key(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        headers = mock_post.call_args.kwargs["headers"]
        assert "Authorization" in headers
        assert headers["Content-Type"] == "application/json"
        mock_post.assert_called_once()

    @patch("gym_app.tasks.requests.post")
    def test_recurrent_flag_true(self, mock_post, active_sub):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"data": {"status": "APPROVED"}},
            raise_for_status=lambda: None,
        )
        process_subscription_payment(active_sub)
        payload = mock_post.call_args.kwargs["json"]
        assert payload["recurrent"] is True
        mock_post.assert_called_once()
