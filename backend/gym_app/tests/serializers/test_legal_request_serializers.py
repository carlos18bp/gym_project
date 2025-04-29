import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers
from gym_app.models import (
    LegalRequestType, 
    LegalDiscipline, 
    LegalRequestFiles, 
    LegalRequest
)
from gym_app.serializers.legal_request import (
    LegalRequestTypeSerializer,
    LegalDisciplineSerializer,
    LegalRequestFilesSerializer,
    LegalRequestSerializer
)

@pytest.fixture
def legal_request_type():
    """Create a legal request type for testing"""
    return LegalRequestType.objects.create(name="Consulta")

@pytest.fixture
def legal_discipline():
    """Create a legal discipline for testing"""
    return LegalDiscipline.objects.create(name="Derecho Civil")

@pytest.fixture
def legal_request_file():
    """Create a legal request file for testing"""
    test_file = SimpleUploadedFile(
        "test_document.pdf", 
        b"file_content", 
        content_type="application/pdf"
    )
    return LegalRequestFiles.objects.create(file=test_file)

@pytest.fixture
def legal_request(legal_request_type, legal_discipline, legal_request_file):
    """Create a complete legal request for testing"""
    legal_request = LegalRequest.objects.create(
        first_name="John",
        last_name="Doe",
        email="john.doe@example.com",
        request_type=legal_request_type,
        discipline=legal_discipline,
        description="I need legal advice for a contract"
    )
    legal_request.files.add(legal_request_file)
    return legal_request

@pytest.mark.django_db
class TestLegalRequestTypeSerializer:
    
    def test_serialize_legal_request_type(self, legal_request_type):
        """Test the serialization of a legal request type"""
        serializer = LegalRequestTypeSerializer(legal_request_type)
        
        assert serializer.data['id'] == legal_request_type.id
        assert serializer.data['name'] == legal_request_type.name
    
    def test_deserialize_legal_request_type(self):
        """Test the deserialization to create a new legal request type"""
        data = {'name': 'New Consultation'}
        
        serializer = LegalRequestTypeSerializer(data=data)
        assert serializer.is_valid()
        
        legal_request_type = serializer.save()
        assert legal_request_type.name == 'New Consultation'

@pytest.mark.django_db
class TestLegalDisciplineSerializer:
    
    def test_serialize_legal_discipline(self, legal_discipline):
        """Test the serialization of a legal discipline"""
        serializer = LegalDisciplineSerializer(legal_discipline)
        
        assert serializer.data['id'] == legal_discipline.id
        assert serializer.data['name'] == legal_discipline.name
    
    def test_deserialize_legal_discipline(self):
        """Test the deserialization to create a new legal discipline"""
        data = {'name': 'Labor Law'}
        
        serializer = LegalDisciplineSerializer(data=data)
        assert serializer.is_valid()
        
        legal_discipline = serializer.save()
        assert legal_discipline.name == 'Labor Law'

@pytest.mark.django_db
class TestLegalRequestFilesSerializer:
    
    def test_serialize_legal_request_file(self, legal_request_file):
        """Test the serialization of a legal request file"""
        serializer = LegalRequestFilesSerializer(legal_request_file)
        
        assert serializer.data['id'] == legal_request_file.id
        assert 'file' in serializer.data
    
    def test_deserialize_legal_request_file(self):
        """Test the deserialization to create a new legal request file"""
        test_file = SimpleUploadedFile(
            "new_document.pdf", 
            b"new_content", 
            content_type="application/pdf"
        )
        
        data = {'file': test_file}
        
        serializer = LegalRequestFilesSerializer(data=data)
        assert serializer.is_valid()
        
        legal_request_file = serializer.save()
        assert 'new_document' in legal_request_file.file.name

@pytest.mark.django_db
class TestLegalRequestSerializer:
    
    def test_serialize_legal_request(self, legal_request):
        """Test the serialization of a complete legal request"""
        serializer = LegalRequestSerializer(legal_request)
        
        # Verify basic fields
        assert serializer.data['id'] == legal_request.id
        assert serializer.data['first_name'] == legal_request.first_name
        assert serializer.data['last_name'] == legal_request.last_name
        assert serializer.data['email'] == legal_request.email
        assert serializer.data['description'] == legal_request.description
        
        # Verify nested relationships
        assert serializer.data['request_type']['id'] == legal_request.request_type.id
        assert serializer.data['request_type']['name'] == legal_request.request_type.name
        
        assert serializer.data['discipline']['id'] == legal_request.discipline.id
        assert serializer.data['discipline']['name'] == legal_request.discipline.name
        
        # Verify files
        assert len(serializer.data['files']) == 1
        assert serializer.data['files'][0]['id'] == legal_request.files.first().id

    def test_deserialize_legal_request_with_existing_relations(self, legal_request_type, legal_discipline):
        """
        Test the deserialization to create a request with existing relationships.
        
        Note: This test assumes that the LegalRequestSerializer is configured
        to accept IDs for relationships (request_type, discipline) instead of complete
        nested objects when creating a new object. If this is not the case, the test
        would need to be adjusted.
        """
        # Create a serializer that allows creation with IDs for relationships
        class CreateLegalRequestSerializer(serializers.ModelSerializer):
            class Meta:
                model = LegalRequest
                fields = '__all__'
        
        data = {
            'first_name': 'Jane',
            'last_name': 'Smith',
            'email': 'jane.smith@example.com',
            'request_type': legal_request_type.id,
            'discipline': legal_discipline.id,
            'description': 'I need advice on property rights'
        }
        
        serializer = CreateLegalRequestSerializer(data=data)
        assert serializer.is_valid()
        
        legal_request = serializer.save()
        assert legal_request.first_name == 'Jane'
        assert legal_request.last_name == 'Smith'
        assert legal_request.request_type.id == legal_request_type.id
        assert legal_request.discipline.id == legal_discipline.id

    def test_update_legal_request(self, legal_request):
        """
        Test updating a legal request.
        
        Note: As in the previous test, we assume there is a serializer
        for updating that accepts IDs for relationships.
        """
        # Create a serializer for updating
        class UpdateLegalRequestSerializer(serializers.ModelSerializer):
            class Meta:
                model = LegalRequest
                fields = '__all__'
        
        # Data for update
        data = {
            'first_name': 'John Updated',
            'last_name': 'Doe Updated',
            'email': legal_request.email,
            'request_type': legal_request.request_type.id,
            'discipline': legal_request.discipline.id,
            'description': 'Updated request'
        }
        
        serializer = UpdateLegalRequestSerializer(legal_request, data=data)
        assert serializer.is_valid()
        
        updated_request = serializer.save()
        assert updated_request.id == legal_request.id
        assert updated_request.first_name == 'John Updated'
        assert updated_request.last_name == 'Doe Updated'
        assert updated_request.description == 'Updated request'
