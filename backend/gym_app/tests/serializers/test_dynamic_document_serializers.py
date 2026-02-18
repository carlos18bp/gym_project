import pytest
from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock, PropertyMock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory
from django.utils import timezone

from gym_app.models.dynamic_document import (
    DynamicDocument,
    DocumentVariable,
    RecentDocument,
    DocumentSignature,
    Tag,
    DocumentFolder,
    DocumentVisibilityPermission,
    DocumentUsabilityPermission,
    DocumentRelationship,
)
from gym_app.serializers.dynamic_document import (
    DynamicDocumentSerializer,
    DocumentVariableSerializer,
    TagSerializer,
    DocumentSignatureSerializer,
    RecentDocumentSerializer,
    DocumentFolderSerializer,
    DocumentVisibilityPermissionSerializer,
    DocumentUsabilityPermissionSerializer,
    DocumentRelationshipSerializer,
)
User = get_user_model()
factory = RequestFactory()

@pytest.fixture
def user():
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword'
    )

@pytest.fixture
def document_variable_data():
    return {
        'name_en': 'test_variable',
        'name_es': 'variable_prueba',
        'tooltip': 'Test tooltip',
        'field_type': 'input',
        'value': 'Test value'
    }

@pytest.fixture
def document_data():
    return {
        'title': 'Test Document',
        'content': '<p>This is a test document with {{test_variable}}.</p>',
        'state': 'Draft'
    }

@pytest.fixture
def document_with_variables(user):
    document = DynamicDocument.objects.create(
        title='Existing Document',
        content='<p>This is an existing document with {{variable1}} and {{variable2}}.</p>',
        state='Draft',
        created_by=user
    )
    
    DocumentVariable.objects.create(
        document=document,
        name_en='variable1',
        name_es='variable1_es',
        tooltip='Variable 1 tooltip',
        field_type='input',
        value='Value 1'
    )
    
    DocumentVariable.objects.create(
        document=document,
        name_en='variable2',
        name_es='variable2_es',
        tooltip='Variable 2 tooltip',
        field_type='text_area',
        value='Value 2'
    )
    
    return document

@pytest.fixture
def legal_document():
    """Create a test legal document with a file"""
    test_file = SimpleUploadedFile(
        "test_document.pdf", 
        b"file_content", 
        content_type="application/pdf"
    )
    return LegalDocument.objects.create(
        name="Test Legal Document",
        file=test_file
    )

@pytest.mark.django_db
class TestDocumentVariableSerializer:
    
    def test_serialize_document_variable(self, document_with_variables):
        """Test serializing a document variable"""
        variable = document_with_variables.variables.first()
        serializer = DocumentVariableSerializer(variable)
        
        assert serializer.data['name_en'] == variable.name_en
        assert serializer.data['name_es'] == variable.name_es
        assert serializer.data['tooltip'] == variable.tooltip
        assert serializer.data['field_type'] == variable.field_type
        assert serializer.data['value'] == variable.value
    
    def test_deserialize_document_variable(self, document_variable_data):
        """Test deserializing document variable data"""
        serializer = DocumentVariableSerializer(data=document_variable_data)
        
        assert serializer.is_valid()
        assert serializer.validated_data['name_en'] == document_variable_data['name_en']
        assert serializer.validated_data['name_es'] == document_variable_data['name_es']
        assert serializer.validated_data['tooltip'] == document_variable_data['tooltip']
        assert serializer.validated_data['field_type'] == document_variable_data['field_type']
        assert serializer.validated_data['value'] == document_variable_data['value']
    
    def test_invalid_document_variable(self):
        """Test deserializing invalid document variable data"""
        # Invalid field_type value
        invalid_data = {
            'name_en': 'test_variable',
            'name_es': 'variable_prueba',
            'tooltip': 'Test tooltip',
            'field_type': 'invalid_type',
            'value': 'Test value'
        }
        
        serializer = DocumentVariableSerializer(data=invalid_data)
        assert not serializer.is_valid()
        assert 'field_type' in serializer.errors

    def test_number_field_type_requires_numeric_value(self, document_variable_data):
        """Si field_type es number y el valor no es numérico, debe fallar."""
        document_variable_data.update({'field_type': 'number', 'value': 'no-number'})
        serializer = DocumentVariableSerializer(data=document_variable_data)

        assert not serializer.is_valid()
        assert 'value' in serializer.errors

    def test_date_field_type_requires_valid_date(self, document_variable_data):
        """Si field_type es date y el valor no tiene formato YYYY-MM-DD, debe fallar."""
        document_variable_data.update({'field_type': 'date', 'value': '2023/01/01'})
        serializer = DocumentVariableSerializer(data=document_variable_data)

        assert not serializer.is_valid()
        assert 'value' in serializer.errors

    def test_email_field_type_requires_valid_email(self, document_variable_data):
        """Si field_type es email y el valor no es un correo válido, debe fallar."""
        document_variable_data.update({'field_type': 'email', 'value': 'not-an-email'})
        serializer = DocumentVariableSerializer(data=document_variable_data)

        assert not serializer.is_valid()
        assert 'value' in serializer.errors

    def test_select_field_type_requires_non_empty_options(self, document_variable_data):
        """Si field_type es select y no hay opciones, debe fallar."""
        document_variable_data.update({'field_type': 'select'})
        serializer = DocumentVariableSerializer(data=document_variable_data)

        assert not serializer.is_valid()
        assert 'select_options' in serializer.errors

    def test_select_field_type_with_valid_options(self, document_variable_data):
        """field_type select debe aceptar una lista no vacía de opciones."""
        document_variable_data.update({'field_type': 'select', 'select_options': ['opt1', 'opt2']})
        serializer = DocumentVariableSerializer(data=document_variable_data)

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data['select_options'] == ['opt1', 'opt2']

