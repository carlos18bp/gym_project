# Contract Execution — Payment Schedule & Billing Invoices Implementation Plan

A sub-module on FullySigned legal documents that adds a `payment_schedule` summary field to document variables, creates a `ContractPaymentRecord` model for sequential billing invoice uploads, and exposes two new document actions ("Subir Cuenta de Cobro" / "Ver Cuentas de Cobro").

---

## Confirmed Decisions

| Question | Decision |
|---|---|
| Who can upload | Assigned client (`document.assigned_to`) **or** the lawyer creator on their behalf |
| Upload order | **Sequential** — slot N+1 unlocks only when slot N has `status='accepted'` |
| Amount per record | **Optional** `DecimalField` per record — enables payment accounting view |
| Requirement number | **#11** |
| File types accepted | PDF, JPG, PNG, DOCX — max 20 MB (mirrors `LegalRequestFiles` pattern) |
| Who can accept/reject | Lawyer (document creator) only — accepts or rejects with mandatory rejection comment |
| Re-upload after rejection | Allowed — client can re-upload for any slot in `rejected` status |
| Lawyer notification | Email to document creator when client uploads a billing invoice |
| Client notification | Email to assigned client when lawyer accepts or rejects |
| Trigger | Document must be `FullySigned` + have a `payment_schedule` variable with integer value ≥ 1 |

---

## Current Architecture State

### `DocumentVariable.SUMMARY_FIELD_CHOICES` (models/dynamic_document.py)
Current choices: `counterparty`, `object`, `value`, `term`, `subscription_date`, `start_date`, `end_date`  
**Missing**: `payment_schedule` — number of installments/payments in the contract

### Signed document menu options (`menuOptionsHelper.js`)
`signatures` context + `FullySigned`: preview, letterhead, associations, signatures status, download signed document  
**Missing**: "Subir Cuenta de Cobro", "Ver Cuentas de Cobro"

`client` context + `FullySigned`: preview, download PDF/Word, download signed document  
**Missing**: same two actions

### File upload pattern (direct reuse)
- Backend: `request.FILES.get('file')` → `FileField(upload_to='...')` (see `CaseFile`, `LegalRequestFiles`)
- Frontend: `upload_file_request(url, formData)` with `FormData` → `axios.post('/api/...')`

### No `ContractPaymentRecord` model exists anywhere.

---

## Implementation

### Phase 1 — Backend: DocumentVariable — New Summary Field Choice

**Modified file: `backend/gym_app/models/dynamic_document.py`**

In `DocumentVariable.SUMMARY_FIELD_CHOICES`, add:

```python
SUMMARY_FIELD_CHOICES = [
    ('none', 'Sin clasificar'),
    ('counterparty', 'Usuario / Contraparte'),
    ('object', 'Objeto'),
    ('value', 'Valor'),
    ('term', 'Plazo'),
    ('subscription_date', 'Fecha de suscripción'),
    ('start_date', 'Fecha de inicio'),
    ('end_date', 'Fecha de fin'),
    ('payment_schedule', 'Forma de pago (N cuotas)'),   # NEW
]
```

This is a **no-migration** change — it only extends the choices list on an existing `CharField`. Existing records with other choices are unaffected.

---

### Phase 2 — Backend: ContractPaymentRecord Model

**New file: `backend/gym_app/models/contract_execution.py`**

```python
import os
import uuid
from django.db import models
from django.conf import settings


def payment_record_file_path(instance, filename):
    """Unique path for billing invoice files per document."""
    ext = filename.split('.')[-1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('contract_payments', str(instance.document.id), filename)


class ContractPaymentRecord(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),       # slot exists but no file yet
        ('uploaded', 'Uploaded'),     # client uploaded, awaiting lawyer decision
        ('accepted', 'Accepted'),     # lawyer accepted the invoice
        ('rejected', 'Rejected'),     # lawyer rejected; client must re-upload
    ]

    document = models.ForeignKey(
        'DynamicDocument',
        on_delete=models.CASCADE,
        related_name='payment_records',
        help_text="The fully signed document this payment record belongs to."
    )
    payment_number = models.PositiveSmallIntegerField(
        help_text="Sequential payment number (1, 2, 3…)."
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        help_text="Current status of this payment slot."
    )
    file = models.FileField(
        upload_to=payment_record_file_path,
        null=True,
        blank=True,
        help_text="Billing invoice file (PDF, JPG, PNG, DOCX)."
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional billed amount for this installment."
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Optional notes (visible to lawyer only)."
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_payment_records',
        help_text="User who uploaded this billing invoice."
    )
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the record was created."
    )
    decided_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the lawyer accepted or rejected this record."
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decided_payment_records',
        help_text="Lawyer who accepted or rejected this record."
    )
    rejection_comment = models.TextField(
        blank=True,
        null=True,
        help_text="Mandatory reason provided by the lawyer when rejecting an invoice."
    )

    class Meta:
        unique_together = ('document', 'payment_number')
        ordering = ['payment_number']
        verbose_name = 'Contract Payment Record'
        verbose_name_plural = 'Contract Payment Records'

    def __str__(self):
        return f"{self.document.title} — Payment {self.payment_number} ({self.status})"

    def is_decided(self):
        return self.status in ('accepted', 'rejected')

    def can_upload(self):
        """Client can upload when slot is pending or rejected (re-upload)."""
        return self.status in ('pending', 'rejected')
```

