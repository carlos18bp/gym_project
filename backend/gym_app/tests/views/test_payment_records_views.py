"""Tests for the contract-execution (cuentas de cobro) REST API views."""

import os
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from gym_app.models import (
    DocumentPaymentRecord,
    DocumentVariable,
    DynamicDocument,
    Notification,
)

MODULE = "gym_app.views.dynamic_documents.payments_views"


@pytest.fixture
def signed_document(lawyer_user, client_user):
    """FullySigned document with 3 agreed installments."""
    document = DynamicDocument.objects.create(
        title="Contrato de cuotas",
        content="<p>contenido</p>",
        state="FullySigned",
        fully_signed=True,
        created_by=lawyer_user,
        assigned_to=client_user,
    )
    DocumentVariable.objects.create(
        document=document,
        name_es="Forma de pago",
        field_type="number",
        summary_field="payment_installments",
        value="3",
    )
    return document


def records_url(document):
    """Build the payment-records list URL for a document."""
    return f"/api/dynamic-documents/{document.id}/payment-records/"


def upload_url(document):
    """Build the payment-record upload URL for a document."""
    return f"{records_url(document)}upload/"


def make_pdf(name="cuenta.pdf", size=None):
    """Build an in-memory PDF upload of the requested size."""
    content = b"x" * size if size else b"pdf-bytes"
    return SimpleUploadedFile(name, content, content_type="application/pdf")


def upload(api_client, document, number=1, **extra):
    """POST a cuenta de cobro for the given installment as the given user."""
    payload = {"installment_number": number, "file": make_pdf(), **extra}
    return api_client.post(upload_url(document), payload, format="multipart")


def make_record(document, number, status_=DocumentPaymentRecord.STATUS_UPLOADED, uploaded_by=None):
    """Create a payment record row directly in the DB."""
    return DocumentPaymentRecord.objects.create(
        document=document,
        installment_number=number,
        file=make_pdf(f"cuota_{number}.pdf"),
        original_name=f"cuota_{number}.pdf",
        status=status_,
        uploaded_by=uploaded_by,
    )


# ── GET list ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_requires_auth(api_client, signed_document):
    """List requires auth."""
    response = api_client.get(records_url(signed_document))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_list_forbidden_for_third_party(api_client, signed_document, basic_user):
    """List forbidden for third party."""
    api_client.force_authenticate(user=basic_user)
    response = api_client.get(records_url(signed_document))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_list_synthesizes_pending_slots(api_client, signed_document, client_user):
    """List synthesizes pending slots."""
    api_client.force_authenticate(user=client_user)
    response = api_client.get(records_url(signed_document))

    assert response.status_code == status.HTTP_200_OK
    data = response.data
    assert data["configured"] is True
    assert data["total_installments"] == 3
    assert data["next_uploadable"] == 1
    assert data["can_upload"] is True
    assert data["can_review"] is False
    assert [slot["status"] for slot in data["slots"]] == ["pending", "pending", "pending"]


@pytest.mark.django_db
def test_list_feature_off_without_variable(api_client, lawyer_user, client_user):
    """List feature off without variable."""
    document = DynamicDocument.objects.create(
        title="Sin forma de pago",
        content="<p>c</p>",
        state="FullySigned",
        fully_signed=True,
        created_by=lawyer_user,
        assigned_to=client_user,
    )
    api_client.force_authenticate(user=client_user)
    response = api_client.get(records_url(document))

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"document_id": document.id, "configured": False, "slots": []}


# ── Upload ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_upload_by_assigned_client(api_client, signed_document, client_user):
    """Upload by assigned client."""
    api_client.force_authenticate(user=client_user)
    response = upload(api_client, signed_document, 1, amount="2500000.50", notes="Primera cuota")

    assert response.status_code == status.HTTP_201_CREATED
    record = DocumentPaymentRecord.objects.get(document=signed_document, installment_number=1)
    assert (record.status, str(record.amount), record.notes, record.uploaded_by) == (
        DocumentPaymentRecord.STATUS_UPLOADED, "2500000.50", "Primera cuota", client_user,
    )
    assert response.data["slots"][0]["status"] == "uploaded"
    assert response.data["next_uploadable"] is None
    assert response.data["in_review"] is True