@pytest.mark.django_db
class TestDynamicDocumentSerializer:
    
    def test_serialize_document(self, document_with_variables):
        """Test serializing a document with variables"""
        serializer = DynamicDocumentSerializer(document_with_variables)
        
        assert serializer.data['title'] == document_with_variables.title
        assert serializer.data['content'] == document_with_variables.content
        assert serializer.data['state'] == document_with_variables.state
        assert len(serializer.data['variables']) == 2
        
        variable_names = [var['name_en'] for var in serializer.data['variables']]
        assert 'variable1' in variable_names
        assert 'variable2' in variable_names
    
    def test_create_document_basic_fields(self, document_data, document_variable_data, user):
        """Test creating a document with variables - basic fields"""
        document_data['variables'] = [document_variable_data]
        
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        context = {'request': MockRequest(user)}
        serializer = DynamicDocumentSerializer(data=document_data, context=context)
        
        assert serializer.is_valid()
        document = serializer.save()
        
        assert document.title == document_data['title']
        assert document.content == document_data['content']
        assert document.state == document_data['state']
        assert document.created_by == user

    def test_create_document_variables(self, document_data, document_variable_data, user):
        """Test creating a document with variables - variables creation"""
        document_data['variables'] = [document_variable_data]
        
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        context = {'request': MockRequest(user)}
        serializer = DynamicDocumentSerializer(data=document_data, context=context)
        assert serializer.is_valid()
        document = serializer.save()
        
        assert document.variables.count() == 1
        variable = document.variables.first()
        assert variable.name_en == document_variable_data['name_en']
        assert variable.name_es == document_variable_data['name_es']
        assert variable.value == document_variable_data['value']
    
    def test_update_document(self, document_with_variables, user):
        """Test updating a document and its variables"""
        ev = list(document_with_variables.variables.all())
        update_data = {
            'title': 'Updated Document', 'content': '<p>Updated.</p>', 'state': 'Progress',
            'variables': [
                {'id': ev[0].id, 'name_en': ev[0].name_en, 'name_es': ev[0].name_es, 'tooltip': 'Updated', 'field_type': ev[0].field_type, 'value': 'Updated'},
                {'name_en': 'new_var', 'name_es': 'nueva_var', 'tooltip': 'New', 'field_type': 'input', 'value': 'New'}
            ]
        }
        class MockRequest:
            def __init__(self, u): self.user = u

        serializer = DynamicDocumentSerializer(document_with_variables, data=update_data, partial=True, context={'request': MockRequest(user)})
        assert serializer.is_valid()
        doc = serializer.save()
        assert doc.title == 'Updated Document'
        assert doc.variables.count() == 2

    def test_update_document_variables_changes(self, document_with_variables, user):
        """Test that updating a document correctly modifies variables"""
        existing_variables = list(document_with_variables.variables.all())
        
        update_data = {
            'variables': [
                {
                    'id': existing_variables[0].id,
                    'name_en': existing_variables[0].name_en,
                    'name_es': existing_variables[0].name_es,
                    'tooltip': 'Updated tooltip',
                    'field_type': existing_variables[0].field_type,
                    'value': 'Updated Value'
                },
                {
                    'name_en': 'new_variable',
                    'name_es': 'nueva_variable',
                    'tooltip': 'New variable tooltip',
                    'field_type': 'input',
                    'value': 'New value'
                }
            ]
        }
        
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        context = {'request': MockRequest(user)}
        serializer = DynamicDocumentSerializer(
            document_with_variables, data=update_data, partial=True, context=context
        )
        assert serializer.is_valid()
        updated_document = serializer.save()
        
        # First variable should be updated
        updated_var = updated_document.variables.get(id=existing_variables[0].id)
        assert updated_var.tooltip == 'Updated tooltip'
        assert updated_var.value == 'Updated Value'
        
        # Second variable should be deleted (not found)
        with pytest.raises(DocumentVariable.DoesNotExist):
            updated_document.variables.get(id=existing_variables[1].id)
        
        # New variable should be created
        new_var = updated_document.variables.get(name_en='new_variable')
        assert new_var.name_es == 'nueva_variable'
        assert new_var.value == 'New value'
    
    def test_partial_update_document(self, document_with_variables, user):
        """Test partially updating a document without affecting variables"""
        # Count initial variables
        initial_variable_count = document_with_variables.variables.count()
        
        # Prepare partial update data (no variables included)
        update_data = {
            'title': 'Partially Updated Document',
            'state': 'Completed'
        }
        
        # Create context with request
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        context = {'request': MockRequest(user)}
        serializer = DynamicDocumentSerializer(
            document_with_variables, 
            data=update_data, 
            partial=True,
            context=context
        )
        
        assert serializer.is_valid()
        updated_document = serializer.save()
        
        # Verify only specified fields were updated
        assert updated_document.title == update_data['title']
        assert updated_document.state == update_data['state']
        assert updated_document.content == document_with_variables.content  # Unchanged
        
        # Verify variables were not affected
        assert updated_document.variables.count() == initial_variable_count
    
    def test_invalid_document_data(self):
        """Test deserializing invalid document data"""
        # Missing required field (title)
        invalid_data = {
            'content': '<p>Content without title</p>',
            'state': 'Draft'
        }
        
        serializer = DynamicDocumentSerializer(data=invalid_data)
        assert not serializer.is_valid()
        assert 'title' in serializer.errors

    def test_create_document_with_requires_signature_adds_suffix_and_creates_signatures(self, user):
        """Al requerir firma se agrega sufijo _firma y se crean firmas para creador y firmantes."""

        # Creador abogado
        lawyer = User.objects.create_user(
            email='lawyer@example.com',
            password='testpassword',
            first_name='Law',
            last_name='Yer',
            role='lawyer',
        )

        client = User.objects.create_user(
            email='client@example.com',
            password='testpassword',
            first_name='Cli',
            last_name='Ent',
            role='client',
        )

        data = {
            'title': 'Contrato',
            'content': '<p>Contenido</p>',
            'state': 'Draft',
            'requires_signature': True,
            'signers': [client.id],
        }

        class MockRequest:
            def __init__(self, user):
                self.user = user

        context = {'request': MockRequest(lawyer)}
        serializer = DynamicDocumentSerializer(data=data, context=context)

        assert serializer.is_valid(), serializer.errors
        document = serializer.save()

        # Título con sufijo
        assert document.title == 'Contrato_firma'
        assert document.requires_signature is True

        # Deben existir firmas para el abogado creador y el cliente
        signer_emails = set(document.signatures.values_list('signer__email', flat=True))
        assert signer_emails == {lawyer.email, client.email}

    def test_create_document_with_visibility_and_usability_permissions(self):
        """Crear documento debe generar permisos de visibilidad/usabilidad coherentes."""

        lawyer = User.objects.create_user(
            email='lawyer@example.com',
            password='testpassword',
            role='lawyer',
        )
        client1 = User.objects.create_user(
            email='client1@example.com',
            password='testpassword',
            role='client',
        )
        client2 = User.objects.create_user(
            email='client2@example.com',
            password='testpassword',
            role='client',
        )
        other_lawyer = User.objects.create_user(
            email='otherlawyer@example.com',
            password='testpassword',
            role='lawyer',
        )

        data = {
            'title': 'Doc Permisos',
            'content': '<p>Contenido</p>',
            'state': 'Draft',
            'is_public': False,
            'visibility_user_ids': [client1.id],
            'usability_user_ids': [client1.id, client2.id, other_lawyer.id],
        }

        class MockRequest:
            def __init__(self, user):
                self.user = user

        context = {'request': MockRequest(lawyer)}
        serializer = DynamicDocumentSerializer(data=data, context=context)

        assert serializer.is_valid(), serializer.errors
        document = serializer.save()

        # Permisos de visibilidad: solo client1
        vis_emails = set(document.visibility_permissions.values_list('user__email', flat=True))
        assert vis_emails == {client1.email}

        # Permisos de usabilidad: solo client1 (client2 no tiene visibilidad, abogados se omiten)
        usab_emails = set(document.usability_permissions.values_list('user__email', flat=True))
        assert usab_emails == {client1.email}

