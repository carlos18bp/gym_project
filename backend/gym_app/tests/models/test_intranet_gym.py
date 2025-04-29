import pytest
import os
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models.intranet_gym import LegalDocument

@pytest.fixture
def sample_pdf():
    """Create a sample PDF file for testing"""
    return SimpleUploadedFile(
        "sample_document.pdf",
        b"PDF file content",
        content_type="application/pdf"
    )

@pytest.fixture
def legal_document(sample_pdf):
    """Create a legal document with a file for testing"""
    return LegalDocument.objects.create(
        name="Sample Legal Document",
        file=sample_pdf
    )

@pytest.mark.django_db
class TestLegalDocument:
    
    def test_create_legal_document(self, sample_pdf):
        """Test creating a legal document"""
        document = LegalDocument.objects.create(
            name="Test Legal Document",
            file=sample_pdf
        )
        
        assert document.id is not None
        assert document.name == "Test Legal Document"
        assert document.file is not None
        assert "sample_document" in document.file.name
        assert document.file.size > 0
    
    def test_update_legal_document(self, legal_document):
        """Test updating a legal document"""
        # Update the name
        legal_document.name = "Updated Legal Document"
        legal_document.save()
        
        # Refresh from database
        legal_document.refresh_from_db()
        
        # Verify changes
        assert legal_document.name == "Updated Legal Document"
    
    def test_update_legal_document_file(self, legal_document):
        """Test updating a legal document's file"""
        # Original file name
        original_file_name = legal_document.file.name
        
        # Create a new file
        new_file = SimpleUploadedFile(
            "new_document.pdf",
            b"New PDF content",
            content_type="application/pdf"
        )
        
        # Update the file
        legal_document.file = new_file
        legal_document.save()
        
        # Refresh from database
        legal_document.refresh_from_db()
        
        # Verify changes
        assert legal_document.file.name != original_file_name
        assert "new_document" in legal_document.file.name
    
    def test_delete_legal_document(self, legal_document):
        """Test deleting a legal document"""
        document_id = legal_document.id
        file_path = legal_document.file.path
        
        # Delete document
        legal_document.delete()
        
        # Verify document was deleted from database
        assert not LegalDocument.objects.filter(id=document_id).exists()
        
        # Note: In a real application, we might also verify that the file is removed from disk
        # but in tests Django doesn't always physically save the files to disk
    
    def test_str_representation(self, legal_document):
        """Test string representation of legal document"""
        assert str(legal_document) == legal_document.name
    
    def test_multiple_legal_documents(self):
        """Test creating multiple legal documents"""
        # Create multiple test files
        test_files = [
            SimpleUploadedFile(
                f"document_{i}.pdf",
                f"Content for document {i}".encode(),
                content_type="application/pdf"
            )
            for i in range(1, 4)  # Create 3 files
        ]
        
        # Create documents with the files
        documents = [
            LegalDocument.objects.create(
                name=f"Legal Document {i}",
                file=test_files[i-1]
            )
            for i in range(1, 4)  # Create 3 documents
        ]
        
        # Verify documents were created
        assert LegalDocument.objects.count() >= 3  # At least 3 (could be more from other tests)
        
        # Verify each document has the correct name
        for i in range(1, 4):
            document = LegalDocument.objects.get(name=f"Legal Document {i}")
            assert document is not None
            assert f"document_{i}" in document.file.name