@pytest.mark.django_db
def test_upload_by_creator_lawyer_on_behalf(api_client, signed_document, lawyer_user):
    """Upload by creator lawyer on behalf."""
    api_client.force_authenticate(user=lawyer_user)
    response = upload(api_client, signed_document, 1)
    assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_upload_out_of_order_slot_conflicts(api_client, signed_document, client_user):
    """Upload out of order slot conflicts."""
    api_client.force_authenticate(user=client_user)
    response = upload(api_client, signed_document, 2)
    assert response.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_upload_blocked_while_in_review(api_client, signed_document, client_user):
    """Upload blocked while in review."""
    make_record(signed_document, 1)
    api_client.force_authenticate(user=client_user)
    response = upload(api_client, signed_document, 2)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert "revisión" in response.data["detail"]


@pytest.mark.django_db
def test_upload_rejects_disallowed_extension(api_client, signed_document, client_user):
    """Upload rejects disallowed extension."""
    api_client.force_authenticate(user=client_user)
    payload = {
        "installment_number": 1,
        "file": SimpleUploadedFile("virus.exe", b"x", content_type="application/octet-stream"),
    }
    response = api_client.post(upload_url(signed_document), payload, format="multipart")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_upload_rejects_oversized_file(api_client, signed_document, client_user):
    """Upload rejects oversized file."""
    api_client.force_authenticate(user=client_user)
    with patch(f"{MODULE}.MAX_UPLOAD_SIZE", 10):
        response = upload(api_client, signed_document, 1, file=make_pdf(size=64))
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "20 MB" in response.data["detail"] or "tamaño" in response.data["detail"]


@pytest.mark.django_db
def test_upload_rejects_invalid_amount(api_client, signed_document, client_user):
    """Upload rejects invalid amount."""
    api_client.force_authenticate(user=client_user)
    response = upload(api_client, signed_document, 1, amount="no-es-numero")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_upload_feature_off_returns_400(api_client, lawyer_user, client_user):
    """Upload feature off returns 400."""
    document = DynamicDocument.objects.create(
        title="Draft doc",
        content="<p>c</p>",
        state="Draft",
        created_by=lawyer_user,
        assigned_to=client_user,
    )
    api_client.force_authenticate(user=client_user)
    response = upload(api_client, document, 1)
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_upload_forbidden_for_non_party(api_client, signed_document, basic_user):
    """Upload forbidden for non party."""
    api_client.force_authenticate(user=basic_user)
    response = upload(api_client, signed_document, 1)
    assert response.status_code == status.HTTP_403_FORBIDDEN


# ── Accept / Reject ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_accept_forbidden_for_client(api_client, signed_document, client_user):
    """Accept forbidden for client."""
    record = make_record(signed_document, 1)
    api_client.force_authenticate(user=client_user)
    response = api_client.post(f"{records_url(signed_document)}{record.id}/accept/", {})
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_accept_enables_next_slot(api_client, signed_document, lawyer_user):
    """Accept enables next slot."""
    record = make_record(signed_document, 1)
    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(f"{records_url(signed_document)}{record.id}/accept/", {})

    assert response.status_code == status.HTTP_200_OK
    record.refresh_from_db()
    assert record.status == DocumentPaymentRecord.STATUS_ACCEPTED
    assert response.data["accepted_count"] == 1
    assert response.data["next_uploadable"] == 2


@pytest.mark.django_db
def test_accept_already_reviewed_conflicts(api_client, signed_document, lawyer_user):
    """Accept already reviewed conflicts."""
    record = make_record(signed_document, 1, status_=DocumentPaymentRecord.STATUS_ACCEPTED)
    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(f"{records_url(signed_document)}{record.id}/accept/", {})
    assert response.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