**Register in `backend/gym_app/models/__init__.py`**:

```python
from .contract_execution import ContractPaymentRecord
```

Add to `__all__`: `'ContractPaymentRecord'`

**Migration**: `python manage.py makemigrations gym_app -n add_contract_payment_record`

---

### Phase 3 — Backend: Serializer

**New file: `backend/gym_app/serializers/contract_execution.py`**

```python
from rest_framework import serializers
from gym_app.models import ContractPaymentRecord


class ContractPaymentRecordSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField(read_only=True)
    decided_by_name = serializers.SerializerMethodField(read_only=True)
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ContractPaymentRecord
        fields = [
            'id', 'document', 'payment_number', 'status',
            'file', 'file_url', 'amount', 'notes',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
            'decided_by', 'decided_by_name', 'decided_at',
            'rejection_comment',
        ]
        read_only_fields = [
            'uploaded_by', 'uploaded_at', 'decided_by', 'decided_at',
            'uploaded_by_name', 'decided_by_name', 'file_url',
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None

    def get_decided_by_name(self, obj):
        if obj.decided_by:
            return f"{obj.decided_by.first_name} {obj.decided_by.last_name}".strip() or obj.decided_by.email
        return None

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None
```

---

### Phase 4 — Backend: Helper — Payment Schedule Resolution

A small utility to determine the payment schedule (N) from a document's variables:

```python
def get_payment_schedule(document):
    """
    Return the number of payment installments from the document's variables.
    Returns 0 if no payment_schedule variable is found or value is not a positive integer.
    """
    for var in document.variables.all():
        if var.summary_field == 'payment_schedule':
            try:
                n = int(var.value or 0)
                return max(n, 0)
            except (ValueError, TypeError):
                return 0
    return 0
```

---

### Phase 5 — Backend: Views

**New file: `backend/gym_app/views/contract_execution.py`**

