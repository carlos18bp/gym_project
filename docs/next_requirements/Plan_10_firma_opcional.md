# Required vs. Informational Signers — Implementation Plan

Add an `is_required` boolean flag to `DocumentSignature` so a lawyer can mark certain signers as informational (notified but not blocking), allowing the document to reach `FullySigned` once only the required signers have signed.

---

## Confirmed Decisions

| Question | Decision |
|---|---|
| Default behavior | `is_required = True` for all new and existing signatures — zero breaking change |
| Informational signers can sign voluntarily | Yes — their `DocumentSignature` record exists; they can sign, but document doesn't wait |
| Informational signer rejection | Recorded in DB, but does **not** change document state to `Rejected` |
| Informational signers in "Pending Signatures" tab | **No** — they are excluded from the pending list (`is_required=True` filter) |
| Informational signers in "Firmados" tab | **Yes** — if they signed voluntarily, their record shows `signed=True` |
| Signature counters (`total_signatures`, `completed_signatures`) | Count only `is_required=True` records |
| UI for signer type toggle | `DocumentForm.vue` — the `selectedSigners` section in formalize mode |

---

## Current Architecture State

### The 4 Critical Callsites (exact locations)

| Location | Current logic | Bug |
|---|---|---|
| `models/dynamic_document.py` `check_fully_signed()` | `self.signatures.filter(signed=False).exists()` | Counts informational signers |
| `views/dynamic_documents/signature_views.py` `sign_document()` ~line 362 | `if all(sig.signed for sig in all_signatures):` | Counts informational signers |
| `views/dynamic_documents/signature_views.py` `reject_document()` ~line 442 | Always sets `document.state = 'Rejected'` | Any signer can block |
| `views/dynamic_documents/signature_views.py` `get_pending_signatures()` ~line 204 | No `is_required` filter | Would show informational signers a pending document |

### Serializer
- `DocumentSignatureSerializer` (`serializers/dynamic_document.py` line 93): fields list does not include `is_required`
- `DynamicDocumentSerializer.get_signers()` (line 221): signer dict does not include `is_required`
- `DynamicDocumentSerializer.get_total_signatures()` / `get_completed_signatures()`: count ALL signatures
- `DynamicDocumentSerializer` write field `signers` (line 145): flat `PrimaryKeyRelatedField`, no per-signer metadata

### Frontend
- Signer assignment: `views/dynamic_document/DocumentForm.vue` — `selectedSigners` ref → passed as `signers: selectedSigners.value.map(u => u.id)` in `saveDocument()`
- Signature status display: two copies of `DocumentSignaturesModal.vue` (cards/modals and common)
- `SignaturesListTable.vue`: renders signer rows with Pendiente/Firmado/Rechazado badges — no `is_required` badge
- `SignaturesList.vue` (client pending list filter, line 147): `doc.signatures?.some(sig => sig.signer_email === userEmail)` — no `is_required` filter

---

## Implementation

### Phase 1 — Backend: Model

**Modified file: `backend/gym_app/models/dynamic_document.py`**

Add to `DocumentSignature`:

```python
is_required = models.BooleanField(
    default=True,
    help_text="If True, this signer must sign for the document to be FullySigned. "
              "If False, signer is notified and may sign voluntarily but does not block completion."
)
```

Update `check_fully_signed()`:

```python
# Before:
pending_signatures = self.signatures.filter(signed=False).exists()
# After:
pending_signatures = self.signatures.filter(signed=False, is_required=True).exists()
```

**Migration**: `python manage.py makemigrations gym_app -n add_is_required_to_documentsignature`

---

### Phase 2 — Backend: Signature Views

**Modified file: `backend/gym_app/views/dynamic_documents/signature_views.py`**

#### 2a. `sign_document()` — fully-signed check

```python
# Before (line ~362):
if all(sig.signed for sig in all_signatures):
    document.state = 'FullySigned'
    document.fully_signed = True
    ...

# After:
required_signatures = [sig for sig in all_signatures if sig.is_required]
if required_signatures and all(sig.signed for sig in required_signatures):
    document.state = 'FullySigned'
    document.fully_signed = True
    ...
```

