import pytest
import io
import pandas as pd
import datetime
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.db import models
from gym_app.views.reports import (
    generate_active_processes_report,
    generate_processes_by_lawyer_report,
    generate_processes_by_client_report,
    generate_process_stages_report,
    generate_registered_users_report,
    generate_user_activity_report,
    generate_lawyers_workload_report,
    generate_documents_by_state_report,
    generate_received_legal_requests_report,
    generate_requests_by_type_discipline_report
)
from gym_app.models import (
    Process, Case, Stage, User, ActivityFeed, DynamicDocument,
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
)


@pytest.fixture
def mock_response():
    """Create a mock HttpResponse for testing reports"""
    return HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@pytest.fixture
def fixed_now():
    """Deterministic timestamp anchor for report test data and filters."""
    return datetime.datetime(2026, 1, 15, 10, 0, tzinfo=datetime.timezone.utc)


@pytest.fixture
def report_window():
    """Stable aware range that always includes test records regardless runtime date."""
    return (
        datetime.datetime(2000, 1, 1, 0, 0, tzinfo=datetime.timezone.utc),
        datetime.datetime(2100, 1, 1, 0, 0, tzinfo=datetime.timezone.utc),
    )


@pytest.fixture
def report_window_naive(report_window):
    """Naive variant used by report functions that compare naive datetimes."""
    start_date, end_date = report_window
    return start_date.replace(tzinfo=None), end_date.replace(tzinfo=None)


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
    
    return {'client': client, 'lawyer': lawyer}


@pytest.fixture
def sample_data(sample_users, fixed_now):
    """Create sample data for testing reports"""
    # Create case type
    case = Case.objects.create(type='Civil')
    
    # Create process and associate client via ManyToMany field
    process = Process.objects.create(
        authority='District Court',
        plaintiff='Company Inc.',
        defendant='Other Company LLC',
        ref='TEST-123',
        lawyer=sample_users['lawyer'],
        case=case,
        subcase='Contract Dispute',
        created_at=fixed_now - datetime.timedelta(days=10),
    )
    process.clients.add(sample_users['client'])
    
    # Create stages for the process
    stage1 = Stage.objects.create(
        status='Initial Review',
        created_at=fixed_now - datetime.timedelta(days=9)
    )
    stage2 = Stage.objects.create(
        status='Documentation',
        created_at=fixed_now - datetime.timedelta(days=5)
    )
    process.stages.add(stage1, stage2)
    
    # Create activity feeds
    activity = ActivityFeed.objects.create(
        user=sample_users['lawyer'],
        action_type='create_process',
        description=f"Created process {process.ref}",
        created_at=fixed_now - datetime.timedelta(days=10)
    )
    
    # Create document
    document = DynamicDocument.objects.create(
        title="Test Document",
        state="Draft",
        created_by=sample_users['lawyer'],
        assigned_to=sample_users['client'],
        created_at=fixed_now - datetime.timedelta(days=8),
        updated_at=fixed_now - datetime.timedelta(days=5)
    )
    
    # Create legal request types and disciplines
    request_type = LegalRequestType.objects.create(name="Consultation")
    discipline = LegalDiscipline.objects.create(name="Civil Law")

    # Create a dedicated user for this legal request to match expected report values
    request_user = User.objects.create_user(
        email="john.doe@example.com",
        password="password123",
        first_name="John",
        last_name="Doe",
        role="client",
    )

    # Create legal request associated to the user
    legal_request = LegalRequest.objects.create(
        user=request_user,
        request_type=request_type,
        discipline=discipline,
        description="I need advice on a civil matter",
        created_at=fixed_now - datetime.timedelta(days=7),
    )
    
    # Create and attach a file to the legal request
    test_file = SimpleUploadedFile(
        "document.pdf",
        b"File content",
        content_type="application/pdf"
    )
    file_obj = LegalRequestFiles.objects.create(file=test_file)
    legal_request.files.add(file_obj)
    
    return {
        'case': case,
        'process': process,
        'stages': [stage1, stage2],
        'activity': activity,
        'document': document,
        'request_type': request_type,
        'discipline': discipline,
        'legal_request': legal_request,
        'file_obj': file_obj
    }


