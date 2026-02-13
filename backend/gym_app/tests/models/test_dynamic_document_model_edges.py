from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from gym_app.models import (
    DynamicDocument,
    DocumentRelationship,
    DocumentVisibilityPermission,
    DocumentUsabilityPermission,
    DocumentSignature,
    DocumentVariable,
    RecentDocument,
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
        )

    return create_document


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


def test_document_visibility_permission_str(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer = user_factory("viewer@example.com")
    document = document_factory(created_by=creator, title="Doc Title")

    permission = DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer,
        granted_by=creator,
    )

    assert str(permission) == f"{viewer.email} can view '{document.title}'"


def test_document_visibility_permission_ordering_by_granted_at(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer_old = user_factory("viewer-old@example.com")
    viewer_new = user_factory("viewer-new@example.com")
    document = document_factory(created_by=creator)

    perm_old = DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer_old,
        granted_by=creator,
    )
    perm_new = DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer_new,
        granted_by=creator,
    )

    older_time = timezone.now() - timedelta(days=1)
    newer_time = timezone.now()
    DocumentVisibilityPermission.objects.filter(pk=perm_old.pk).update(
        granted_at=older_time
    )
    DocumentVisibilityPermission.objects.filter(pk=perm_new.pk).update(
        granted_at=newer_time
    )

    permissions = list(DocumentVisibilityPermission.objects.all())

    assert permissions[0].id == perm_new.id
    assert permissions[1].id == perm_old.id


def test_document_visibility_permission_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer = user_factory("viewer@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer,
        granted_by=creator,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentVisibilityPermission.objects.create(
                document=document,
                user=viewer,
                granted_by=creator,
            )


def test_document_usability_permission_str(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    editor = user_factory("editor@example.com")
    document = document_factory(created_by=creator, title="Doc Title")

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )
    permission = DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )

    assert str(permission) == f"{editor.email} can use '{document.title}'"


def test_document_usability_permission_unique_together(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    editor = user_factory("editor@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )
    DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor,
        granted_by=creator,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            DocumentUsabilityPermission.objects.create(
                document=document,
                user=editor,
                granted_by=creator,
            )


def test_document_usability_permission_ordering_by_granted_at(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    editor_old = user_factory("editor-old@example.com")
    editor_new = user_factory("editor-new@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor_old,
        granted_by=creator,
    )
    DocumentVisibilityPermission.objects.create(
        document=document,
        user=editor_new,
        granted_by=creator,
    )

    perm_old = DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor_old,
        granted_by=creator,
    )
    perm_new = DocumentUsabilityPermission.objects.create(
        document=document,
        user=editor_new,
        granted_by=creator,
    )

    older_time = timezone.now() - timedelta(days=1)
    newer_time = timezone.now()
    DocumentUsabilityPermission.objects.filter(pk=perm_old.pk).update(
        granted_at=older_time
    )
    DocumentUsabilityPermission.objects.filter(pk=perm_new.pk).update(
        granted_at=newer_time
    )

    permissions = list(DocumentUsabilityPermission.objects.all())

    assert permissions[0].id == perm_new.id
    assert permissions[1].id == perm_old.id


def test_document_usability_permission_allows_gym_lawyer(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    gym_lawyer = user_factory("gym@example.com", is_gym_lawyer=True)
    document = document_factory(created_by=creator)

    permission = DocumentUsabilityPermission.objects.create(
        document=document,
        user=gym_lawyer,
        granted_by=creator,
    )

    assert permission.id is not None


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


def test_document_variable_invalid_number_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser un"):
        DocumentVariable.objects.create(
            document=document,
            name_en="amount",
            field_type="number",
            value="not-a-number",
        )


def test_document_variable_invalid_date_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser una fecha"):
        DocumentVariable.objects.create(
            document=document,
            name_en="start",
            field_type="date",
            value="2023/01/01",
        )


def test_document_variable_invalid_email_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    with pytest.raises(ValidationError, match="valor debe ser un correo"):
        DocumentVariable.objects.create(
            document=document,
            name_en="email",
            field_type="email",
            value="not-an-email",
        )


def test_document_variable_valid_number_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        value="1234.56",
    )

    assert variable.id is not None


def test_document_variable_valid_date_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="start_date",
        field_type="date",
        value="2024-01-31",
    )

    assert variable.id is not None


def test_document_variable_valid_email_no_error(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="contact_email",
        field_type="email",
        value="person@example.com",
    )

    assert variable.id is not None


def test_document_variable_get_formatted_value_usd_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        currency="USD",
        value="1000",
    )

    assert variable.get_formatted_value() == "US $ 1.000.00"


def test_document_variable_get_formatted_value_returns_raw_when_not_value(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="notes",
        field_type="input",
        summary_field="none",
        value="Some notes",
    )

    assert variable.get_formatted_value() == "Some notes"


def test_document_variable_get_formatted_value_without_currency_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        value="1000",
    )

    assert variable.get_formatted_value() == "1.000.00"


def test_document_variable_get_formatted_value_unknown_currency_label(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    document = document_factory(created_by=creator)

    variable = DocumentVariable.objects.create(
        document=document,
        name_en="amount",
        field_type="number",
        summary_field="value",
        currency="GBP",
        value="1000",
    )

    assert variable.get_formatted_value() == "GBP 1.000.00"


def test_recent_document_str(user_factory, document_factory):
    user = user_factory("recent@example.com")
    document = document_factory(created_by=user, title="Recent Doc")

    recent = RecentDocument.objects.create(user=user, document=document)

    assert user.email in str(recent)
    assert document.title in str(recent)


def test_recent_document_unique_together(user_factory, document_factory):
    user = user_factory("unique@example.com")
    document = document_factory(created_by=user)

    RecentDocument.objects.create(user=user, document=document)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            RecentDocument.objects.create(user=user, document=document)
