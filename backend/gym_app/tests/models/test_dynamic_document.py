import pytest
from django.core.exceptions import ValidationError
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable
from gym_app.models.user import User

@pytest.fixture
def user():
    """Create a user for testing"""
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword',
        first_name='Test',
        last_name='User'
    )

@pytest.fixture
def document(user):
    """Create a dynamic document for testing"""
    return DynamicDocument.objects.create(
        title='Test Document',
        content='<p>This is a test document with {{variable1}} and {{variable2}}.</p>',
        state='Draft',
        created_by=user
    )

@pytest.fixture
def document_variable(document):
    """Create a document variable for testing"""
    return DocumentVariable.objects.create(
        document=document,
        name_en='variable1',
        name_es='variable1_es',
        tooltip='Variable 1 tooltip',
        field_type='input',
        value='Test Value'
    )

@pytest.mark.django_db
class TestDynamicDocument:
    
    def test_create_document(self, user):
        """Test creating a dynamic document"""
        document = DynamicDocument.objects.create(
            title='New Document',
            content='<p>Content with {{variable}}.</p>',
            state='Draft',
            created_by=user
        )
        
        assert document.id is not None
        assert document.title == 'New Document'
        assert document.content == '<p>Content with {{variable}}.</p>'
        assert document.state == 'Draft'
        assert document.created_by == user
        assert document.created_at is not None
        assert document.updated_at is not None
        
    def test_document_state_choices(self, document):
        """Test document state choices validation"""
        # Valid state update
        document.state = 'Published'
        document.save()
        document.refresh_from_db()
        assert document.state == 'Published'
        
        # Valid state update
        document.state = 'Progress'
        document.save()
        document.refresh_from_db()
        assert document.state == 'Progress'
        
        # Valid state update
        document.state = 'Completed'
        document.save()
        document.refresh_from_db()
        assert document.state == 'Completed'
        
    def test_document_str_representation(self, document):
        """Test string representation of document"""
        assert str(document) == document.title
    
    def test_document_assign_to_user(self, document, user):
        """Test assigning document to a user"""
        another_user = User.objects.create_user(
            email='another@example.com',
            password='anotherpassword',
            first_name='Another',
            last_name='User'
        )
        
        document.assigned_to = another_user
        document.save()
        document.refresh_from_db()
        
        assert document.assigned_to == another_user
        assert document.assigned_to.email == 'another@example.com'

@pytest.mark.django_db
class TestDocumentVariable:
    
    def test_create_document_variable(self, document):
        """Test creating a document variable"""
        variable = DocumentVariable.objects.create(
            document=document,
            name_en='new_variable',
            name_es='nueva_variable',
            tooltip='New variable tooltip',
            field_type='text_area',
            value='New Test Value'
        )
        
        assert variable.id is not None
        assert variable.name_en == 'new_variable'
        assert variable.name_es == 'nueva_variable'
        assert variable.tooltip == 'New variable tooltip'
        assert variable.field_type == 'text_area'
        assert variable.value == 'New Test Value'
        assert variable.document == document
    
    def test_document_variable_field_type_choices(self, document_variable):
        """Test document variable field type choices validation"""
        # Valid field type update
        document_variable.field_type = 'text_area'
        document_variable.save()
        document_variable.refresh_from_db()
        assert document_variable.field_type == 'text_area'
        
        # Valid field type update
        document_variable.field_type = 'input'
        document_variable.save()
        document_variable.refresh_from_db()
        assert document_variable.field_type == 'input'
    
    def test_document_variable_str_representation(self, document_variable):
        """Test string representation of document variable"""
        assert str(document_variable) == document_variable.name_en
    
    def test_document_with_multiple_variables(self, document, document_variable):
        """Test a document with multiple variables"""
        # Create multiple variables for the document
        variables = [
            DocumentVariable.objects.create(
                document=document,
                name_en=f'variable{i}',
                name_es=f'variable{i}_es',
                tooltip=f'Variable {i} tooltip',
                field_type='input' if i % 2 == 0 else 'text_area',
                value=f'Value {i}'
            )
            for i in range(1, 4)  # Create 3 variables
        ]
        
        # Verify the variables were created and associated with the document
        document_variables = document.variables.all()
        assert document_variables.count() == 4  # 3 new + 1 from fixture
        
        # Verify each variable has correct data
        variable_names = [var.name_en for var in document_variables]
        assert document_variable.name_en in variable_names
        for i in range(1, 4):
            assert f'variable{i}' in variable_names
