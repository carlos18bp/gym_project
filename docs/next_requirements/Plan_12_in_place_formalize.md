# In-Place Formalize — No Document Copy on Signature Submission

Replace the document-copy behavior in the formalize flow with an in-place state transition so that formalizing a `Completed` document simply updates that same document to `PendingSignatures` instead of creating a new one.

---

## Confirmed Decisions

| Question | Decision |
|---|---|
| Title `_firma` suffix | **Not added** — suffix only existed to distinguish the copy; with no copy it is meaningless |
| Original document | Updated in place (`state` → `PendingSignatures`, `requires_signature` → `True`) |
| Existing relationships | Preserved — they belong to the same document object |
| Backward compatibility | Documents already formalized under the old flow are unaffected |
| Requirement number | **#12** |

---

## Current Architecture — Root Cause

### Frontend: `DocumentForm.vue` lines 711–756

```javascript
// In formalize mode, always create a new document   ← the bug
if (route.params.mode === 'formalize') {
  const response = await store.createDocument(documentData);  // ← creates copy
  if (response && response.id) {
    documentId = response.id;                                  // ← new ID, not original
    // ... creates relationships on the NEW document
  }
}
```

`store.createDocument` calls `POST /api/dynamic-documents/create/` → serializer `create()` → **new row in DB**.

### Backend: `DynamicDocumentSerializer.create()` — two behaviors NOT in `update()`

| Behavior | `create()` | `update()` | Gap |
|---|---|---|---|
| `_firma` suffix on title | ✅ lines 427–428 | ❌ | No longer needed (see decision above) |
| Lawyer's own `DocumentSignature` | ✅ lines 456–464 | ❌ | **Must add to `update()`** — otherwise lawyer never appears as a required signer |

### No other changes needed

- `update_dynamic_document` view (`PATCH /dynamic-documents/{id}/update/`) already accepts `state`, `requires_signature`, `signers`, `signature_due_date`, `variables` — no view change required.
- All post-save logic in `DocumentForm.vue` (relationships, redirect, notifications) already uses the `documentId` variable — once that variable holds the original ID, everything works correctly with zero further changes.

---

## Implementation

### Change 1 — Frontend `DocumentForm.vue` (~3 lines)

**File**: `frontend/src/views/dynamic_document/DocumentForm.vue`

```javascript
// BEFORE (lines ~711–713):
// In formalize mode, always create a new document
if (route.params.mode === 'formalize') {
  const response = await store.createDocument(documentData);

// AFTER:
// In formalize mode, update the existing document in place (no copy created)
if (route.params.mode === 'formalize') {
  const response = await store.updateDocument(route.params.id, documentData);
```

That is the **only frontend change**. Everything that follows (`documentId = response.id`, relationships loop, `localStorage`, redirect) is already correct because it references `documentId` generically.

---

### Change 2 — Backend `DynamicDocumentSerializer.update()` (~10 lines)

**File**: `backend/gym_app/serializers/dynamic_document.py`

Inside `update()`, after the existing signer loop that creates client signatures (line ~583), add the lawyer's own signature creation when transitioning to `PendingSignatures`:

```python
# After the existing signer loop in update():

# If transitioning to PendingSignatures, ensure the document creator (lawyer)
# also has a DocumentSignature record — mirrors the behavior of create().
new_state = validated_data.get('state', instance.state)
if requires_signature and new_state == 'PendingSignatures':
    creator = instance.created_by
    if creator and getattr(creator, 'role', None) == 'lawyer':
        existing_signer_ids = set(sig.signer.id for sig in instance.signatures.all())
        if creator.id not in existing_signer_ids:
            try:
                DocumentSignature.objects.create(document=instance, signer=creator)
            except Exception:
                pass
```

**Why here**: The existing `update()` signer loop (line ~567) only processes the `signers` list from the request payload (client users). The lawyer who created the document is never included in that list — they are added separately in `create()`. This block replicates that same logic for the update path.

---

## Side Effects Analysis

| Concern | Impact |
|---|---|
| Document moves tabs in the UI | ✅ Automatic — `SignaturesList.vue` already filters by `state`; the doc naturally leaves "Completados" and enters "Pendientes de firmas" |
| Document relationships | ✅ Preserved — relationships are on the same DB row, not affected by state change |
| Document variables | ✅ Preserved — `update()` only replaces variables if `variables` key is included in the payload; the formalize payload includes updated variables from the form |
| `pendingSignatureDocuments` Pinia getter | ✅ Already filters `state === 'PendingSignatures'` — will pick up the updated document after `store.init(true)` |
| Old copies already created | ✅ Unaffected — they are separate rows; this change only affects future formalizations |
| `correction` mode flow | ✅ Unaffected — correction uses `updateDocument` already and calls `reopen-signatures/` endpoint separately |
| `@require_document_usability('usability')` decorator on update view | ✅ Lawyers have automatic usability access to all documents |

---

## Tests to Add

**New file**: `backend/gym_app/tests/views/test_in_place_formalize.py`

