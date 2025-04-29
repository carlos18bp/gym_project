import pytest
import json
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, Process, Stage, Case, CaseFile

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def client_user():
    return User.objects.create_user(
        email='client@example.com',
        password='testpassword',
        role='Client'
    )

@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email='lawyer@example.com',
        password='testpassword',
        role='Lawyer'
    )

@pytest.fixture
def admin_user():
    return User.objects.create_user(
        email='admin@example.com',
        password='testpassword',
        role='Admin'
    )

@pytest.fixture
def case_type():
    return Case.objects.create(type='Criminal')

@pytest.fixture
def stage():
    return Stage.objects.create(status='In Progress')

@pytest.fixture
def process(client_user, lawyer_user, case_type, stage):
    process = Process.objects.create(
        authority='Supreme Court',
        plaintiff='John Smith',
        defendant='Jane Doe',
        ref='CASE-123',
        client=client_user,
        lawyer=lawyer_user,
        case=case_type,
        subcase='Theft'
    )
    process.stages.add(stage)
    return process

@pytest.fixture
def case_file():
    test_file = SimpleUploadedFile(
        "test_file.txt", 
        b"This is a test file content", 
        content_type="text/plain"
    )
    return CaseFile.objects.create(file=test_file)

@pytest.mark.django_db
class TestProcessViews:
    
    def test_process_list_client(self, api_client, client_user, process):
        """Test that a client can only see their own processes"""
        # Authenticate as client
        api_client.force_authenticate(user=client_user)
        
        # Make the request
        url = reverse('process-list')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['ref'] == 'CASE-123'
        
        # Create another process with a different client
        other_client = User.objects.create_user(
            email='other.client@example.com',
            password='testpassword',
            role='Client'
        )
        other_process = Process.objects.create(
            authority='District Court',
            plaintiff='Other Person',
            defendant='Another Person',
            ref='CASE-456',
            client=other_client,
            lawyer=process.lawyer,
            case=process.case
        )
        
        # Make the request again
        response = api_client.get(url)
        
        # Client should still only see their process
        assert len(response.data) == 1
        assert response.data[0]['ref'] == 'CASE-123'
    
    def test_process_list_lawyer(self, api_client, lawyer_user, process):
        """Test that a lawyer can only see processes they are assigned to"""
        # Authenticate as lawyer
        api_client.force_authenticate(user=lawyer_user)
        
        # Make the request
        url = reverse('process-list')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['ref'] == 'CASE-123'
        
        # Create another process with a different lawyer
        other_lawyer = User.objects.create_user(
            email='other.lawyer@example.com',
            password='testpassword',
            role='Lawyer'
        )
        other_process = Process.objects.create(
            authority='District Court',
            plaintiff='Other Person',
            defendant='Another Person',
            ref='CASE-456',
            client=process.client,
            lawyer=other_lawyer,
            case=process.case
        )
        
        # Make the request again
        response = api_client.get(url)
        
        # Lawyer should still only see their process
        assert len(response.data) == 1
        assert response.data[0]['ref'] == 'CASE-123'
    
    def test_process_list_admin(self, api_client, admin_user, process):
        """Test that an admin can see all processes"""
        # Authenticate as admin
        api_client.force_authenticate(user=admin_user)
        
        # Make the request
        url = reverse('process-list')
        response = api_client.get(url)
        
        # Assert the response - admin sees the one process
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        
        # Create another process
        other_client = User.objects.create_user(
            email='other.client@example.com',
            password='testpassword',
            role='Client'
        )
        other_lawyer = User.objects.create_user(
            email='other.lawyer@example.com',
            password='testpassword',
            role='Lawyer'
        )
        other_process = Process.objects.create(
            authority='District Court',
            plaintiff='Other Person',
            defendant='Another Person',
            ref='CASE-456',
            client=other_client,
            lawyer=other_lawyer,
            case=process.case
        )
        
        # Make the request again
        response = api_client.get(url)
        
        # Admin should see both processes
        assert len(response.data) == 2
        refs = [p['ref'] for p in response.data]
        assert 'CASE-123' in refs
        assert 'CASE-456' in refs
    
    def test_create_process(self, api_client, admin_user, client_user, lawyer_user, case_type):
        """Test creating a new process"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Prepare the data
        main_data = {
            'authority': 'Federal Court',
            'plaintiff': 'Company Inc.',
            'defendant': 'Other Company LLC',
            'ref': 'CASE-789',
            'clientId': client_user.id,
            'lawyerId': lawyer_user.id,
            'caseTypeId': case_type.id,
            'subcase': 'Contract Dispute',
            'stages': [
                {'status': 'New'},
                {'status': 'Analysis'}
            ]
        }
        
        # Make the request
        url = reverse('create-process')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['authority'] == 'Federal Court'
        assert response.data['plaintiff'] == 'Company Inc.'
        assert response.data['defendant'] == 'Other Company LLC'
        assert response.data['ref'] == 'CASE-789'
        assert response.data['subcase'] == 'Contract Dispute'
        
        # Verify the process was created in database
        created_process = Process.objects.get(ref='CASE-789')
        assert created_process.client.id == client_user.id
        assert created_process.lawyer.id == lawyer_user.id
        assert created_process.case.id == case_type.id
        
        # Verify stages were created
        assert created_process.stages.count() == 2
        stages_statuses = [stage.status for stage in created_process.stages.all()]
        assert 'New' in stages_statuses
        assert 'Analysis' in stages_statuses
    
    def test_create_process_invalid_client(self, api_client, admin_user, lawyer_user, case_type):
        """Test creating a process with an invalid client ID"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Prepare the data with invalid client ID
        main_data = {
            'authority': 'Federal Court',
            'plaintiff': 'Company Inc.',
            'defendant': 'Other Company LLC',
            'ref': 'CASE-789',
            'clientId': 9999,  # Invalid ID
            'lawyerId': lawyer_user.id,
            'caseTypeId': case_type.id,
            'subcase': 'Contract Dispute'
        }
        
        # Make the request
        url = reverse('create-process')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Client or Lawyer not found' in response.data['detail']
        
        # Verify no process was created
        assert Process.objects.count() == 0
    
    def test_update_process(self, api_client, admin_user, process, case_type):
        """Test updating an existing process"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Create a new case type for the update
        new_case_type = Case.objects.create(type='Civil')
        
        # Add a case file to the process
        test_file = SimpleUploadedFile(
            "document.txt", 
            b"Test content", 
            content_type="text/plain"
        )
        case_file = CaseFile.objects.create(file=test_file)
        process.case_files.add(case_file)
        
        # Prepare the update data
        main_data = {
            'authority': 'Updated Court',
            'plaintiff': 'Updated Plaintiff',
            'defendant': 'Updated Defendant',
            'ref': 'UPDATED-REF',
            'clientId': process.client.id,
            'caseTypeId': new_case_type.id,
            'subcase': 'Updated Subcase',
            'caseFileIds': [case_file.id]  # Keep this file
        }
        
        # Make the request
        url = reverse('update-process', kwargs={'pk': process.id})
        response = api_client.put(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Get the updated process from database to verify changes
        updated_process = Process.objects.get(id=process.id)
        assert updated_process.authority == 'Updated Court'
        assert updated_process.plaintiff == 'Updated Plaintiff'
        assert updated_process.defendant == 'Updated Defendant'
        assert updated_process.ref == 'UPDATED-REF'
        assert updated_process.subcase == 'Updated Subcase'
        assert updated_process.case.id == new_case_type.id
        assert updated_process.case_files.count() == 1
        assert updated_process.case_files.first().id == case_file.id
        
        # Verify response data reflects the updates
        assert response.data['authority'] == 'Updated Court'
        assert response.data['plaintiff'] == 'Updated Plaintiff'
        assert response.data['defendant'] == 'Updated Defendant'
        assert response.data['ref'] == 'UPDATED-REF'
        assert response.data['subcase'] == 'Updated Subcase'
    
    def test_update_case_file(self, api_client, admin_user, process):
        """Test uploading a file to an existing process"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Create a test file
        test_file = SimpleUploadedFile(
            "new_document.txt", 
            b"New document content", 
            content_type="text/plain"
        )
        
        # Prepare the data
        data = {
            'processId': process.id,
            'file': test_file
        }
        
        # Make the request
        url = reverse('update-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['detail'] == 'File uploaded successfully.'
        assert 'fileId' in response.data
        
        # Verify the file was associated with the process
        process.refresh_from_db()
        assert process.case_files.count() == 1
        
        # Verify that the file name contains 'new_document' and ends with '.txt'
        # This is more flexible than checking for the exact filename with suffixes
        file_name = process.case_files.first().file.name
        assert 'new_document' in file_name
        assert file_name.endswith('.txt')
    
    def test_update_case_file_missing_process_id(self, api_client, admin_user):
        """Test uploading a file without specifying a process ID"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Create a test file
        test_file = SimpleUploadedFile(
            "document.txt", 
            b"Document content", 
            content_type="text/plain"
        )
        
        # Prepare the data without process ID
        data = {
            'file': test_file
        }
        
        # Make the request
        url = reverse('update-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Process ID is required' in response.data['detail']
        
        # Verify no files were created
        assert CaseFile.objects.count() == 0
    
    def test_update_case_file_missing_file(self, api_client, admin_user, process):
        """Test uploading without providing a file"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Prepare the data without file
        data = {
            'processId': process.id
        }
        
        # Make the request
        url = reverse('update-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'File is required' in response.data['detail']
        
        # Verify no files were created
        assert CaseFile.objects.count() == 0
    
    def test_update_case_file_nonexistent_process(self, api_client, admin_user):
        """Test uploading a file to a non-existent process"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        # Create a test file
        test_file = SimpleUploadedFile(
            "document.txt", 
            b"Document content", 
            content_type="text/plain"
        )
        
        # Prepare the data with non-existent process ID
        data = {
            'processId': 9999,  # Non-existent ID
            'file': test_file
        }
        
        # Make the request
        url = reverse('update-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        
        # Verify no files were created
        assert CaseFile.objects.count() == 0
    
    def test_unauthenticated_access(self, api_client):
        """Test that unauthenticated users cannot access the process endpoints"""
        # Test process list
        list_url = reverse('process-list')
        list_response = api_client.get(list_url)
        assert list_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test create process
        create_url = reverse('create-process')
        create_response = api_client.post(create_url, {}, format='multipart')
        assert create_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test update process (using a fictitious ID)
        update_url = reverse('update-process', kwargs={'pk': 1})
        update_response = api_client.put(update_url, {}, format='multipart')
        assert update_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test update case file
        file_url = reverse('update-file')
        file_response = api_client.post(file_url, {}, format='multipart')
        assert file_response.status_code == status.HTTP_401_UNAUTHORIZED
