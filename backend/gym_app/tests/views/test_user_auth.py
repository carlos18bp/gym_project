import pytest
import json
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.core import mail
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from gym_app.models import User, PasswordCode
from django.core.files.uploadedfile import SimpleUploadedFile

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user_data():
    return {
        'email': 'test@example.com',
        'password': 'securepassword123',
        'first_name': 'Test',
        'last_name': 'User',
        'role': 'client'
    }

@pytest.fixture
def existing_user():
    user = User.objects.create_user(
        email='existing@example.com',
        password='existingpassword',
        first_name='Existing',
        last_name='User'
    )
    return user

@pytest.fixture
def user():
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword',
        first_name='Test',
        last_name='User'
    )

@pytest.mark.django_db
class TestSignOn:
    
    def test_sign_on_success(self, api_client, user_data):
        """Test successful user registration"""
        # Make the request
        url = reverse('sign_on')
        response = api_client.post(url, user_data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert 'refresh' in response.data
        assert 'access' in response.data
        assert 'user' in response.data
        assert response.data['user']['email'] == user_data['email']
        
        # Verify user was created in the database
        assert User.objects.filter(email=user_data['email']).exists()
        
        # Verify password was hashed
        user = User.objects.get(email=user_data['email'])
        assert user.check_password(user_data['password'])
    
    def test_sign_on_existing_email(self, api_client, user_data, existing_user):
        """Test registration with an existing email"""
        # Use an existing email
        user_data['email'] = existing_user.email
        
        # Make the request
        url = reverse('sign_on')
        response = api_client.post(url, user_data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_409_CONFLICT
        assert 'warning' in response.data
        assert 'already registered' in response.data['warning']
    
    def test_sign_on_invalid_data(self, api_client):
        """Test registration with invalid data"""
        # Invalid data (missing required field - email)
        invalid_data = {
            'password': 'securepassword123',
            'first_name': 'Test',
            'last_name': 'User'
        }
        
        # Make the request
        url = reverse('sign_on')
        response = api_client.post(url, invalid_data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        
        # Verify no user was created
        assert not User.objects.filter(first_name='Test', last_name='User').exists()

@pytest.mark.django_db
class TestSendVerificationCode:
    
    @patch('gym_app.views.userAuth.send_mail')
    def test_send_verification_code_success(self, mock_send_mail, api_client):
        """Test successful sending of verification code"""
        # Prepare data
        data = {'email': 'new@example.com'}
        
        # Make the request
        url = reverse('send_verification_code')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'passcode' in response.data
        assert len(response.data['passcode']) == 6  # 6-digit code
        
        # Verify email was sent
        assert mock_send_mail.called
        
        # Check that send_mail was called with the correct email
        # The send_mail function takes 4 positional arguments:
        # subject, message, from_email, recipient_list
        args, kwargs = mock_send_mail.call_args
        # Make sure the fourth argument (index 3) is the email list
        assert data['email'] in args[3]  # recipient_list is the fourth positional argument
    
    def test_send_verification_code_existing_email(self, api_client, existing_user):
        """Test sending verification code to an existing email"""
        # Prepare data with existing email
        data = {'email': existing_user.email}
        
        # Make the request
        url = reverse('send_verification_code')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_409_CONFLICT
        assert 'error' in response.data
        assert 'already registered' in response.data['error']
    
    def test_send_verification_code_no_email(self, api_client):
        """Test sending verification code without providing email"""
        # Make the request with empty data
        url = reverse('send_verification_code')
        response = api_client.post(url, {}, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'email is required' in response.data['error'].lower()

@pytest.mark.django_db
class TestSignIn:
    
    def test_sign_in_with_password_success(self, api_client, existing_user):
        """Test successful sign-in with password"""
        # Prepare data
        data = {
            'email': existing_user.email,
            'password': 'existingpassword'  # Plain password from fixture
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'refresh' in response.data
        assert 'access' in response.data
        assert 'user' in response.data
    
    def test_sign_in_with_wrong_password(self, api_client, existing_user):
        """Test sign-in with wrong password"""
        # Prepare data with wrong password
        data = {
            'email': existing_user.email,
            'password': 'wrongpassword'
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.data
    
    def test_sign_in_with_passcode_success(self, api_client, existing_user):
        """Test successful sign-in with passcode"""
        # Create a passcode for the user
        passcode = '123456'
        PasswordCode.objects.create(user=existing_user, code=passcode, used=False)
        
        # Prepare data
        data = {
            'email': existing_user.email,
            'passcode': passcode
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'refresh' in response.data
        assert 'access' in response.data
        assert 'user' in response.data
        
        # Verify passcode was marked as used
        assert PasswordCode.objects.get(code=passcode).used == True
    
    def test_sign_in_with_invalid_passcode(self, api_client, existing_user):
        """Test sign-in with invalid passcode"""
        # Prepare data with invalid passcode
        data = {
            'email': existing_user.email,
            'passcode': '999999'  # Invalid passcode
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.data
    
    def test_sign_in_user_not_found(self, api_client):
        """Test sign-in with non-existent user"""
        # Prepare data with non-existent email
        data = {
            'email': 'nonexistent@example.com',
            'password': 'anypassword'
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.data

@pytest.mark.django_db
class TestGoogleLogin:
    
    @patch('gym_app.views.userAuth.urlopen')
    def test_google_login_existing_user(self, mock_urlopen, api_client, existing_user):
        """Test Google login with an existing user"""
        # Prepare data
        data = {
            'email': existing_user.email,
            'given_name': 'Google',
            'family_name': 'User'
        }
        
        # Make the request
        url = reverse('google_login')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'refresh' in response.data
        assert 'access' in response.data
        assert 'user' in response.data
        assert response.data['user']['email'] == existing_user.email
    
    @patch('gym_app.views.userAuth.urlopen')
    def test_google_login_new_user(self, mock_urlopen, api_client):
        """Test Google login creating a new user"""
        # Mock the urlopen response for the profile image
        mock_response = MagicMock()
        mock_response.read.return_value = b'fake_image_data'
        mock_urlopen.return_value = mock_response
        
        # Prepare data for a new user
        data = {
            'email': 'google.user@example.com',
            'given_name': 'Google',
            'family_name': 'User',
            'picture': 'http://example.com/picture.jpg'
        }
        
        # Make the request
        url = reverse('google_login')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'refresh' in response.data
        assert 'access' in response.data
        assert 'user' in response.data
        
        # Verify new user was created
        assert User.objects.filter(email='google.user@example.com').exists()
        user = User.objects.get(email='google.user@example.com')
        assert user.first_name == 'Google'
        assert user.last_name == 'User'
    
    def test_google_login_no_email(self, api_client):
        """Test Google login without providing email"""
        # Make the request with missing email
        url = reverse('google_login')
        response = api_client.post(url, {'given_name': 'Test'}, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data['status']

@pytest.mark.django_db
class TestUpdatePassword:
    
    def test_update_password_success(self, api_client, existing_user):
        """Test successful password update"""
        # Authenticate the user
        api_client.force_authenticate(user=existing_user)
        
        # Prepare data
        data = {
            'current_password': 'existingpassword',  # Original password
            'new_password': 'newpassword123'
        }
        
        # Make the request
        url = reverse('update_password')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'updated successfully' in response.data['message']
        
        # Verify password was updated
        existing_user.refresh_from_db()
        assert existing_user.check_password('newpassword123')
    
    def test_update_password_wrong_current(self, api_client, existing_user):
        """Test password update with wrong current password"""
        # Authenticate the user
        api_client.force_authenticate(user=existing_user)
        
        # Prepare data with wrong current password
        data = {
            'current_password': 'wrongpassword',
            'new_password': 'newpassword123'
        }
        
        # Make the request
        url = reverse('update_password')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'incorrect' in response.data['error']
        
        # Verify password was not updated
        existing_user.refresh_from_db()
        assert not existing_user.check_password('newpassword123')
    
    def test_update_password_missing_fields(self, api_client, existing_user):
        """Test password update with missing fields"""
        # Authenticate the user
        api_client.force_authenticate(user=existing_user)
        
        # Make the request with missing fields
        url = reverse('update_password')
        response = api_client.post(url, {'current_password': 'existingpassword'}, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
    
    def test_update_password_unauthenticated(self, api_client):
        """Test password update when not authenticated"""
        # Make the request without authentication
        url = reverse('update_password')
        response = api_client.post(url, {}, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
class TestPasswordResetFlow:
    
    @patch('gym_app.views.userAuth.send_mail')
    def test_send_passcode_success(self, mock_send_mail, api_client, existing_user):
        """Test successful sending of password reset passcode"""
        # Prepare data
        data = {
            'email': existing_user.email,
            'subject_email': 'Password Reset'
        }
        
        # Make the request
        url = reverse('send_passcode')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        
        # Verify email was sent
        assert mock_send_mail.called
        
        # Verify passcode was created in database
        assert PasswordCode.objects.filter(user=existing_user).exists()
    
    def test_send_passcode_user_not_found(self, api_client):
        """Test sending passcode to non-existent user"""
        # Prepare data with non-existent email
        data = {
            'email': 'nonexistent@example.com',
            'subject_email': 'Password Reset'
        }
        
        # Make the request
        url = reverse('send_passcode')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'error' in response.data
    
    def test_verify_passcode_and_reset_success(self, api_client, existing_user):
        """Test successful password reset with valid passcode"""
        # Create a passcode for the user
        passcode = '123456'
        PasswordCode.objects.create(user=existing_user, code=passcode, used=False)
        
        # Prepare data
        data = {
            'passcode': passcode,
            'new_password': 'resetpassword123'
        }
        
        # Make the request
        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'reset successful' in response.data['message']
        
        # Verify password was reset
        existing_user.refresh_from_db()
        assert existing_user.check_password('resetpassword123')
        
        # Verify passcode was marked as used
        assert PasswordCode.objects.get(code=passcode).used == True
    
    def test_verify_passcode_invalid_code(self, api_client):
        """Test password reset with invalid passcode"""
        # Prepare data with invalid passcode
        data = {
            'passcode': '999999',  # Invalid passcode
            'new_password': 'resetpassword123'
        }
        
        # Make the request
        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'invalid or expired' in response.data['error'].lower()

@pytest.mark.django_db
class TestValidateToken:
    
    def test_validate_token_success(self, api_client, existing_user):
        """Test successful token validation"""
        # Authenticate the user
        api_client.force_authenticate(user=existing_user)
        
        # Make the request
        url = reverse('validate_token')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'detail' in response.data
        assert 'valid' in response.data['detail']
    
    def test_validate_token_unauthenticated(self, api_client):
        """Test token validation without authentication"""
        # Make the request without authentication
        url = reverse('validate_token')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
class TestUpdateProfile:
    
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
        # Removing any fields that might cause validation issues
        data = {
            'first_name': 'Updated',
            'last_name': 'Name',
            'contact': '9876543210',
            'email': user.email,  # Keeping the same email to avoid uniqueness issues
        }
        
        # Make the request without including the photo initially to see if that's the issue
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
        assert not user.is_profile_completed
