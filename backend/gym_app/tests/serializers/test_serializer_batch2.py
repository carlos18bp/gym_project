"""
Batch 2: Serializer tests covering DynamicDocumentSerializer (summary fields,
permission fields, create/update), DocumentVariableSerializer validation,
permission serializers, relationship serializers, subscription edges.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from gym_app.models import (
    DynamicDocument, DocumentVariable, DocumentSignature,
    DocumentVisibilityPermission, DocumentUsabilityPermission,
    DocumentRelationship, DocumentFolder, Tag, RecentDocument,
    Subscription, PaymentHistory, User,
)
from gym_app.serializers.dynamic_document import (
    DocumentVariableSerializer,
    DynamicDocumentSerializer,
    TagSerializer,
    DocumentSignatureSerializer,
    RecentDocumentSerializer,
    DocumentFolderSerializer,
    DocumentVisibilityPermissionSerializer,
    DocumentUsabilityPermissionSerializer,
    DocumentRelationshipSerializer,
)
from gym_app.serializers.subscription import (
    SubscriptionSerializer, PaymentHistorySerializer,
)

pytestmark = pytest.mark.django_db


# ── helpers / fixtures ──────────────────────────────────────────────────────

class MockRequest:
    def __init__(self, user):
        self.user = user


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="lawyer-s2@example.com", password="testpassword",
        first_name="Lawyer", last_name="S2", role="lawyer", is_gym_lawyer=True,
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="client-s2@example.com", password="testpassword",
        first_name="Client", last_name="S2", role="client",
    )


@pytest.fixture
def document(lawyer):
    return DynamicDocument.objects.create(
        title="SerDoc", content="<p>body</p>", state="Draft", created_by=lawyer,
    )


# ── DocumentVariableSerializer validation ────────────────────────────────────

class TestDocumentVariableSerializerValidation:
    def test_number_invalid(self):
        data = {"name_en": "v", "field_type": "number", "value": "abc"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()
        assert "value" in s.errors

    def test_date_invalid(self):
        data = {"name_en": "v", "field_type": "date", "value": "not-a-date"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()

    def test_email_invalid(self):
        data = {"name_en": "v", "field_type": "email", "value": "bad"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()

    def test_select_without_options(self):
        data = {"name_en": "v", "field_type": "select", "value": "x"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()
        assert "select_options" in s.errors

    def test_select_with_options_valid(self):
        data = {
            "name_en": "v", "field_type": "select",
            "select_options": ["opt1", "opt2"],
        }
        s = DocumentVariableSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_number_valid(self):
        data = {"name_en": "v", "field_type": "number", "value": "42"}
        s = DocumentVariableSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_date_valid(self):
        data = {"name_en": "v", "field_type": "date", "value": "2024-06-15"}
        s = DocumentVariableSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_email_valid(self):
        data = {"name_en": "v", "field_type": "email", "value": "ok@example.com"}
        s = DocumentVariableSerializer(data=data)
        assert s.is_valid(), s.errors

    def test_input_type_no_special_validation(self):
        data = {"name_en": "v", "field_type": "input", "value": "anything"}
        s = DocumentVariableSerializer(data=data)
        assert s.is_valid(), s.errors


# ── TagSerializer ────────────────────────────────────────────────────────────

class TestTagSerializer:
    def test_create_attaches_user(self, lawyer):
        data = {"name": "Urgent", "color_id": 1}
        s = TagSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        tag = s.save()
        assert tag.created_by == lawyer
        assert tag.name == "Urgent"


# ── DocumentSignatureSerializer ──────────────────────────────────────────────

class TestDocumentSignatureSerializer:
    def test_signer_name_with_names(self, lawyer, document):
        sig = DocumentSignature.objects.create(document=document, signer=lawyer)
        s = DocumentSignatureSerializer(sig)
        assert s.data["signer_name"] == "Lawyer S2"
        assert s.data["signer_email"] == lawyer.email

    def test_signer_name_falls_back_to_email(self, document):
        no_name = User.objects.create_user(
            email="anon@example.com", password="p", first_name="", last_name="",
        )
        sig = DocumentSignature.objects.create(document=document, signer=no_name)
        s = DocumentSignatureSerializer(sig)
        assert s.data["signer_name"] == "anon@example.com"


# ── DynamicDocumentSerializer summary fields ─────────────────────────────────

class TestDynamicDocumentSerializerSummary:
    def test_summary_counterparty_from_variable(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="cp", field_type="input",
            summary_field="counterparty", value="ACME Corp",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_counterparty"] == "ACME Corp"

    def test_summary_counterparty_fallback_assigned_to(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=lawyer, assigned_to=client_user,
        )
        s = DynamicDocumentSerializer(doc, context={"request": MockRequest(lawyer)})
        assert s.data["summary_counterparty"] == "Client S2"

    def test_summary_counterparty_fallback_signer(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="D", content="C", created_by=lawyer, requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)
        s = DynamicDocumentSerializer(doc, context={"request": MockRequest(lawyer)})
        assert s.data["summary_counterparty"] == "Client S2"

    def test_summary_counterparty_none(self, lawyer, document):
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_counterparty"] is None

    def test_summary_object(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="obj", field_type="input",
            summary_field="object", value="Service Agreement",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_object"] == "Service Agreement"

    def test_summary_value_and_currency(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="val", field_type="input",
            summary_field="value", value="5000", currency="USD",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_value"] == "5000"
        assert s.data["summary_value_currency"] == "USD"

    def test_summary_value_currency_none_when_no_var(self, lawyer, document):
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_value_currency"] is None

    def test_summary_term(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="t", field_type="input",
            summary_field="term", value="12 months",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_term"] == "12 months"

    def test_summary_subscription_date_from_variable(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="sd", field_type="date",
            summary_field="subscription_date", value="2024-03-15",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_subscription_date"] == "2024-03-15"

    def test_summary_subscription_date_fallback_created_at(self, lawyer, document):
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_subscription_date"] == document.created_at.date().isoformat()

    def test_summary_start_date(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="sd", field_type="date",
            summary_field="start_date", value="2024-01-01",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_start_date"] == "2024-01-01"

    def test_summary_end_date(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="ed", field_type="date",
            summary_field="end_date", value="2024-12-31",
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["summary_end_date"] == "2024-12-31"


# ── DynamicDocumentSerializer permission fields ─────────────────────────────

class TestDynamicDocumentSerializerPermissions:
    def test_lawyer_can_view_edit_delete(self, lawyer, document):
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["can_view"] is True
        assert s.data["can_edit"] is True
        assert s.data["can_delete"] is True
        assert s.data["user_permission_level"] == "lawyer"

    def test_client_no_access(self, lawyer, client_user, document):
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(client_user)})
        assert s.data["can_view"] is False
        assert s.data["can_edit"] is False
        assert s.data["can_delete"] is False
        assert s.data["user_permission_level"] is None

    def test_client_view_only(self, lawyer, client_user, document):
        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer,
        )
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(client_user)})
        assert s.data["can_view"] is True
        assert s.data["can_edit"] is False
        assert s.data["can_delete"] is False
        assert s.data["user_permission_level"] == "view_only"

    def test_owner_can_view_edit_delete(self, client_user):
        doc = DynamicDocument.objects.create(
            title="Own", content="C", created_by=client_user,
        )
        s = DynamicDocumentSerializer(doc, context={"request": MockRequest(client_user)})
        assert s.data["can_view"] is True
        assert s.data["can_edit"] is True
        assert s.data["can_delete"] is True

    def test_no_request_context(self, document):
        s = DynamicDocumentSerializer(document, context={})
        assert s.data["can_view"] is False
        assert s.data["user_permission_level"] is None


# ── DynamicDocumentSerializer signature counts ──────────────────────────────

class TestDynamicDocumentSerializerSignatureCounts:
    def test_completed_and_total_signatures(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="Sig", content="C", created_by=lawyer, requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=lawyer, signed=True)
        DocumentSignature.objects.create(document=doc, signer=client_user, signed=False)
        s = DynamicDocumentSerializer(doc, context={"request": MockRequest(lawyer)})
        assert s.data["completed_signatures"] == 1
        assert s.data["total_signatures"] == 2

    def test_no_signature_required(self, lawyer, document):
        s = DynamicDocumentSerializer(document, context={"request": MockRequest(lawyer)})
        assert s.data["completed_signatures"] == 0
        assert s.data["total_signatures"] == 0


# ── DynamicDocumentSerializer.get_signer_ids ─────────────────────────────────

class TestDynamicDocumentSerializerSignerIds:
    def test_signer_ids(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="S", content="C", created_by=lawyer, requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)
        s = DynamicDocumentSerializer(doc, context={"request": MockRequest(lawyer)})
        assert client_user.id in s.data["signer_ids"]


# ── DynamicDocumentSerializer.get_relationships_count ────────────────────────

class TestDynamicDocumentSerializerRelationshipsCount:
    def test_relationships_count_with_user(self, lawyer):
        doc_a = DynamicDocument.objects.create(title="A", content="C", created_by=lawyer)
        doc_b = DynamicDocument.objects.create(title="B", content="C", created_by=lawyer, state="Completed")
        DocumentRelationship.objects.create(
            source_document=doc_a, target_document=doc_b, created_by=lawyer,
        )
        s = DynamicDocumentSerializer(doc_a, context={"request": MockRequest(lawyer)})
        assert s.data["relationships_count"] == 1

    def test_relationships_count_without_user(self, lawyer):
        doc_a = DynamicDocument.objects.create(title="A", content="C", created_by=lawyer)
        doc_b = DynamicDocument.objects.create(title="B", content="C", created_by=lawyer)
        DocumentRelationship.objects.create(
            source_document=doc_a, target_document=doc_b, created_by=lawyer,
        )
        s = DynamicDocumentSerializer(doc_a, context={})
        assert s.data["relationships_count"] == 1


# ── DynamicDocumentSerializer.create ─────────────────────────────────────────

class TestDynamicDocumentSerializerCreate:
    def test_create_basic_document(self, lawyer):
        data = {"title": "New", "content": "<p>C</p>", "state": "Draft"}
        s = DynamicDocumentSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        doc = s.save()
        assert doc.created_by == lawyer
        assert doc.title == "New"

    def test_create_with_signature_appends_firma(self, lawyer, client_user):
        data = {
            "title": "Contract",
            "content": "<p>C</p>",
            "state": "Draft",
            "requires_signature": True,
            "signers": [client_user.id],
        }
        s = DynamicDocumentSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        doc = s.save()
        assert doc.title.endswith("_firma")
        assert doc.requires_signature is True
        assert doc.signatures.filter(signer=client_user).exists()

    def test_create_with_tags(self, lawyer):
        tag = Tag.objects.create(name="T1", created_by=lawyer)
        data = {
            "title": "Tagged", "content": "C", "state": "Draft",
            "tag_ids": [tag.id],
        }
        s = DynamicDocumentSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        doc = s.save()
        assert tag in doc.tags.all()

    def test_create_with_variables(self, lawyer):
        data = {
            "title": "Vars", "content": "C", "state": "Draft",
            "variables": [
                {"name_en": "v1", "field_type": "input", "value": "hello"},
            ],
        }
        s = DynamicDocumentSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        doc = s.save()
        assert doc.variables.count() == 1

    def test_create_with_visibility_permissions(self, lawyer, client_user):
        data = {
            "title": "VisPerm", "content": "C", "state": "Draft",
            "visibility_user_ids": [client_user.id],
        }
        s = DynamicDocumentSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        doc = s.save()
        assert DocumentVisibilityPermission.objects.filter(
            document=doc, user=client_user,
        ).exists()


# ── DynamicDocumentSerializer.update ─────────────────────────────────────────

class TestDynamicDocumentSerializerUpdate:
    def test_update_title_and_state(self, lawyer, document):
        data = {"title": "Updated", "state": "Progress"}
        s = DynamicDocumentSerializer(
            document, data=data, partial=True,
            context={"request": MockRequest(lawyer)},
        )
        assert s.is_valid(), s.errors
        doc = s.save()
        assert doc.title == "Updated"
        assert doc.state == "Progress"

    def test_update_removes_relationships_on_completed_to_progress(self, lawyer):
        doc_a = DynamicDocument.objects.create(
            title="A", content="C", created_by=lawyer, state="Completed",
        )
        doc_b = DynamicDocument.objects.create(
            title="B", content="C", created_by=lawyer, state="Completed",
        )
        DocumentRelationship.objects.create(
            source_document=doc_a, target_document=doc_b, created_by=lawyer,
        )
        data = {"state": "Progress"}
        s = DynamicDocumentSerializer(
            doc_a, data=data, partial=True,
            context={"request": MockRequest(lawyer)},
        )
        assert s.is_valid(), s.errors
        s.save()
        assert DocumentRelationship.objects.filter(source_document=doc_a).count() == 0

    def test_update_variables_replaces_all(self, lawyer, document):
        DocumentVariable.objects.create(
            document=document, name_en="old", field_type="input",
        )
        data = {
            "variables": [{"name_en": "new", "field_type": "input", "value": "x"}],
        }
        s = DynamicDocumentSerializer(
            document, data=data, partial=True,
            context={"request": MockRequest(lawyer)},
        )
        assert s.is_valid(), s.errors
        s.save()
        names = list(document.variables.values_list("name_en", flat=True))
        assert names == ["new"]


# ── RecentDocumentSerializer ─────────────────────────────────────────────────

class TestRecentDocumentSerializer:
    def test_serializes_nested_document(self, lawyer, document):
        rd = RecentDocument.objects.create(user=lawyer, document=document)
        s = RecentDocumentSerializer(rd, context={"request": MockRequest(lawyer)})
        assert s.data["document"]["title"] == "SerDoc"
        assert "last_visited" in s.data


# ── DocumentFolderSerializer ─────────────────────────────────────────────────

class TestDocumentFolderSerializer:
    def test_create_attaches_owner(self, client_user, document):
        data = {"name": "MyFolder", "document_ids": [document.id]}
        s = DocumentFolderSerializer(
            data=data, context={"request": MockRequest(client_user)},
        )
        assert s.is_valid(), s.errors
        folder = s.save()
        assert folder.owner == client_user
        assert document in folder.documents.all()


# ── DocumentVisibilityPermissionSerializer ───────────────────────────────────

class TestDocumentVisibilityPermissionSerializer:
    def test_serialize(self, lawyer, client_user, document):
        perm = DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer,
        )
        s = DocumentVisibilityPermissionSerializer(perm)
        assert s.data["user_email"] == client_user.email
        assert s.data["user_full_name"] == "Client S2"
        assert s.data["granted_by_email"] == lawyer.email
        assert s.data["document_title"] == document.title

    def test_user_full_name_falls_back_to_email(self, lawyer, document):
        anon = User.objects.create_user(
            email="anon@example.com", password="p", first_name="", last_name="",
        )
        perm = DocumentVisibilityPermission.objects.create(
            document=document, user=anon, granted_by=lawyer,
        )
        s = DocumentVisibilityPermissionSerializer(perm)
        assert s.data["user_full_name"] == "anon@example.com"


# ── DocumentUsabilityPermissionSerializer ────────────────────────────────────

class TestDocumentUsabilityPermissionSerializer:
    def test_serialize(self, lawyer, client_user, document):
        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer,
        )
        perm = DocumentUsabilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer,
        )
        s = DocumentUsabilityPermissionSerializer(perm)
        assert s.data["user_email"] == client_user.email
        assert s.data["user_full_name"] == "Client S2"
        assert s.data["document_title"] == document.title


# ── DocumentRelationshipSerializer ───────────────────────────────────────────

class TestDocumentRelationshipSerializer:
    def test_validate_self_relationship_rejected(self, lawyer, document):
        data = {
            "source_document": document.id,
            "target_document": document.id,
        }
        s = DocumentRelationshipSerializer(
            data=data, context={"request": MockRequest(lawyer)},
        )
        assert not s.is_valid()

    def test_create_sets_created_by(self, lawyer):
        doc_a = DynamicDocument.objects.create(title="A", content="C", created_by=lawyer)
        doc_b = DynamicDocument.objects.create(title="B", content="C", created_by=lawyer)
        data = {
            "source_document": doc_a.id,
            "target_document": doc_b.id,
        }
        s = DocumentRelationshipSerializer(
            data=data, context={"request": MockRequest(lawyer)},
        )
        assert s.is_valid(), s.errors
        rel = s.save()
        assert rel.created_by == lawyer
        assert s.data["source_document_title"] == "A"
        assert s.data["target_document_title"] == "B"
        assert s.data["created_by_email"] == lawyer.email
        assert s.data["created_by_name"] == "Lawyer S2"

    def test_created_by_name_empty_when_no_creator(self, lawyer):
        doc_a = DynamicDocument.objects.create(title="A", content="C", created_by=lawyer)
        doc_b = DynamicDocument.objects.create(title="B", content="C", created_by=lawyer)
        rel = DocumentRelationship.objects.create(
            source_document=doc_a, target_document=doc_b, created_by=lawyer,
        )
        # Simulate no created_by name
        lawyer.first_name = ""
        lawyer.last_name = ""
        lawyer.save()
        s = DocumentRelationshipSerializer(rel)
        assert s.data["created_by_name"] == lawyer.email


# ── SubscriptionSerializer edge-cases ────────────────────────────────────────

class TestSubscriptionSerializerEdges:
    def test_user_name_fallback_to_email(self):
        user = User.objects.create_user(
            email="noname-sub@example.com", password="p",
            first_name="", last_name="",
        )
        sub = Subscription.objects.create(
            user=user, plan_type="basico", status="active",
            next_billing_date=date.today() + timedelta(days=30),
            amount=Decimal("0.00"),
        )
        s = SubscriptionSerializer(sub)
        assert s.data["user_name"] == user.email

    def test_read_only_fields(self):
        user = User.objects.create_user(
            email="ro@example.com", password="p", role="client",
        )
        sub = Subscription.objects.create(
            user=user, plan_type="cliente", status="active",
            next_billing_date=date.today() + timedelta(days=30),
            amount=Decimal("50000.00"),
        )
        s = SubscriptionSerializer(sub)
        assert "id" in s.data
        assert "created_at" in s.data
        assert "updated_at" in s.data
