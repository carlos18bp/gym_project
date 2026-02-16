import pytest
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from gym_app.models import (
    DynamicDocument,
    DocumentSignature,
    DocumentRelationship,
    DocumentVariable,
)
from gym_app.models.user import User


pytestmark = pytest.mark.django_db


@pytest.fixture
def user_factory():
    def create_user(email, role="client", is_gym_lawyer=False):
        return User.objects.create_user(
            email=email,
            password="testpassword",
            role=role,
            is_gym_lawyer=is_gym_lawyer,
        )

    return create_user


@pytest.fixture
def document_factory():
    def create_document(created_by, **kwargs):
        return DynamicDocument.objects.create(
            title=kwargs.pop("title", "Doc"),
            content=kwargs.pop("content", "<p>x</p>"),
            state=kwargs.pop("state", "Draft"),
            created_by=created_by,
            assigned_to=kwargs.pop("assigned_to", None),
            is_public=kwargs.pop("is_public", False),
            requires_signature=kwargs.pop("requires_signature", False),
            fully_signed=kwargs.pop("fully_signed", False),
        )

    return create_document


def test_check_fully_signed_returns_false_when_not_required(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator, requires_signature=False, state="Draft")

    result = document.check_fully_signed()
    document.refresh_from_db()

    assert result is False
    assert document.fully_signed is False
    assert document.state == "Draft"


def test_check_fully_signed_returns_false_when_no_signatures(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator, requires_signature=True, state="PendingSignatures")

    result = document.check_fully_signed()
    document.refresh_from_db()

    assert result is False
    assert document.fully_signed is False
    assert document.state == "PendingSignatures"