@pytest.mark.django_db
class TestReportFunctions:
    
    def test_active_processes_report(self, mock_response, sample_data, report_window):
        """Test the active processes report generation function directly"""
        # Get dates for report range
        start_date, end_date = report_window
        
        # Generate report
        response = generate_active_processes_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert 'TEST-123' in df['Referencia'].values
        assert 'Civil' in df['Tipo de Caso'].values
        assert 'District Court' in df['Autoridad'].values
        assert 'Company Inc.' in df['Demandante'].values
        assert 'Other Company LLC' in df['Demandado'].values
    
    def test_processes_by_lawyer_report(self, mock_response, sample_data, sample_users, monkeypatch, report_window):
        """Test the processes by lawyer report generation function directly"""
        # Mock the user_id variable that's used in the function
        monkeypatch.setattr('gym_app.views.reports.user_id', None)
        
        # Get dates for report range
        start_date, end_date = report_window
        
        # Generate report
        response = generate_processes_by_lawyer_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        # Check if lawyer info is in the report (in any row, in the lawyer column)
        lawyer_email = sample_users['lawyer'].email
        assert any(lawyer_email in str(val) for val in df['Abogado'].values)
        # Check that process reference is there
        assert 'TEST-123' in df['Referencia de Proceso'].values
    
    def test_processes_by_client_report(self, mock_response, sample_data, sample_users, monkeypatch, report_window):
        """Test the processes by client report generation function directly"""
        # Mock the user_id variable that's used in the function
        monkeypatch.setattr('gym_app.views.reports.user_id', None)
        
        # Get dates for report range
        start_date, end_date = report_window
        
        # Generate report
        response = generate_processes_by_client_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert 'Client' in df['Cliente'].values[0]  # First name of client
        assert sample_users['client'].identification in df['ID Cliente'].values
        assert 'TEST-123' in df['Referencia de Proceso'].values
    
    def test_process_stages_report(self, mock_response, sample_data, report_window):
        """Test the process stages report generation function directly"""
        # Get dates for report range
        start_date, end_date = report_window
        
        # Generate report
        response = generate_process_stages_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert 'TEST-123' in df['Referencia de Proceso'].values
        assert 'Initial Review' in df['Etapa'].values
        assert 'Documentation' in df['Etapa'].values
    
    def test_registered_users_report(self, mock_response, sample_users, report_window_naive):
        """Test the registered users report generation function directly"""
        # Get dates for report range - use naive datetimes (no timezone)
        start_date, end_date = report_window_naive
        
        # Generate report
        response = generate_registered_users_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert sample_users['client'].email in df['Email'].values
        assert sample_users['lawyer'].email in df['Email'].values
        
        # Verify role display
        client_row = df[df['Email'] == sample_users['client'].email].iloc[0]
        lawyer_row = df[df['Email'] == sample_users['lawyer'].email].iloc[0]
        assert client_row['Rol'] == 'Cliente'
        assert lawyer_row['Rol'] == 'Abogado'
    
    def test_user_activity_report(self, mock_response, sample_data, sample_users, report_window_naive):
        """Test the user activity report generation function directly"""
        # Get dates for report range - use naive datetimes (no timezone)
        start_date, end_date = report_window_naive
        
        # Generate report
        response = generate_user_activity_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert sample_users['lawyer'].email in df['Usuario'].values
        
        # Check action types
        assert 'create_process' in df['Tipo de Acción'].values
        
        # Check description
        description = df[df['Usuario'] == sample_users['lawyer'].email]['Descripción'].iloc[0]
        assert 'TEST-123' in description
    
    def test_lawyers_workload_report(self, mock_response, sample_data, sample_users, monkeypatch, report_window):
        """Test the lawyers workload report generation function directly"""
        # Mock the user_id variable that's used in the function
        monkeypatch.setattr('gym_app.views.reports.user_id', None)
        
        # Get dates for report range
        start_date, end_date = report_window
        
        # Generate report
        response = generate_lawyers_workload_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert sample_users['lawyer'].email in df['Email'].values
        
        # Check the lawyer's workload data
        lawyer_row = df[df['Email'] == sample_users['lawyer'].email].iloc[0]
        assert lawyer_row['Total de Procesos Asignados'] >= 1  # At least our test process
        assert lawyer_row['Procesos Activos'] >= 1  # Our test process is active
    
    def test_documents_by_state_report(self, mock_response, sample_data, sample_users, monkeypatch, report_window):
        """Test the documents by state report generation function directly"""
        # Mock the user_id variable that's used in the function
        monkeypatch.setattr('gym_app.views.reports.user_id', None)
        # Mock the models.Q function since it's used directly in the function
        monkeypatch.setattr('gym_app.views.reports.models', models)
        
        # Get dates for report range
        start_date, end_date = report_window
        
        # Generate report
        response = generate_documents_by_state_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert "Test Document" in df['Título'].values
        assert "Borrador" in df['Estado'].values  # "Draft" translated to Spanish
    
    def test_received_legal_requests_report(self, mock_response, sample_data, report_window_naive):
        """Test the received legal requests report generation function directly"""
        # Get dates for report range - use naive datetimes (no timezone)
        start_date, end_date = report_window_naive
        
        # Generate report
        response = generate_received_legal_requests_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # Read Excel content to verify data
        excel_content = io.BytesIO(response.content)
        df = pd.read_excel(excel_content)
        
        # Verify data is present
        assert not df.empty
        assert "John Doe" in df['Nombre Solicitante'].values
        assert "john.doe@example.com" in df['Email'].values
        assert "Consultation" in df['Tipo de Solicitud'].values
        assert "Civil Law" in df['Disciplina Legal'].values
        
        # Check for file attachment count
        request_row = df[df['Email'] == "john.doe@example.com"].iloc[0]
        assert request_row['Archivos Adjuntos'] == 1  # Our test legal request has one file
    
    def test_requests_by_type_discipline_report(self, mock_response, sample_data, report_window_naive):
        """Test the requests by type and discipline report generation function directly"""
        # Get dates for report range - use naive datetimes (no timezone)
        start_date, end_date = report_window_naive
        
        # Generate report
        response = generate_requests_by_type_discipline_report(mock_response, start_date, end_date)
        
        # Verify response
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        # This report has multiple sheets, so we need to check differently
        excel_content = io.BytesIO(response.content)
        xlsx = pd.ExcelFile(excel_content)
        
        # Verify sheets exist
        assert 'Resumen' in xlsx.sheet_names
        
        # If there's detail sheet, check it
        if 'Detalle de Solicitudes' in xlsx.sheet_names:
            df_details = pd.read_excel(xlsx, 'Detalle de Solicitudes')
            assert not df_details.empty
            assert "John Doe" in df_details['Nombre Solicitante'].values
            assert "Consultation" in df_details['Tipo de Solicitud'].values
            assert "Civil Law" in df_details['Disciplina Legal'].values 