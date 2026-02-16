import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, LegalDocument
import tempfile
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
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
        
        # Verify the response structure
        assert 'documents' in response.data
        assert 'profile' in response.data
        assert 'lawyers_count' in response.data
        assert 'users_count' in response.data
        
        # Verify documents
        assert len(response.data['documents']) == 3
        document_names = [doc['name'] for doc in response.data['documents']]
        assert 'Document 1' in document_names
        assert 'Document 2' in document_names
        assert 'Document 3' in document_names
        
        # Verify counts
        assert isinstance(response.data['lawyers_count'], int)
        assert isinstance(response.data['users_count'], int)
    
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
        # Original endpoint returns a Spanish success message
        assert response.data['message'] == 'Informe creado y enviado con éxito.'

        # Check that the email was sent
        assert len(mail.outbox) == 1
        # Subject is in Spanish and includes the billing label
        assert 'Cuenta de Cobro/Factura' in mail.outbox[0].subject
        # The contract number should appear somewhere in the rendered email body
        assert 'C123456' in mail.outbox[0].body
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

    @pytest.mark.django_db
    def test_create_report_with_user_email_confirmation(self, api_client, user):
        """Cover the user email confirmation branch (lines 137-144)."""
        api_client.force_authenticate(user=user)
        file1 = SimpleUploadedFile("att.txt", b"data", content_type="text/plain")
        data = {
            'contract': 'C999',
            'initialDate': '2025-01-01',
            'endDate': '2025-12-31',
            'paymentConcept': 'Services',
            'paymentAmount': '500.00',
            'userName': 'Test',
            'userLastName': 'User',
            'userEmail': 'confirm@example.com',
            'files[0]': file1,
        }
        url = reverse('create-report-request')
        response = api_client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED
        # Two emails: one to billing, one confirmation to user
        assert len(mail.outbox) == 2

    @pytest.mark.django_db
    def test_create_report_user_email_as_list(self, api_client, user):
        """Cover the userEmail-as-list branch (lines 111-113)."""
        api_client.force_authenticate(user=user)
        data = {
            'contract': 'C888',
            'initialDate': '2025-01-01',
            'endDate': '2025-12-31',
            'paymentConcept': 'Srv',
            'paymentAmount': '100.00',
            'userName': 'A',
            'userLastName': 'B',
            'userEmail': ['listuser@example.com'],
        }
        url = reverse('create-report-request')
        response = api_client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED

    @pytest.mark.django_db
    def test_create_report_no_files(self, api_client, user):
        """Cover the path with no files attached."""
        api_client.force_authenticate(user=user)
        data = {
            'contract': 'C777',
            'initialDate': '2025-01-01',
            'endDate': '2025-12-31',
            'paymentConcept': 'Srv',
            'paymentAmount': '100.00',
            'userName': 'A',
            'userLastName': 'B',
        }
        url = reverse('create-report-request')
        response = api_client.post(url, data, format='multipart')
        assert response.status_code == status.HTTP_201_CREATED


# ======================================================================
# Tests merged from test_intranet_gym_coverage.py
# ======================================================================

"""Tests for uncovered branches in intranet_gym.py (92%→higher)."""
import pytest
from unittest import mock
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from gym_app.models import User, IntranetProfile
@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_igc@e.com', password='p', role='lawyer',
        first_name='L', last_name='I')


@pytest.mark.django_db
class TestIntranetGymRegressionScenarios:

    def test_list_docs_no_intranet_profile(self, api_client, lawyer):
        """Lines 28-32: no IntranetProfile → profile_data is None."""
        IntranetProfile.objects.all().delete()
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse('list-legal-intranet-documents'))
        assert r.status_code == 200
        assert r.data['profile'] is None

    def test_create_report_user_email_as_list(self, api_client, lawyer):
        """Line 113: userEmail sent as list extracts first element."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch('gym_app.views.intranet_gym.send_template_email'):
            r = api_client.post(
                reverse('create-report-request'),
                {
                    'contract': 'C1', 'initialDate': '2025-01-01',
                    'endDate': '2025-12-31', 'paymentConcept': 'Test',
                    'paymentAmount': '100', 'userName': 'L',
                    'userLastName': 'I',
                    'userEmail': ['law_igc@e.com'],
                },
                format='json')
        assert r.status_code == 201
        assert r.data['message'] == 'Informe creado y enviado con éxito.'

    def test_create_report_exception(self, api_client, lawyer):
        """Lines 156-158: exception during report creation returns 400."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.intranet_gym.send_template_email',
            side_effect=RuntimeError('email failed')
        ):
            r = api_client.post(
                reverse('create-report-request'),
                {'contract': 'C1', 'userName': 'L', 'userLastName': 'I'},
                format='json')
        assert r.status_code == 400
        assert 'error' in r.data
