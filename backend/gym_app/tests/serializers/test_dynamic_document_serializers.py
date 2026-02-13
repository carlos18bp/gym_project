import pytest
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
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
from gym_app.models.intranet_gym import LegalDocument
from gym_app.serializers.intranet_gym import LegalDocumentSerializer

User = get_user_model()

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
    
    def test_create_document(self, document_data, document_variable_data, user):
        """Test creating a document with variables"""
        # Add variables to document data
        document_data['variables'] = [document_variable_data]
        
        # Create mock request with authenticated user
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        context = {'request': MockRequest(user)}
        serializer = DynamicDocumentSerializer(data=document_data, context=context)
        
        assert serializer.is_valid()
        document = serializer.save()
        
        # Verify document was created with the correct data
        assert document.title == document_data['title']
        assert document.content == document_data['content']
        assert document.state == document_data['state']
        assert document.created_by == user
        
        # Verify variables were created
        assert document.variables.count() == 1
        variable = document.variables.first()
        assert variable.name_en == document_variable_data['name_en']
        assert variable.name_es == document_variable_data['name_es']
        assert variable.value == document_variable_data['value']
    
    def test_update_document(self, document_with_variables, user):
        """Test updating a document and its variables"""
        # Get existing variables to update
        existing_variables = list(document_with_variables.variables.all())
        
        # Prepare update data
        update_data = {
            'title': 'Updated Document',
            'content': '<p>This is an updated document.</p>',
            'state': 'Progress',
            'variables': [
                # Update first variable
                {
                    'id': existing_variables[0].id,
                    'name_en': existing_variables[0].name_en,
                    'name_es': existing_variables[0].name_es,
                    'tooltip': 'Updated tooltip',
                    'field_type': existing_variables[0].field_type,
                    'value': 'Updated Value'
                },
                # Add a new variable
                {
                    'name_en': 'new_variable',
                    'name_es': 'nueva_variable',
                    'tooltip': 'New variable tooltip',
                    'field_type': 'input',
                    'value': 'New value'
                }
                # Note: Second existing variable is not included, so it should be deleted
            ]
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
        
        # Verify document was updated
        assert updated_document.title == update_data['title']
        assert updated_document.content == update_data['content']
        assert updated_document.state == update_data['state']
        
        # Verify variables were updated correctly
        assert updated_document.variables.count() == 2  # One updated, one new, one deleted
        
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
class TestLegalDocumentSerializer:
    
    def test_serialize_legal_document(self, legal_document):
        """Test serialization of a legal document"""
        # Create a simulated request context
        class MockRequest:
            def __init__(self):
                self.scheme = 'http'
                self.host = 'testserver'
            
            def build_absolute_uri(self, url):
                return f"{self.scheme}://{self.host}{url}"
        
        # Create the serializer with the context
        context = {'request': MockRequest()}
        serializer = LegalDocumentSerializer(legal_document, context=context)
        
        # Verify that fields are serialized correctly
        assert serializer.data['id'] == legal_document.id
        assert serializer.data['name'] == legal_document.name
        assert 'file' in serializer.data
        
        # Verify that file_url is an absolute URL
        assert serializer.data['file_url'].startswith('http://testserver')
        assert legal_document.file.name in serializer.data['file_url']
    
    def test_serialize_legal_document_without_request(self, legal_document):
        """Test serialization without a request object in the context"""
        # Create the serializer without a request context
        serializer = LegalDocumentSerializer(legal_document)
        
        # Verify that fields are serialized correctly
        assert serializer.data['id'] == legal_document.id
        assert serializer.data['name'] == legal_document.name
        assert 'file' in serializer.data
        
        # Verify that file_url is a relative URL
        assert not serializer.data['file_url'].startswith('http://')
        assert legal_document.file.name in serializer.data['file_url']
    
    def test_deserialize_legal_document(self):
        """Test deserialization to create a new legal document"""
        # Create a test file
        test_file = SimpleUploadedFile(
            "new_document.pdf", 
            b"new_file_content", 
            content_type="application/pdf"
        )
        
        # Data for deserialization
        data = {
            'name': 'New Legal Document',
            'file': test_file
        }
        
        # Create and validate the serializer
        serializer = LegalDocumentSerializer(data=data)
        assert serializer.is_valid()
        
        # Verify the validated data
        assert serializer.validated_data['name'] == 'New Legal Document'
        assert serializer.validated_data['file'] == test_file
        
        # Save and verify the new document
        legal_document = serializer.save()
        assert legal_document.name == 'New Legal Document'
        assert 'new_document' in legal_document.file.name
    
    def test_update_legal_document(self, legal_document):
        """Test updating an existing legal document"""
        # Original file
        original_file_name = legal_document.file.name
        
        # Create a new file for the update
        update_file = SimpleUploadedFile(
            "updated_document.pdf", 
            b"updated_content", 
            content_type="application/pdf"
        )
        
        # Data for the update
        data = {
            'name': 'Updated Legal Document',
            'file': update_file
        }
        
        # Create and validate the serializer for update
        serializer = LegalDocumentSerializer(legal_document, data=data)
        assert serializer.is_valid()
        
        # Save and verify the update
        updated_document = serializer.save()
        assert updated_document.id == legal_document.id  # Same document
        assert updated_document.name == 'Updated Legal Document'
        assert 'updated_document' in updated_document.file.name
        assert updated_document.file.name != original_file_name
    
    def test_partial_update_legal_document(self, legal_document):
        """Test partial update of a legal document"""
        # Original file
        original_file_name = legal_document.file.name
        
        # Data for partial update (name only)
        data = {
            'name': 'Partially Updated Document'
        }
        
        # Create and validate the serializer for partial update
        serializer = LegalDocumentSerializer(legal_document, data=data, partial=True)
        assert serializer.is_valid()
        
        # Save and verify the partial update
        updated_document = serializer.save()
        assert updated_document.id == legal_document.id  # Same document
        assert updated_document.name == 'Partially Updated Document'
        assert updated_document.file.name == original_file_name  # File unchanged
    
    def test_invalid_document_data(self):
        """Test validation of invalid data"""
        # Data without a file (required field)
        invalid_data = {
            'name': 'Document Without File'
        }
        
        # Verify that validation fails
        serializer = LegalDocumentSerializer(data=invalid_data)
        assert not serializer.is_valid()
        assert 'file' in serializer.errors
