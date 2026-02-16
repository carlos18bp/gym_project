import pytest
import json
from unittest.mock import patch, MagicMock
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


# ======================================================================
# Tests merged from test_process_views.py (coverage + edge cases)
# ======================================================================

@pytest.fixture
def _pv_lawyer():
    return User.objects.create_user(
        email='law_pc@e.com', password='p', role='lawyer',
        first_name='L', last_name='P')


@pytest.fixture
def _pv_lawyer2():
    return User.objects.create_user(
        email='law2_pc@e.com', password='p', role='lawyer',
        first_name='L2', last_name='P')


@pytest.fixture
def _pv_client():
    return User.objects.create_user(
        email='cli_pc@e.com', password='p', role='client',
        first_name='C', last_name='P')


@pytest.fixture
def _pv_ctype():
    return Case.objects.create(type='CivPC')


@pytest.fixture
def _pv_proc(_pv_lawyer, _pv_client, _pv_ctype):
    p = Process.objects.create(
        authority='A', plaintiff='P', defendant='D', ref='PC1',
        lawyer=_pv_lawyer, case=_pv_ctype, subcase='S')
    p.clients.add(_pv_client)
    return p


@pytest.mark.django_db
class TestProcessRegressionScenarios:

    def test_update_process_changes_lawyer(self, api_client, _pv_lawyer, _pv_lawyer2, _pv_proc):
        """Line 215: updating lawyerId assigns new lawyer to process."""
        api_client.force_authenticate(user=_pv_lawyer)
        url = reverse('update-process', kwargs={'pk': _pv_proc.pk})
        data = {'mainData': json.dumps({'lawyerId': _pv_lawyer2.id})}
        r = api_client.put(url, data, format='multipart')
        assert r.status_code == status.HTTP_200_OK
        _pv_proc.refresh_from_db()
        assert _pv_proc.lawyer_id == _pv_lawyer2.id


# --- Edge-case fixtures ---

@pytest.fixture
def _edge_lawyer():
    return User.objects.create_user(
        email="lawyer-edge@example.com", password="testpassword",
        first_name="Lawyer", last_name="Edge", role="Lawyer",
    )


@pytest.fixture
def _edge_client():
    return User.objects.create_user(
        email="client-edge@example.com", password="testpassword",
        first_name="Client", last_name="Edge", role="Client",
    )


@pytest.fixture
def _edge_admin():
    return User.objects.create_user(
        email="admin-edge@example.com", password="testpassword",
        first_name="Admin", last_name="Edge", role="Admin",
    )


@pytest.fixture
def _edge_ctype():
    return Case.objects.create(type="Civil")


@pytest.fixture
def _edge_proc(_edge_lawyer, _edge_client, _edge_ctype):
    proc = Process.objects.create(
        authority="Juzgado 1", plaintiff="Plaintiff", defendant="Defendant",
        ref="REF-001", lawyer=_edge_lawyer, case=_edge_ctype, progress=50,
    )
    proc.clients.add(_edge_client)
    stage = Stage.objects.create(status="Initial stage")
    proc.stages.add(stage)
    return proc


