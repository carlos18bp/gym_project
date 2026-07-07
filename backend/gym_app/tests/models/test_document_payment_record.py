"""Tests for the DocumentPaymentRecord model and payment domain helpers."""

import os
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError

from gym_app.models import DocumentPaymentRecord, DocumentVariable, DynamicDocument
from gym_app.models.dynamic_document import parse_payment_installments


def make_signed_document(lawyer, client, installments="3", field_type="number"):
    """FullySigned document with a payment-installments variable."""
    document = DynamicDocument.objects.create(
        title="Contrato con cuotas",
        content="<p>contenido</p>",
        state="FullySigned",
        fully_signed=True,
        created_by=lawyer,
        assigned_to=client,
    )
    if installments is not None:
        DocumentVariable.objects.create(
            document=document,
            name_es="Forma de pago",
            field_type=field_type,
            summary_field="payment_installments",
            value=installments,
        )
    return document


def make_record(document, number, status=DocumentPaymentRecord.STATUS_UPLOADED, amount=None):
    return DocumentPaymentRecord.objects.create(
        document=document,
        installment_number=number,
        file=SimpleUploadedFile(f"cuota_{number}.pdf", b"pdf-bytes"),
        original_name=f"cuota_{number}.pdf",
        status=status,
        amount=amount,
    )


# ── parse_payment_installments ──────────────────────────────────────

@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("3", 3),
        ("3.0", 3),
        (" 12 ", 12),
        ("1", 1),
        ("0", None),
        ("-2", None),
        ("2.5", None),
        ("abc", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_payment_installments(raw, expected):
    """The parser only accepts whole numbers >= 1."""
    assert parse_payment_installments(raw) == expected


# ── Model constraints ───────────────────────────────────────────────

@pytest.mark.django_db
def test_unique_per_document_and_installment(lawyer_user, client_user):
    """A document allows a single record per installment number."""
    document = make_signed_document(lawyer_user, client_user)
    make_record(document, 1)

    with pytest.raises(IntegrityError):
        make_record(document, 1)


@pytest.mark.django_db
def test_post_delete_removes_physical_file(lawyer_user, client_user):
    """Deleting a record removes the uploaded file from disk."""
    document = make_signed_document(lawyer_user, client_user)
    record = make_record(document, 1)
    file_path = record.file.path
    assert os.path.isfile(file_path)

    record.delete()

    assert not os.path.isfile(file_path)


# ── get_payment_installments ────────────────────────────────────────

@pytest.mark.django_db
def test_get_payment_installments_reads_variable(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user, installments="3")
    assert document.get_payment_installments() == 3


@pytest.mark.django_db
def test_get_payment_installments_none_without_variable(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user, installments=None)
    assert document.get_payment_installments() is None


@pytest.mark.django_db
def test_get_payment_installments_none_for_invalid_value(lawyer_user, client_user):
    # A misauthored variable (free-text input) must not break the feature
    document = make_signed_document(
        lawyer_user, client_user, installments="cero", field_type="input"
    )
    assert document.get_payment_installments() is None


# ── get_payment_progress ────────────────────────────────────────────

@pytest.mark.django_db
def test_progress_none_when_not_fully_signed(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user)
    document.state = "Draft"
    document.save(update_fields=["state"])

    assert document.get_payment_progress() is None


@pytest.mark.django_db
def test_progress_none_when_feature_off(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user, installments=None)
    assert document.get_payment_progress() is None


@pytest.mark.django_db
def test_progress_no_records_first_slot_available(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user)

    progress = document.get_payment_progress()

    assert progress == {
        "total_installments": 3,
        "accepted_count": 0,
        "in_review": False,
        "next_uploadable": 1,
        "total_amount_accepted": None,
    }


@pytest.mark.django_db
def test_progress_accepted_enables_next_slot(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user)
    make_record(document, 1, status=DocumentPaymentRecord.STATUS_ACCEPTED, amount=Decimal("100.50"))

    progress = document.get_payment_progress()

    assert progress["accepted_count"] == 1
    assert progress["next_uploadable"] == 2
    assert progress["in_review"] is False
    assert progress["total_amount_accepted"] == Decimal("100.50")


@pytest.mark.django_db
def test_progress_uploaded_blocks_every_slot(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user)
    make_record(document, 1, status=DocumentPaymentRecord.STATUS_UPLOADED)

    progress = document.get_payment_progress()

    assert progress["next_uploadable"] is None
    assert progress["in_review"] is True


@pytest.mark.django_db
def test_progress_rejected_reopens_same_slot(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user)
    make_record(document, 1, status=DocumentPaymentRecord.STATUS_REJECTED)

    progress = document.get_payment_progress()

    assert progress["next_uploadable"] == 1
    assert progress["in_review"] is False


@pytest.mark.django_db
def test_progress_all_accepted_sums_amounts(lawyer_user, client_user):
    document = make_signed_document(lawyer_user, client_user)
    make_record(document, 1, status=DocumentPaymentRecord.STATUS_ACCEPTED, amount=Decimal("100"))
    make_record(document, 2, status=DocumentPaymentRecord.STATUS_ACCEPTED, amount=None)
    make_record(document, 3, status=DocumentPaymentRecord.STATUS_ACCEPTED, amount=Decimal("50"))

    progress = document.get_payment_progress()

    assert progress["accepted_count"] == 3
    assert progress["next_uploadable"] is None
    assert progress["in_review"] is False
    assert progress["total_amount_accepted"] == Decimal("150")