#### 2b. `reject_document()` — only required signers change document state

```python
# After marking signature_record as rejected, wrap the state update:
if signature_record.is_required:
    document.state = 'Rejected'
    document.fully_signed = False
    document.updated_at = timezone.now()
    document.save(update_fields=['state', 'fully_signed', 'updated_at'])
    # Notify creator (existing email block — keep inside this if)
```

When `is_required=False`: the rejection is saved on the signature record, but NO document state change and NO notification to creator.

#### 2c. `get_pending_signatures()` — exclude informational signers from pending list

```python
# Before:
pending_signatures = DocumentSignature.objects.filter(
    signer=request.user,
    signed=False,
    rejected=False,
    document__state='PendingSignatures',
)
# After:
pending_signatures = DocumentSignature.objects.filter(
    signer=request.user,
    signed=False,
    rejected=False,
    document__state='PendingSignatures',
    is_required=True,               # NEW
)
```

#### 2d. `get_user_pending_documents_full()` — same filter

```python
pending_signatures = DocumentSignature.objects.filter(
    signer_id=user_id,
    signed=False,
    rejected=False,
    document__state='PendingSignatures',
    is_required=True,               # NEW
)
```

---

### Phase 3 — Backend: Serializer

**Modified file: `backend/gym_app/serializers/dynamic_document.py`**

#### 3a. `DocumentSignatureSerializer` — add `is_required` to fields

```python
class Meta:
    model = DocumentSignature
    fields = [
        'id', 'signer_id', 'signer_email', 'signer_name',
        'signed', 'signed_at', 'rejected', 'rejected_at',
        'rejection_comment', 'created_at',
        'is_required',          # NEW
    ]
    read_only_fields = [
        'signed', 'signed_at', 'rejected', 'rejected_at',
        'rejection_comment', 'created_at',
        # is_required is writable — set at creation time
    ]
```

#### 3b. `DynamicDocumentSerializer` — add `optional_signer_ids` write field

Below the existing `signers` field declaration:

```python
optional_signer_ids = serializers.PrimaryKeyRelatedField(
    many=True,
    write_only=True,
    queryset=User.objects.all(),
    required=False,
    help_text="Users to notify about the signature but whose signature is not required."
)
```

Add `'optional_signer_ids'` to `Meta.fields`.

#### 3c. `get_signers()` — include `is_required` in each signer dict

```python
signers_data.append({
    'signature_id': signature.id,
    'signer_email': signer.email,
    'signer_name': full_name,
    'signed': signature.signed,
    'signed_at': signature.signed_at,
    'rejected': signature.rejected,
    'rejected_at': signature.rejected_at,
    'rejection_comment': signature.rejection_comment,
    'is_current_user': bool(current_user and signer.id == current_user.id),
    'is_required': signature.is_required,   # NEW
})
```

#### 3d. `get_total_signatures()` and `get_completed_signatures()` — required only

```python
def get_total_signatures(self, obj):
    return obj.signatures.filter(is_required=True).count()

def get_completed_signatures(self, obj):
    return obj.signatures.filter(signed=True, is_required=True).count()
```

#### 3e. Serializer `create()` — handle `optional_signer_ids`

In `create()`, after popping `signers`:
```python
optional_signers = validated_data.pop('optional_signer_ids', [])
```

After the existing `DocumentSignature.objects.create(document=document, signer=signer)` loop:
```python
for signer in optional_signers:
    try:
        DocumentSignature.objects.get_or_create(
            document=document,
            signer=signer,
            defaults={'is_required': False}
        )
    except Exception:
        pass
```

#### 3f. Serializer `update()` — same pattern

In `update()`, pop `optional_signer_ids` and create `DocumentSignature(is_required=False)` for new ones.

---

### Phase 4 — Backend: Admin

**Modified file: `backend/gym_app/admin.py`**

Add `is_required` to any `DocumentSignature` inline if it exists. If there is a `DocumentSignatureInline`:

```python
class DocumentSignatureInline(admin.TabularInline):
    model = DocumentSignature
    extra = 0
    fields = ['signer', 'is_required', 'signed', 'signed_at', 'rejected']
    readonly_fields = ['signed', 'signed_at', 'rejected']
```

