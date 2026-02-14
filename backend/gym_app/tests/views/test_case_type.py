# backend/gym_app/tests/views/test_case_type.py

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import Case, User
@pytest.fixture
def user():
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword'
    )

@pytest.fixture
def case_list():
    """Create test cases for testing"""
    cases = [
        Case.objects.create(type='Criminal'),
        Case.objects.create(type='Civil'),
        Case.objects.create(type='Family')
    ]
    return cases

@pytest.mark.django_db
class TestCaseTypeViews:
    
    def test_case_list_authenticated(self, api_client, user, case_list):
        """
        Test that authenticated users can retrieve a list of cases.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('case-list')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3
        
        # Verify the returned data
        case_types = [case['type'] for case in response.data]
        assert 'Criminal' in case_types
        assert 'Civil' in case_types
        assert 'Family' in case_types
    
    def test_case_list_unauthenticated(self, api_client, case_list):
        """
        Test that unauthenticated users cannot access the case list.
        """
        url = reverse('case-list')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED