"""Tests for signature_notification_service."""

from datetime import date, timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import DynamicDocument, DocumentSignature, Notification
from gym_app.services.signature_notification_service import (
    notify_daily_pending_reminders,
    notify_signature_completed,
    notify_signature_expired,
    notify_signature_progress,
    notify_signature_rejected,
    notify_signature_reopened,
    notify_signature_requested,
)

User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def signer_user():
    """Extra user who acts as a signer."""
    return User.objects.create_user(
        email="signer@test.com",
        password="testpassword",
        first_name="Signer",
        last_name="User",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def sig_document(lawyer_user):
    """Document in PendingSignatures state."""
    return DynamicDocument.objects.create(
        title="Sig Doc",
        content="<p>content</p>",
        state="PendingSignatures",
        requires_signature=True,
        created_by=lawyer_user,
    )


# ── notify_signature_requested ────────────────────────────────────

@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_requested_creates_in_app_notifications(
    mock_email, sig_document, client_user, signer_user
):
    """Creates one in-app notification per signer."""
    signers = [client_user, signer_user]
    notify_signature_requested(sig_document, signers)

    notifs = Notification.objects.filter(
        category="signature_request",
        link_type="document",
        link_id=sig_document.id,
    )
    assert notifs.count() == 2
    assert set(notifs.values_list("user_id", flat=True)) == {
        client_user.id,
        signer_user.id,
    }


@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_requested_sends_email(
    mock_email, sig_document, client_user
):
    """Sends email to each signer."""
    notify_signature_requested(sig_document, [client_user])
    assert mock_email.call_count >= 1


@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_requested_no_signers(mock_email, sig_document):
    """No-op when signers list is empty."""
    notify_signature_requested(sig_document, [])
    mock_email.assert_not_called()
    assert Notification.objects.count() == 0


# ── notify_signature_completed ────────────────────────────────────

@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_completed_includes_creator(
    mock_email, sig_document, lawyer_user, signer_user
):
    """Includes document creator in notification recipients."""
    DocumentSignature.objects.create(
        document=sig_document, signer=signer_user, signed=True
    )
    notify_signature_completed(sig_document, signer_user)

    notifs = Notification.objects.filter(
        category="signature_completed",
        link_id=sig_document.id,
    )
    recipient_ids = set(notifs.values_list("user_id", flat=True))
    assert lawyer_user.id in recipient_ids
    assert signer_user.id in recipient_ids


# ── notify_signature_rejected ─────────────────────────────────────

@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_rejected_notifies_creator(
    mock_email, sig_document, lawyer_user, signer_user
):
    """Rejection sends in-app notification to document creator."""
    notify_signature_rejected(sig_document, signer_user, comment="Not correct")

    notif = Notification.objects.get(
        user=lawyer_user,
        category="signature_rejected",
    )
    assert "Not correct" in notif.message
    assert notif.link_type == "document"
    assert notif.link_id == sig_document.id
    assert notif.priority == "high"


@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_rejected_without_comment(
    mock_email, sig_document, lawyer_user, signer_user
):
    """Rejection works without a comment."""
    notify_signature_rejected(sig_document, signer_user)
    notif = Notification.objects.get(
        user=lawyer_user,
        category="signature_rejected",
    )
    assert notif.link_id == sig_document.id


# ── notify_signature_progress ─────────────────────────────────────

@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_progress_emails_all_signers(
    mock_email, sig_document, client_user, signer_user
):
    """Progress notification reaches every signer."""
    DocumentSignature.objects.create(
        document=sig_document, signer=client_user, signed=True
    )
    DocumentSignature.objects.create(
        document=sig_document, signer=signer_user, signed=False
    )

    notify_signature_progress(sig_document, client_user)

    mock_email.assert_called_once()
    to_emails = mock_email.call_args.kwargs["to_emails"]
    assert set(to_emails) == {client_user.email, signer_user.email}


# ── notify_signature_expired ──────────────────────────────────────

@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_expired_notifies_creator_only(
    mock_email, sig_document, lawyer_user, signer_user
):
    """Expiration creates an in-app notification for the document creator only."""
    DocumentSignature.objects.create(
        document=sig_document, signer=signer_user, signed=False
    )

    notify_signature_expired(sig_document)

    expired_notifs = Notification.objects.filter(category="signature_expired")
    assert expired_notifs.count() == 1
    assert expired_notifs.first().user_id == lawyer_user.id


# ── notify_signature_reopened (in-app only — no email) ────────────

@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_notify_signature_reopened_creates_in_app_only(
    mock_email, sig_document, client_user, signer_user
):
    """Reopen sends in-app notifications but does NOT send email (per spec)."""
    DocumentSignature.objects.create(
        document=sig_document, signer=client_user, signed=False
    )
    DocumentSignature.objects.create(
        document=sig_document, signer=signer_user, signed=False
    )

    notify_signature_reopened(sig_document)

    mock_email.assert_not_called()
    notifs = Notification.objects.filter(category="signature_reopened")
    assert set(notifs.values_list("user_id", flat=True)) == {
        client_user.id,
        signer_user.id,
    }


# ── notify_daily_pending_reminders ────────────────────────────────

@pytest.fixture
@pytest.mark.django_db
def aged_pending_doc(lawyer_user):
    """Pending document created >24h ago — eligible for daily reminder."""
    doc = DynamicDocument.objects.create(
        title="Aged Pending Doc",
        content="<p>old</p>",
        state="PendingSignatures",
        requires_signature=True,
        created_by=lawyer_user,
    )
    DynamicDocument.objects.filter(pk=doc.pk).update(
        created_at=timezone.now() - timedelta(days=2)
    )
    doc.refresh_from_db()
    return doc


@pytest.fixture
@pytest.mark.django_db
def fresh_pending_doc(lawyer_user):
    """Pending document created within the last 24h — should be excluded."""
    return DynamicDocument.objects.create(
        title="Fresh Pending Doc",
        content="<p>new</p>",
        state="PendingSignatures",
        requires_signature=True,
        created_by=lawyer_user,
    )


@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_daily_reminder_excludes_documents_created_within_24h(
    mock_email, aged_pending_doc, fresh_pending_doc, signer_user
):
    """Daily reminder counts only documents older than 24h."""
    DocumentSignature.objects.create(
        document=aged_pending_doc, signer=signer_user, signed=False
    )
    DocumentSignature.objects.create(
        document=fresh_pending_doc, signer=signer_user, signed=False
    )

    notify_daily_pending_reminders()

    mock_email.assert_called_once()
    additional_info = mock_email.call_args.kwargs["context"]["additional_info"]
    assert "Aged Pending Doc" in additional_info
    assert "Fresh Pending Doc" not in additional_info


@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_daily_reminder_skips_users_with_only_recent_documents(
    mock_email, fresh_pending_doc, signer_user
):
    """A user whose only pending docs are <24h old receives nothing."""
    DocumentSignature.objects.create(
        document=fresh_pending_doc, signer=signer_user, signed=False
    )

    notify_daily_pending_reminders()

    mock_email.assert_not_called()
    assert not Notification.objects.filter(
        user=signer_user, category="signature_reminder"
    ).exists()


@freeze_time('2026-01-15 10:00:00')
@pytest.mark.django_db
@patch("gym_app.services.signature_notification_service.send_template_email")
def test_daily_reminder_aggregates_documents_per_user(
    mock_email, lawyer_user, signer_user
):
    """A user with N aged pending docs gets one email and one in-app notification."""
    for idx in range(3):
        doc = DynamicDocument.objects.create(
            title=f"Aged Doc {idx}",
            content="<p>x</p>",
            state="PendingSignatures",
            requires_signature=True,
            created_by=lawyer_user,
        )
        DynamicDocument.objects.filter(pk=doc.pk).update(
            created_at=timezone.now() - timedelta(days=2)
        )
        DocumentSignature.objects.create(
            document=doc, signer=signer_user, signed=False
        )

    notify_daily_pending_reminders()

    assert mock_email.call_count == 1
    reminders = Notification.objects.filter(
        user=signer_user, category="signature_reminder"
    )
    assert reminders.count() == 1
