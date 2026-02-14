import pytest
import json
import requests
from unittest.mock import patch, MagicMock
from django.urls import reverse
from django.core import mail
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from gym_app.models import User, PasswordCode, EmailVerificationCode
from django.core.files.uploadedfile import SimpleUploadedFile
def _mock_captcha_success_patch(monkeypatch):
    """Helper to mock successful captcha verification."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"success": True}
    mock_resp.raise_for_status = MagicMock()
    monkeypatch.setattr(
        "gym_app.utils.captcha.requests.post", lambda *a, **kw: mock_resp
    )

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
    def test_sign_on_success(self, api_client, user_data, monkeypatch):
        """Test successful user registration"""
        _mock_captcha_success_patch(monkeypatch)
        EmailVerificationCode.objects.create(email=user_data['email'], code='123456')
        user_data['passcode'] = '123456'
        user_data['captcha_token'] = 'tok'
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
    def test_sign_on_existing_email(self, api_client, user_data, existing_user, monkeypatch):
        """Test registration with an existing email"""
        _mock_captcha_success_patch(monkeypatch)
        # Use an existing email
        user_data['email'] = existing_user.email
        user_data['passcode'] = '123456'
        user_data['captcha_token'] = 'tok'
        
        # Make the request
        url = reverse('sign_on')
        response = api_client.post(url, user_data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_409_CONFLICT
        assert 'warning' in response.data
        assert 'already registered' in response.data['warning']
    
    @pytest.mark.edge
    def test_sign_on_invalid_data(self, api_client, monkeypatch):
        """Test registration with invalid data"""
        _mock_captcha_success_patch(monkeypatch)
        # Invalid data (missing required field - email)
        invalid_data = {
            'password': 'securepassword123',
            'first_name': 'Test',
            'last_name': 'User',
            'captcha_token': 'tok',
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

        with patch('gym_app.utils.captcha.requests.post', return_value=mock_response) as mock_requests_post:
            response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'message' in response.data
        assert 'passcode' not in response.data

        # Verify code was saved in DB
        from gym_app.models import EmailVerificationCode
        assert EmailVerificationCode.objects.filter(email=data['email']).exists()

        # Captcha verification and email sending should have been called
        mock_requests_post.assert_called_once()
        mock_send_email.assert_called_once()

        _, kwargs = mock_send_email.call_args
        assert kwargs['to_emails'] == [data['email']]
        assert kwargs['template_name'] == 'code_verification'

    @patch('gym_app.utils.captcha.requests.post')
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

    @patch('gym_app.utils.captcha.requests.post', side_effect=requests.RequestException('network error'))
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
    
    @patch('gym_app.utils.captcha.requests.post')
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
    def test_sign_on_rest_success_defaults_role(self, api_client, user_data, monkeypatch):
        _mock_captcha_success_patch(monkeypatch)
        data = dict(user_data)
        data.pop("role", None)
        EmailVerificationCode.objects.create(email=data['email'], code='654321')
        data['passcode'] = '654321'
        data['captcha_token'] = 'tok'

        url = reverse('sign_on')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["user"]["email"] == data["email"]

        user = User.objects.get(email=data["email"])
        assert user.role == 'basic'

    @patch('gym_app.views.userAuth.send_template_email')
    @patch('gym_app.utils.captcha.requests.post')
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
        assert 'message' in response.data
        assert 'passcode' not in response.data
        mock_requests_post.assert_called_once()
        mock_send_email.assert_called_once()

    @patch('gym_app.utils.captcha.requests.post')
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
    
    @patch('gym_app.utils.captcha.requests.post')
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
    
    @patch('gym_app.utils.captcha.requests.post')
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

    @patch('gym_app.utils.captcha.requests.post')
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

    @patch('gym_app.utils.captcha.requests.post', side_effect=requests.RequestException('network error'))
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
    
    @patch('gym_app.utils.captcha.requests.post')
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
        with patch('gym_app.utils.captcha.requests.post', return_value=mock_response) as mock_requests_post:
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

    @patch('gym_app.utils.captcha.requests.post')
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
    
    @patch('gym_app.utils.captcha.requests.post')
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
    
    @patch('gym_app.utils.captcha.requests.post')
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
            'email': existing_user.email,
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
            'email': 'x@x.com',
        }

        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification is required' in response.data['error']

    @patch('gym_app.utils.captcha.requests.post')
    @pytest.mark.edge
    def test_verify_passcode_captcha_failed(self, mock_requests_post, api_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {'success': False}
        mock_response.raise_for_status.return_value = None
        mock_requests_post.return_value = mock_response

        data = {
            'passcode': '123456',
            'new_password': 'resetpassword123',
            'email': 'x@x.com',
            'captcha_token': 'invalid_captcha',
        }

        url = reverse('verify_passcode_and_reset_password')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Captcha verification failed' in response.data['error']
    
    @patch('gym_app.utils.captcha.requests.post')
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
            'email': 'x@x.com',
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


# ======================================================================
# Tests migrated from test_views_batch14.py
# ======================================================================

"""
Batch 14 – 20 tests for:
  • corporate_request.py: dashboard stats, conversation, status update
  • userAuth.py: sign_on, sign_in, google_login, update_password, validate_token,
    send_passcode, verify_passcode_and_reset_password
  • organization_posts.py: CRUD, toggle pin/status, public posts
