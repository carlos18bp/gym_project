import pytest
import json
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, Process, Stage, Case, CaseFile, RecentProcess
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
        lawyer=lawyer_user,
        case=case_type,
        subcase='Theft'
    )
    process.clients.add(client_user)
    process.stages.add(stage)
    return process

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
            lawyer=process.lawyer,
            case=process.case
        )
        other_process.clients.add(other_client)
        
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
            lawyer=other_lawyer,
            case=process.case
        )
        # Share the same clients as the original process
        other_process.clients.set(process.clients.all())
        
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
            lawyer=other_lawyer,
            case=process.case
        )
        other_process.clients.add(other_client)
        
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
            'clientIds': [client_user.id],
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
        assert created_process.clients.count() == 1
        assert created_process.clients.first().id == client_user.id
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
            'clientIds': [9999],  # Invalid ID
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

    def test_get_recent_processes_returns_only_user_entries(self, api_client, client_user, process):
        """recent-processes debe devolver solo los procesos recientes del usuario autenticado"""
        # Crear entradas de procesos recientes para el usuario
        RecentProcess.objects.create(user=client_user, process=process)

        # Crear otra entrada para un usuario distinto
        other_user = User.objects.create_user(
            email='other.user@example.com',
            password='testpassword',
            role='Client'
        )
        other_process = Process.objects.create(
            authority='Other Court',
            plaintiff='Other',
            defendant='Other',
            ref='CASE-OTHER',
            lawyer=process.lawyer,
            case=process.case
        )
        RecentProcess.objects.create(user=other_user, process=other_process)

        api_client.force_authenticate(user=client_user)

        url = reverse('recent-processes')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['process']['id'] == process.id

    def test_get_recent_processes_limits_to_10_and_orders_by_last_viewed(self, api_client, client_user, case_type, lawyer_user):
        """recent-processes debe devolver máximo 10 elementos ordenados por last_viewed desc"""
        # Crear 12 procesos y entradas de RecentProcess con last_viewed creciente
        for i in range(12):
            p = Process.objects.create(
                authority='Court',
                plaintiff=f'P{i}',
                defendant=f'D{i}',
                ref=f'CASE-{i}',
                lawyer=lawyer_user,
                case=case_type
            )
            rp = RecentProcess.objects.create(user=client_user, process=p)
            # Forzar un orden consistente incrementando last_viewed
            rp.last_viewed = rp.last_viewed.replace(microsecond=i)
            rp.save(update_fields=['last_viewed'])

        api_client.force_authenticate(user=client_user)
        url = reverse('recent-processes')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 10

        # Comprobar que están ordenados por last_viewed descendente
        timestamps = [item['last_viewed'] for item in response.data]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_update_recent_process_creates_or_updates_entry(self, api_client, client_user, process):
        """update-recent-process debe crear o actualizar la entrada de RecentProcess"""
        api_client.force_authenticate(user=client_user)

        url = reverse('update-recent-process', kwargs={'process_id': process.id})

        # Primera llamada: debe crear la entrada
        response = api_client.post(url, {})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'success'

        rp = RecentProcess.objects.get(user=client_user, process=process)
        first_last_viewed = rp.last_viewed

        # Segunda llamada: debe actualizar last_viewed
        response = api_client.post(url, {})
        assert response.status_code == status.HTTP_200_OK

        rp.refresh_from_db()
        assert rp.last_viewed >= first_last_viewed

    def test_update_recent_process_not_found(self, api_client, client_user):
        """update-recent-process debe responder 404 si el proceso no existe"""
        api_client.force_authenticate(user=client_user)

        url = reverse('update-recent-process', kwargs={'process_id': 9999})
        response = api_client.post(url, {})

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['error'] == 'Process not found'