```python
import pytest
from gym_app.models import DynamicDocument, DocumentSignature
from gym_app.models.dynamic_document import DocumentVariable

pytestmark = pytest.mark.django_db


@pytest.fixture
def completed_document(lawyer_user, client_user):
    doc = DynamicDocument.objects.create(
        title='Contrato de Servicios',
        content='Content',
        state='Completed',
        requires_signature=False,
        created_by=lawyer_user,
        assigned_to=client_user,
    )
    return doc


class TestInPlaceFormalize:
    def test_formalize_updates_same_document_not_creates_copy(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        initial_id = completed_document.id
        initial_count = DynamicDocument.objects.count()

        api_client.force_authenticate(user=lawyer_user)
        response = api_client.patch(
            f'/api/dynamic-documents/{completed_document.id}/update/',
            {
                'state': 'PendingSignatures',
                'requires_signature': True,
                'signers': [client_user.id],
            },
            format='json'
        )
        assert response.status_code == 200
        # No new document was created
        assert DynamicDocument.objects.count() == initial_count
        # Same document ID
        assert response.data['id'] == initial_id

    def test_formalize_sets_pending_signatures_state(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        api_client.force_authenticate(user=lawyer_user)
        api_client.patch(
            f'/api/dynamic-documents/{completed_document.id}/update/',
            {'state': 'PendingSignatures', 'requires_signature': True, 'signers': [client_user.id]},
            format='json'
        )
        completed_document.refresh_from_db()
        assert completed_document.state == 'PendingSignatures'
        assert completed_document.requires_signature is True

    def test_formalize_creates_lawyer_signature_record(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        """Lawyer's own DocumentSignature must be created during in-place formalize."""
        api_client.force_authenticate(user=lawyer_user)
        api_client.patch(
            f'/api/dynamic-documents/{completed_document.id}/update/',
            {'state': 'PendingSignatures', 'requires_signature': True, 'signers': [client_user.id]},
            format='json'
        )
        # Lawyer signature record must exist
        assert DocumentSignature.objects.filter(
            document=completed_document, signer=lawyer_user
        ).exists()

    def test_formalize_creates_client_signature_record(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        api_client.force_authenticate(user=lawyer_user)
        api_client.patch(
            f'/api/dynamic-documents/{completed_document.id}/update/',
            {'state': 'PendingSignatures', 'requires_signature': True, 'signers': [client_user.id]},
            format='json'
        )
        assert DocumentSignature.objects.filter(
            document=completed_document, signer=client_user
        ).exists()

    def test_formalize_preserves_original_title(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        """Title must NOT get _firma suffix when updating in place."""
        original_title = completed_document.title
        api_client.force_authenticate(user=lawyer_user)
        api_client.patch(
            f'/api/dynamic-documents/{completed_document.id}/update/',
            {'state': 'PendingSignatures', 'requires_signature': True, 'signers': [client_user.id]},
            format='json'
        )
        completed_document.refresh_from_db()
        assert completed_document.title == original_title
        assert not completed_document.title.endswith('_firma')

    def test_formalize_preserves_existing_relationships(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        """Relationships on the original document must survive the formalize transition."""
        from gym_app.models.dynamic_document import DocumentRelationship
        other_doc = DynamicDocument.objects.create(
            title='Other', content='C', state='Completed', created_by=lawyer_user
        )
        DocumentRelationship.objects.create(
            source_document=completed_document,
            target_document=other_doc,
            created_by=lawyer_user,
        )
        api_client.force_authenticate(user=lawyer_user)
        api_client.patch(
            f'/api/dynamic-documents/{completed_document.id}/update/',
            {'state': 'PendingSignatures', 'requires_signature': True, 'signers': [client_user.id]},
            format='json'
        )
        assert DocumentRelationship.objects.filter(
            source_document=completed_document
        ).exists()

    def test_lawyer_signature_not_duplicated_on_re_formalize(
        self, api_client, lawyer_user, client_user, completed_document
    ):
        """Calling update twice must not create duplicate lawyer signature records."""
        api_client.force_authenticate(user=lawyer_user)
        for _ in range(2):
            api_client.patch(
                f'/api/dynamic-documents/{completed_document.id}/update/',
                {'state': 'PendingSignatures', 'requires_signature': True, 'signers': [client_user.id]},
                format='json'
            )
        lawyer_sig_count = DocumentSignature.objects.filter(
            document=completed_document, signer=lawyer_user
        ).count()
        assert lawyer_sig_count == 1
```

---

## Files Summary

### Modified Files
| Layer | File | Change |
|---|---|---|
| Frontend | `frontend/src/views/dynamic_document/DocumentForm.vue` | Line ~712: `createDocument` → `updateDocument(route.params.id, ...)` |
| Backend | `backend/gym_app/serializers/dynamic_document.py` | `update()` method: add lawyer signature creation on `PendingSignatures` transition |

### New Files
| Layer | File | Purpose |
|---|---|---|
| Backend tests | `backend/gym_app/tests/views/test_in_place_formalize.py` | 7 regression tests for the new behavior |

### No Changes Needed
- `document_views.py` — `update_dynamic_document` view already handles all fields
- `menuOptionsHelper.js` — "Formalizar y Agregar Firmas" action is unchanged
- `DynamicDocumentStore` — `updateDocument` already exists and works correctly
- Any signature views — `sign_document`, `get_pending_signatures` etc. operate on `DocumentSignature` objects which are now created on the original document

---

## Implementation Order

| Step | Task | Est. Time |
|---|---|---|
| 1 | Backend: add lawyer signature creation in `update()` | 0.25 h |
| 2 | Backend: write and run 7 regression tests | 1 h |
| 3 | Frontend: change `createDocument` → `updateDocument` in formalize branch | 0.1 h |
| 4 | Manual smoke test: formalize a document end-to-end | 0.5 h |
| **Total** | | **~1.85 h** |

**Estimated cost**: Low difficulty → **270,000 – 360,000 COP**

---

## Key Risk

The only non-trivial risk is **existing documents formalized under the old flow**: after this change, the original `Completed` documents that previously generated copies will never be "consumed". They will remain as orphan `Completed` documents. This is a data cleanup concern, not a functional bug — existing data is unaffected and existing copies continue to work in their current state.