```python
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models import ContractPaymentRecord
from gym_app.models.dynamic_document import DynamicDocument
from gym_app.serializers.contract_execution import ContractPaymentRecordSerializer


MAX_FILE_SIZE_MB = 20
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'docx'}


def _can_access_payment(user, document):
    """Returns True if user is the assigned client or the document creator (lawyer)."""
    return (
        document.assigned_to == user or
        document.created_by == user or
        user.role == 'lawyer' or
        user.is_gym_lawyer
    )


def get_payment_schedule(document):
    for var in document.variables.all():
        if var.summary_field == 'payment_schedule':
            try:
                return max(int(var.value or 0), 0)
            except (ValueError, TypeError):
                return 0
    return 0


# ── List payment records for a document ──────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_payment_records(request, document_id):
    """
    List all payment records (slots) for a FullySigned document.
    Returns all N slots regardless of status (pending ones have no file).
    """
    try:
        document = DynamicDocument.objects.prefetch_related('variables').get(
            pk=document_id, state='FullySigned'
        )
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found or not fully signed.'},
                        status=status.HTTP_404_NOT_FOUND)

    if not _can_access_payment(request.user, document):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    n = get_payment_schedule(document)
    if n == 0:
        return Response({'detail': 'This document has no payment schedule configured.'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Ensure all N slots exist in the DB (create pending ones if missing)
    existing = {r.payment_number: r for r in
                ContractPaymentRecord.objects.filter(document=document)}
    for i in range(1, n + 1):
        if i not in existing:
            record = ContractPaymentRecord.objects.create(
                document=document, payment_number=i, status='pending'
            )
            existing[i] = record

    records = [existing[i] for i in sorted(existing.keys())]
    serializer = ContractPaymentRecordSerializer(records, many=True, context={'request': request})

    return Response({
        'total_slots': n,
        'records': serializer.data,
        'summary': {
            'pending': sum(1 for r in records if r.status == 'pending'),
            'uploaded': sum(1 for r in records if r.status == 'uploaded'),
            'accepted': sum(1 for r in records if r.status == 'accepted'),
            'rejected': sum(1 for r in records if r.status == 'rejected'),
            'total_amount': sum(
                float(r.amount) for r in records if r.amount is not None
            ),
        }
    }, status=status.HTTP_200_OK)


# ── Upload billing invoice for a specific payment slot ────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_payment_record(request, document_id, payment_number):
    """
    Upload a billing invoice file for a specific payment slot.
    Enforces sequential unlocking: slot N is only accessible when N-1 is uploaded/reviewed.
    """
    try:
        document = DynamicDocument.objects.prefetch_related('variables').get(
            pk=document_id, state='FullySigned'
        )
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found or not fully signed.'},
                        status=status.HTTP_404_NOT_FOUND)

    if not _can_access_payment(request.user, document):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    n = get_payment_schedule(document)
    if n == 0:
        return Response({'detail': 'This document has no payment schedule configured.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if payment_number < 1 or payment_number > n:
        return Response({'detail': f'Invalid payment number. Must be between 1 and {n}.'},
                        status=status.HTTP_400_BAD_REQUEST)

    # Enforce sequential locking: previous slot must be accepted by the lawyer
    if payment_number > 1:
        try:
            prev = ContractPaymentRecord.objects.get(
                document=document, payment_number=payment_number - 1
            )
            if prev.status != 'accepted':
                return Response(
                    {'detail': f'Payment slot {payment_number - 1} must be accepted by the lawyer before slot {payment_number} can be uploaded.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ContractPaymentRecord.DoesNotExist:
            return Response(
                {'detail': f'Payment slot {payment_number - 1} has not been created yet.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    # Validate file
    file = request.FILES.get('file')
    if not file:
        return Response({'detail': 'A file is required.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
    if ext not in ALLOWED_EXTENSIONS:
        return Response(
            {'detail': f'File type not allowed. Accepted: {", ".join(ALLOWED_EXTENSIONS)}.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        return Response(
            {'detail': f'File too large. Maximum size is {MAX_FILE_SIZE_MB} MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    amount = request.data.get('amount')
    notes = request.data.get('notes', '')

    record, _ = ContractPaymentRecord.objects.get_or_create(
        document=document,
        payment_number=payment_number,
        defaults={'status': 'pending'}
    )

    # Allow upload when slot is pending or rejected (re-upload after rejection)
    if record.status == 'accepted':
        return Response(
            {'detail': 'This payment slot has already been accepted and cannot be modified.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    record.file = file
    record.status = 'uploaded'
    record.uploaded_by = request.user
    record.notes = notes
    # Reset any previous rejection decision when client re-uploads
    record.decided_by = None
    record.decided_at = None
    record.rejection_comment = None
    if amount:
        try:
            record.amount = float(amount)
        except (ValueError, TypeError):
            pass

    record.save()

    # Notify the document creator (lawyer) via email
    creator = document.created_by
    if creator and getattr(creator, 'email', None):
        try:
            from gym_app.views.layouts.sendEmail import EmailMessage
            uploader_name = request.user.get_full_name() or request.user.email
            email_message = EmailMessage(
                subject=f"[Contrato] Nueva cuenta de cobro — {document.title} (Cuota {payment_number})",
                body=(
                    f"El usuario {uploader_name} ha cargado la cuenta de cobro correspondiente "
                    f"a la cuota {payment_number} del contrato '{document.title}'.\n\n"
                    f"Ingresa a la plataforma para revisarla y aceptarla o rechazarla."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[creator.email],
            )
            email_message.send()
        except Exception:
            pass  # Never block the upload due to email failure

    serializer = ContractPaymentRecordSerializer(record, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ── Accept a payment record (lawyer only) ────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def accept_payment_record(request, document_id, payment_number):
    """
    Accept an uploaded billing invoice. Lawyer (document creator) only.
    Unlocks the next payment slot.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id, state='FullySigned')
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    if document.created_by != request.user and not (
        request.user.role == 'lawyer' or request.user.is_gym_lawyer
    ):
        return Response({'detail': 'Only the document creator can accept payments.'},
                        status=status.HTTP_403_FORBIDDEN)

    try:
        record = ContractPaymentRecord.objects.get(
            document=document, payment_number=payment_number
        )
    except ContractPaymentRecord.DoesNotExist:
        return Response({'detail': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)

    if record.status != 'uploaded':
        return Response(
            {'detail': 'Only uploaded records can be accepted.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    record.status = 'accepted'
    record.decided_by = request.user
    record.decided_at = timezone.now()
    record.rejection_comment = None
    record.save()

    # Notify the assigned client
    client = document.assigned_to
    if client and getattr(client, 'email', None):
        try:
            from gym_app.views.layouts.sendEmail import EmailMessage
            email_message = EmailMessage(
                subject=f"[Contrato] Cuenta de cobro aceptada — {document.title} (Cuota {payment_number})",
                body=(
                    f"Tu cuenta de cobro correspondiente a la cuota {payment_number} "
                    f"del contrato '{document.title}' ha sido aceptada.\n\n"
                    f"Ya puedes cargar la siguiente cuenta de cobro si aplica."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[client.email],
            )
            email_message.send()
        except Exception:
            pass

    serializer = ContractPaymentRecordSerializer(record, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ── Reject a payment record (lawyer only) ────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def reject_payment_record(request, document_id, payment_number):
    """
    Reject an uploaded billing invoice with a mandatory rejection comment.
    Lawyer (document creator) only. Client can re-upload after rejection.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id, state='FullySigned')
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    if document.created_by != request.user and not (
        request.user.role == 'lawyer' or request.user.is_gym_lawyer
    ):
        return Response({'detail': 'Only the document creator can reject payments.'},
                        status=status.HTTP_403_FORBIDDEN)

    rejection_comment = request.data.get('rejection_comment', '').strip()
    if not rejection_comment:
        return Response(
            {'detail': 'A rejection comment is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        record = ContractPaymentRecord.objects.get(
            document=document, payment_number=payment_number
        )
    except ContractPaymentRecord.DoesNotExist:
        return Response({'detail': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)

    if record.status != 'uploaded':
        return Response(
            {'detail': 'Only uploaded records can be rejected.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    record.status = 'rejected'
    record.decided_by = request.user
    record.decided_at = timezone.now()
    record.rejection_comment = rejection_comment
    record.save()

    # Notify the assigned client with the rejection reason
    client = document.assigned_to
    if client and getattr(client, 'email', None):
        try:
            from gym_app.views.layouts.sendEmail import EmailMessage
            email_message = EmailMessage(
                subject=f"[Contrato] Cuenta de cobro rechazada — {document.title} (Cuota {payment_number})",
                body=(
                    f"Tu cuenta de cobro correspondiente a la cuota {payment_number} "
                    f"del contrato '{document.title}' ha sido rechazada.\n\n"
                    f"Motivo: {rejection_comment}\n\n"
                    f"Por favor, corrige el comprobante y vuelve a cargarlo."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[client.email],
            )
            email_message.send()
        except Exception:
            pass

    serializer = ContractPaymentRecordSerializer(record, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ── Download a billing invoice file ──────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_payment_file(request, document_id, payment_number):
    """Download the billing invoice file for a specific payment slot."""
    try:
        document = DynamicDocument.objects.get(pk=document_id, state='FullySigned')
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not _can_access_payment(request.user, document):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        record = ContractPaymentRecord.objects.get(
            document=document, payment_number=payment_number
        )
    except ContractPaymentRecord.DoesNotExist:
        return Response({'detail': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not record.file:
        return Response({'detail': 'No file uploaded for this payment slot.'},
                        status=status.HTTP_404_NOT_FOUND)

    from django.http import FileResponse
    return FileResponse(record.file.open('rb'), as_attachment=True, filename=record.file.name.split('/')[-1])
```

