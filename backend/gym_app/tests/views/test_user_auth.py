import pytest
import json
import requests
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
@pytest.mark.integration
class TestSignOn:
    
    @pytest.mark.contract
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
    
    @pytest.mark.edge
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
    
    @pytest.mark.edge
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
@pytest.mark.integration
class TestSendVerificationCode:
    
    @patch('gym_app.views.userAuth.send_template_email')
    @pytest.mark.contract
    def test_send_verification_code_success(self, mock_send_email, api_client):
        """Test successful sending of verification code with valid captcha"""
        data = {
            'email': 'new@example.com',
            'captcha_token': 'valid_captcha_token',
        }

        url = reverse('send_verification_code')

        # Mock successful captcha verification
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None

        with patch('gym_app.views.userAuth.requests.post', return_value=mock_response) as mock_requests_post:
            response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'passcode' in response.data
        assert len(response.data['passcode']) == 6

        # Captcha verification and email sending should have been called
        mock_requests_post.assert_called_once()
        mock_send_email.assert_called_once()

        _, kwargs = mock_send_email.call_args
        assert kwargs['to_emails'] == [data['email']]
        assert kwargs['template_name'] == 'code_verification'

    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_send_verification_code_captcha_failed(self, mock_requests_post, api_client):
        data = {
            'email': 'new@example.com',
            'captcha_token': 'invalid_captcha',
        }

        mock_response = MagicMock()
        mock_response.json.return_value = {'success': False}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        url = reverse('send_verification_code')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification failed' in response.data['error']

    @patch('gym_app.views.userAuth.requests.post', side_effect=requests.RequestException('network error'))
    @pytest.mark.edge
    def test_send_verification_code_captcha_request_exception(self, mock_requests_post, api_client):
        data = {
            'email': 'new@example.com',
            'captcha_token': 'captcha_token',
        }

        url = reverse('send_verification_code')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'Error verifying captcha' in response.data['error']
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_send_verification_code_existing_email(self, mock_requests_post, api_client, existing_user):
        """Test sending verification code to an existing email"""
        data = {
            'email': existing_user.email,
            'captcha_token': 'valid_captcha_token',
        }

        # Mock successful captcha verification
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        url = reverse('send_verification_code')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_409_CONFLICT
        assert 'error' in response.data
        assert 'already registered' in response.data['error']
    
    @pytest.mark.edge
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
class TestUserAuthRest:
    def test_sign_on_rest_success_defaults_role(self, api_client, user_data):
        data = dict(user_data)
        data.pop("role", None)

        url = reverse('sign_on')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["user"]["email"] == data["email"]

        user = User.objects.get(email=data["email"])
        assert user.role == 'basic'

    @patch('gym_app.views.userAuth.send_template_email')
    @patch('gym_app.views.userAuth.requests.post')
    def test_send_verification_code_rest_success(self, mock_requests_post, mock_send_email, api_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        url = reverse('send_verification_code')
        payload = {
            'email': 'rest-new@example.com',
            'captcha_token': 'valid_captcha',
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'passcode' in response.data
        mock_requests_post.assert_called_once()
        mock_send_email.assert_called_once()

    @patch('gym_app.views.userAuth.requests.post')
    def test_sign_in_rest_success(self, mock_requests_post, api_client, existing_user):
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        url = reverse('sign_in')
        payload = {
            'email': existing_user.email,
            'password': 'existingpassword',
            'captcha_token': 'valid_captcha',
        }
        response = api_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data

@pytest.mark.django_db
@pytest.mark.integration
class TestSignIn:
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.contract
    def test_sign_in_with_password_success(self, mock_requests_post, api_client, existing_user):
        """Test successful sign-in with password and valid captcha"""
        # Mock successful captcha verification
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response
        
        # Prepare data
        data = {
            'email': existing_user.email,
            'password': 'existingpassword',  # Plain password from fixture
            'captcha_token': 'valid_captcha_token'
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'refresh' in response.data
        assert 'access' in response.data
        assert 'user' in response.data
        
        # Verify captcha was validated
        mock_requests_post.assert_called_once()
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_sign_in_with_wrong_password(self, mock_requests_post, api_client, existing_user):
        """Test sign-in with wrong password and valid captcha"""
        # Mock successful captcha verification
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'email': existing_user.email,
            'password': 'wrongpassword',
            'captcha_token': 'valid_captcha_token',
        }

        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.data

    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_sign_in_captcha_failed(self, mock_requests_post, api_client, existing_user):
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': False}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'email': existing_user.email,
            'password': 'existingpassword',
            'captcha_token': 'invalid_captcha',
        }

        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification failed' in response.data['error']

    @patch('gym_app.views.userAuth.requests.post', side_effect=requests.RequestException('network error'))
    @pytest.mark.edge
    def test_sign_in_captcha_request_exception(self, mock_requests_post, api_client, existing_user):
        data = {
            'email': existing_user.email,
            'password': 'existingpassword',
            'captcha_token': 'captcha_token',
        }

        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'Error verifying captcha' in response.data['error']
    
    @pytest.mark.edge
    def test_sign_in_missing_email(self, api_client):
        """Test sign-in with missing email"""
        # Prepare data without email
        data = {
            'password': 'anypassword'
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'Email and password are required' in response.data['error']
    
    @pytest.mark.edge
    def test_sign_in_missing_password(self, api_client):
        """Test sign-in with missing password"""
        # Prepare data without password
        data = {
            'email': 'test@example.com'
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'Email and password are required' in response.data['error']
    
    @pytest.mark.edge
    def test_sign_in_missing_captcha(self, api_client):
        """Test sign-in with missing captcha token"""
        # Prepare data without captcha_token
        data = {
            'email': 'test@example.com',
            'password': 'testpassword'
        }
        
        # Make the request
        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'Captcha verification is required' in response.data['error']
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_sign_in_user_not_found(self, mock_requests_post, api_client):
        """Test sign-in with non-existent user and valid captcha"""
        # Mock successful captcha verification
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'email': 'nonexistent@example.com',
            'password': 'anypassword',
            'captcha_token': 'valid_captcha_token',
        }

        url = reverse('sign_in')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'error' in response.data

@pytest.mark.django_db
@pytest.mark.integration
class TestGoogleLogin:
    
    @patch('gym_app.views.userAuth.urlopen')
    @pytest.mark.contract
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
    @pytest.mark.contract
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

    @patch('gym_app.views.userAuth.urlopen', side_effect=Exception('urlopen failed'))
    @pytest.mark.edge
    def test_google_login_profile_image_exception(self, mock_urlopen, api_client):
        """Test Google login when profile image urlopen fails"""
        data = {
            'email': 'google.error@example.com',
            'given_name': 'Google',
            'family_name': 'Error',
            'picture': 'http://example.com/broken.jpg'
        }

        url = reverse('google_login')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['created'] is True
        assert User.objects.filter(email='google.error@example.com').exists()
        mock_urlopen.assert_called_once()
    
    @pytest.mark.edge
    def test_google_login_no_email(self, api_client):
        """Test Google login without providing email"""
        # Make the request with missing email
        url = reverse('google_login')
        response = api_client.post(url, {'given_name': 'Test'}, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data['status']

@pytest.mark.django_db
@pytest.mark.integration
class TestUpdatePassword:
    
    @pytest.mark.contract
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
    
    @pytest.mark.edge
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
    
    @pytest.mark.edge
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
    
    @pytest.mark.edge
    def test_update_password_unauthenticated(self, api_client):
        """Test password update when not authenticated"""
        # Make the request without authentication
        url = reverse('update_password')
        response = api_client.post(url, {}, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
@pytest.mark.integration
class TestPasswordResetFlow:
    
    @patch('gym_app.views.userAuth.send_template_email')
    @pytest.mark.contract
    def test_send_passcode_success(self, mock_send_email, api_client, existing_user):
        """Test successful sending of password reset passcode with captcha"""
        data = {
            'email': existing_user.email,
            'subject_email': 'Password Reset',
            'captcha_token': 'valid_captcha_token',
        }

        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None

        url = reverse('send_passcode')
        with patch('gym_app.views.userAuth.requests.post', return_value=mock_response) as mock_requests_post:
            response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        mock_requests_post.assert_called_once()
        mock_send_email.assert_called_once()

        # Verify passcode was created in database
        assert PasswordCode.objects.filter(user=existing_user).exists()

    @pytest.mark.edge
    def test_send_passcode_missing_captcha(self, api_client, existing_user):
        data = {
            'email': existing_user.email,
            'subject_email': 'Password Reset',
        }

        url = reverse('send_passcode')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification is required' in response.data['error']

    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_send_passcode_captcha_failed(self, mock_requests_post, api_client, existing_user):
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': False}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'email': existing_user.email,
            'subject_email': 'Password Reset',
            'captcha_token': 'invalid_captcha_token',
        }

        url = reverse('send_passcode')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification failed' in response.data['error']
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_send_passcode_user_not_found(self, mock_requests_post, api_client):
        """Test sending passcode to non-existent user with valid captcha"""
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'email': 'nonexistent@example.com',
            'subject_email': 'Password Reset',
            'captcha_token': 'valid_captcha_token',
        }

        url = reverse('send_passcode')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'error' in response.data
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.contract
    def test_verify_passcode_and_reset_success(self, mock_requests_post, api_client, existing_user):
        """Test successful password reset with valid passcode and captcha"""
        passcode = '123456'
        PasswordCode.objects.create(user=existing_user, code=passcode, used=False)

        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'passcode': passcode,
            'new_password': 'resetpassword123',
            'captcha_token': 'valid_captcha_token',
        }

        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'reset successful' in response.data['message']

        existing_user.refresh_from_db()
        assert existing_user.check_password('resetpassword123')
        assert PasswordCode.objects.get(code=passcode).used is True

    @pytest.mark.edge
    def test_verify_passcode_missing_captcha(self, api_client):
        data = {
            'passcode': '123456',
            'new_password': 'resetpassword123',
        }

        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification is required' in response.data['error']

    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_verify_passcode_captcha_failed(self, mock_requests_post, api_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': False}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'passcode': '123456',
            'new_password': 'resetpassword123',
            'captcha_token': 'invalid_captcha',
        }

        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification failed' in response.data['error']
    
    @patch('gym_app.views.userAuth.requests.post')
    @pytest.mark.edge
    def test_verify_passcode_invalid_code(self, mock_requests_post, api_client):
        """Test password reset with invalid passcode and valid captcha"""
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': True}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'passcode': '999999',  # Invalid passcode
            'new_password': 'resetpassword123',
            'captcha_token': 'valid_captcha_token',
        }

        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'error' in response.data
        assert 'invalid or expired' in response.data['error'].lower()