---

### Phase 5 — Backend: Tests

**New file: `backend/gym_app/tests/views/test_optional_signature.py`**

```python
import pytest
from django.utils import timezone
from gym_app.models import DynamicDocument, DocumentSignature

pytestmark = pytest.mark.django_db


@pytest.fixture
def signature_document(lawyer_user):
    doc = DynamicDocument.objects.create(
        title='Test_firma',
        content='Content',
        state='PendingSignatures',
        requires_signature=True,
        created_by=lawyer_user,
    )
    return doc


class TestCheckFullySigned:
    def test_fully_signed_only_when_required_signers_have_signed(self, signature_document, lawyer_user, client_user):
        required_sig = DocumentSignature.objects.create(
            document=signature_document, signer=lawyer_user, is_required=True
        )
        optional_sig = DocumentSignature.objects.create(
            document=signature_document, signer=client_user, is_required=False
        )
        # Mark required signer as signed
        required_sig.signed = True
        required_sig.signed_at = timezone.now()
        required_sig.save()
        # Optional signer has NOT signed yet
        result = signature_document.check_fully_signed()
        assert result is True
        signature_document.refresh_from_db()
        assert signature_document.state == 'FullySigned'

    def test_not_fully_signed_if_required_signer_pending(self, signature_document, lawyer_user, client_user):
        DocumentSignature.objects.create(
            document=signature_document, signer=lawyer_user, is_required=True, signed=False
        )
        DocumentSignature.objects.create(
            document=signature_document, signer=client_user, is_required=False, signed=True,
            signed_at=timezone.now()
        )
        result = signature_document.check_fully_signed()
        assert result is False


class TestSignDocument:
    def test_document_becomes_fully_signed_when_only_required_signer_signs(
        self, api_client, lawyer_user, client_user
    ):
        doc = DynamicDocument.objects.create(
            title='Doc_firma', content='C', state='PendingSignatures',
            requires_signature=True, created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user, is_required=True)
        DocumentSignature.objects.create(document=doc, signer=client_user, is_required=False)

        api_client.force_authenticate(user=lawyer_user)
        # Lawyer needs a signature to sign
        from gym_app.models.user import UserSignature
        UserSignature.objects.create(user=lawyer_user, signature_image='fake.png')

        response = api_client.post(f'/api/dynamic-documents/{doc.id}/sign/{lawyer_user.id}/')
        assert response.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'FullySigned'


class TestRejectDocument:
    def test_required_signer_rejection_sets_document_to_rejected(
        self, api_client, lawyer_user, client_user
    ):
        doc = DynamicDocument.objects.create(
            title='Doc_firma', content='C', state='PendingSignatures',
            requires_signature=True, created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, is_required=True)
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{doc.id}/reject/{client_user.id}/',
            {'comment': 'No estoy de acuerdo'},
            format='json'
        )
        assert response.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Rejected'

    def test_informational_signer_rejection_does_not_change_document_state(
        self, api_client, lawyer_user, client_user
    ):
        doc = DynamicDocument.objects.create(
            title='Doc_firma', content='C', state='PendingSignatures',
            requires_signature=True, created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user, is_required=True)
        DocumentSignature.objects.create(document=doc, signer=client_user, is_required=False)
        api_client.force_authenticate(user=client_user)
        response = api_client.post(
            f'/api/dynamic-documents/{doc.id}/reject/{client_user.id}/',
            {'comment': 'No firmo'},
            format='json'
        )
        assert response.status_code == 200
        doc.refresh_from_db()
        # Document must remain in PendingSignatures — NOT Rejected
        assert doc.state == 'PendingSignatures'


class TestPendingSignaturesEndpoint:
    def test_informational_signer_not_in_pending_list(self, api_client, lawyer_user, client_user):
        doc = DynamicDocument.objects.create(
            title='Doc_firma', content='C', state='PendingSignatures',
            requires_signature=True, created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, is_required=False)
        api_client.force_authenticate(user=client_user)
        response = api_client.get('/api/dynamic-documents/pending-signatures/')
        assert response.status_code == 200
        # Client is informational — should NOT appear in their pending list
        assert len(response.data) == 0

    def test_required_signer_appears_in_pending_list(self, api_client, lawyer_user, client_user):
        doc = DynamicDocument.objects.create(
            title='Doc_firma', content='C', state='PendingSignatures',
            requires_signature=True, created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, is_required=True)
        api_client.force_authenticate(user=client_user)
        response = api_client.get('/api/dynamic-documents/pending-signatures/')
        assert response.status_code == 200
        assert len(response.data) == 1


class TestSignatureCounters:
    def test_total_and_completed_signatures_count_only_required(self, api_client, lawyer_user, client_user):
        doc = DynamicDocument.objects.create(
            title='Doc_firma', content='C', state='PendingSignatures',
            requires_signature=True, created_by=lawyer_user,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer_user, is_required=True,
                                          signed=True, signed_at=timezone.now())
        DocumentSignature.objects.create(document=doc, signer=client_user, is_required=False,
                                          signed=False)
        api_client.force_authenticate(user=lawyer_user)
        response = api_client.get(f'/api/dynamic-documents/{doc.id}/')
        assert response.status_code == 200
        # total = 1 required, completed = 1 required signed
        assert response.data['total_signatures'] == 1
        assert response.data['completed_signatures'] == 1
```

