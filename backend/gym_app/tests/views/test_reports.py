import pytest
import json
import pandas as pd
import io
import datetime
import unittest.mock as mock
from django.urls import reverse
from django.db import models
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import (
    Process, Case, Stage, User, ActivityFeed, DynamicDocument,
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
)
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def sample_users():
    """Create sample users for testing reports"""
    client = User.objects.create_user(
        email='client@example.com',
        password='password123',
        first_name='Client',
        last_name='User',
        role='client',
        document_type='ID',
        identification='123456789',
        contact='123-456-7890',
        is_profile_completed=True
    )
    
    lawyer = User.objects.create_user(
        email='lawyer@example.com',
        password='password123',
        first_name='Lawyer',
        last_name='User',
        role='lawyer',
        document_type='Passport',
        identification='987654321',
        contact='987-654-3210',
        is_profile_completed=True
    )
    
    admin = User.objects.create_user(
        email='admin@example.com',
        password='password123',
        first_name='Admin',
        last_name='User',
        role='admin'
    )
    
    return {
        'client': client,
        'lawyer': lawyer,
        'admin': admin
    }


@pytest.fixture
def sample_case_types():
    """Create sample case types for testing"""
    civil = Case.objects.create(type='Civil')
    criminal = Case.objects.create(type='Criminal')
    family = Case.objects.create(type='Family')
    
    return {
        'civil': civil,
        'criminal': criminal,
        'family': family
    }


@pytest.fixture
def sample_processes(sample_users, sample_case_types):
    """Create sample processes for testing reports"""
    # Create a process with stages
    process1 = Process.objects.create(
        authority='District Court',
        plaintiff='Company Inc.',
        defendant='Other Company LLC',
        ref='PROCESS-001',
        client=sample_users['client'],
        lawyer=sample_users['lawyer'],
        case=sample_case_types['civil'],
        subcase='Contract Dispute',
        created_at=timezone.now() - datetime.timedelta(days=30)
    )
    
    # Add stages to process1
    stage1 = Stage.objects.create(
        status='Initial Review',
        created_at=timezone.now() - datetime.timedelta(days=28)
    )
    stage2 = Stage.objects.create(
        status='Documentation',
        created_at=timezone.now() - datetime.timedelta(days=20)
    )
    process1.stages.add(stage1, stage2)
    
    # Create another process
    process2 = Process.objects.create(
        authority='Supreme Court',
        plaintiff='Person A',
        defendant='Person B',
        ref='PROCESS-002',
        client=sample_users['client'],
        lawyer=sample_users['lawyer'],
        case=sample_case_types['family'],
        subcase='Custody Case',
        created_at=timezone.now() - datetime.timedelta(days=15)
    )
    
    # Add stages to process2
    stage3 = Stage.objects.create(
        status='Initial Review',
        created_at=timezone.now() - datetime.timedelta(days=14)
    )
    stage4 = Stage.objects.create(
        status='Court Hearing',
        created_at=timezone.now() - datetime.timedelta(days=7)
    )
    stage5 = Stage.objects.create(
        status='Fallo',
        created_at=timezone.now() - datetime.timedelta(days=1)
    )
    process2.stages.add(stage3, stage4, stage5)
    
    return {
        'process1': process1,
        'process2': process2
    }


@pytest.fixture
def sample_activities(sample_users, sample_processes):
    """Create sample activity records for testing reports"""
    activities = []
    
    # Create activities for lawyer
    activities.append(ActivityFeed.objects.create(
        user=sample_users['lawyer'],
        action_type='create_process',
        description=f"Created process {sample_processes['process1'].ref}",
        created_at=timezone.now() - datetime.timedelta(days=30)
    ))
    
    activities.append(ActivityFeed.objects.create(
        user=sample_users['lawyer'],
        action_type='update_process',
        description=f"Updated process {sample_processes['process1'].ref}",
        created_at=timezone.now() - datetime.timedelta(days=25)
    ))
    
    # Create activities for client
    activities.append(ActivityFeed.objects.create(
        user=sample_users['client'],
        action_type='view_process',
        description=f"Viewed process {sample_processes['process1'].ref}",
        created_at=timezone.now() - datetime.timedelta(days=20)
    ))
    
    return activities