def test_reject_requires_reason(api_client, signed_document, lawyer_user):
    """Reject requires reason."""
    record = make_record(signed_document, 1)
    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(
        f"{records_url(signed_document)}{record.id}/reject/", {"rejection_reason": "   "}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_reject_reopens_slot_with_reason(api_client, signed_document, lawyer_user):
    """Reject reopens slot with reason."""
    record = make_record(signed_document, 1)
    api_client.force_authenticate(user=lawyer_user)
    response = api_client.post(
        f"{records_url(signed_document)}{record.id}/reject/",
        {"rejection_reason": "Falta el concepto del cobro"},
    )

    assert response.status_code == status.HTTP_200_OK
    record.refresh_from_db()
    assert record.status == DocumentPaymentRecord.STATUS_REJECTED
    assert record.rejection_reason == "Falta el concepto del cobro"
    assert response.data["next_uploadable"] == 1
    assert response.data["slots"][0]["record"]["rejection_reason"] == "Falta el concepto del cobro"


@pytest.mark.django_db
def test_reupload_after_rejection_reuses_record(api_client, signed_document, client_user, lawyer_user):
    """Reupload after rejection reuses record."""
    record = make_record(
        signed_document, 1, status_=DocumentPaymentRecord.STATUS_REJECTED, uploaded_by=client_user
    )
    record.rejection_reason = "Ilegible"
    record.save(update_fields=["rejection_reason"])
    old_path = record.file.path

    api_client.force_authenticate(user=client_user)
    response = upload(api_client, signed_document, 1)

    assert response.status_code == status.HTTP_201_CREATED
    assert DocumentPaymentRecord.objects.filter(document=signed_document).count() == 1
    record.refresh_from_db()
    assert record.status == DocumentPaymentRecord.STATUS_UPLOADED
    assert record.rejection_reason == "Ilegible"  # audit trail kept
    assert not os.path.isfile(old_path)  # replaced physical file removed


# ── Download ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_download_by_party(api_client, signed_document, client_user):
    """Download by party."""
    record = make_record(signed_document, 1)
    api_client.force_authenticate(user=client_user)
    response = api_client.get(f"{records_url(signed_document)}{record.id}/download/")

    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Disposition"].startswith("attachment")


@pytest.mark.django_db
def test_download_record_of_other_document_404(api_client, signed_document, lawyer_user, client_user):
    """Download record of other document 404."""
    other = DynamicDocument.objects.create(
        title="Otro contrato",
        content="<p>c</p>",
        state="FullySigned",
        fully_signed=True,
        created_by=lawyer_user,
        assigned_to=client_user,
    )
    record = make_record(other, 1)
    api_client.force_authenticate(user=client_user)
    # Record id exists but belongs to another document (anti-IDOR)
    response = api_client.get(f"{records_url(signed_document)}{record.id}/download/")
    assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Notifications ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_upload_notifies_creator(api_client, signed_document, client_user, lawyer_user):
    """Upload notifies creator."""
    api_client.force_authenticate(user=client_user)
    with patch(
        "gym_app.services.payment_notification_service.send_template_email"
    ) as mock_email:
        response = upload(api_client, signed_document, 1)

    assert response.status_code == status.HTTP_201_CREATED
    assert mock_email.call_count == 1
    notification = Notification.objects.get(user=lawyer_user)
    assert "Cuota 1 cargada" in notification.title
    assert notification.link_type == "document"
    assert notification.link_id == signed_document.id


@pytest.mark.django_db
def test_upload_by_creator_skips_self_notification(api_client, signed_document, lawyer_user):
    """Upload by creator skips self notification."""
    api_client.force_authenticate(user=lawyer_user)
    with patch(
        "gym_app.services.payment_notification_service.send_template_email"
    ) as mock_email:
        response = upload(api_client, signed_document, 1)

    assert response.status_code == status.HTTP_201_CREATED
    assert not mock_email.called
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_reject_notifies_client_with_reason(api_client, signed_document, lawyer_user, client_user):
    """Reject notifies client with reason."""
    record = make_record(signed_document, 1, uploaded_by=client_user)
    api_client.force_authenticate(user=lawyer_user)
    with patch(
        "gym_app.services.payment_notification_service.send_template_email"
    ) as mock_email:
        response = api_client.post(
            f"{records_url(signed_document)}{record.id}/reject/",
            {"rejection_reason": "Monto errado"},
        )

    assert response.status_code == status.HTTP_200_OK
    assert mock_email.call_count == 1
    notification = Notification.objects.get(user=client_user)
    assert "rechazada" in notification.title
    assert "Monto errado" in notification.message
    assert notification.priority == "high"