@pytest.mark.django_db
@pytest.mark.integration
class TestValidateToken:
    
    @pytest.mark.contract
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
    
    @pytest.mark.edge
    def test_validate_token_unauthenticated(self, api_client):
        """Test token validation without authentication"""
        # Make the request without authentication
        url = reverse('validate_token')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
@pytest.mark.integration
class TestUpdateProfile:
    
    @pytest.mark.contract
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

    @patch('gym_app.views.user.default_storage.save')
    @pytest.mark.contract
    def test_update_profile_with_photo(self, mock_save, api_client, user):
        """Test updating profile with photo (multipart)"""
        from io import BytesIO
        from PIL import Image as PILImage

        api_client.force_authenticate(user=user)

        # Generate a valid JPEG image so ImageField validation passes
        buf = BytesIO()
        PILImage.new('RGB', (100, 100), color='red').save(buf, format='JPEG')
        buf.seek(0)
        test_photo = SimpleUploadedFile(
            "profile.jpg",
            buf.read(),
            content_type="image/jpeg"
        )

        mock_save.return_value = 'profile_photos/saved_profile.jpg'

        data = {
            'first_name': 'Updated',
            'last_name': 'Photo',
            'contact': '1234567890',
            'email': user.email,
            'photo_profile': test_photo,
        }

        url = reverse('update_profile', kwargs={'pk': user.id})
        response = api_client.put(url, data, format='multipart')

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        # photo_profile is set via default_storage.save mock
        assert 'profile_photos' in str(user.photo_profile)
        assert mock_save.call_count >= 1