---

### Phase 6 — Backend: Admin

**Modified file: `backend/gym_app/admin.py`**

```python
from gym_app.models import ContractPaymentRecord

class ContractPaymentRecordInline(admin.TabularInline):
    model = ContractPaymentRecord
    extra = 0
    fields = ['payment_number', 'status', 'amount', 'uploaded_by', 'uploaded_at', 'decided_by', 'decided_at', 'rejection_comment']
    readonly_fields = ['uploaded_at', 'decided_at', 'uploaded_by', 'decided_by']

@admin.register(ContractPaymentRecord)
class ContractPaymentRecordAdmin(admin.ModelAdmin):
    list_display = ['document', 'payment_number', 'status', 'amount', 'uploaded_by', 'uploaded_at', 'decided_by']
    list_filter = ['status']
    search_fields = ['document__title', 'uploaded_by__email']
```

---

### Phase 7 — Backend: URLs

**Modified file: `backend/gym_app/urls.py`**

Add import:
```python
from gym_app.views.contract_execution import (
    list_payment_records, upload_payment_record,
    accept_payment_record, reject_payment_record, download_payment_file
)
```

Add new URL group before `urlpatterns`:
```python
contract_execution_urls = [
    path(
        'dynamic-documents/<int:document_id>/payments/',
        list_payment_records,
        name='list_payment_records'
    ),
    path(
        'dynamic-documents/<int:document_id>/payments/<int:payment_number>/upload/',
        upload_payment_record,
        name='upload_payment_record'
    ),
    path(
        'dynamic-documents/<int:document_id>/payments/<int:payment_number>/accept/',
        accept_payment_record,
        name='accept_payment_record'
    ),
    path(
        'dynamic-documents/<int:document_id>/payments/<int:payment_number>/reject/',
        reject_payment_record,
        name='reject_payment_record'
    ),
    path(
        'dynamic-documents/<int:document_id>/payments/<int:payment_number>/download/',
        download_payment_file,
        name='download_payment_file'
    ),
]
```

