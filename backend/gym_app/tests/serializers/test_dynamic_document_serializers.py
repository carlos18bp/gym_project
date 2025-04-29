import pytest
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable
from gym_app.serializers.dynamic_document import DynamicDocumentSerializer, DocumentVariableSerializer
from django.core.files.uploadedfile import SimpleUploadedFile
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
