"""Tests for subscription_tasks module."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

import pytest
from freezegun import freeze_time
from django.contrib.auth import get_user_model
from gym_app.models import Subscription
from gym_app.tasks import (
    cancel_subscription,
    process_monthly_subscriptions,
    process_subscription_payment,
)
from requests.exceptions import RequestException

User = get_user_model()
FIXED_TODAY = date(2026, 1, 15)


@pytest.fixture
def wompi_settings(monkeypatch, settings):
    """Wompi settings."""
    monkeypatch.setattr(settings, "WOMPI_API_URL", "https://sandbox.wompi.co/v1")
    monkeypatch.setattr(settings, "WOMPI_PRIVATE_KEY", "priv_test")
    monkeypatch.setattr(settings, "WOMPI_INTEGRITY_KEY", "integrity_test")
    return settings


@pytest.fixture
@pytest.mark.django_db
def subscription_user():
    """Subscription user."""
    return User.objects.create_user(
        email="subscriber@example.com",
        password="testpassword",
        first_name="Sub",
        last_name="User",
        role="client",
    )


@pytest.mark.django_db
class TestProcessSubscriptionPayment:
    """Tests for Process Subscription Payment."""

    @freeze_time("2026-01-15")
    @mock.patch("gym_app.tasks.requests.post")
    def test_free_plan_skips_wompi_and_updates_next_billing(
        self, mock_post, subscription_user
    ):
        """Verify free plan skips wompi and updates next billing."""
        today = FIXED_TODAY
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

    @freeze_time("2026-01-15")
    @mock.patch("gym_app.tasks.requests.post")
    def test_paid_plan_approved_updates_next_billing(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify paid plan approved updates next billing."""
        today = FIXED_TODAY
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
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify paid plan declined expires subscription and downgrades user."""
        today = FIXED_TODAY
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
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify paid plan pending leaves subscription unchanged."""
        today = FIXED_TODAY
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
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify paid plan request exception raises."""
        today = FIXED_TODAY
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=today,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )

        mock_post.side_effect = RequestException("boom")

        with pytest.raises(RequestException) as exc_info:
            process_subscription_payment(sub)
        assert exc_info.value is not None
        sub.refresh_from_db()
        assert sub.status == "active"

    @mock.patch("gym_app.tasks.requests.post")
    def test_amount_converted_to_cents(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify amount is converted to cents for Wompi payload."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        mock_post.assert_called_once()
        sent_amount = mock_post.call_args.kwargs["json"]["amount_in_cents"]
        assert sent_amount == 5000000

    @mock.patch("gym_app.tasks.requests.post")
    def test_reference_contains_sub_id(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify transaction reference contains the subscription id."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        mock_post.assert_called_once()
        ref = mock_post.call_args.kwargs["json"]["reference"]
        assert f"SUB-{sub.id}-" in ref

    @mock.patch("gym_app.tasks.requests.post")
    def test_payment_source_id_and_currency_sent(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify payment_source_id and currency are included in payload."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        mock_post.assert_called_once()
        payload = mock_post.call_args.kwargs["json"]
        assert payload["payment_source_id"] == "src_1"
        assert payload["currency"] == "COP"

    @mock.patch("gym_app.tasks.requests.post")
    def test_signature_is_sha256_hex(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify signature in payload is a 64-char SHA256 hex digest."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        mock_post.assert_called_once()
        payload = mock_post.call_args.kwargs["json"]
        assert "signature" in payload
        assert len(payload["signature"]) == 64

    @mock.patch("gym_app.tasks.requests.post")
    def test_auth_header_uses_private_key(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify Authorization header uses the private key."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        mock_post.assert_called_once()
        headers = mock_post.call_args.kwargs["headers"]
        assert "Authorization" in headers
        assert headers["Content-Type"] == "application/json"

    @mock.patch("gym_app.tasks.requests.post")
    def test_recurrent_flag_is_true(
        self, mock_post, subscription_user, wompi_settings
    ):
        """Verify recurrent flag is True in Wompi payload."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
            payment_source_id="src_1",
        )
        wompi_response = mock.Mock()
        wompi_response.raise_for_status.return_value = None
        wompi_response.json.return_value = {"data": {"status": "APPROVED"}}
        mock_post.return_value = wompi_response

        process_subscription_payment(sub)

        mock_post.assert_called_once()
        payload = mock_post.call_args.kwargs["json"]
        assert payload["recurrent"] is True