Append `+ contract_execution_urls` to `urlpatterns`.

---

### Phase 8 — Backend: Tests

**New file: `backend/gym_app/tests/views/test_contract_execution.py`**

```python
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models import ContractPaymentRecord
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable

pytestmark = pytest.mark.django_db


@pytest.fixture
def signed_document_with_payments(lawyer_user, client_user):
    doc = DynamicDocument.objects.create(
        title='Contract_firma',
        content='Content',
        state='FullySigned',
        requires_signature=True,
        fully_signed=True,
        created_by=lawyer_user,
        assigned_to=client_user,
    )
    DocumentVariable.objects.create(
        document=doc,
        name_en='payment_schedule',
        name_es='Forma de pago',
        field_type='number',
        summary_field='payment_schedule',
        value='3',
    )
    return doc


@pytest.fixture
def fake_pdf():
    return SimpleUploadedFile('invoice.pdf', b'%PDF fake content', content_type='application/pdf')


class TestListPaymentRecords:
    def test_client_can_list_payment_slots(self, api_client, client_user, signed_document_with_payments):
        api_client.force_authenticate(user=client_user)
        response = api_client.get(f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/')
        assert response.status_code == 200
        assert response.data['total_slots'] == 3
        assert len(response.data['records']) == 3

    def test_unauthenticated_user_denied(self, api_client, signed_document_with_payments):
        response = api_client.get(f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/')
        assert response.status_code == 401

    def test_unrelated_user_denied(self, api_client, basic_user, signed_document_with_payments):
        api_client.force_authenticate(user=basic_user)
        response = api_client.get(f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/')
        assert response.status_code == 403

    def test_document_without_payment_schedule_returns_400(self, api_client, lawyer_user):
        doc = DynamicDocument.objects.create(
            title='No payments', content='C', state='FullySigned',
            requires_signature=True, fully_signed=True, created_by=lawyer_user
        )
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.get(f'/api/dynamic-documents/{doc.id}/payments/')
        assert response.status_code == 400


class TestUploadPaymentRecord:
    def test_client_can_upload_first_slot(self, api_client, client_user, signed_document_with_payments, fake_pdf):
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/upload/',
            {'file': fake_pdf, 'amount': '1500000'},
            format='multipart'
        )
        assert response.status_code == 200
        assert response.data['status'] == 'uploaded'
        assert response.data['payment_number'] == 1

    def test_cannot_upload_slot_2_before_slot_1(
        self, api_client, client_user, signed_document_with_payments, fake_pdf
    ):
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/2/upload/',
            {'file': fake_pdf},
            format='multipart'
        )
        assert response.status_code == 400
        assert 'slot 1' in response.data['detail'].lower() or '1' in response.data['detail']

    def test_can_upload_slot_2_after_slot_1_is_accepted(
        self, api_client, client_user, lawyer_user, signed_document_with_payments, fake_pdf
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='accepted',   # must be accepted, not just uploaded
            uploaded_by=client_user,
            decided_by=lawyer_user,
        )
        fake_pdf2 = SimpleUploadedFile('invoice2.pdf', b'%PDF content 2', content_type='application/pdf')
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/2/upload/',
            {'file': fake_pdf2},
            format='multipart'
        )
        assert response.status_code == 200

    def test_invalid_file_type_rejected(
        self, api_client, client_user, signed_document_with_payments
    ):
        bad_file = SimpleUploadedFile('malware.exe', b'content', content_type='application/octet-stream')
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/upload/',
            {'file': bad_file},
            format='multipart'
        )
        assert response.status_code == 400

    def test_accepted_slot_cannot_be_reuploaded(
        self, api_client, client_user, lawyer_user, signed_document_with_payments, fake_pdf
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='accepted',
            uploaded_by=client_user,
            decided_by=lawyer_user,
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/upload/',
            {'file': fake_pdf},
            format='multipart'
        )
        assert response.status_code == 400

    def test_rejected_slot_can_be_reuploaded(
        self, api_client, client_user, lawyer_user, signed_document_with_payments, fake_pdf
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='rejected',
            uploaded_by=client_user,
            decided_by=lawyer_user,
            rejection_comment='Incorrect document',
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/upload/',
            {'file': fake_pdf},
            format='multipart'
        )
        assert response.status_code == 200
        # After re-upload, decision fields must be reset
        record = ContractPaymentRecord.objects.get(
            document=signed_document_with_payments, payment_number=1
        )
        assert record.status == 'uploaded'
        assert record.rejection_comment is None


class TestAcceptPaymentRecord:
    def test_lawyer_can_accept_uploaded_record(
        self, api_client, lawyer_user, client_user, signed_document_with_payments
    ):
        record = ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='uploaded',
            uploaded_by=client_user,
        )
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/accept/',
            {},
            format='json'
        )
        assert response.status_code == 200
        record.refresh_from_db()
        assert record.status == 'accepted'
        assert record.decided_by == lawyer_user

    def test_client_cannot_accept(
        self, api_client, client_user, signed_document_with_payments
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='uploaded',
            uploaded_by=client_user,
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/accept/',
            {},
            format='json'
        )
        assert response.status_code == 403

    def test_pending_record_cannot_be_accepted(
        self, api_client, lawyer_user, signed_document_with_payments
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments, payment_number=1, status='pending'
        )
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/accept/',
            {},
            format='json'
        )
        assert response.status_code == 400


class TestRejectPaymentRecord:
    def test_lawyer_can_reject_uploaded_record_with_comment(
        self, api_client, lawyer_user, client_user, signed_document_with_payments
    ):
        record = ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='uploaded',
            uploaded_by=client_user,
        )
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/reject/',
            {'rejection_comment': 'El monto no coincide con el contrato.'},
            format='json'
        )
        assert response.status_code == 200
        record.refresh_from_db()
        assert record.status == 'rejected'
        assert record.decided_by == lawyer_user
        assert record.rejection_comment == 'El monto no coincide con el contrato.'

    def test_reject_without_comment_returns_400(
        self, api_client, lawyer_user, client_user, signed_document_with_payments
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='uploaded',
            uploaded_by=client_user,
        )
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/reject/',
            {},
            format='json'
        )
        assert response.status_code == 400

    def test_client_cannot_reject(
        self, api_client, client_user, signed_document_with_payments
    ):
        ContractPaymentRecord.objects.create(
            document=signed_document_with_payments,
            payment_number=1,
            status='uploaded',
            uploaded_by=client_user,
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{signed_document_with_payments.id}/payments/1/reject/',
            {'rejection_comment': 'Trying to reject own invoice'},
            format='json'
        )
        assert response.status_code == 403
```