---

### Phase 6 — Frontend: Signer Assignment UI

**Modified file: `frontend/src/views/dynamic_document/DocumentForm.vue`**

The `selectedSigners` ref currently stores plain user objects. Change to track `is_required` per signer.

#### State change
```javascript
// Before:
const selectedSigners = ref([]);

// After:
const selectedSigners = ref([]); // Each element: { ...user, is_required: true }
```

#### `addSigner()` — default is_required = true
```javascript
const addSigner = (user) => {
  selectedSigners.value.push({ ...user, is_required: true });
  userSearchQuery.value = '';
  filteredUsers.value = [];
  showUserResults.value = false;
};
```

#### Template — add toggle per signer in the "Firmantes seleccionados" list
```html
<li
  v-for="(signer, index) in selectedSigners"
  :key="signer.id"
  class="flex items-center justify-between p-2 bg-gray-50 rounded-md"
>
  <span class="text-sm text-gray-700">{{ signer.first_name }} {{ signer.last_name }}</span>
  <div class="flex items-center gap-3">
    <!-- is_required toggle -->
    <label class="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
      <input
        type="checkbox"
        v-model="signer.is_required"
        class="rounded border-gray-300 text-secondary focus:ring-secondary"
      />
      Firma requerida
    </label>
    <button @click="removeSigner(signer)" class="text-red-400 hover:text-red-600">
      <XMarkIcon class="size-4" />
    </button>
  </div>
</li>
```

#### `saveDocument()` — split required vs optional signers
```javascript
// Before:
signers: selectedSigners.value.map(user => user.id),

// After:
signers: selectedSigners.value
  .filter(u => u.is_required)
  .map(u => u.id),
optional_signer_ids: selectedSigners.value
  .filter(u => !u.is_required)
  .map(u => u.id),
```

#### Load existing signers (formalize mode) — restore is_required from signer_ids vs optional
When loading existing document signers, use `doc.signers` (which now includes `is_required`) to restore the toggle state:
```javascript
if (document.value.signers && document.value.signers.length > 0) {
  selectedSigners.value = document.value.signers.map(s => ({
    id: s.signer_id,
    email: s.signer_email,
    first_name: s.signer_name,
    is_required: s.is_required ?? true,
  }));
}
```

---

### Phase 7 — Frontend: Signature Status Display

Both `DocumentSignaturesModal.vue` copies need a new "Tipo" column.

**Modified files:**
- `frontend/src/components/dynamic_document/cards/modals/DocumentSignaturesModal.vue`
- `frontend/src/components/dynamic_document/common/DocumentSignaturesModal.vue`
- `frontend/src/components/dynamic_document/common/SignaturesListTable.vue`

Add a new `<th>` column header:
```html
<th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Tipo
</th>
```

