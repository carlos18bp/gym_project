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
        process_monthly_subscriptions()
        mock_pay.assert_not_called()

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
        process_monthly_subscriptions()
        mock_pay.assert_not_called()


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

    @patch("gym_app.tasks.requests.post")
    def test_request_exception_raises(self, mock_post, active_sub):
        import requests as req_lib
        mock_post.side_effect = req_lib.RequestException("timeout")
        with pytest.raises(req_lib.RequestException):
            process_subscription_payment(active_sub)

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
        with pytest.raises(Subscription.DoesNotExist):
            cancel_subscription(999999)

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
        process_monthly_subscriptions()
        mock_pay.assert_not_called()

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