---

### Phase 9 — Frontend: Pinia Store

**New file: `frontend/src/stores/dynamic_document/contractExecution.js`**

```javascript
import { defineStore } from 'pinia';
import { get_request, upload_file_request, update_request } from '../services/request_http';

export const useContractExecutionStore = defineStore('contractExecution', {
  state: () => ({
    records: [],
    summary: null,
    totalSlots: 0,
    loading: false,
    error: null,
  }),

  getters: {
    // First slot in pending or rejected state (client can upload/re-upload)
    nextUploadableSlot: (state) => {
      return state.records.find(r => r.status === 'pending' || r.status === 'rejected')
        ?.payment_number ?? null;
    },
    hasUploadable: (state) => {
      if (state.records.length === 0) return false;
      // Slot 1 is always uploadable if pending/rejected
      const slot1 = state.records.find(r => r.payment_number === 1);
      if (slot1 && (slot1.status === 'pending' || slot1.status === 'rejected')) return true;
      // For slot N>1: uploadable only if slot N-1 is accepted
      return state.records.some(r => {
        if (r.status !== 'pending' && r.status !== 'rejected') return false;
        const prev = state.records.find(p => p.payment_number === r.payment_number - 1);
        return prev && prev.status === 'accepted';
      });
    },
  },

  actions: {
    async fetchRecords(documentId) {
      this.loading = true;
      try {
        const response = await get_request(`dynamic-documents/${documentId}/payments/`);
        this.records = response.data.records;
        this.summary = response.data.summary;
        this.totalSlots = response.data.total_slots;
      } catch (error) {
        this.error = error;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async uploadRecord(documentId, paymentNumber, file, amount = null, notes = '') {
      const formData = new FormData();
      formData.append('file', file);
      if (amount !== null && amount !== '') formData.append('amount', amount);
      if (notes) formData.append('notes', notes);

      const response = await upload_file_request(
        `dynamic-documents/${documentId}/payments/${paymentNumber}/upload/`,
        formData
      );
      // Refresh records after upload
      await this.fetchRecords(documentId);
      return response.data;
    },

    async acceptRecord(documentId, paymentNumber) {
      const response = await update_request(
        `dynamic-documents/${documentId}/payments/${paymentNumber}/accept/`,
        'PATCH',
        {}
      );
      await this.fetchRecords(documentId);
      return response.data;
    },

    async rejectRecord(documentId, paymentNumber, rejectionComment) {
      const response = await update_request(
        `dynamic-documents/${documentId}/payments/${paymentNumber}/reject/`,
        'PATCH',
        { rejection_comment: rejectionComment }
      );
      await this.fetchRecords(documentId);
      return response.data;
    },
  },
});
```

