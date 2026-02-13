import pytest
import json
import datetime
import unittest.mock as mock
from django.urls import reverse
from django.db import models
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from gym_app.models import (
    User, Process, Case, Stage, ActivityFeed, DynamicDocument,
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
)
from django.core.files.uploadedfile import SimpleUploadedFile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user():
    """Create an admin user for API authentication"""
    return User.objects.create_user(
        email='admin@example.com',
        password='password123',
        first_name='Admin',
        last_name='User',
        role='admin'
    )


@pytest.fixture
def basic_data():
    """Create minimal data for API testing"""
    # Create client and lawyer
    client = User.objects.create_user(
        email='client@example.com',
        password='password123',
        first_name='Client',
        last_name='User',
        role='client'
    )
    
    lawyer = User.objects.create_user(
        email='lawyer@example.com',
        password='password123',
        first_name='Lawyer',
        last_name='User',
        role='lawyer'
    )
    
    # Create a case type
    case = Case.objects.create(type='Civil')
    
    # Create a process and associate client via ManyToMany field
    process = Process.objects.create(
        authority='Test Court',
        plaintiff='Test Plaintiff',
        defendant='Test Defendant',
        ref='API-TEST',
        lawyer=lawyer,
        case=case,
        subcase='API Test Case',
    )
    process.clients.add(client)
    
    # Add a stage
    stage = Stage.objects.create(status='Initial Review')
    process.stages.add(stage)
    
    return {
        'client': client,
        'lawyer': lawyer,
        'case': case,
        'process': process,
        'stage': stage
    }


@pytest.mark.django_db
class TestReportsAPI:
    
    def test_generate_excel_report_unauthorized(self, api_client):
        """Test that unauthenticated users cannot generate reports"""
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes',
            'startDate': '2023-01-01',
            'endDate': '2023-12-31'
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 401 Unauthorized
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_generate_excel_report_missing_report_type(self, api_client, admin_user):
        """Test API rejects requests without reportType"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        data = {
            'startDate': '2023-01-01',
            'endDate': '2023-12-31'
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 400 Bad Request
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'reportType is required' in response.data['error']
    
    def test_generate_excel_report_invalid_dates(self, api_client, admin_user):
        """Test API rejects requests with invalid date formats"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes',
            'startDate': 'invalid-date',
            'endDate': '2023-12-31'
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 400 Bad Request
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid date format' in response.data['error']
    
    def test_generate_excel_report_only_one_date(self, api_client, admin_user):
        """Test API requires both dates if any date is provided"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes',
            'startDate': '2023-01-01'
            # No endDate
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 400 Bad Request
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Both startDate and endDate must be provided' in response.data['error']
    
    def test_generate_excel_report_unsupported_type(self, api_client, admin_user):
        """Test API rejects unsupported report types"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'nonexistent_report',
            'startDate': '2023-01-01',
            'endDate': '2023-12-31'
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 400 Bad Request
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Report type nonexistent_report not supported' in response.data['error']
    
    def test_active_processes_report_api(self, api_client, admin_user, basic_data):
        """Test generating active processes report through API"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes',
            'startDate': (timezone.now().date() - datetime.timedelta(days=30)).strftime('%Y-%m-%d'),
            'endDate': timezone.now().date().strftime('%Y-%m-%d')
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 200 OK and xlsx content type
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        assert 'attachment; filename="active_processes_' in response['Content-Disposition']
    
    def test_report_without_date_filters(self, api_client, admin_user, basic_data):
        """Test generating report without specifying dates"""
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        data = {
            'reportType': 'active_processes'
            # No dates provided
        }
        response = api_client.post(url, data, format='json')
        
        # Should return 200 OK
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    @mock.patch('gym_app.views.reports.models', models)
    @mock.patch('openpyxl.chart.PieChart.add_data')
    @mock.patch('openpyxl.chart.BarChart.add_data')
    def test_all_report_types_basic_functionality(self, mock_bar_add_data, mock_pie_add_data, api_client, admin_user, basic_data):
        """Test that all report types return successful responses"""
        # Configure mocks to do nothing
        mock_pie_add_data.return_value = None
        mock_bar_add_data.return_value = None
        
        # List of all supported report types
        report_types = [
            'active_processes',
            'processes_by_lawyer',
            'processes_by_client',
            'process_stages',
            'registered_users',
            'user_activity',
            'lawyers_workload',
            'documents_by_state',
            'received_legal_requests',
            'requests_by_type_discipline'
        ]
        
        # Authenticate
        api_client.force_authenticate(user=admin_user)
        
        url = reverse('generate-excel-report')
        
        # Test each report type
        for report_type in report_types:
            # Use date objects to avoid timezone issues with datetimes
            start_date = (timezone.now().date() - datetime.timedelta(days=30)).strftime('%Y-%m-%d')
            end_date = timezone.now().date().strftime('%Y-%m-%d')
            data = {
                'reportType': report_type,
                'startDate': start_date,
                'endDate': end_date
            }
            response = api_client.post(url, data, format='json')
            
            # All should return 200 OK and xlsx content type
            assert response.status_code == status.HTTP_200_OK, f"Report type {report_type} failed"
            assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            assert f'attachment; filename="{report_type}_' in response['Content-Disposition'] 