# backend/gym_app/tests/views/test_dynamic_document.py

import pytest
import io
import json
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, DynamicDocument, DocumentVariable

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword'
    )

@pytest.fixture
def sample_document(user):
    """Create a sample dynamic document for testing"""
    document = DynamicDocument.objects.create(
        title="Test Document",
        content="<p>This is a test document with {{variable1}} and {{variable2}}.</p>",
        state="Draft",
        created_by=user
    )
    
    # Create variables for the document
    DocumentVariable.objects.create(
        document=document,
        name_en="variable1",
        value="Value 1"
    )
    
    DocumentVariable.objects.create(
        document=document,
        name_en="variable2",
        value="Value 2"
    )
    
    return document

@pytest.mark.django_db
class TestDynamicDocumentViews:
    
    def test_list_dynamic_documents_authenticated(self, api_client, user, sample_document):
        """Test retrieving a list of dynamic documents when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('list_dynamic_documents')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['title'] == "Test Document"
        assert response.data[0]['state'] == "Draft"
    
    def test_list_dynamic_documents_unauthenticated(self, api_client, sample_document):
        """Test that unauthenticated users cannot access the document list"""
        url = reverse('list_dynamic_documents')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_dynamic_document_authenticated(self, api_client, user):
        """Test creating a new dynamic document when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create document data
        data = {
            "title": "New Document",
            "content": "<p>This is a new document with {{variable1}}.</p>",
            "state": "Draft",
            "variables": [
                {
                    "name_en": "variable1",
                    "value": "Test Value"
                }
            ]
        }
        
        # Make the request
        url = reverse('create_dynamic_document')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == "New Document"
        
        # Verify document was created in the database
        assert DynamicDocument.objects.count() == 1
        document = DynamicDocument.objects.first()
        assert document.title == "New Document"
        assert document.created_by == user
        
        # Verify variable was created
        assert document.variables.count() == 1
        variable = document.variables.first()
        assert variable.name_en == "variable1"
        assert variable.value == "Test Value"
    
    def test_update_dynamic_document_authenticated(self, api_client, user, sample_document):
        """Test updating an existing dynamic document when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create update data
        data = {
            "title": "Updated Document",
            "content": "<p>This is the updated content.</p>",
            "state": "Progress",
            "variables": [
                {
                    "name_en": "variable1",
                    "value": "Updated Value 1"
                },
                {
                    "name_en": "variable2",
                    "value": "Updated Value 2"
                }
            ]
        }
        
        # Make the request
        url = reverse('update_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.put(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == "Updated Document"
        assert response.data['state'] == "Progress"
        
        # Verify document was updated in the database
        sample_document.refresh_from_db()
        assert sample_document.title == "Updated Document"
        assert sample_document.state == "Progress"
        
        # Verify variables were updated
        variables = {var.name_en: var.value for var in sample_document.variables.all()}
        assert variables["variable1"] == "Updated Value 1"
        assert variables["variable2"] == "Updated Value 2"
    
    def test_delete_dynamic_document_authenticated(self, api_client, user, sample_document):
        """Test deleting a dynamic document when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('delete_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.delete(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response.data['detail'] == "Dynamic document deleted successfully."
        
        # Verify document was deleted from the database
        assert DynamicDocument.objects.count() == 0

@pytest.mark.django_db
class TestDynamicDocumentExport:
    
    def test_download_dynamic_document_pdf_authenticated(self, api_client, user, sample_document, monkeypatch):
        """Test downloading a dynamic document as PDF when authenticated"""
        # Mock the pisa.CreatePDF function to avoid actual PDF creation
        class MockPisaStatus:
            err = False
            
        def mock_create_pdf(*args, **kwargs):
            return MockPisaStatus()
            
        monkeypatch.setattr('xhtml2pdf.pisa.CreatePDF', mock_create_pdf)
        
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('download_dynamic_document_pdf', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/pdf'
        assert response['Content-Disposition'] == f'attachment; filename="{sample_document.title}.pdf"'
    
    def test_download_dynamic_document_word_authenticated(self, api_client, user, sample_document, monkeypatch):
        """Test downloading a dynamic document as Word when authenticated"""
        # Create a mock for Document.save
        class MockDocument:
            def __init__(self):
                self.styles = {
                    'Normal': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading1': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading2': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading3': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading4': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading5': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading6': type('Style', (), {'font': type('Font', (), {'name': None})})
                }
                
            def add_paragraph(self, *args, **kwargs):
                return type('Paragraph', (), {
                    'runs': [],
                    'add_run': lambda text: type('Run', (), {'font': type('Font', (), {'name': None})}),
                    'alignment': None,
                    'paragraph_format': type('ParagraphFormat', (), {'left_indent': None, 'line_spacing': None})
                })
                
            def add_heading(self, *args, **kwargs):
                return type('Heading', (), {
                    'runs': [type('Run', (), {'font': type('Font', (), {'name': None})})],
                })
                
            def save(self, *args, **kwargs):
                pass
        
        # Replace Document with our mock
        monkeypatch.setattr('docx.Document', lambda: MockDocument())
        
        # Create a mock for get_template
        def mock_get_template(*args, **kwargs):
            return type('Template', (), {
                'render': lambda context: f'<html><body>{context["content"]}</body></html>'
            })
        
        monkeypatch.setattr('django.template.loader.get_template', mock_get_template)
        
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('download_dynamic_document_word', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        assert response['Content-Disposition'] == f'attachment; filename="{sample_document.title}.docx"'
    
    def test_document_download_unauthenticated(self, api_client, sample_document):
        """Test that unauthenticated users cannot download documents"""
        # Try PDF download
        pdf_url = reverse('download_dynamic_document_pdf', kwargs={'pk': sample_document.pk})
        pdf_response = api_client.get(pdf_url)
        assert pdf_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Try Word download
        word_url = reverse('download_dynamic_document_word', kwargs={'pk': sample_document.pk})
        word_response = api_client.get(word_url)
        assert word_response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_download_nonexistent_document(self, api_client, user):
        """Test trying to download a document that doesn't exist"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Try PDF download with non-existent ID
        pdf_url = reverse('download_dynamic_document_pdf', kwargs={'pk': 9999})
        pdf_response = api_client.get(pdf_url)
        assert pdf_response.status_code == status.HTTP_404_NOT_FOUND
        
        # Try Word download with non-existent ID
        word_url = reverse('download_dynamic_document_word', kwargs={'pk': 9999})
        word_response = api_client.get(word_url)
        assert word_response.status_code == status.HTTP_404_NOT_FOUND