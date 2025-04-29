import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, LegalDocument
import tempfile
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile

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
def legal_documents():
    """Create test legal documents for testing"""
    # Create a test file for each document
    test_file1 = SimpleUploadedFile(
        "test_document1.txt", 
        b"file_content", 
        content_type="text/plain"
    )
    test_file2 = SimpleUploadedFile(
        "test_document2.txt", 
        b"file_content2", 
        content_type="text/plain"
    )
    test_file3 = SimpleUploadedFile(
        "test_document3.txt", 
        b"file_content3", 
        content_type="text/plain"
    )
    
    documents = [
        LegalDocument.objects.create(
            name='Document 1',
            file=test_file1
        ),
        LegalDocument.objects.create(
            name='Document 2',
            file=test_file2
        ),
        LegalDocument.objects.create(
            name='Document 3',
            file=test_file3
        )
    ]
    return documents

@pytest.mark.django_db
class TestIntranetGymViews:
    
    def test_list_legal_intranet_documents_authenticated(self, api_client, user, legal_documents):
        """
        Test that authenticated users can retrieve a list of legal documents.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('list-legal-intranet-documents')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3
        
        # Verify the returned data
        document_names = [doc['name'] for doc in response.data]
        assert 'Document 1' in document_names
        assert 'Document 2' in document_names
        assert 'Document 3' in document_names
    
    def test_list_legal_intranet_documents_unauthenticated(self, api_client, legal_documents):
        """
        Test that unauthenticated users cannot access the legal documents list.
        """
        url = reverse('list-legal-intranet-documents')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

class TestCreateReport:
    
    @pytest.mark.django_db
    def test_create_report_success(self, api_client, user):
        """
        Test successful report creation with file uploads.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create test files
        file1 = SimpleUploadedFile(
            "test_file1.txt", 
            b"file_content", 
            content_type="text/plain"
        )
        file2 = SimpleUploadedFile(
            "test_file2.txt", 
            b"file_content2", 
            content_type="text/plain"
        )
        
        # Create the payload
        data = {
            'contract': 'C123456',
            'initialDate': '2023-01-01',
            'endDate': '2023-12-31',
            'paymentConcept': 'Monthly Services',
            'paymentAmount': '1000.00',
            'files[0]': file1,
            'files[1]': file2
        }
        
        # Make the request - Correct the endpoint name
        url = reverse('create-report-request')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['message'] == 'Report successfully created and sent.'
        
        # Check that the email was sent
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == 'New Report Request'
        assert 'Contract Number: C123456' in mail.outbox[0].body
        assert len(mail.outbox[0].attachments) == 2
    
    @pytest.mark.django_db
    def test_create_report_unauthenticated(self, api_client):
        """
        Test that unauthenticated users cannot create reports.
        """
        # Correct the endpoint name
        url = reverse('create-report-request')
        response = api_client.post(url, {}, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