---

### Phase 10 — Frontend: New Views & Components

**New files**:

| File | Purpose |
|---|---|
| `frontend/src/views/dynamic_document/ContractPayments.vue` | Full page or modal: table of all payment slots with status badges, amounts, upload dates, download buttons, Accept/Reject actions for lawyer, rejection reason display for client |
| `frontend/src/components/dynamic_document/modals/UploadPaymentModal.vue` | Modal: file picker, optional amount field, notes, confirm upload for a specific slot |
| `frontend/src/components/dynamic_document/modals/RejectPaymentModal.vue` | Modal: mandatory rejection comment textarea + confirm for lawyer rejection |

#### `ContractPayments.vue` structure
- Receives `documentId` as prop or route param
- On mount: `contractExecutionStore.fetchRecords(documentId)`
- Shows a table with columns: Cuota #, Estado badge, Monto, Fecha carga, Cargado por, Archivo (download link), Motivo rechazo (if rejected), Acciones
- **Lawyer view** — Acciones column: "Aceptar" + "Rechazar" buttons (only when `status='uploaded'`)
- **Client view** — Acciones column: "Subir" button (only when `status='pending'` or `'rejected'`); rejected rows show the `rejection_comment` inline
- Summary row: total amount, N pending, N uploaded (awaiting decision), N accepted, N rejected
- "Subir Cuenta de Cobro" button (client only) → opens `UploadPaymentModal`

#### `UploadPaymentModal.vue` structure
- Receives `documentId`, `paymentNumber` as props
- File drag-and-drop (mirrors `SendDocument.vue`)
- Optional amount input
- Optional notes textarea
- Submit → calls `contractExecutionStore.uploadRecord()`

---

### Phase 11 — Frontend: Menu Actions

**Modified file: `frontend/src/components/dynamic_document/cards/menuOptionsHelper.js`**

In the **`signatures` config** + `FullySigned`, add (after "Descargar Documento firmado"):

```javascript
// Contract execution actions — only for documents with payment_schedule
const hasPaymentSchedule = document.variables?.some(
  v => v.summary_field === 'payment_schedule' && parseInt(v.value) > 0
);

if (document.state === 'FullySigned' && hasPaymentSchedule) {
  options.push({ label: 'Ver Cuentas de Cobro', action: 'viewPayments' });
  options.push({ label: 'Subir Cuenta de Cobro', action: 'uploadPayment' });
}
```

In the **`client` config** + `FullySigned` section, add the same block after "Descargar Documento firmado".