@pytest.mark.django_db
class TestDynamicDocumentSerializerExtras:
    def test_tag_serializer_sets_created_by_from_request(self, user):
        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = TagSerializer(
            data={"name": "Important", "color_id": 2},
            context={"request": MockRequest(user)},
        )

        assert serializer.is_valid(), serializer.errors
        tag = serializer.save()

        assert tag.created_by == user

    def test_document_signature_serializer_signer_name_fallback(self):
        creator = User.objects.create_user(
            email="creator@example.com",
            password="testpassword",
            role="lawyer",
        )
        signer = User.objects.create_user(
            email="sig@example.com",
            password="testpassword",
            first_name="",
            last_name="",
        )
        document = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        signature = DocumentSignature.objects.create(document=document, signer=signer)

        serializer = DocumentSignatureSerializer(signature)
        data = serializer.data

        assert data["signer_email"] == signer.email
        assert data["signer_name"] == signer.email

    def test_document_folder_serializer_sets_owner_and_documents(self):
        owner = User.objects.create_user(
            email="owner@example.com",
            password="testpassword",
            role="client",
        )
        document = DynamicDocument.objects.create(
            title="Folder Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=owner,
        )

        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = DocumentFolderSerializer(
            data={"name": "Folder", "color_id": 1, "document_ids": [document.id]},
            context={"request": MockRequest(owner)},
        )

        assert serializer.is_valid(), serializer.errors
        folder = serializer.save()

        assert folder.owner == owner
        assert list(folder.documents.all()) == [document]

        data = DocumentFolderSerializer(folder).data
        assert data["name"] == "Folder"
        assert len(data["documents"]) == 1

    def test_recent_document_serializer_includes_document_data(self):
        viewer = User.objects.create_user(
            email="viewer@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Recent Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=viewer,
        )
        recent = RecentDocument.objects.create(user=viewer, document=document)

        serializer = RecentDocumentSerializer(recent)
        data = serializer.data

        assert data["document"]["id"] == document.id
        assert data["document"]["title"] == document.title

    def test_document_visibility_permission_serializer_full_name(self):
        creator = User.objects.create_user(
            email="creator@example.com",
            password="testpassword",
            first_name="Creator",
            last_name="User",
        )
        viewer = User.objects.create_user(
            email="viewer@example.com",
            password="testpassword",
            first_name="View",
            last_name="Er",
        )
        document = DynamicDocument.objects.create(
            title="Visibility Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        permission = DocumentVisibilityPermission.objects.create(
            document=document,
            user=viewer,
            granted_by=creator,
        )

        serializer = DocumentVisibilityPermissionSerializer(permission)
        data = serializer.data

        assert data["user_email"] == viewer.email
        assert data["user_full_name"] == "View Er"
        assert data["granted_by_email"] == creator.email
        assert data["document_title"] == document.title

    def test_document_usability_permission_serializer_full_name(self):
        creator = User.objects.create_user(
            email="creator@example.com",
            password="testpassword",
            first_name="Creator",
            last_name="User",
        )
        user = User.objects.create_user(
            email="user@example.com",
            password="testpassword",
            first_name="Use",
            last_name="R",
        )
        document = DynamicDocument.objects.create(
            title="Usability Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        DocumentVisibilityPermission.objects.create(
            document=document,
            user=user,
            granted_by=creator,
        )
        permission = DocumentUsabilityPermission.objects.create(
            document=document,
            user=user,
            granted_by=creator,
        )

        serializer = DocumentUsabilityPermissionSerializer(permission)
        data = serializer.data

        assert data["user_email"] == user.email
        assert data["user_full_name"] == "Use R"
        assert data["granted_by_email"] == creator.email
        assert data["document_title"] == document.title

    def test_document_relationship_serializer_sets_created_by(self):
        creator = User.objects.create_user(
            email="rel@example.com",
            password="testpassword",
            first_name="",
            last_name="",
        )
        source = DynamicDocument.objects.create(
            title="Source",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        target = DynamicDocument.objects.create(
            title="Target",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )

        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = DocumentRelationshipSerializer(
            data={"source_document": source.id, "target_document": target.id},
            context={"request": MockRequest(creator)},
        )

        assert serializer.is_valid(), serializer.errors
        relationship = serializer.save()

        data = DocumentRelationshipSerializer(relationship).data
        assert data["created_by"] == creator.id
        assert data["created_by_email"] == creator.email
        assert data["created_by_name"] == creator.email

    def test_document_relationship_serializer_rejects_self_relation(self):
        creator = User.objects.create_user(
            email="rel2@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Self",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )

        serializer = DocumentRelationshipSerializer(
            data={"source_document": document.id, "target_document": document.id}
        )

        assert not serializer.is_valid()
        assert "cannot be related" in str(serializer.errors)

    def test_dynamic_document_serializer_signature_counts_and_ids(self):
        creator = User.objects.create_user(
            email="owner@example.com",
            password="testpassword",
            role="client",
        )
        signer = User.objects.create_user(
            email="signer@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Sign Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
            requires_signature=True,
        )
        DocumentSignature.objects.create(document=document, signer=creator, signed=True)
        DocumentSignature.objects.create(document=document, signer=signer, signed=False)

        serializer = DynamicDocumentSerializer(document)
        data = serializer.data

        assert data["completed_signatures"] == 1
        assert data["total_signatures"] == 2
        assert set(data["signer_ids"]) == {creator.id, signer.id}

    def test_dynamic_document_serializer_get_signers_flags_current_user(self):
        owner = User.objects.create_user(
            email="owner-sign@example.com",
            password="testpassword",
        )
        other = User.objects.create_user(
            email="other-sign@example.com",
            password="testpassword",
            first_name="Other",
            last_name="Signer",
        )
        document = DynamicDocument.objects.create(
            title="Signer Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=owner,
            requires_signature=True,
        )
        signed_at = timezone.now()
        rejected_at = timezone.now()
        DocumentSignature.objects.create(
            document=document,
            signer=owner,
            signed=True,
            signed_at=signed_at,
        )
        DocumentSignature.objects.create(
            document=document,
            signer=other,
            rejected=True,
            rejected_at=rejected_at,
            rejection_comment="Nope",
        )

        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = DynamicDocumentSerializer(
            document,
            context={"request": MockRequest(owner)},
        )
        signers = serializer.get_signers(document)
        by_email = {entry["signer_email"]: entry for entry in signers}

        assert by_email[owner.email]["is_current_user"] is True
        assert by_email[owner.email]["signed"] is True
        assert by_email[other.email]["is_current_user"] is False
        assert by_email[other.email]["rejected"] is True
        assert by_email[other.email]["rejection_comment"] == "Nope"

    def test_dynamic_document_serializer_permission_flags_for_owner(self):
        owner = User.objects.create_user(
            email="perm@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Perm Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=owner,
        )

        class MockRequest:
            def __init__(self, user):
                self.user = user

        serializer = DynamicDocumentSerializer(
            document,
            context={"request": MockRequest(owner)},
        )
        data = serializer.data

        assert data["user_permission_level"] == "owner"
        assert data["can_view"] is True
        assert data["can_edit"] is True
        assert data["can_delete"] is True

    def test_dynamic_document_serializer_relationships_count_without_request(self):
        creator = User.objects.create_user(
            email="relcount@example.com",
            password="testpassword",
        )
        source = DynamicDocument.objects.create(
            title="Rel Source",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        target = DynamicDocument.objects.create(
            title="Rel Target",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        DocumentRelationship.objects.create(
            source_document=source,
            target_document=target,
            created_by=creator,
        )

        serializer = DynamicDocumentSerializer(source)
        data = serializer.data

        assert data["relationships_count"] == 1

    def test_dynamic_document_serializer_summary_counterparty_from_variable(self):
        creator = User.objects.create_user(
            email="summary@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Summary Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        DocumentVariable.objects.create(
            document=document,
            name_en="counterparty",
            field_type="input",
            value="Acme",
            summary_field="counterparty",
        )

        serializer = DynamicDocumentSerializer(document)
        data = serializer.data

        assert data["summary_counterparty"] == "Acme"

    def test_dynamic_document_serializer_summary_counterparty_fallback_assigned(self):
        owner = User.objects.create_user(
            email="owner2@example.com",
            password="testpassword",
        )
        assigned = User.objects.create_user(
            email="assigned@example.com",
            password="testpassword",
            first_name="Assigned",
            last_name="User",
        )
        document = DynamicDocument.objects.create(
            title="Fallback Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=owner,
            assigned_to=assigned,
        )

        serializer = DynamicDocumentSerializer(document)
        data = serializer.data

        assert data["summary_counterparty"] == "Assigned User"

    def test_dynamic_document_serializer_summary_value_and_currency(self):
        creator = User.objects.create_user(
            email="value@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Value Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        DocumentVariable.objects.create(
            document=document,
            name_en="value",
            field_type="number",
            value="123",
            currency="USD",
            summary_field="value",
        )

        serializer = DynamicDocumentSerializer(document)
        data = serializer.data

        assert data["summary_value"] == "123"
        assert data["summary_value_currency"] == "USD"

    def test_dynamic_document_serializer_summary_fields_from_variables(self):
        creator = User.objects.create_user(
            email="summary-fields@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Summary Fields",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        DocumentVariable.objects.create(
            document=document,
            name_en="object",
            field_type="input",
            value="Servicios",
            summary_field="object",
        )
        DocumentVariable.objects.create(
            document=document,
            name_en="term",
            field_type="input",
            value="12 meses",
            summary_field="term",
        )
        DocumentVariable.objects.create(
            document=document,
            name_en="start_date",
            field_type="date",
            value="2025-01-01",
            summary_field="start_date",
        )
        DocumentVariable.objects.create(
            document=document,
            name_en="end_date",
            field_type="date",
            value="2025-12-31",
            summary_field="end_date",
        )

        serializer = DynamicDocumentSerializer(document)
        data = serializer.data

        assert data["summary_object"] == "Servicios"
        assert data["summary_term"] == "12 meses"
        assert data["summary_start_date"] == "2025-01-01"
        assert data["summary_end_date"] == "2025-12-31"

    def test_dynamic_document_serializer_summary_subscription_date_fallback(self):
        creator = User.objects.create_user(
            email="date@example.com",
            password="testpassword",
        )
        document = DynamicDocument.objects.create(
            title="Date Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=creator,
        )
        created_at = timezone.now() - timedelta(days=2)
        DynamicDocument.objects.filter(pk=document.pk).update(created_at=created_at)
        document.refresh_from_db()

        serializer = DynamicDocumentSerializer(document)
        data = serializer.data

        assert data["summary_subscription_date"] == created_at.date().isoformat()


@pytest.mark.django_db

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


@pytest.fixture
def tag(lawyer):
    return Tag.objects.create(name="EdgeTag", created_by=lawyer)


@pytest.fixture
def client_user2():
    return User.objects.create_user(
        email="client2-edge@example.com", password="testpassword",
        first_name="Client2", last_name="Edge", role="client",
    )


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email="basic-edge@example.com", password="testpassword",
        first_name="Basic", last_name="Edge", role="basic",
    )


@pytest.fixture
def normal_client():
    return User.objects.create_user(
        email="normal-client-edge@example.com", password="testpassword",
        first_name="Normal", last_name="Client", role="client",
    )


@pytest.fixture
def document_by_basic(basic_user):
    return DynamicDocument.objects.create(
        title="BasicDoc", content="<p>basic</p>", state="Draft", created_by=basic_user,
    )


# ── DocumentVariableSerializer validation ────────────────────────────────────

@pytest.mark.django_db
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

@pytest.mark.django_db
class TestTagSerializer:
    def test_create_attaches_user(self, lawyer):
        data = {"name": "Urgent", "color_id": 1}
        s = TagSerializer(data=data, context={"request": MockRequest(lawyer)})
        assert s.is_valid(), s.errors
        tag = s.save()
        assert tag.created_by == lawyer
        assert tag.name == "Urgent"


# ── DocumentSignatureSerializer ──────────────────────────────────────────────

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
class TestDynamicDocumentSerializerSignerIds:
    def test_signer_ids(self, lawyer, client_user):
        doc = DynamicDocument.objects.create(
            title="S", content="C", created_by=lawyer, requires_signature=True,
        )
        DocumentSignature.objects.create(document=doc, signer=client_user)
        s = DynamicDocumentSerializer(doc, context={"request": MockRequest(lawyer)})
        assert client_user.id in s.data["signer_ids"]


# ── DynamicDocumentSerializer.get_relationships_count ────────────────────────

@pytest.mark.django_db
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

@pytest.mark.django_db
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


# ── DynamicDocumentSerializer.update ─────────────────────────────────────────

@pytest.mark.django_db
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

@pytest.mark.django_db
class TestRecentDocumentSerializer:
    def test_serializes_nested_document(self, lawyer, document):
        rd = RecentDocument.objects.create(user=lawyer, document=document)
        s = RecentDocumentSerializer(rd, context={"request": MockRequest(lawyer)})
        assert s.data["document"]["title"] == "SerDoc"
        assert "last_visited" in s.data


# ── DocumentFolderSerializer ─────────────────────────────────────────────────

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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

@pytest.mark.django_db
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
        from types import SimpleNamespace
        mock_sig = SimpleNamespace(signer=None)
        
        class MockSignatures:
            def select_related(self, *args):
                return self
            def all(self):
                return [mock_sig]
        
        mock_obj = SimpleNamespace(signatures=MockSignatures())
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
        serializer = DocumentRelationshipSerializer(rel, context={"request": request})
        assert serializer.data["created_by_name"] == lawyer.get_full_name().strip()

    def test_get_created_by_name_no_user(self, document, lawyer, rf):
        """Cover line 784/886: created_by is None → empty string."""
        doc2 = DynamicDocument.objects.create(
            title="Doc3", content="<p>c</p>", state="Progress", created_by=lawyer,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document, target_document=doc2, created_by=lawyer,
        )
        serializer = DocumentRelationshipSerializer(context={"request": rf.get("/")})
        from types import SimpleNamespace
        mock_obj = SimpleNamespace(created_by=None)
        assert serializer.get_created_by_name(mock_obj) == ""

    def test_validate_self_relationship_raises(self, document, rf, lawyer):
        """Cover lines 790-798: self-relationship raises ValidationError."""
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

@pytest.mark.django_db

class TestDynamicDocumentSummarySubscriptionDateNone:
    def test_get_summary_subscription_date_returns_none_when_no_created_at(
        self, lawyer_user
    ):
        """
        get_summary_subscription_date returns None when the document has
        no subscription_date variable and created_at is None (line 402).
        """
        doc = DynamicDocument.objects.create(
            title="No Date",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        # Set created_at to None in-memory after save (auto_now_add)
        doc.created_at = None
        serializer = DynamicDocumentSerializer()

        result = serializer.get_summary_subscription_date(doc)

        assert result is None


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 463-464: exception in creator signature creation
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDynamicDocumentCreateSignatureException:
    def test_create_silently_catches_duplicate_signature_error(self, lawyer_user):
        """
        When creating a document with requires_signature and the creator
        signature creation raises an exception (e.g., IntegrityError),
        it is silently caught (lines 463-464).
        """
        request = factory.post("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            data={
                "title": "Sig Doc",
                "content": "<p>sig</p>",
                "state": "Draft",
                "requires_signature": True,
                "signers": [],
                "variables": [],
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        # Patch DocumentSignature.objects.create to raise on first call
        with patch(
            "gym_app.serializers.dynamic_document.DocumentSignature.objects.create",
            side_effect=Exception("Duplicate signature"),
        ):
            doc = serializer.save()

        # Document should still be created despite the signature error
        assert doc.pk is not None
        assert doc.requires_signature is True
        assert doc.title == "Sig Doc_firma"


# ---------------------------------------------------------------------------
# dynamic_document.py – line 607: visibility permission error in update
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDynamicDocumentUpdateVisibilityError:
    def test_update_visibility_permission_error_is_printed(
        self, document, lawyer_user, basic_user
    ):
        """
        When updating visibility permissions, if get_or_create raises an
        exception, it is caught and printed (line 607 area via line 615-616).
        """
        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document,
            data={
                "title": document.title,
                "content": document.content,
                "state": document.state,
                "visibility_user_ids": [basic_user.pk],
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        with patch(
            "gym_app.models.dynamic_document.DocumentVisibilityPermission.objects.get_or_create",
            side_effect=Exception("DB error"),
        ):
            doc = serializer.save()

        # Document should still be updated despite the permission error
        assert doc.pk == document.pk


# ---------------------------------------------------------------------------
# dynamic_document.py – line 636: usability perm skipped (no visibility)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDynamicDocumentUpdateUsabilityNoVisibility:
    def test_update_usability_skipped_when_user_has_no_visibility(
        self, document, lawyer_user, basic_user
    ):
        """
        When updating usability permissions on a non-public document,
        a user without visibility permission is skipped (lines 639-646).
        """
        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document,
            data={
                "title": document.title,
                "content": document.content,
                "state": document.state,
                "usability_user_ids": [basic_user.pk],
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        doc = serializer.save()

        # The basic_user should NOT have usability permission
        # because they have no visibility permission on non-public doc
        has_usability = DocumentUsabilityPermission.objects.filter(
            document=doc, user=basic_user
        ).exists()
        assert has_usability is False


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 779-784: get_created_by_name
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDocumentRelationshipSerializerGetCreatedByName:
    def test_get_created_by_name_with_full_name(self, document, lawyer_user):
        """
        get_created_by_name returns 'first_name last_name' when
        created_by has a name set (lines 779-783).
        """
        doc2 = DynamicDocument.objects.create(
            title="Target Doc",
            content="<p>y</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document,
            target_document=doc2,
            created_by=lawyer_user,
        )
        serializer = DocumentRelationshipSerializer()

        result = serializer.get_created_by_name(rel)

        assert result == lawyer_user.get_full_name().strip()

    def test_get_created_by_name_falls_back_to_email(self, document):
        """
        get_created_by_name returns email when first/last name are empty
        (line 783 branch).
        """
        no_name_user = User.objects.create_user(
            email="noname_scov@test.com",
            password="pw",
            first_name="",
            last_name="",
            role="client",
        )
        doc2 = DynamicDocument.objects.create(
            title="Target2",
            content="<p>z</p>",
            state="Draft",
            created_by=no_name_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document,
            target_document=doc2,
            created_by=no_name_user,
        )
        serializer = DocumentRelationshipSerializer()

        result = serializer.get_created_by_name(rel)

        assert result == "noname_scov@test.com"

    def test_get_created_by_name_returns_empty_when_no_creator(self, document, lawyer_user):
        """
        get_created_by_name returns '' when created_by is None (line 784).
        created_by FK is NOT NULL at DB level, so we patch the descriptor.
        """
        doc2 = DynamicDocument.objects.create(
            title="Target3",
            content="<p>w</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document,
            target_document=doc2,
            created_by=lawyer_user,
        )
        serializer = DocumentRelationshipSerializer()

        # Temporarily replace the FK descriptor so obj.created_by is None
        with patch.object(DocumentRelationship, "created_by", new=None):
            result = serializer.get_created_by_name(rel)

        assert result == ""


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 790-798: validate self-relationship
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDocumentRelationshipSerializerValidate:
    def test_validate_rejects_self_relationship(self, document):
        """
        validate raises ValidationError when source == target (lines 793-796).
        """
        serializer = DocumentRelationshipSerializer(
            data={
                "source_document": document.pk,
                "target_document": document.pk,
            }
        )

        is_valid = serializer.is_valid()

        assert is_valid is False
        assert "non_field_errors" in serializer.errors


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 805-809: create sets created_by
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDocumentRelationshipSerializerCreate:
    def test_create_sets_created_by_from_request(self, document, lawyer_user):
        """
        create() sets created_by from request.user (lines 805-809).
        """
        doc2 = DynamicDocument.objects.create(
            title="Target Create",
            content="<p>c</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        request = factory.post("/fake/")
        request.user = lawyer_user

        serializer = DocumentRelationshipSerializer(
            data={
                "source_document": document.pk,
                "target_document": doc2.pk,
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        rel = serializer.save()

        assert rel.pk is not None
        assert rel.created_by == lawyer_user


# ---------------------------------------------------------------------------
# organization.py – line 445: create post by non-corporate raises error
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# corporate_request.py – line 198: direct call to validate_corporate_client

@pytest.mark.django_db
class TestDynamicDocumentUpdateVisibilitySkipsCreator:
    def test_update_visibility_skips_document_creator(self, document_by_basic, basic_user, lawyer_user):
        """
        When the document creator (non-lawyer) is included in
        visibility_user_ids, they are skipped at the creator check
        (line 606-607 continue), not the lawyer check.
        """
        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document_by_basic,
            data={
                "title": document_by_basic.title,
                "content": document_by_basic.content,
                "state": document_by_basic.state,
                "visibility_user_ids": [basic_user.pk],  # creator (non-lawyer)
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        doc = serializer.save()

        has_vis = DocumentVisibilityPermission.objects.filter(
            document=doc, user=basic_user
        ).exists()
        # Creator is skipped, so no visibility permission created for them
        assert has_vis is False


# ---------------------------------------------------------------------------
# dynamic_document.py – line 636: creator skipped in usability update
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDynamicDocumentUpdateUsabilitySkipsCreator:
    def test_update_usability_skips_document_creator(
        self, document_by_basic, basic_user, lawyer_user, normal_client
    ):
        """
        When the document creator (non-lawyer) is included in
        usability_user_ids, they are skipped at the creator check
        (line 635-636 continue), not the lawyer check.
        """
        # Grant visibility to normal_client so usability can proceed for them
        from gym_app.models.dynamic_document import (
            DocumentVisibilityPermission,
            DocumentUsabilityPermission,
        )
        DocumentVisibilityPermission.objects.create(
            document=document_by_basic, user=normal_client, granted_by=lawyer_user
        )

        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document_by_basic,
            data={
                "title": document_by_basic.title,
                "content": document_by_basic.content,
                "state": document_by_basic.state,
                "usability_user_ids": [basic_user.pk, normal_client.pk],  # basic_user is creator
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        doc = serializer.save()

        creator_has_usa = DocumentUsabilityPermission.objects.filter(
            document=doc, user=basic_user
        ).exists()
        # Creator (basic_user) is skipped
        assert creator_has_usa is False
        # normal_client with visibility DOES get usability
        other_has_usa = DocumentUsabilityPermission.objects.filter(
            document=doc, user=normal_client
        ).exists()
        assert other_has_usa is True
