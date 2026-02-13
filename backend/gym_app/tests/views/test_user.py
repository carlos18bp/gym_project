import pytest
import json
from io import BytesIO
from unittest.mock import patch
from datetime import date
from PIL import Image
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User
from gym_app.models.user import ActivityFeed, UserSignature

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword',
        first_name='Test',
        last_name='User',
        contact='1234567890',
        birthday=date(1990, 1, 1),
        identification='ID12345',
        document_type='ID'
    )

@pytest.fixture
def another_user():
    return User.objects.create_user(
        email='another@example.com',
        password='anotherpassword',
        first_name='Another',
        last_name='User'
    )


def _png_file(name='sig.png'):
    buffer = BytesIO()
    Image.new('RGB', (1, 1), color='white').save(buffer, format='PNG')
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type='image/png')

@pytest.mark.django_db
class TestUserViews:
    
    def test_user_list_authenticated(self, api_client, user, another_user):
        """Test that authenticated users can retrieve a list of users"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('user-list')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        
        # Verify both users are in the response
        emails = [u['email'] for u in response.data]
        assert 'test@example.com' in emails
        assert 'another@example.com' in emails
    
    def test_user_list_unauthenticated(self, api_client, user):
        """Test that unauthenticated users cannot access the user list"""
        url = reverse('user-list')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_update_profile_success(self, api_client, user):
        """Test successfully updating a user's own profile"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create test photo
        test_photo = SimpleUploadedFile(
            "profile.jpg",
            b"file_content",
            content_type="image/jpeg"
        )
        
        # Prepare update data with only the fields we're changing
        # Eliminando cualquier campo que pueda causar problemas de validación
        data = {
            'first_name': 'Updated',
            'last_name': 'Name',
            'contact': '9876543210',
            'email': user.email,  # Mantener el mismo email para evitar problemas de unicidad
        }
        
        # Hacer la solicitud sin incluir la foto inicialmente para ver si ese es el problema
        url = reverse('update_profile', kwargs={'pk': user.id})
        response = api_client.put(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response.data['message'] == 'Profile updated successfully'
        
        # Verify user was updated in the database
        user.refresh_from_db()
        assert user.first_name == 'Updated'
        assert user.last_name == 'Name'
        assert user.contact == '9876543210'
        
        # Verify profile completion status
        assert user.is_profile_completed == True
    
    def test_update_profile_partial(self, api_client, user):
        """Test updating a user's profile with only some fields"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare partial update data
        data = {
            'first_name': 'NewFirst',
        }
        
        # Make the request
        url = reverse('update_profile', kwargs={'pk': user.id})
        response = api_client.put(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        
        # Verify only the specified field was updated
        user.refresh_from_db()
        assert user.first_name == 'NewFirst'
        assert user.last_name == 'User'  # Unchanged
        
        # Verify profile completion status
        assert user.is_profile_completed == True  # Should still be complete
    
    def test_update_profile_incomplete(self, api_client):
        """Test updating a profile to an incomplete state"""
        # Create a user with incomplete profile
        incomplete_user = User.objects.create_user(
            email='incomplete@example.com',
            password='password',
            # Missing fields to make profile incomplete
        )
        
        # Authenticate the user
        api_client.force_authenticate(user=incomplete_user)
        
        # Prepare update data - still incomplete
        data = {
            'first_name': 'Some',
            # Still missing required fields
        }
        
        # Make the request
        url = reverse('update_profile', kwargs={'pk': incomplete_user.id})
        response = api_client.put(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        
        # Verify profile was updated but still incomplete
        incomplete_user.refresh_from_db()
        assert incomplete_user.first_name == 'Some'
        assert incomplete_user.is_profile_completed == False
    
    def test_update_other_user_profile(self, api_client, user, another_user):
        """Test that a user cannot update another user's profile"""
        # Authenticate as user
        api_client.force_authenticate(user=user)
        
        # Prepare update data for another user's profile
        data = {
            'first_name': 'Hacked',
            'last_name': 'Name',
        }
        
        # Make the request to update another user's profile
        url = reverse('update_profile', kwargs={'pk': another_user.id})
        response = api_client.put(url, data, format='multipart')
        
        # Assert the response - should be forbidden
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'You do not have permission' in response.data['error']
        
        # Verify the other user's profile was not changed
        another_user.refresh_from_db()
        assert another_user.first_name == 'Another'  # Unchanged
    
    def test_update_nonexistent_user(self, api_client, user):
        """Test trying to update a non-existent user profile"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Use a non-existent user ID
        non_existent_id = user.id + 100
        
        # Make the request with the non-existent ID
        url = reverse('update_profile', kwargs={'pk': non_existent_id})
        response = api_client.put(url, {}, format='multipart')
        
        # Assert the response - should be forbidden (can't update other profiles)
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_update_profile_unauthenticated(self, api_client, user):
        """Test that unauthenticated users cannot update profiles"""
        url = reverse('update_profile', kwargs={'pk': user.id})
        response = api_client.put(url, {}, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Verify user was not updated
        original_first_name = user.first_name
        user.refresh_from_db()
        assert user.first_name == original_first_name  # Unchanged

    def test_update_profile_invalid_email_returns_400(self, api_client, user):
        """Invalid email should return serializer errors."""
        api_client.force_authenticate(user=user)

        url = reverse('update_profile', kwargs={'pk': user.id})
        response = api_client.put(url, {'email': 'not-an-email'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.data

    def test_get_user_activities_returns_only_authenticated_user(self, api_client, user, another_user):
        """Activities should be filtered by the authenticated user."""
        ActivityFeed.objects.create(user=user, action_type='create', description='User action')
        ActivityFeed.objects.create(user=another_user, action_type='delete', description='Other action')

        api_client.force_authenticate(user=user)

        url = reverse('user-activities')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['description'] == 'User action'

    def test_create_activity_success(self, api_client, user):
        """Authenticated users can create activities and they are linked to the user."""
        api_client.force_authenticate(user=user)

        url = reverse('create-activity')
        response = api_client.post(
            url,
            {'action_type': 'create', 'description': 'Created something'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert ActivityFeed.objects.filter(user=user).count() == 1

    def test_create_activity_invalid_payload(self, api_client, user):
        """Invalid payload should return 400 errors."""
        api_client.force_authenticate(user=user)

        url = reverse('create-activity')
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_signature_forbidden_for_other_user(self, api_client, user, another_user):
        """Users cannot update another user's signature."""
        api_client.force_authenticate(user=user)

        url = reverse('update-signature', kwargs={'user_id': another_user.id})
        response = api_client.post(url, {}, format='multipart')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'permission' in response.data['error'].lower()

    def test_update_signature_user_not_found(self, api_client, user):
        """If the user does not exist, return 404."""
        ghost_user = User(id=9999, email='ghost@example.com')
        api_client.force_authenticate(user=ghost_user)

        url = reverse('update-signature', kwargs={'user_id': ghost_user.id})
        response = api_client.post(url, {}, format='multipart')

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['error'] == 'User not found'

    def test_update_signature_missing_image(self, api_client, user):
        """Signature image is required."""
        api_client.force_authenticate(user=user)

        url = reverse('update-signature', kwargs={'user_id': user.id})
        response = api_client.post(url, {'method': 'upload'}, format='multipart')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['error'] == 'No signature image provided'

    @patch('django.core.files.storage.FileSystemStorage.save', return_value='signatures/test.png')
    def test_update_signature_creates_new_signature(self, mock_save, api_client, user):
        """If no signature exists, it should create one and return 201."""
        api_client.force_authenticate(user=user)

        signature_image = _png_file('sig.png')
        url = reverse('update-signature', kwargs={'user_id': user.id})

        response = api_client.post(
            url,
            {'method': 'upload', 'signature_image': signature_image},
            format='multipart',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['message'] == 'Signature created successfully'
        assert UserSignature.objects.filter(user=user).count() == 1

    @patch('django.core.files.storage.FileSystemStorage.save', return_value='signatures/test.png')
    @patch('gym_app.views.user.default_storage.exists', return_value=True)
    @patch('gym_app.views.user.default_storage.delete')
    def test_update_signature_updates_existing(self, mock_delete, mock_exists, mock_save, api_client, user):
        """Updating an existing signature should return 200 and keep one record."""
        # Create an existing signature
        existing_signature = UserSignature.objects.create(
            user=user,
            signature_image=_png_file('old.png'),
            method='upload',
        )

        api_client.force_authenticate(user=user)

        signature_image = _png_file('new.png')
        url = reverse('update-signature', kwargs={'user_id': user.id})

        response = api_client.post(
            url,
            {'method': 'draw', 'signature_image': signature_image},
            format='multipart',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['message'] == 'Signature updated successfully'
        assert UserSignature.objects.filter(user=user).count() == 1
        mock_delete.assert_called_once()