In the **`lawyer` config**, add within the `FullySigned` / `PendingSignatures` block:
```javascript
if (document.state === 'FullySigned' && hasPaymentSchedule) {
  baseOptions.push({ label: 'Ver Cuentas de Cobro', action: 'viewPayments' });
}
```

The **`viewPayments`** and **`uploadPayment`** actions need to be handled in `BaseDocumentCard.vue` (or the parent dashboard) similarly to how `viewSignatures`, `sign`, `downloadSignedDocument` etc. are handled.

---

### Phase 12 — Frontend: Action Handlers

Wherever document card actions are dispatched (the parent that handles `action` events), add:

```javascript
case 'viewPayments':
  selectedDocument.value = document;
  showContractPaymentsModal.value = true;
  break;
case 'uploadPayment':
  selectedDocument.value = document;
  showUploadPaymentModal.value = true;
  break;
```

---

## Files Summary

### New Files
| Layer | Path |
|---|---|
| Backend model | `backend/gym_app/models/contract_execution.py` |
| Backend serializer | `backend/gym_app/serializers/contract_execution.py` |
| Backend views | `backend/gym_app/views/contract_execution.py` |
| Backend tests | `backend/gym_app/tests/views/test_contract_execution.py` |
| Django migration | `backend/gym_app/migrations/XXXX_add_contract_payment_record.py` |
| Frontend store | `frontend/src/stores/dynamic_document/contractExecution.js` |
| Frontend view | `frontend/src/views/dynamic_document/ContractPayments.vue` |
| Frontend component | `frontend/src/components/dynamic_document/modals/UploadPaymentModal.vue` |

### Modified Files
| Layer | Path | Change |
|---|---|---|
| Backend model | `backend/gym_app/models/dynamic_document.py` | Add `payment_schedule` to `SUMMARY_FIELD_CHOICES` |
| Backend models init | `backend/gym_app/models/__init__.py` | Import `ContractPaymentRecord` |
| Backend admin | `backend/gym_app/admin.py` | Register `ContractPaymentRecord` |
| Backend URLs | `backend/gym_app/urls.py` | Add `contract_execution_urls` |
| Frontend menu helper | `frontend/src/components/dynamic_document/cards/menuOptionsHelper.js` | Add `viewPayments` / `uploadPayment` actions |
| Frontend action handlers | Parent dashboard/card components handling actions | Handle new action cases |

---

## Implementation Order

| Phase | Task | Est. Time |
|---|---|---|
| 1 | `SUMMARY_FIELD_CHOICES` update (no migration) | 0.25 h |
| 2 | `ContractPaymentRecord` model + `__init__` + migration | 1 h |
| 3 | Serializer | 0.5 h |
| 4 | Views (5 endpoints: list, upload, accept, reject, download) | 3 h |
| 5 | Admin | 0.25 h |
| 6 | URL wiring | 0.25 h |
| 7 | Backend tests (14 tests) | 2.5 h |
| 8 | Frontend store | 0.5 h |
| 9 | Frontend views + modals (3 components) | 5 h |
| 10 | Menu helper + action handlers | 1 h |
| **Total** | | **~12.25 h** |

**Estimated cost**: Medium-High difficulty → **2,160,000 – 2,520,000 COP**

---

## Key Constraints & Edge Cases

| Case | Handling |
|---|---|
| Document without `payment_schedule` variable | `get_payment_schedule()` returns 0; all endpoints return 400 |
| `payment_schedule` value is not a valid integer | Defaults to 0 — no payment records created |
| Document not in `FullySigned` state | All endpoints return 404 |
| Slot N+1 upload before slot N is `accepted` | 400 with clear message specifying previous slot must be accepted first |
| Re-upload after `accepted` | 400 — accepted records are locked forever |
| Re-upload after `rejected` | Allowed — `rejected` state enables re-upload; decision fields reset on save |
| Reject without `rejection_comment` | 400 — comment is mandatory for rejection |
| Accept a `pending` or `rejected` record | 400 — only `uploaded` records can be accepted |
| Client calls accept/reject endpoint | 403 — only lawyer (document creator) can decide |
| Email fails on upload / accept / reject | Silently swallowed — never blocks the operation |
| File larger than 20 MB | 400 — size validation before save |
| Disallowed file extension | 400 — extension whitelist check |
| Lawyer uploading on behalf of client | Allowed — `_can_access_payment` includes `created_by` check |
