import pytest
import os
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models.legal_request import (
    LegalRequestType, 
    LegalDiscipline, 
    LegalRequestFiles, 
    LegalRequest
)

@pytest.fixture
def legal_request_type():
    """Create a legal request type for testing"""
    return LegalRequestType.objects.create(name="Consultation")

@pytest.fixture
def legal_discipline():
    """Create a legal discipline for testing"""
    return LegalDiscipline.objects.create(name="Corporate Law")

@pytest.fixture
def legal_request_file():
    """Create a legal request file for testing"""
    test_file = SimpleUploadedFile(
        "test_document.pdf",
        b"File content for testing",
        content_type="application/pdf"
    )
    return LegalRequestFiles.objects.create(file=test_file)

@pytest.fixture
def legal_request(legal_request_type, legal_discipline):
    """Create a legal request for testing"""
    return LegalRequest.objects.create(
        first_name="John",
        last_name="Doe",
        email="john.doe@example.com",
        request_type=legal_request_type,
        discipline=legal_discipline,
        description="I need legal advice for my company formation."
    )

@pytest.mark.django_db
class TestLegalRequestType:
    
    def test_create_legal_request_type(self):
        """Test creating a legal request type"""
        request_type = LegalRequestType.objects.create(name="Contract Review")
        
        assert request_type.id is not None
        assert request_type.name == "Contract Review"
    
    def test_unique_name_constraint(self, legal_request_type):
        """Test unique name constraint for legal request types"""
        with pytest.raises(Exception):  # This should raise an exception due to unique constraint
            LegalRequestType.objects.create(name=legal_request_type.name)
    
    def test_str_representation(self, legal_request_type):
        """Test string representation of legal request type"""
        assert str(legal_request_type) == legal_request_type.name

@pytest.mark.django_db
class TestLegalDiscipline:
    
    def test_create_legal_discipline(self):
        """Test creating a legal discipline"""
        discipline = LegalDiscipline.objects.create(name="Family Law")
        
        assert discipline.id is not None
        assert discipline.name == "Family Law"
    
    def test_unique_name_constraint(self, legal_discipline):
        """Test unique name constraint for legal disciplines"""
        with pytest.raises(Exception):  # This should raise an exception due to unique constraint
            LegalDiscipline.objects.create(name=legal_discipline.name)
    
    def test_str_representation(self, legal_discipline):
        """Test string representation of legal discipline"""
        assert str(legal_discipline) == legal_discipline.name

@pytest.mark.django_db
class TestLegalRequestFiles:
    
    def test_create_legal_request_file(self):
        """Test creating a legal request file"""
        test_file = SimpleUploadedFile(
            "new_document.pdf",
            b"New file content",
            content_type="application/pdf"
        )
        
        file_obj = LegalRequestFiles.objects.create(file=test_file)
        
        assert file_obj.id is not None
        assert "new_document" in file_obj.file.name
        assert file_obj.created_at is not None
    
    def test_str_representation(self, legal_request_file):
        """Test string representation of legal request file"""
        file_name = os.path.basename(legal_request_file.file.name)
        assert str(legal_request_file) == file_name

@pytest.mark.django_db
class TestLegalRequest:
    
    def test_create_legal_request(self, legal_request_type, legal_discipline):
        """Test creating a legal request"""
        request = LegalRequest.objects.create(
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            request_type=legal_request_type,
            discipline=legal_discipline,
            description="I need advice on intellectual property."
        )
        
        assert request.id is not None
        assert request.first_name == "Jane"
        assert request.last_name == "Smith"
        assert request.email == "jane.smith@example.com"
        assert request.request_type == legal_request_type
        assert request.discipline == legal_discipline
        assert request.description == "I need advice on intellectual property."
        assert request.created_at is not None
        assert request.files.count() == 0  # No files added yet
    
    def test_add_files_to_legal_request(self, legal_request, legal_request_file):
        """Test adding files to a legal request"""
        # Add the existing file
        legal_request.files.add(legal_request_file)
        
        # Create and add a new file
        new_file = SimpleUploadedFile(
            "additional_document.pdf",
            b"Additional file content",
            content_type="application/pdf"
        )
        new_file_obj = LegalRequestFiles.objects.create(file=new_file)
        legal_request.files.add(new_file_obj)
        
        # Refresh the object from DB
        legal_request.refresh_from_db()
        
        # Verify files were added
        assert legal_request.files.count() == 2
        file_names = [os.path.basename(f.file.name) for f in legal_request.files.all()]
        assert any("test_document" in name for name in file_names)
        assert any("additional_document" in name for name in file_names)
    
    def test_remove_file_from_legal_request(self, legal_request, legal_request_file):
        """Test removing a file from a legal request"""
        # First add the file
        legal_request.files.add(legal_request_file)
        assert legal_request.files.count() == 1
        
        # Now remove the file from the relationship (but not delete the file object)
        legal_request.files.remove(legal_request_file)
        
        # Verify file was removed
        assert legal_request.files.count() == 0
        
        # Verify file object still exists
        assert LegalRequestFiles.objects.filter(id=legal_request_file.id).exists()
    
    def test_str_representation(self, legal_request):
        """Test string representation of legal request"""
        expected = f"{legal_request.first_name} {legal_request.last_name} - {legal_request.request_type.name}"
        assert str(legal_request) == expected