"""
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    Organization, OrganizationMembership, OrganizationPost, PasswordCode,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b14@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(
        email="corp_b14@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corp_user):
    return Organization.objects.create(
        title="Org B14", corporate_client=corp_user, is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def membership(organization, client_user):
    return OrganizationMembership.objects.create(
        organization=organization, user=client_user, role="MEMBER", is_active=True,
    )


# ===========================================================================
# 1. corporate_request.py – dashboard stats, conversation
# ===========================================================================

@pytest.mark.django_db
class TestCorporateRequestViews:

    def test_dashboard_stats(self, api_client, corp_user, organization):
        """Lines covering corporate_get_dashboard_stats."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("corporate-get-dashboard-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_dashboard_stats_non_corp_forbidden(self, api_client, client_user):
        """Decorator: require_corporate_client_only."""
        api_client.force_authenticate(user=client_user)
        url = reverse("corporate-get-dashboard-stats")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_conversation_not_found(self, api_client, client_user):
        """get_request_conversation – request not found."""
        api_client.force_authenticate(user=client_user)
        url = reverse("get-request-conversation", kwargs={"request_id": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. userAuth.py
# ===========================================================================

@pytest.mark.django_db
class TestUserAuth:

    def test_sign_on_duplicate_email(self, api_client, client_user, monkeypatch):
        """Lines 36-37: email already registered."""
        _mock_captcha_success_patch(monkeypatch)
        url = reverse("sign_on")
        resp = api_client.post(url, {
            "email": client_user.email,
            "password": "newpw123",
            "passcode": "123456",
            "captcha_token": "tok",
        }, format="json")
        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_sign_on_invalid_data(self, api_client, monkeypatch):
        """Lines 63-64: serializer validation error."""
        _mock_captcha_success_patch(monkeypatch)
        url = reverse("sign_on")
        resp = api_client.post(url, {
            "email": "",
            "password": "",
            "captcha_token": "tok",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_sign_in_missing_fields(self, api_client):
        """Lines 151-152: email/password required."""
        url = reverse("sign_in")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_sign_in_missing_captcha(self, api_client):
        """Lines 154-155: captcha required."""
        url = reverse("sign_in")
        resp = api_client.post(url, {
            "email": "test@test.com", "password": "pw",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_google_login_missing_email(self, api_client):
        """Lines 220-221: email required."""
        url = reverse("google_login")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_google_login_new_user_no_picture(self, api_client):
        """Lines 234-252: new user without picture."""
        url = reverse("google_login")
        resp = api_client.post(url, {
            "email": "newgoogle_b14@test.com",
            "given_name": "Google",
            "family_name": "User",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["created"] is True
        assert User.objects.filter(email="newgoogle_b14@test.com").exists()

    def test_google_login_existing_user(self, api_client, client_user):
        """Lines 254-266: existing user login."""
        url = reverse("google_login")
        resp = api_client.post(url, {
            "email": client_user.email,
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["created"] is False

    def test_update_password_missing_fields(self, api_client, client_user):
        """Lines 302-303: both passwords required."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update_password")
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_password_wrong_current(self, api_client, client_user):
        """Lines 306-307: current password incorrect."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update_password")
        resp = api_client.post(url, {
            "current_password": "wrongpw",
            "new_password": "newpw123",
        }, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_password_success(self, api_client, client_user):
        """Lines 310-314: password update success."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update_password")
        resp = api_client.post(url, {
            "current_password": "pw",
            "new_password": "newpw123",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_validate_token(self, api_client, client_user):
        """Lines 453-460: validate token."""
        api_client.force_authenticate(user=client_user)
        url = reverse("validate_token")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK


# ===========================================================================
# 3. organization_posts.py
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationPosts:

    def test_create_post_success(self, api_client, corp_user, organization):
        """Lines 42-63: create post."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("create-organization-post", kwargs={"organization_id": organization.id})
        resp = api_client.post(url, {
            "title": "Test Post",
            "content": "Post content here",
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_post_missing_title(self, api_client, corp_user, organization):
        """Lines 65-72: validation error on missing title."""
        api_client.force_authenticate(user=corp_user)
        url = reverse("create-organization-post", kwargs={"organization_id": organization.id})
        resp = api_client.post(url, {"content": "No title"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_posts(self, api_client, corp_user, organization):
        """Lines 78-120: list posts with filters."""
        OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="P1", content="C1",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_posts_public_member(self, api_client, client_user, organization, membership):
        """Lines 125-172: public posts for member."""
        OrganizationPost.objects.create(
            organization=organization, author=organization.corporate_client,
            title="Public P1", content="C1", is_active=True,
        )
        api_client.force_authenticate(user=client_user)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_posts_public_non_member_forbidden(self, api_client, organization):
        """Lines 144-147: non-member forbidden."""
        outsider = User.objects.create_user(
            email="outsider_b14@test.com", password="pw", role="client",
        )
        api_client.force_authenticate(user=outsider)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_pin(self, api_client, corp_user, organization):
        """Lines 272-294: toggle pin status."""
        post = OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="Pin Post", content="C", is_pinned=False,
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("toggle-organization-post-pin", kwargs={
            "organization_id": organization.id, "post_id": post.id,
        })
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_pinned is True

    def test_toggle_status(self, api_client, corp_user, organization):
        """Lines 300-327: toggle active status."""
        post = OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="Status Post", content="C", is_active=True,
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("toggle-organization-post-status", kwargs={
            "organization_id": organization.id, "post_id": post.id,
        })
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_active is False

    def test_delete_post(self, api_client, corp_user, organization):
        """Lines 245-266: delete post."""
        post = OrganizationPost.objects.create(
            organization=organization, author=corp_user,
            title="Del Post", content="C",
        )
        api_client.force_authenticate(user=corp_user)
        url = reverse("delete-organization-post", kwargs={
            "organization_id": organization.id, "post_id": post.id,
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        assert not OrganizationPost.objects.filter(id=post.id).exists()


# ======================================================================
# Tests migrated from test_views_batch36.py
# ======================================================================

"""Batch 36 – 20 tests: final sweep – user/auth views, permission views, model edges, tag/folder views."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentVariable, Tag, DocumentFolder,
)
from gym_app.models.user import ActivityFeed

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law36@t.com", password="pw", role="lawyer", first_name="L", last_name="W")


# -- user views --
class TestUserViews:
    def test_user_list(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("user-list"))
        assert resp.status_code == 200

    def test_update_profile(self, api, law):
        api.force_authenticate(user=law)
        resp = api.put(
            reverse("update_profile", args=[law.id]),
            {"first_name": "Updated", "last_name": "Name"},
            format="json",
        )
        assert resp.status_code == 200
        law.refresh_from_db()
        assert law.first_name == "Updated"

    def test_get_user_activities(self, api, law):
        ActivityFeed.objects.create(user=law, action_type="login", description="Logged in")
        api.force_authenticate(user=law)
        resp = api.get(reverse("user-activities"))
        assert resp.status_code == 200

    def test_create_activity(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(
            reverse("create-activity"),
            {"action_type": "create", "description": "Test activity"},
            format="json",
        )
        assert resp.status_code == 201
        assert ActivityFeed.objects.filter(user=law, action_type="create").exists()


# -- auth views --
class TestAuthViews:
    def test_validate_token_invalid(self, api):
        resp = api.post(reverse("validate_token"), {"token": "invalid"}, format="json")
        assert resp.status_code in (400, 401)

    def test_sign_in_missing_fields(self, api):
        resp = api.post(reverse("sign_in"), {}, format="json")
        assert resp.status_code == 400

    def test_sign_in_wrong_credentials(self, api):
        User.objects.create_user(email="auth36@t.com", password="pw", role="client")
        resp = api.post(reverse("sign_in"), {"email": "auth36@t.com", "password": "wrong"}, format="json")
        assert resp.status_code in (400, 401)


# -- tag views --
class TestTagViews:
    def test_list_tags(self, api, law):
        Tag.objects.create(name="Tag36", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list-tags"))
        assert resp.status_code == 200

    def test_create_tag(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("create-tag"), {"name": "NewTag36"}, format="json")
        assert resp.status_code == 201
        assert Tag.objects.filter(name="NewTag36").exists()

    def test_delete_tag(self, api, law):
        tag = Tag.objects.create(name="DelTag36", created_by=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-tag", args=[tag.id]))
        assert resp.status_code in (200, 204)
        assert not Tag.objects.filter(id=tag.id).exists()


# -- folder views --
class TestFolderViews:
    def test_list_folders(self, api, law):
        DocumentFolder.objects.create(name="Folder36", owner=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list-folders"))
        assert resp.status_code == 200

    def test_create_folder(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("create-folder"), {"name": "NewFolder36"}, format="json")
        assert resp.status_code == 201
        assert DocumentFolder.objects.filter(name="NewFolder36").exists()

    def test_delete_folder(self, api, law):
        folder = DocumentFolder.objects.create(name="DelFolder36", owner=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-folder", args=[folder.id]))
        assert resp.status_code in (200, 204)
        assert not DocumentFolder.objects.filter(id=folder.id).exists()


# -- permission views --
class TestPermissionViews:
    def test_get_document_permissions(self, api, law):
        doc = DynamicDocument.objects.create(title="Perm36", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-document-permissions", args=[doc.id]))
        assert resp.status_code == 200

    def test_toggle_public_access(self, api, law):
        doc = DynamicDocument.objects.create(title="Pub36", content="<p>x</p>", state="Draft", created_by=law, is_public=False)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("toggle-public-access", args=[doc.id]))
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert doc.is_public is True

    def test_get_available_clients(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-available-clients"))
        assert resp.status_code == 200

    def test_get_available_roles(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-available-roles"))
        assert resp.status_code == 200


# -- model edge: DocumentVariable __str__ --
class TestDocumentVariableStr:
    def test_variable_str(self, law):
        doc = DynamicDocument.objects.create(title="V36", content="<p>x</p>", state="Draft", created_by=law)
        v = DocumentVariable.objects.create(document=doc, name_en="full_name", name_es="Nombre", field_type="input", value="John")
        s = str(v)
        assert s  # verify no crash and non-empty string


# -- legal updates --
class TestLegalUpdatesViews:
    def test_list_legal_updates(self, api, law):
        from gym_app.models import LegalUpdate
        LegalUpdate.objects.create(title="LU36", content="Body", is_active=True)
        api.force_authenticate(user=law)
        resp = api.get(reverse("legal-updates-list"))
        assert resp.status_code == 200

    def test_list_legal_updates_unauthenticated(self, api):
        resp = api.get(reverse("legal-updates-list"))
        assert resp.status_code in (401, 403)
