"""
Edge tests for gym_app/serializers/dynamic_document.py to close coverage gaps.

Targets: DocumentVariableSerializer validation, DynamicDocumentSerializer
create/update (signatures, permissions, tags, state transitions),
get_can_edit/get_can_delete, summary method fallbacks,
DocumentRelationshipSerializer (validate, create, get_created_by_name).
"""
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers as drf_serializers

from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentVariable, DocumentSignature,
    Tag, DocumentFolder, DocumentVisibilityPermission,
    DocumentUsabilityPermission, DocumentRelationship,
)
from gym_app.serializers.dynamic_document import (
    DocumentVariableSerializer,
    DynamicDocumentSerializer,
    DocumentRelationshipSerializer,
    DocumentFolderSerializer,
)

User = get_user_model()


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def lawyer(db):
    return User.objects.create_user(
        email="dds-lawyer@example.com",
        password="testpassword",
        first_name="Doc",
        last_name="Lawyer",
        role="lawyer",
    )


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        email="dds-client@example.com",
        password="testpassword",
        first_name="Doc",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def client_user2(db):
    return User.objects.create_user(
        email="dds-client2@example.com",
        password="testpassword",
        first_name="Second",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def document(db, lawyer):
    return DynamicDocument.objects.create(
        title="Test Doc",
        content="<p>Content</p>",
        state="Progress",
        created_by=lawyer,
    )


@pytest.fixture
def tag(db, lawyer):
    return Tag.objects.create(name="TestTag", color_id=1, created_by=lawyer)


# ---------------------------------------------------------------------------
# DocumentVariableSerializer validation edges
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDocumentVariableSerializerEdges:
    def test_validate_number_invalid(self):
        """Cover lines 47-50: invalid number raises."""
        serializer = DocumentVariableSerializer(data={
            "name_en": "Amount", "name_es": "Monto",
            "field_type": "number", "value": "not-a-number",
        })
        assert not serializer.is_valid()
        assert "value" in serializer.errors

    def test_validate_date_invalid(self):
        """Cover lines 55-58: invalid date raises."""
        serializer = DocumentVariableSerializer(data={
            "name_en": "Date", "name_es": "Fecha",
            "field_type": "date", "value": "31-12-2025",
        })
        assert not serializer.is_valid()

    def test_validate_email_invalid(self):
        """Cover lines 63-66: invalid email raises."""
        serializer = DocumentVariableSerializer(data={
            "name_en": "Email", "name_es": "Correo",
            "field_type": "email", "value": "not-an-email",
        })
        assert not serializer.is_valid()

    def test_validate_select_no_options(self):
        """Cover lines 70-73: select with no options raises."""
        serializer = DocumentVariableSerializer(data={
            "name_en": "Choice", "name_es": "Opción",
            "field_type": "select", "value": "",
        })
        assert not serializer.is_valid()

    def test_validate_select_with_options(self):
        """Cover line 41: select with options passes."""
        serializer = DocumentVariableSerializer(data={
            "name_en": "Choice", "name_es": "Opción",
            "field_type": "select", "value": "opt1",
            "select_options": ["opt1", "opt2"],
        })
        assert serializer.is_valid(), serializer.errors


# ---------------------------------------------------------------------------
# DynamicDocumentSerializer.get_can_edit / get_can_delete edges
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDynamicDocumentPermissionEdges:
    def test_get_can_edit_no_request(self, document):
        """Cover line 308: no request → False."""
        serializer = DynamicDocumentSerializer()
        assert serializer.get_can_edit(document) is False

    def test_get_can_delete_no_request(self, document):
        """Cover line 329: no request → False."""
        serializer = DynamicDocumentSerializer()
        assert serializer.get_can_delete(document) is False

    def test_get_can_edit_no_permission(self, document, client_user, rf):
        """Cover lines 311-312: user_permission is None → False."""
        request = rf.get("/")
        request.user = client_user
        serializer = DynamicDocumentSerializer(context={"request": request})
        with patch.object(type(document), 'get_user_permission_level', return_value=None):
            assert serializer.get_can_edit(document) is False

    def test_get_can_delete_no_permission(self, document, client_user, rf):
        """Cover lines 332-333: user_permission is None → False."""
        request = rf.get("/")
        request.user = client_user
        serializer = DynamicDocumentSerializer(context={"request": request})
        with patch.object(type(document), 'get_user_permission_level', return_value=None):
            assert serializer.get_can_delete(document) is False

    def test_get_can_edit_unknown_permission(self, document, client_user, rf):
        """Cover lines 320-321: unknown permission level → ValueError → False."""
        request = rf.get("/")
        request.user = client_user
        serializer = DynamicDocumentSerializer(context={"request": request})
        with patch.object(type(document), 'get_user_permission_level', return_value='unknown_level'):
            assert serializer.get_can_edit(document) is False

    def test_get_can_delete_unknown_permission(self, document, client_user, rf):
        """Cover lines 341-342: unknown permission level → ValueError → False."""
        request = rf.get("/")
        request.user = client_user
        serializer = DynamicDocumentSerializer(context={"request": request})
        with patch.object(type(document), 'get_user_permission_level', return_value='unknown_level'):
            assert serializer.get_can_delete(document) is False


# ---------------------------------------------------------------------------
# DynamicDocumentSerializer summary method fallbacks
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDynamicDocumentSummaryEdges:
    def test_get_signers_signer_none(self, document, lawyer, rf):
        """Cover line 228: signer is None → continue."""
        # Create a signature then mock its signer to be None
        sig = DocumentSignature.objects.create(document=document, signer=lawyer)
        serializer = DynamicDocumentSerializer(context={"request": rf.get("/")})
        # Mock the queryset to return a signature with signer=None
        mock_sig = MagicMock()
        mock_sig.signer = None
        mock_obj = MagicMock()
        mock_obj.signatures.select_related.return_value.all.return_value = [mock_sig]
        result = serializer.get_signers(mock_obj)
        assert result == []

    def test_get_summary_subscription_date_with_variable(self, document, lawyer, rf):
        """Cover line 392: subscription_date variable with value."""
        DocumentVariable.objects.create(
            document=document, name_en="SubDate", name_es="FechaSub",
            field_type="date", value="2025-06-15", summary_field="subscription_date",
        )
        request = rf.get("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        result = serializer.get_summary_subscription_date(document)
        assert result == "2025-06-15"

    def test_summary_subscription_date_fallback_created_at(self, document, rf, lawyer):
        """Cover lines 395-397: no variable → fallback to created_at.date().isoformat()."""
        request = rf.get("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        result = serializer.get_summary_subscription_date(document)
        assert result == document.created_at.date().isoformat()

    def test_summary_subscription_date_attribute_error(self, document, rf, lawyer):
        """Cover lines 398-400: created_at is unexpected type → str()."""
        request = rf.get("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        # Mock created_at to be a string (no .date() method)
        document.created_at = "2025-01-01"
        result = serializer.get_summary_subscription_date(document)
        assert result == "2025-01-01"

    def test_summary_counterparty_assigned_to_fallback(self, document, client_user, rf, lawyer):
        """Cover lines 355-359: no counterparty var, but assigned_to exists → name."""
        document.assigned_to = client_user
        document.save()
        request = rf.get("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        result = serializer.get_summary_counterparty(document)
        assert "Doc Client" in result or "Client" in result

    def test_relationships_count_no_request(self, document):
        """Cover lines 269-275: no request → count all relationships."""
        serializer = DynamicDocumentSerializer()
        result = serializer.get_relationships_count(document)
        assert result == 0


# ---------------------------------------------------------------------------
# DynamicDocumentSerializer.create edges (signatures, tags, permissions)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDynamicDocumentCreateEdges:
    def test_create_with_tags(self, lawyer, tag, rf):
        """Cover line 446: tags assigned during creation."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        validated = {
            "title": "Tagged Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "tags": [tag],
            "variables": [],
            "signers": [],
            "visibility_user_ids": [],
            "usability_user_ids": [],
        }
        doc = serializer.create(validated)
        assert tag in doc.tags.all()

    def test_create_with_signatures_lawyer_creator(self, lawyer, client_user, rf):
        """Cover lines 457-474: creates signatures for lawyer creator and client signers."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        validated = {
            "title": "Sig Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "requires_signature": True,
            "tags": [],
            "variables": [],
            "signers": [client_user],
            "visibility_user_ids": [],
            "usability_user_ids": [],
        }
        doc = serializer.create(validated)
        assert doc.signatures.count() == 2  # lawyer + client

    def test_create_with_visibility_permissions(self, lawyer, client_user, rf):
        """Cover lines 477-491: visibility permissions created for non-public doc."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        validated = {
            "title": "Private Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "is_public": False,
            "tags": [],
            "variables": [],
            "signers": [],
            "visibility_user_ids": [client_user],
            "usability_user_ids": [],
        }
        doc = serializer.create(validated)
        assert DocumentVisibilityPermission.objects.filter(document=doc, user=client_user).exists()

    def test_create_with_usability_permissions(self, lawyer, client_user, rf):
        """Cover lines 494-516: usability permissions with visibility check."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        validated = {
            "title": "Usable Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "is_public": False,
            "tags": [],
            "variables": [],
            "signers": [],
            "visibility_user_ids": [client_user],
            "usability_user_ids": [client_user],
        }
        doc = serializer.create(validated)
        assert DocumentUsabilityPermission.objects.filter(document=doc, user=client_user).exists()

    def test_create_usability_skip_no_visibility(self, lawyer, client_user, client_user2, rf):
        """Cover lines 502-507: skip usability if no visibility permission."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        validated = {
            "title": "Usable Skip Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "is_public": False,
            "tags": [],
            "variables": [],
            "signers": [],
            "visibility_user_ids": [client_user],
            "usability_user_ids": [client_user2],  # client2 has no visibility
        }
        doc = serializer.create(validated)
        assert not DocumentUsabilityPermission.objects.filter(document=doc, user=client_user2).exists()

    def test_create_signature_exception_silenced(self, lawyer, client_user, rf):
        """Cover lines 463-464, 473-474: signature creation exception silenced."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        # Patch DocumentSignature.objects.create to raise on second call
        call_count = {"n": 0}
        orig_create = DocumentSignature.objects.create
        def fail_on_duplicate(**kwargs):
            call_count["n"] += 1
            if call_count["n"] > 1:
                raise Exception("Duplicate signature")
            return orig_create(**kwargs)
        with patch.object(DocumentSignature.objects, 'create', side_effect=fail_on_duplicate):
            validated = {
                "title": "Sig Exc Doc",
                "content": "<p>c</p>",
                "state": "Progress",
                "requires_signature": True,
                "tags": [],
                "variables": [],
                "signers": [client_user],
                "visibility_user_ids": [],
                "usability_user_ids": [],
            }
            doc = serializer.create(validated)
            # Document still created despite signature error
            assert doc.id is not None

    def test_create_visibility_permission_exception_silenced(self, lawyer, client_user, rf):
        """Cover lines 490-491: visibility permission exception silenced."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        with patch(
            'gym_app.serializers.dynamic_document.DocumentVisibilityPermission.objects.get_or_create',
            side_effect=Exception("DB error"),
        ):
            validated = {
                "title": "Vis Exc Doc",
                "content": "<p>c</p>",
                "state": "Progress",
                "is_public": False,
                "tags": [],
                "variables": [],
                "signers": [],
                "visibility_user_ids": [client_user],
                "usability_user_ids": [],
            }
            doc = serializer.create(validated)
            assert doc.id is not None

    def test_create_usability_permission_exception_silenced(self, lawyer, client_user, rf):
        """Cover lines 515-516: usability permission exception silenced."""
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        # First give visibility, then make usability creation fail
        validated = {
            "title": "Usa Exc Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "is_public": True,
            "tags": [],
            "variables": [],
            "signers": [],
            "visibility_user_ids": [],
            "usability_user_ids": [client_user],
        }
        with patch(
            'gym_app.serializers.dynamic_document.DocumentUsabilityPermission.objects.get_or_create',
            side_effect=Exception("DB error"),
        ):
            doc = serializer.create(validated)
            assert doc.id is not None

    def test_create_skip_lawyer_visibility(self, lawyer, rf):
        """Cover lines 481-482: skip lawyers for visibility permissions."""
        lawyer2 = User.objects.create_user(
            email="dds-lawyer2@example.com", password="tp",
            first_name="L2", last_name="L", role="lawyer",
        )
        request = rf.post("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(context={"request": request})
        validated = {
            "title": "Lawyer Skip Doc",
            "content": "<p>c</p>",
            "state": "Progress",
            "is_public": False,
            "tags": [],
            "variables": [],
            "signers": [],
            "visibility_user_ids": [lawyer2],
            "usability_user_ids": [],
        }
        doc = serializer.create(validated)
        assert not DocumentVisibilityPermission.objects.filter(document=doc, user=lawyer2).exists()


# ---------------------------------------------------------------------------
# DynamicDocumentSerializer.update edges
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDynamicDocumentUpdateEdges:
    def test_update_tags(self, document, tag, rf, lawyer):
        """Cover line 556: update tags."""
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"tags": [tag]})
        assert tag in result.tags.all()

    def test_update_signers_add_new(self, document, client_user, rf, lawyer):
        """Cover lines 567-583: add new signers during update."""
        document.requires_signature = True
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document,
            data={"signers": [client_user.id]},
            partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"signers": [client_user], "requires_signature": True})
        assert document.signatures.filter(signer=client_user).exists()

    def test_update_visibility_permissions(self, document, client_user, rf, lawyer):
        """Cover lines 590-616: update visibility permissions."""
        document.is_public = False
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"visibility_user_ids": [client_user]})
        assert DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()

    def test_update_usability_permissions(self, document, client_user, rf, lawyer):
        """Cover lines 618-655: update usability permissions."""
        document.is_public = False
        document.save()
        # First add visibility
        DocumentVisibilityPermission.objects.create(
            document=document, user=client_user, granted_by=lawyer,
        )
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"usability_user_ids": [client_user]})
        assert DocumentUsabilityPermission.objects.filter(document=document, user=client_user).exists()

    def test_update_signers_exception_silenced(self, document, client_user, rf, lawyer):
        """Cover lines 582-583: signature creation exception silenced during update."""
        document.requires_signature = True
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"signers": [client_user.id]}, partial=True,
            context={"request": request},
        )
        with patch.object(DocumentSignature.objects, 'create', side_effect=Exception("dup")):
            result = serializer.update(document, {"signers": [client_user], "requires_signature": True})
            assert result.id is not None

    def test_update_visibility_skip_creator(self, document, client_user, rf, lawyer):
        """Cover lines 606-607: skip document creator in visibility update."""
        document.is_public = False
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        # Include the creator (lawyer) in visibility_user_ids - should be skipped
        result = serializer.update(document, {"visibility_user_ids": [lawyer, client_user]})
        # Creator should not get an explicit visibility permission
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=lawyer).exists()
        assert DocumentVisibilityPermission.objects.filter(document=document, user=client_user).exists()

    def test_update_visibility_exception_silenced(self, document, client_user, rf, lawyer):
        """Cover lines 615-616: visibility permission exception silenced during update."""
        document.is_public = False
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        with patch(
            'gym_app.models.dynamic_document.DocumentVisibilityPermission.objects.get_or_create',
            side_effect=Exception("DB error"),
        ):
            result = serializer.update(document, {"visibility_user_ids": [client_user]})
            assert result.id is not None

    def test_update_usability_skip_creator(self, document, client_user, rf, lawyer):
        """Cover lines 635-636: skip document creator in usability update."""
        document.is_public = True
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"usability_user_ids": [lawyer, client_user]})
        assert not DocumentUsabilityPermission.objects.filter(document=document, user=lawyer).exists()

    def test_update_usability_no_visibility_skip(self, document, client_user, client_user2, rf, lawyer):
        """Cover lines 644-646: skip usability if no visibility (non-public doc)."""
        document.is_public = False
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        # client_user2 has no visibility permission and is not in visibility_user_ids
        result = serializer.update(document, {"usability_user_ids": [client_user2]})
        assert not DocumentUsabilityPermission.objects.filter(document=document, user=client_user2).exists()

    def test_update_usability_exception_silenced(self, document, client_user, rf, lawyer):
        """Cover lines 654-655: usability permission exception silenced during update."""
        document.is_public = True
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        with patch(
            'gym_app.models.dynamic_document.DocumentUsabilityPermission.objects.get_or_create',
            side_effect=Exception("DB error"),
        ):
            result = serializer.update(document, {"usability_user_ids": [client_user]})
            assert result.id is not None

    def test_update_skip_lawyer_in_visibility(self, document, rf, lawyer):
        """Cover lines 602-603: skip lawyers in visibility permission update."""
        lawyer2 = User.objects.create_user(
            email="dds-up-lawyer2@example.com", password="tp",
            first_name="UL2", last_name="L", role="lawyer",
        )
        document.is_public = False
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"visibility_user_ids": [lawyer2]})
        assert not DocumentVisibilityPermission.objects.filter(document=document, user=lawyer2).exists()

    def test_update_skip_lawyer_in_usability(self, document, rf, lawyer):
        """Cover lines 631-632: skip lawyers in usability permission update."""
        lawyer2 = User.objects.create_user(
            email="dds-up-lawyer3@example.com", password="tp",
            first_name="UL3", last_name="L", role="lawyer",
        )
        document.is_public = True
        document.save()
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"title": document.title}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"usability_user_ids": [lawyer2]})
        assert not DocumentUsabilityPermission.objects.filter(document=document, user=lawyer2).exists()

    def test_update_state_completed_to_progress_deletes_relationships(self, document, lawyer, rf):
        """Cover lines 664-671: Completed → Progress deletes relationships."""
        doc2 = DynamicDocument.objects.create(
            title="Related Doc", content="<p>r</p>",
            state="Progress", created_by=lawyer,
        )
        document.state = "Completed"
        document.save()
        DocumentRelationship.objects.create(
            source_document=document, target_document=doc2, created_by=lawyer,
        )
        assert DocumentRelationship.objects.filter(source_document=document).count() == 1
        request = rf.put("/")
        request.user = lawyer
        serializer = DynamicDocumentSerializer(
            instance=document, data={"state": "Progress"}, partial=True,
            context={"request": request},
        )
        result = serializer.update(document, {"state": "Progress"})
        assert DocumentRelationship.objects.filter(source_document=document).count() == 0


# ---------------------------------------------------------------------------
# DocumentRelationshipSerializer edges (lines 779-798, 805-809, 886)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDocumentRelationshipSerializerEdges:
    def test_get_created_by_name_with_user(self, document, lawyer, rf):
        """Cover lines 779-783: created_by has name."""
        doc2 = DynamicDocument.objects.create(
            title="Doc2", content="<p>c</p>", state="Progress", created_by=lawyer,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document, target_document=doc2, created_by=lawyer,
        )
        request = rf.get("/")
        request.user = lawyer
        # Use the second definition of DocumentRelationshipSerializer (line 840+)
        from gym_app.serializers.dynamic_document import DocumentRelationshipSerializer
        serializer = DocumentRelationshipSerializer(rel, context={"request": request})
        assert serializer.data["created_by_name"] == "Doc Lawyer"

    def test_get_created_by_name_no_user(self, document, lawyer, rf):
        """Cover line 784/886: created_by is None → empty string."""
        doc2 = DynamicDocument.objects.create(
            title="Doc3", content="<p>c</p>", state="Progress", created_by=lawyer,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document, target_document=doc2, created_by=lawyer,
        )
        from gym_app.serializers.dynamic_document import DocumentRelationshipSerializer
        serializer = DocumentRelationshipSerializer(context={"request": rf.get("/")})
        mock_obj = MagicMock()
        mock_obj.created_by = None
        assert serializer.get_created_by_name(mock_obj) == ""

    def test_validate_self_relationship_raises(self, document, rf, lawyer):
        """Cover lines 790-798: self-relationship raises ValidationError."""
        from gym_app.serializers.dynamic_document import DocumentRelationshipSerializer
        request = rf.post("/")
        request.user = lawyer
        serializer = DocumentRelationshipSerializer(
            data={
                "source_document": document.id,
                "target_document": document.id,
            },
            context={"request": request},
        )
        assert not serializer.is_valid()

    def test_create_sets_created_by(self, document, lawyer, rf):
        """Cover lines 805-809: create sets created_by from request."""
        doc2 = DynamicDocument.objects.create(
            title="Doc4", content="<p>c</p>", state="Progress", created_by=lawyer,
        )
        from gym_app.serializers.dynamic_document import DocumentRelationshipSerializer
        request = rf.post("/")
        request.user = lawyer
        serializer = DocumentRelationshipSerializer(
            data={
                "source_document": document.id,
                "target_document": doc2.id,
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors
        rel = serializer.save()
        assert rel.created_by == lawyer


# ---------------------------------------------------------------------------
# DocumentFolderSerializer.create edge
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestDocumentFolderSerializerEdges:
    def test_create_folder_attaches_user(self, client_user, rf):
        """Cover lines 706-707: create attaches request.user as owner."""
        request = rf.post("/")
        request.user = client_user
        serializer = DocumentFolderSerializer(
            data={"name": "My Folder", "color_id": 1},
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors
        folder = serializer.save()
        assert folder.owner == client_user