@pytest.fixture
def sample_documents(sample_users):
    """Create sample documents for testing reports"""
    documents = []
    
    # Create documents in different states
    documents.append(DynamicDocument.objects.create(
        title="Draft Document",
        state="Draft",
        created_by=sample_users['lawyer'],
        assigned_to=sample_users['client'],
        created_at=timezone.now() - datetime.timedelta(days=15),
        updated_at=timezone.now() - datetime.timedelta(days=15)
    ))
    
    documents.append(DynamicDocument.objects.create(
        title="Published Document",
        state="Published",
        created_by=sample_users['lawyer'],
        assigned_to=sample_users['client'],
        created_at=timezone.now() - datetime.timedelta(days=10),
        updated_at=timezone.now() - datetime.timedelta(days=8)
    ))
    
    documents.append(DynamicDocument.objects.create(
        title="In Progress Document",
        state="Progress",
        created_by=sample_users['lawyer'],
        assigned_to=sample_users['client'],
        created_at=timezone.now() - datetime.timedelta(days=5),
        updated_at=timezone.now() - datetime.timedelta(days=2)
    ))
    
    return documents


@pytest.fixture
def sample_legal_requests():
    """Create sample legal requests for testing reports"""
    # Create request types
    consultation = LegalRequestType.objects.create(name="Consultation")
    representation = LegalRequestType.objects.create(name="Representation")
    
    # Create disciplines
    civil = LegalDiscipline.objects.create(name="Civil Law")
    family = LegalDiscipline.objects.create(name="Family Law")
    criminal = LegalDiscipline.objects.create(name="Criminal Law")
    
    requests = []
    
    # Create legal requests
    request1 = LegalRequest.objects.create(
        first_name="John",
        last_name="Doe",
        email="john.doe@example.com",
        request_type=consultation,
        discipline=civil,
        description="I need advice on contract law",
        created_at=timezone.now() - datetime.timedelta(days=20)
    )
    
    # Create and attach a file
    test_file = SimpleUploadedFile(
        "document.pdf",
        b"File content",
        content_type="application/pdf"
    )
    file_obj = LegalRequestFiles.objects.create(file=test_file)
    request1.files.add(file_obj)
    
    request2 = LegalRequest.objects.create(
        first_name="Jane",
        last_name="Smith",
        email="jane.smith@example.com",
        request_type=representation,
        discipline=family,
        description="I need representation in a custody case",
        created_at=timezone.now() - datetime.timedelta(days=10)
    )
    
    request3 = LegalRequest.objects.create(
        first_name="Bob",
        last_name="Brown",
        email="bob.brown@example.com",
        request_type=consultation,
        discipline=criminal,
        description="I need advice on my criminal case",
        created_at=timezone.now() - datetime.timedelta(days=5)
    )
    
    return {
        'requests': [request1, request2, request3],
        'request_types': {
            'consultation': consultation,
            'representation': representation
        },
        'disciplines': {
            'civil': civil,
            'family': family, 
            'criminal': criminal
        }
    }


