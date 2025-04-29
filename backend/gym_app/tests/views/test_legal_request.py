import pytest
import json
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles

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
def legal_request_type():
    return LegalRequestType.objects.create(
        name='Consultation'
    )

@pytest.fixture
def legal_discipline():
    return LegalDiscipline.objects.create(
        name='Corporate Law'
    )

@pytest.fixture
def legal_request(legal_request_type, legal_discipline):
    return LegalRequest.objects.create(
        first_name='John',
        last_name='Doe',
        email='john.doe@example.com',
        request_type=legal_request_type,
        discipline=legal_discipline,
        description='I need legal advice for my company.'
    )

@pytest.mark.django_db
class TestLegalRequestViews:
    
    def test_create_legal_request_authenticated(self, api_client, user, legal_request_type, legal_discipline):
        """
        Test creating a new legal request when authenticated.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data
        main_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'jane.smith@example.com',
            'requestTypeId': legal_request_type.id,
            'disciplineId': legal_discipline.id,
            'description': 'I need legal advice regarding intellectual property.'
        }
        
        # Make the request
        url = reverse('create-legal-request')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['first_name'] == 'Jane'
        assert response.data['last_name'] == 'Smith'
        assert response.data['email'] == 'jane.smith@example.com'
        assert response.data['description'] == 'I need legal advice regarding intellectual property.'
        
        # Verify the legal request was created in the database
        assert LegalRequest.objects.count() == 1
        legal_request = LegalRequest.objects.first()
        assert legal_request.first_name == 'Jane'
        assert legal_request.last_name == 'Smith'
        assert legal_request.request_type.id == legal_request_type.id
        assert legal_request.discipline.id == legal_discipline.id
    
    def test_create_legal_request_invalid_type(self, api_client, user, legal_discipline):
        """
        Test creating a legal request with an invalid request type ID.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data with an invalid request type ID
        main_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'jane.smith@example.com',
            'requestTypeId': 9999,  # Invalid ID
            'disciplineId': legal_discipline.id,
            'description': 'I need legal advice regarding intellectual property.'
        }
        
        # Make the request
        url = reverse('create-legal-request')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Request type not found' in response.data['detail']
        
        # Verify no legal request was created
        assert LegalRequest.objects.count() == 0
    
    def test_create_legal_request_invalid_discipline(self, api_client, user, legal_request_type):
        """
        Test creating a legal request with an invalid discipline ID.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data with an invalid discipline ID
        main_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'jane.smith@example.com',
            'requestTypeId': legal_request_type.id,
            'disciplineId': 9999,  # Invalid ID
            'description': 'I need legal advice regarding intellectual property.'
        }
        
        # Make the request
        url = reverse('create-legal-request')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Discipline not found' in response.data['detail']
        
        # Verify no legal request was created
        assert LegalRequest.objects.count() == 0

    def test_upload_legal_request_file(self, api_client, user, legal_request):
        """
        Test uploading a file to an existing legal request.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)

        # Create a test file
        test_file = SimpleUploadedFile(
            "test_file.txt",
            b"This is a test file content",
            content_type="text/plain"
        )

        # Prepare the data
        data = {
            'legalRequestId': legal_request.id,
            'file': test_file
        }

        # Make the request
        url = reverse('upload-legal-request-file')
        response = api_client.post(url, data, format='multipart')

        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['detail'] == 'File uploaded successfully.'

        # Verify the file was associated with the legal request
        legal_request.refresh_from_db()
        assert legal_request.files.count() == 1
        
        # Verify file name more flexibly
        file_name = legal_request.files.first().file.name
        assert 'test_file' in file_name
        assert file_name.endswith('.txt')

    def test_upload_file_to_nonexistent_request(self, api_client, user):
        """
        Test uploading a file to a non-existent legal request.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create a test file
        test_file = SimpleUploadedFile(
            "test_file.txt", 
            b"This is a test file content", 
            content_type="text/plain"
        )
        
        # Prepare the data with a non-existent legal request ID
        data = {
            'legalRequestId': 9999,  # Non-existent ID
            'file': test_file
        }
        
        # Make the request
        url = reverse('upload-legal-request-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Legal request not found' in response.data['detail']
        
        # Verify no files were created
        assert LegalRequestFiles.objects.count() == 0
    
    def test_upload_file_without_file(self, api_client, user, legal_request):
        """
        Test uploading without providing a file.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data without a file
        data = {
            'legalRequestId': legal_request.id
            # No file provided
        }
        
        # Make the request
        url = reverse('upload-legal-request-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'No file provided' in response.data['detail']
        
        # Verify no files were associated with the legal request
        legal_request.refresh_from_db()
        assert legal_request.files.count() == 0
    
    def test_get_dropdown_options(self, api_client, user, legal_request_type, legal_discipline):
        """
        Test retrieving dropdown options for legal request types and disciplines.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('get-dropdown-options')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'legal_request_types' in response.data
        assert 'legal_disciplines' in response.data
        
        # Verify the content of the response
        assert len(response.data['legal_request_types']) == 1
        assert response.data['legal_request_types'][0]['name'] == 'Consultation'
        
        assert len(response.data['legal_disciplines']) == 1
        assert response.data['legal_disciplines'][0]['name'] == 'Corporate Law'
    
    def test_unauthenticated_access(self, api_client, legal_request_type, legal_discipline):
        """
        Test that unauthenticated users cannot access the legal request endpoints.
        """
        # Test create legal request
        create_url = reverse('create-legal-request')
        create_response = api_client.post(create_url, {}, format='multipart')
        assert create_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test upload file
        upload_url = reverse('upload-legal-request-file')
        upload_response = api_client.post(upload_url, {}, format='multipart')
        assert upload_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test get dropdown options
        options_url = reverse('get-dropdown-options')
        options_response = api_client.get(options_url)
        assert options_response.status_code == status.HTTP_401_UNAUTHORIZED