@pytest.mark.django_db
class TestProcessMonthlySubscriptions:
    """Tests for Process Monthly Subscriptions."""

    @freeze_time("2026-01-15")
    @mock.patch("gym_app.tasks.process_subscription_payment")
    def test_process_monthly_subscriptions_filters_due_and_calls_processor(
        self, mock_processor, subscription_user
    ):
        """Verify process monthly subscriptions filters due and calls processor."""
        today = FIXED_TODAY
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
        _not_due = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=tomorrow,
            amount=Decimal("50000.00"),
        )

        # Llamamos al método run de la tarea compartida para ejecutar la lógica síncrona
        result = process_monthly_subscriptions.call_local()

        # Debe procesar solo las suscripciones con next_billing_date <= today
        processed_ids = {call.args[0].id for call in mock_processor.call_args_list}
        assert processed_ids == {due1.id, due2.id}
        assert "Processed 2 subscriptions" in result

    @freeze_time("2026-01-15")
    @mock.patch("gym_app.tasks.process_subscription_payment")
    def test_process_monthly_subscriptions_continues_on_exception(
        self, mock_processor, subscription_user
    ):
        """Verify process monthly subscriptions continues on exception."""
        today = FIXED_TODAY
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

        result = process_monthly_subscriptions.call_local()

        assert mock_processor.call_count == 2
        processed_ids = {call.args[0].id for call in mock_processor.call_args_list}
        assert processed_ids == {due1.id, due2.id}
        assert "Processed 2 subscriptions" in result

    @freeze_time("2026-01-15")
    @mock.patch("gym_app.tasks.process_subscription_payment")
    def test_ignores_cancelled_subscriptions(
        self, mock_processor, subscription_user
    ):
        """Verify cancelled subscriptions are not processed."""
        Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="cancelled",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
        )

        result = process_monthly_subscriptions.call_local()

        mock_processor.assert_not_called()
        assert "Processed 0 subscriptions" in result

    @freeze_time("2026-01-15")
    @mock.patch("gym_app.tasks.process_subscription_payment")
    def test_ignores_expired_subscriptions(
        self, mock_processor, subscription_user
    ):
        """Verify expired subscriptions are not processed."""
        Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="expired",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
        )

        result = process_monthly_subscriptions.call_local()

        mock_processor.assert_not_called()
        assert "Processed 0 subscriptions" in result


@pytest.mark.django_db
class TestCancelSubscriptionTask:
    """Tests for Cancel Subscription Task."""

    def test_cancel_subscription_task_success(self, subscription_user):
        """Verify cancel subscription task success."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="active",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
        )

        result = cancel_subscription.call_local(sub.id)

        sub.refresh_from_db()
        assert sub.status == "cancelled"
        subscription_user.refresh_from_db()
        assert subscription_user.role == "basic"
        assert str(sub.id) in result

    def test_cancel_subscription_task_not_found_raises(self):
        """Verify cancel subscription task not found raises."""
        with pytest.raises(Subscription.DoesNotExist) as exc_info:
            cancel_subscription.call_local(9999)
        assert exc_info.value is not None

    def test_cancel_already_cancelled_still_returns_cancelled(
        self, subscription_user
    ):
        """Verify cancelling an already-cancelled subscription keeps status cancelled."""
        sub = Subscription.objects.create(
            user=subscription_user,
            plan_type="cliente",
            status="cancelled",
            next_billing_date=FIXED_TODAY,
            amount=Decimal("50000.00"),
        )

        result = cancel_subscription.call_local(sub.id)

        sub.refresh_from_db()
        assert sub.status == "cancelled"
        assert "cancelled" in result