# ---------------------------------------------------------------------------
# process_list – exception handler (lines 46-47)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestProcessListEdges:
    def test_process_list_exception_returns_500(self, api_client, _edge_client):
        """Cover the except block in process_list (lines 46-47)."""
        api_client.force_authenticate(user=_edge_client)
        url = reverse("process-list")
        with patch("gym_app.views.process.Process.objects") as mock_qs:
            mock_qs.filter.side_effect = Exception("DB error")
            response = api_client.get(url)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "DB error" in response.data["detail"]

    def test_process_list_admin_returns_all(self, api_client, _edge_admin, _edge_proc):
        """Cover the else branch (non-client, non-lawyer role) in process_list."""
        api_client.force_authenticate(user=_edge_admin)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# create_process – edge cases
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCreateProcessEdges:
    def _build_main_data(self, **overrides):
        defaults = {
            "clientIds": [], "lawyerId": None, "caseTypeId": None,
            "authority": "Auth", "plaintiff": "P", "defendant": "D",
            "ref": "R-1", "subcase": "Sub-civil", "stages": [],
        }
        defaults.update(overrides)
        return defaults

    def test_create_process_single_client_id_not_list(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover line 67: client_ids converted from scalar to list."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=_edge_client.id, lawyerId=_edge_lawyer.id, caseTypeId=_edge_ctype.id,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_process_invalid_lawyer(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover lines 75-76: lawyer DoesNotExist."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=99999, caseTypeId=_edge_ctype.id,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_process_invalid_case_type(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover lines 81-82: case type DoesNotExist."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=_edge_lawyer.id, caseTypeId=99999,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_process_non_numeric_progress(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover lines 88-89: progress that can't be cast to int."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=_edge_lawyer.id,
            caseTypeId=_edge_ctype.id, progress="not-a-number",
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["progress"] == 0

    def test_create_process_stage_without_status_skipped(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover line 115: stage with empty status is skipped."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=_edge_lawyer.id,
            caseTypeId=_edge_ctype.id, stages=[{"status": ""}, {"status": "Filed"}],
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED
        proc = Process.objects.get(pk=response.data["id"])
        assert proc.stages.count() == 1

    def test_create_process_stage_with_valid_date(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover lines 120-123: stage with valid ISO date."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=_edge_lawyer.id,
            caseTypeId=_edge_ctype.id, stages=[{"status": "Filed", "date": "2025-06-15"}],
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED
        proc = Process.objects.get(pk=response.data["id"])
        stage = proc.stages.first()
        assert str(stage.date) == "2025-06-15"

    def test_create_process_stage_with_invalid_date_falls_back(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover lines 124-125: invalid date falls back to today."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=_edge_lawyer.id,
            caseTypeId=_edge_ctype.id, stages=[{"status": "Filed", "date": "not-a-date"}],
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_process_unexpected_exception(self, api_client, _edge_lawyer, _edge_client, _edge_ctype):
        """Cover lines 142-144: unexpected exception returns 500."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[_edge_client.id], lawyerId=_edge_lawyer.id, caseTypeId=_edge_ctype.id,
        )
        with patch("gym_app.views.process.Process.objects.create", side_effect=Exception("unexpected")):
            response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_create_process_empty_client_ids(self, api_client, _edge_lawyer, _edge_ctype):
        """Cover line 71: empty clientIds returns 404."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[], lawyerId=_edge_lawyer.id, caseTypeId=_edge_ctype.id,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# update_process – edge cases
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestUpdateProcessEdges:
    def test_update_process_json_body_directly(self, api_client, _edge_lawyer, _edge_proc):
        """Cover line 161: request.data is dict without 'mainData' key."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {"plaintiff": "New Plaintiff", "authorityEmail": "auth@example.com"}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.plaintiff == "New Plaintiff"
        assert _edge_proc.authority_email == "auth@example.com"

    def test_update_process_invalid_json_maindata_fallback(self, api_client, _edge_lawyer, _edge_proc):
        """Cover lines 167-169: mainData is not valid JSON, fallback to request.data."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        response = api_client.put(url, {"mainData": "not-json{{"}, format="multipart")
        assert response.status_code == status.HTTP_200_OK

    def test_update_process_progress_non_numeric(self, api_client, _edge_lawyer, _edge_proc):
        """Cover lines 192-198: progress update with non-numeric value."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {"progress": "abc"}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.progress in (50, 0)

    def test_update_process_progress_clamped(self, api_client, _edge_lawyer, _edge_proc):
        """Cover line 197: progress clamped to 0-100."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {"progress": 150}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.progress == 100

    def test_update_process_client_ids_scalar(self, api_client, _edge_lawyer, _edge_proc, _edge_client):
        """Cover lines 203-208: clientIds as scalar, not list."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {"clientIds": _edge_client.id}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_update_process_invalid_lawyer_id(self, api_client, _edge_lawyer, _edge_proc):
        """Cover lines 213-217: lawyerId that doesn't exist (DoesNotExist caught)."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {"lawyerId": 99999}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.lawyer == _edge_lawyer

    def test_update_process_invalid_case_type_id(self, api_client, _edge_lawyer, _edge_proc, _edge_ctype):
        """Cover lines 225-226: caseTypeId that doesn't exist."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {"caseTypeId": 99999}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.case == _edge_ctype

    def test_update_process_replaces_stages(self, api_client, _edge_lawyer, _edge_proc):
        """Cover lines 239-255: stage replacement with valid/invalid dates."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        data = {
            "stages": [
                {"status": "New stage", "date": "2025-03-01"},
                {"status": ""},
                {"status": "Another stage", "date": "bad-date"},
                {"status": "No date stage"},
            ]
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.stages.count() == 3
        dates = list(_edge_proc.stages.values_list("date", flat=True))
        from datetime import date
        assert date(2025, 3, 1) in dates

    def test_update_process_with_maindata_multipart(self, api_client, _edge_lawyer, _edge_proc):
        """Cover lines 163-166: mainData as valid JSON string in multipart."""
        api_client.force_authenticate(user=_edge_lawyer)
        url = reverse("update-process", kwargs={"pk": _edge_proc.pk})
        main_data = json.dumps({"defendant": "Updated Defendant"})
        response = api_client.put(url, {"mainData": main_data}, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        _edge_proc.refresh_from_db()
        assert _edge_proc.defendant == "Updated Defendant"