Add corresponding `<td>` in each signer row:
```html
<td class="px-4 py-4 whitespace-nowrap">
  <span
    :class="[
      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
      signer.is_required
        ? 'bg-purple-100 text-purple-800'
        : 'bg-gray-100 text-gray-600'
    ]"
  >
    {{ signer.is_required ? 'Requerida' : 'Informativa' }}
  </span>
</td>
```

---

### Phase 8 — Frontend: Client Pending List Filter

**Modified file: `frontend/src/components/dynamic_document/common/SignaturesList.vue`**

The client-side pending filter on line ~147 must exclude informational signatures:

```javascript
// Before:
const isSigner = doc.signatures?.some(sig => {
  return sig.signer_email === userEmail;
});

// After:
const isSigner = doc.signatures?.some(sig => {
  return sig.signer_email === userEmail && sig.is_required !== false;
});
```

---

## Files Summary

### Modified Files
| Layer | Path | Change |
|---|---|---|
| Backend model | `backend/gym_app/models/dynamic_document.py` | Add `is_required` to `DocumentSignature`; fix `check_fully_signed()` |
| Backend views | `backend/gym_app/views/dynamic_documents/signature_views.py` | Fix `sign_document()`, `reject_document()`, `get_pending_signatures()`, `get_user_pending_documents_full()` |
| Backend serializer | `backend/gym_app/serializers/dynamic_document.py` | Add `is_required` to `DocumentSignatureSerializer`; add `optional_signer_ids`; fix counters; fix `get_signers()` |
| Backend admin | `backend/gym_app/admin.py` | Show `is_required` in `DocumentSignature` inline |
| Frontend view | `frontend/src/views/dynamic_document/DocumentForm.vue` | Per-signer `is_required` toggle; split `signers` / `optional_signer_ids` in payload |
| Frontend component | `frontend/src/components/dynamic_document/cards/modals/DocumentSignaturesModal.vue` | Add "Tipo" column |
| Frontend component | `frontend/src/components/dynamic_document/common/DocumentSignaturesModal.vue` | Add "Tipo" column |
| Frontend component | `frontend/src/components/dynamic_document/common/SignaturesListTable.vue` | Add `is_required` badge |
| Frontend component | `frontend/src/components/dynamic_document/common/SignaturesList.vue` | Filter client pending list by `is_required !== false` |

### New Files
| Layer | Path |
|---|---|
| Backend tests | `backend/gym_app/tests/views/test_optional_signature.py` |
| Django migration | `backend/gym_app/migrations/XXXX_add_is_required_to_documentsignature.py` |

---

## Implementation Order

| Phase | Task | Est. Time |
|---|---|---|
| 1 | Model field + migration | 0.5 h |
| 2 | Fix 4 signature view callsites | 1.5 h |
| 3 | Serializer: `is_required`, `optional_signer_ids`, counters, `get_signers()` | 1.5 h |
| 4 | Admin inline update | 0.25 h |
| 5 | Backend tests (8 tests) | 1.5 h |
| 6 | Frontend: `DocumentForm.vue` signer toggle + payload split | 1.5 h |
| 7 | Frontend: both signature modals + `SignaturesListTable` — "Tipo" column | 1 h |
| 8 | Frontend: `SignaturesList.vue` pending list filter | 0.25 h |
| **Total** | | **~8 h** |

**Estimated cost**: Medium difficulty → **1,080,000 – 1,260,000 COP**

---

## Risk & Backward Compatibility

| Risk | Mitigation |
|---|---|
| Existing `DocumentSignature` records have no `is_required` value | `default=True` — existing records all behave as required (no change) |
| `check_fully_signed()` called from `DocumentSignature.save()` | Change is additive — method now checks `is_required=True` subset only |
| Frontend displays `total_signatures` / `completed_signatures` from API | Backend counters updated in serializer — frontend renders unchanged |
| `reopen_document_signatures()` view resets all sigs | Already updates all records with `DocumentSignature.objects.filter(document=document).update(...)` — `is_required` is NOT reset (correct behavior: reopened docs preserve original required/informational assignment) |