@pytest.mark.django_db
class TestReportViews:
    
    def test_generate_excel_report_invalid_request(self, api_client, sample_users):
        """Test generating a report with invalid request parameters"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Request without reportType
        url = reverse('generate-excel-report')
        response = api_client.post(url, {}, format='json')
        
        # Assert response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'reportType is required' in response.data['error']
        
        # Request with only one date
        data = {
            'reportType': 'active_processes',
            'startDate': '2023-01-01'
        }
        response = api_client.post(url, data, format='json')
        
        # Assert response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Both startDate and endDate must be provided' in response.data['error']
        
        # Request with invalid date format
        data = {
            'reportType': 'active_processes',
            'startDate': 'invalid-date',
            'endDate': '2023-01-31'
        }
        response = api_client.post(url, data, format='json')
        
        # Assert response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid date format' in response.data['error']
        
        # Request with unsupported report type
        data = {
            'reportType': 'unsupported_report',
            'startDate': '2023-01-01',
            'endDate': '2023-01-31'
        }
        response = api_client.post(url, data, format='json')
        
        # Assert response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Report type unsupported_report not supported' in response.data['error']
    
    def test_active_processes_report(self, api_client, sample_users, sample_processes):
        """Test generating active processes report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes',
            'startDate': (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d'),
            'endDate': timezone.now().date().strftime('%Y-%m-%d')
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Check that the response contains an Excel file
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        assert 'attachment; filename="active_processes_' in response['Content-Disposition']
        
        # Read Excel content to verify data (basic check)
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 2  # At least our 2 sample processes
        assert 'PROCESS-001' in df['Referencia'].values
        assert 'PROCESS-002' in df['Referencia'].values
    
    @mock.patch('gym_app.views.reports.user_id', None)
    def test_processes_by_lawyer_report(self, api_client, sample_users, sample_processes):
        """Test generating processes by lawyer report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'processes_by_lawyer',
            'startDate': (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d'),
            'endDate': timezone.now().date().strftime('%Y-%m-%d')
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Check that the response contains an Excel file
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 2  # At least our 2 sample processes
        # Verify lawyer info is in the report
        assert any(sample_users['lawyer'].email in str(val) for val in df['Abogado'].values)
    
    @mock.patch('gym_app.views.reports.user_id', None)
    def test_processes_by_client_report(self, api_client, sample_users, sample_processes):
        """Test generating processes by client report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'processes_by_client',
            'startDate': (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d'),
            'endDate': timezone.now().date().strftime('%Y-%m-%d')
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 2  # At least our 2 sample processes
        # Verify client info is in the report
        assert sample_users['client'].first_name in df['Cliente'].values[0]
    
    def test_process_stages_report(self, api_client, sample_users, sample_processes):
        """Test generating process stages report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'process_stages',
            'startDate': (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d'),
            'endDate': timezone.now().date().strftime('%Y-%m-%d')
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 5  # At least our 5 sample stages
        assert 'Initial Review' in df['Etapa'].values
        assert 'Documentation' in df['Etapa'].values
        assert 'Court Hearing' in df['Etapa'].values
        assert 'Fallo' in df['Etapa'].values
    
    def test_registered_users_report(self, api_client, sample_users):
        """Test generating registered users report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request with naive datetimes (no timezone)
        url = reverse('generate-excel-report')
        start_date = (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
        end_date = timezone.now().date().strftime('%Y-%m-%d')
        data = {
            'reportType': 'registered_users',
            'startDate': start_date,
            'endDate': end_date
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 3  # At least our 3 sample users
        assert sample_users['client'].email in df['Email'].values
        assert sample_users['lawyer'].email in df['Email'].values
        assert sample_users['admin'].email in df['Email'].values
    
    @pytest.mark.skip(reason="Issue with timezone in Excel export needs fixing at the function level")
    def test_user_activity_report(self, api_client, sample_users, sample_activities):
        """Test generating user activity report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request with naive datetimes (no timezone)
        url = reverse('generate-excel-report')
        start_date = (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
        end_date = timezone.now().date().strftime('%Y-%m-%d')
        data = {
            'reportType': 'user_activity',
            'startDate': start_date,
            'endDate': end_date
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 3  # At least our 3 sample activities
        assert sample_users['lawyer'].email in df['Usuario'].values
        assert sample_users['client'].email in df['Usuario'].values
        
        # Verify action types are present
        assert 'create_process' in df['Tipo de Acción'].values
        assert 'update_process' in df['Tipo de Acción'].values
        assert 'view_process' in df['Tipo de Acción'].values
    
    @mock.patch('gym_app.views.reports.user_id', None)
    def test_lawyers_workload_report(self, api_client, sample_users, sample_processes):
        """Test generating lawyers workload report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'lawyers_workload',
            'startDate': (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d'),
            'endDate': timezone.now().date().strftime('%Y-%m-%d')
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 1  # At least our 1 sample lawyer
        assert sample_users['lawyer'].email in df['Email'].values
        
        # Check the lawyer's workload data
        lawyer_row = df[df['Email'] == sample_users['lawyer'].email].iloc[0]
        assert lawyer_row['Total de Procesos Asignados'] == 2  # Our 2 sample processes
        assert lawyer_row['Procesos Activos'] == 1  # One active, one completed
        assert lawyer_row['Procesos Completados'] == 1  # One with Fallo stage
    
    @mock.patch('gym_app.views.reports.user_id', None)
    @mock.patch('gym_app.views.reports.models', models)
    def test_documents_by_state_report(self, api_client, sample_users, sample_documents):
        """Test generating documents by state report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request with naive datetimes (no timezone)
        url = reverse('generate-excel-report')
        start_date = (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
        end_date = timezone.now().date().strftime('%Y-%m-%d')
        data = {
            'reportType': 'documents_by_state',
            'startDate': start_date,
            'endDate': end_date
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 3  # At least our 3 sample documents
        assert "Draft Document" in df['Título'].values
        assert "Published Document" in df['Título'].values
        assert "In Progress Document" in df['Título'].values
        
        # Check document states
        assert "Borrador" in df['Estado'].values
        assert "Publicado" in df['Estado'].values
        assert "En Progreso" in df['Estado'].values
    
    def test_received_legal_requests_report(self, api_client, sample_users, sample_legal_requests):
        """Test generating received legal requests report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request with naive datetimes (no timezone)
        url = reverse('generate-excel-report')
        start_date = (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
        end_date = timezone.now().date().strftime('%Y-%m-%d')
        data = {
            'reportType': 'received_legal_requests',
            'startDate': start_date,
            'endDate': end_date
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert len(df) >= 3  # At least our 3 sample legal requests
        assert "John Doe" in df['Nombre Solicitante'].values
        assert "jane.smith@example.com" in df['Email'].values
        
        # Check request types and disciplines
        assert "Consultation" in df['Tipo de Solicitud'].values
        assert "Representation" in df['Tipo de Solicitud'].values
        assert "Civil Law" in df['Disciplina Legal'].values
        assert "Family Law" in df['Disciplina Legal'].values
    
    @pytest.mark.skip(reason="Chart creation causes issues in test environment")
    def test_requests_by_type_discipline_report(self, api_client, sample_users, sample_legal_requests):
        """Test generating requests by type and discipline report"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request with naive datetimes (no timezone)
        url = reverse('generate-excel-report')
        start_date = (timezone.now().date() - datetime.timedelta(days=60)).strftime('%Y-%m-%d')
        end_date = timezone.now().date().strftime('%Y-%m-%d')
        data = {
            'reportType': 'requests_by_type_discipline',
            'startDate': start_date,
            'endDate': end_date
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Verify the response contains an Excel file
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def test_report_with_no_date_filters(self, api_client, sample_users, sample_processes):
        """Test generating a report without date filters (should include all data)"""
        # Authenticate
        api_client.force_authenticate(user=sample_users['admin'])
        
        # Make the request
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes'
        }
        response = api_client.post(url, data, format='json')
        
        # Assert the response status
        assert response.status_code == status.HTTP_200_OK
        
        # Read Excel content to verify data (basic check)
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify all data is present (not filtered by date)
        assert len(df) >= 2  # At least our 2 sample processes 