def test_check_fully_signed_returns_false_with_pending_signatures(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer_1 = user_factory("signer1@example.com")
    signer_2 = user_factory("signer2@example.com")
    document = document_factory(created_by=creator, requires_signature=True, state="PendingSignatures")

    DocumentSignature.objects.bulk_create(
        [
            DocumentSignature(document=document, signer=signer_1, signed=True),
            DocumentSignature(document=document, signer=signer_2, signed=False),
        ]
    )

    result = document.check_fully_signed()
    document.refresh_from_db()

    assert result is False
    assert document.fully_signed is False
    assert document.state == "PendingSignatures"


def test_check_fully_signed_sets_fully_signed_and_state(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator, requires_signature=True, state="PendingSignatures")

    DocumentSignature.objects.bulk_create(
        [DocumentSignature(document=document, signer=signer, signed=True)]
    )

    result = document.check_fully_signed()
    document.refresh_from_db()

    assert result is True
    assert document.fully_signed is True
    assert document.state == "FullySigned"


def test_check_fully_signed_updates_from_true_to_false(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer_1 = user_factory("signer1@example.com")
    signer_2 = user_factory("signer2@example.com")
    document = document_factory(created_by=creator, requires_signature=True, state="PendingSignatures")

    DocumentSignature.objects.create(document=document, signer=signer_1, signed=True)
    document.check_fully_signed()
    document.refresh_from_db()

    DocumentSignature.objects.bulk_create(
        [DocumentSignature(document=document, signer=signer_2, signed=False)]
    )
    past_time = timezone.now() - timedelta(days=1)
    DynamicDocument.objects.filter(pk=document.pk).update(updated_at=past_time)
    document.refresh_from_db()
    old_updated_at = document.updated_at

    result = document.check_fully_signed()
    document.refresh_from_db()

    assert result is False
    assert document.fully_signed is False
    assert document.state == "FullySigned"
    assert document.updated_at > old_updated_at


def test_document_signature_str_pending(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    signature = DocumentSignature.objects.create(document=document, signer=signer)

    assert "Pending" in str(signature)


def test_document_signature_str_signed(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    signature = DocumentSignature.objects.create(document=document, signer=signer, signed=True)

    assert "Signed" in str(signature)


def test_document_signature_str_rejected(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    signature = DocumentSignature.objects.create(document=document, signer=signer, rejected=True)

    assert "Rejected" in str(signature)


def test_document_signature_save_calls_check_fully_signed(user_factory, document_factory, monkeypatch):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator, requires_signature=True)

    called = {"count": 0}

    def fake_check():
        called["count"] += 1
        return True

    monkeypatch.setattr(document, "check_fully_signed", fake_check)

    DocumentSignature.objects.create(document=document, signer=signer)

    assert called["count"] == 1


def test_add_relationship_creates_relationship(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator, title="Doc A")
    doc_b = document_factory(created_by=creator, title="Doc B")

    relationship = doc_a.add_relationship(doc_b, created_by=creator)

    assert relationship.source_document == doc_a
    assert relationship.target_document == doc_b
    assert relationship.created_by == creator
    assert DocumentRelationship.objects.count() == 1


def test_remove_relationship_forward(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator)

    DocumentRelationship.objects.create(
        source_document=doc_a,
        target_document=doc_b,
        created_by=creator,
    )

    removed = doc_a.remove_relationship(doc_b)

    assert removed is True
    assert DocumentRelationship.objects.count() == 0


def test_remove_relationship_reverse(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator)

    DocumentRelationship.objects.create(
        source_document=doc_b,
        target_document=doc_a,
        created_by=creator,
    )

    removed = doc_a.remove_relationship(doc_b)

    assert removed is True
    assert DocumentRelationship.objects.count() == 0


def test_document_relationship_clean_rejects_self(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="cannot be related to itself"):
        DocumentRelationship.objects.create(
            source_document=document,
            target_document=document,
            created_by=creator,
        )


def test_document_relationship_str(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator, title="Doc A")
    doc_b = document_factory(created_by=creator, title="Doc B")

    relationship = DocumentRelationship.objects.create(
        source_document=doc_a,
        target_document=doc_b,
        created_by=creator,
    )

    assert str(relationship) == "Doc A -> Doc B"


def test_get_related_documents_without_user_returns_all(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator, title="Doc A")
    doc_b = document_factory(created_by=creator, title="Doc B", state="Completed")
    doc_c = document_factory(created_by=creator, title="Doc C", state="Draft")

    DocumentRelationship.objects.create(
        source_document=doc_a,
        target_document=doc_b,
        created_by=creator,
    )
    DocumentRelationship.objects.create(
        source_document=doc_c,
        target_document=doc_a,
        created_by=creator,
    )

    related_ids = set(doc_a.get_related_documents().values_list("id", flat=True))

    assert related_ids == {doc_b.id, doc_c.id}


def test_get_related_documents_with_no_access_returns_empty(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    other_user = user_factory("other@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator, state="Completed")

    DocumentRelationship.objects.create(
        source_document=doc_a,
        target_document=doc_b,
        created_by=creator,
    )

    related = doc_a.get_related_documents(user=other_user)

    assert list(related) == []


def test_get_related_documents_with_access_filters_final_states(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator, state="Completed", title="Final Doc")
    doc_c = document_factory(created_by=creator, state="Draft", title="Draft Doc")

    DocumentRelationship.objects.create(
        source_document=doc_a,
        target_document=doc_b,
        created_by=creator,
    )
    DocumentRelationship.objects.create(
        source_document=doc_a,
        target_document=doc_c,
        created_by=creator,
    )

    related_ids = set(doc_a.get_related_documents(user=creator).values_list("id", flat=True))

    assert related_ids == {doc_b.id}


def test_document_variable_get_formatted_value_empty(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="value",
        field_type="input",
        summary_field="value",
        value=None,
    )

    assert variable.get_formatted_value() == ""


def test_document_variable_get_formatted_value_with_currency(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="value",
        field_type="input",
        summary_field="value",
        currency="COP",
        value="1.234.567,89",
    )

    assert variable.get_formatted_value() == "COP $ 1.234.567.89"


def test_document_variable_get_formatted_value_parse_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="value",
        field_type="input",
        summary_field="value",
        value="not-a-number",
    )

    assert variable.get_formatted_value() == "not-a-number"


# ======================================================================
# Tests moved from test_model_consolidated.py
# ======================================================================

def test_add_relationship_duplicate_does_not_create(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator)

    first = doc_a.add_relationship(doc_b, created_by=creator)
    second = doc_a.add_relationship(doc_b, created_by=creator)

    assert DocumentRelationship.objects.count() == 1
    assert first.id == second.id


def test_remove_relationship_returns_false_when_missing(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    doc_a = document_factory(created_by=creator)
    doc_b = document_factory(created_by=creator)

    removed = doc_a.remove_relationship(doc_b)

    assert removed is False
    assert DocumentRelationship.objects.count() == 0


def test_get_related_documents_includes_fully_signed_for_owner(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    source = document_factory(created_by=creator)
    target = document_factory(created_by=creator, state="FullySigned")

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=creator).values_list("id", flat=True))

    assert related_ids == {target.id}


def test_get_related_documents_allows_assigned_user_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    assignee = user_factory("assignee@example.com")
    source = document_factory(created_by=creator, assigned_to=assignee)
    target = document_factory(created_by=creator, state="Completed")

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=assignee).values_list("id", flat=True))

    assert related_ids == {target.id}


def test_get_related_documents_allows_signer_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    source = document_factory(created_by=creator)
    target = document_factory(created_by=creator, state="Completed")

    DocumentSignature.objects.create(document=source, signer=signer)
    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=signer).values_list("id", flat=True))

    assert related_ids == {target.id}


def test_get_related_documents_allows_lawyer_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    source = document_factory(created_by=creator)
    final_doc = document_factory(created_by=creator, state="Completed", title="Final Doc")
    draft_doc = document_factory(created_by=creator, state="Draft", title="Draft Doc")

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=final_doc,
        created_by=creator,
    )
    DocumentRelationship.objects.create(
        source_document=source,
        target_document=draft_doc,
        created_by=creator,
    )

    related_ids = set(source.get_related_documents(user=lawyer).values_list("id", flat=True))

    assert related_ids == {final_doc.id}


def test_document_relationship_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    source = document_factory(created_by=creator)
    target = document_factory(created_by=creator)

    DocumentRelationship.objects.create(
        source_document=source,
        target_document=target,
        created_by=creator,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentRelationship.objects.create(
                source_document=source,
                target_document=target,
                created_by=creator,
            )


def test_document_signature_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    DocumentSignature.objects.create(document=document, signer=signer)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentSignature.objects.create(document=document, signer=signer)


def test_document_signature_ordering_by_signer_email(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer_b = user_factory("b@example.com")
    signer_a = user_factory("a@example.com")
    document = document_factory(created_by=creator)

    DocumentSignature.objects.create(document=document, signer=signer_b)
    DocumentSignature.objects.create(document=document, signer=signer_a)

    signatures = list(DocumentSignature.objects.filter(document=document))

    assert [signature.signer.email for signature in signatures] == [
        "a@example.com",
        "b@example.com",
    ]


def test_document_signature_save_triggers_check_on_update(user_factory, document_factory, monkeypatch):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)

    DocumentSignature.objects.bulk_create(
        [DocumentSignature(document=document, signer=signer, signed=False)]
    )
    signature = DocumentSignature.objects.get(document=document, signer=signer)

    called = {"count": 0}

    def fake_check(self):
        called["count"] += 1
        return True

    monkeypatch.setattr(DynamicDocument, "check_fully_signed", fake_check)

    signature.signed = True
    signature.save()

    assert called["count"] == 1


