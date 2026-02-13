import pytest
import json
from unittest.mock import patch
from datetime import timedelta
from django.utils import timezone
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles, LegalRequestResponse

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
        role='client',
    )

@pytest.fixture
def legal_request_type():
    return LegalRequestType.objects.create(
        name='Consultation'
    )

@pytest.fixture
def legal_discipline():
    return LegalDiscipline.objects.create(
        name='Corporate Law'
    )

@pytest.fixture
def legal_request(legal_request_type, legal_discipline, user):
    return LegalRequest.objects.create(
        user=user,
        request_type=legal_request_type,
        discipline=legal_discipline,
        description='I need legal advice for my company.',
    )

@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email='lawyer@example.com',
        password='testpassword',
        first_name='Law',
        last_name='Yer',
        role='lawyer',
    )

@pytest.mark.django_db
@pytest.mark.integration
class TestLegalRequestViews:
    
    @pytest.mark.contract
    def test_create_legal_request_authenticated(self, api_client, user, legal_request_type, legal_discipline):
        """
        Test creating a new legal request when authenticated.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data
        main_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'jane.smith@example.com',
            'requestTypeId': legal_request_type.id,
            'disciplineId': legal_discipline.id,
            'description': 'I need legal advice regarding intellectual property.'
        }
        
        # Make the request
        url = reverse('create-legal-request')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        # The new API returns a summary payload, not the full serialized request
        assert response.data['message'] == 'Legal request received successfully'
        assert response.data['status'] == 'received'
        assert 'email_notification' in response.data
        assert 'next_steps' in response.data
        
        # Verify the legal request was created in the database
        assert LegalRequest.objects.count() == 1
        legal_request = LegalRequest.objects.first()
        # The legal request should be associated to the authenticated user
        assert legal_request.user == user
        assert legal_request.request_type.id == legal_request_type.id
        assert legal_request.discipline.id == legal_discipline.id
    
    @pytest.mark.edge
    def test_create_legal_request_invalid_type(self, api_client, user, legal_discipline):
        """
        Test creating a legal request with an invalid request type ID.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data with an invalid request type ID
        main_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'jane.smith@example.com',
            'requestTypeId': 9999,  # Invalid ID
            'disciplineId': legal_discipline.id,
            'description': 'I need legal advice regarding intellectual property.'
        }
        
        # Make the request
        url = reverse('create-legal-request')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Request type not found' in response.data['detail']
        
        # Verify no legal request was created
        assert LegalRequest.objects.count() == 0
    
    @pytest.mark.edge
    def test_create_legal_request_invalid_discipline(self, api_client, user, legal_request_type):
        """
        Test creating a legal request with an invalid discipline ID.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data with an invalid discipline ID
        main_data = {
            'firstName': 'Jane',
            'lastName': 'Smith',
            'email': 'jane.smith@example.com',
            'requestTypeId': legal_request_type.id,
            'disciplineId': 9999,  # Invalid ID
            'description': 'I need legal advice regarding intellectual property.'
        }
        
        # Make the request
        url = reverse('create-legal-request')
        response = api_client.post(
            url, 
            {'mainData': json.dumps(main_data)}, 
            format='multipart'
        )
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Discipline not found' in response.data['detail']
        
        # Verify no legal request was created
        assert LegalRequest.objects.count() == 0

    @pytest.mark.contract
    def test_upload_legal_request_file(self, api_client, user, legal_request):
        """
        Test uploading a file to an existing legal request.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)

        # Create a valid PDF test file (only allowed types pass validation)
        # Use a minimal PDF header so libmagic correctly detects application/pdf
        pdf_content = (
            b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n"
            b"trailer\n<<>>\n%%EOF\n"
        )
        test_file = SimpleUploadedFile(
            "test_file.pdf",
            pdf_content,
            content_type="application/pdf",
        )

        # Prepare the data
        data = {
            'legalRequestId': legal_request.id,
            'file': test_file
        }

        # Make the request
        url = reverse('upload-legal-request-file')
        response = api_client.post(url, data, format='multipart')

        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['message'] == 'File upload completed'
        assert response.data['successful_uploads'] == 1
        assert response.data['failed_uploads'] == 0

        # Verify the file was associated with the legal request
        legal_request.refresh_from_db()
        assert legal_request.files.count() == 1
        
        # Verify file name more flexibly
        file_name = legal_request.files.first().file.name
        assert 'test_file' in file_name
        assert file_name.endswith('.pdf')

    @pytest.mark.edge
    def test_upload_file_to_nonexistent_request(self, api_client, user):
        """
        Test uploading a file to a non-existent legal request.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create a test file
        test_file = SimpleUploadedFile(
            "test_file.txt", 
            b"This is a test file content", 
            content_type="text/plain"
        )
        
        # Prepare the data with a non-existent legal request ID
        data = {
            'legalRequestId': 9999,  # Non-existent ID
            'file': test_file
        }
        
        # Make the request
        url = reverse('upload-legal-request-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'Legal request not found' in response.data['detail']
        
        # Verify no files were created
        assert LegalRequestFiles.objects.count() == 0
    
    @pytest.mark.edge
    def test_upload_file_without_file(self, api_client, user, legal_request):
        """
        Test uploading without providing a file.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Prepare the data without a file
        data = {
            'legalRequestId': legal_request.id
            # No file provided
        }
        
        # Make the request
        url = reverse('upload-legal-request-file')
        response = api_client.post(url, data, format='multipart')
        
        # Assert the response
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'No files provided' in response.data['detail']
        
        # Verify no files were associated with the legal request
        legal_request.refresh_from_db()
        assert legal_request.files.count() == 0
    
    @pytest.mark.contract
    def test_get_dropdown_options(self, api_client, user, legal_request_type, legal_discipline):
        """
        Test retrieving dropdown options for legal request types and disciplines.
        """
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('get-dropdown-options')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert 'legal_request_types' in response.data
        assert 'legal_disciplines' in response.data
        
        # Verify the content of the response
        assert len(response.data['legal_request_types']) == 1
        assert response.data['legal_request_types'][0]['name'] == 'Consultation'
        
        assert len(response.data['legal_disciplines']) == 1
        assert response.data['legal_disciplines'][0]['name'] == 'Corporate Law'
    
    @pytest.mark.edge
    def test_unauthenticated_access(self, api_client, legal_request_type, legal_discipline):
        """
        Test that unauthenticated users cannot access the legal request endpoints.
        """
        # Test create legal request
        create_url = reverse('create-legal-request')
        create_response = api_client.post(create_url, {}, format='multipart')
        assert create_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test upload file
        upload_url = reverse('upload-legal-request-file')
        upload_response = api_client.post(upload_url, {}, format='multipart')
        assert upload_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Test get dropdown options
        options_url = reverse('get-dropdown-options')
        options_response = api_client.get(options_url)
        assert options_response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.edge
    def test_send_confirmation_email_missing_id(self, api_client, user):
        """If legal_request_id is missing, the view should return 400."""
        api_client.force_authenticate(user=user)

        url = reverse('send-confirmation-email')
        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'] == 'Legal request ID is required.'

    @pytest.mark.edge
    def test_send_confirmation_email_request_not_found(self, api_client, user):
        """If the legal request does not exist, the view should return 404."""
        api_client.force_authenticate(user=user)

        url = reverse('send-confirmation-email')
        response = api_client.post(
            url,
            {'legal_request_id': 9999},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['detail'] == 'Legal request not found.'

    @pytest.mark.edge
    def test_send_confirmation_email_user_without_email(self, api_client, legal_request):
        """If the user has no email configured, the endpoint should fail gracefully."""
        user = legal_request.user
        user.email = ''
        user.save()

        api_client.force_authenticate(user=user)

        url = reverse('send-confirmation-email')
        response = api_client.post(
            url,
            {'legal_request_id': legal_request.id},
            format='json',
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data['detail'] == 'Email sending failed: user email is not configured'
        assert response.data['legal_request_id'] == legal_request.id

    @patch('gym_app.views.legal_request.send_template_email')
    @pytest.mark.contract
    def test_send_confirmation_email_success(self, mock_send_email, api_client, legal_request):
        """Happy path: confirmation email is sent successfully for an existing request."""
        user = legal_request.user
        api_client.force_authenticate(user=user)

        url = reverse('send-confirmation-email')
        response = api_client.post(
            url,
            {'legal_request_id': legal_request.id},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['message'] == 'Confirmation email sent successfully'
        assert response.data['legal_request_id'] == legal_request.id

        mock_send_email.assert_called_once()
        _, kwargs = mock_send_email.call_args
        assert kwargs['template_name'] == 'legal_request'
        assert kwargs['subject'] == 'Confirmación de solicitud legal'
        assert kwargs['to_emails'] == [user.email]

    @patch('gym_app.views.legal_request.send_template_email', side_effect=Exception('SMTP error'))
    @pytest.mark.edge
    def test_send_confirmation_email_failure_sending(self, mock_send_email, api_client, legal_request):
        """If sending the email raises an exception, the view should return 500 but not break."""
        user = legal_request.user
        api_client.force_authenticate(user=user)

        url = reverse('send-confirmation-email')
        response = api_client.post(
            url,
            {'legal_request_id': legal_request.id},
            format='json',
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data['detail'] == 'Email sending failed'
        mock_send_email.assert_called_once()

    @pytest.mark.contract
    def test_list_legal_requests_client_sees_only_own(self, api_client, user, legal_request_type, legal_discipline):
        """Clients should only see their own legal requests."""
        other_user = User.objects.create_user(
            email='other@example.com',
            password='testpassword',
            first_name='Other',
            last_name='User',
            role='client',
        )

        # One request for each user
        my_request = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='My request',
        )
        LegalRequest.objects.create(
            user=other_user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Other request',
        )

        api_client.force_authenticate(user=user)

        url = reverse('list-legal-requests')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['user_role'] == 'client'
        assert response.data['count'] == 1
        assert len(response.data['requests']) == 1
        assert response.data['requests'][0]['id'] == my_request.id

    @pytest.mark.contract
    def test_list_legal_requests_lawyer_sees_all(self, api_client, lawyer_user, legal_request_type, legal_discipline, user):
        """Lawyers should see all legal requests."""
        # Two requests for different clients
        LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Client 1 request',
        )
        another_client = User.objects.create_user(
            email='another@example.com',
            password='testpassword',
            first_name='Another',
            last_name='Client',
            role='client',
        )
        LegalRequest.objects.create(
            user=another_client,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Client 2 request',
        )

        api_client.force_authenticate(user=lawyer_user)

        url = reverse('list-legal-requests')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['user_role'] == 'lawyer'
        assert response.data['count'] == 2
        assert len(response.data['requests']) == 2

    @pytest.mark.contract
    def test_list_legal_requests_search_and_status_filters(self, api_client, user, legal_request_type, legal_discipline):
        """Search and status filters should narrow down the results."""
        # Two requests with different descriptions and statuses
        matching = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Important contract review',
            status='PENDING',
        )
        LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Other issue',
            status='CLOSED',
        )

        api_client.force_authenticate(user=user)

        url = reverse('list-legal-requests')
        response = api_client.get(url, {'search': 'contract', 'status': 'PENDING'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert len(response.data['requests']) == 1
        assert response.data['requests'][0]['id'] == matching.id

    @pytest.mark.edge
    def test_list_legal_requests_date_filters_and_invalid_dates(self, api_client, user, legal_request_type, legal_discipline):
        """Date filters should work with valid dates and ignore invalid ones without crashing."""
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        older_request = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Older request',
        )
        recent_request = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Recent request',
        )

        # Ajustar las fechas manualmente para forzar el rango
        LegalRequest.objects.filter(id=older_request.id).update(created_at=yesterday)
        LegalRequest.objects.filter(id=recent_request.id).update(created_at=today)

        api_client.force_authenticate(user=user)

        url = reverse('list-legal-requests')
        # Solo debería devolver la solicitud reciente
        response = api_client.get(url, {'date_from': str(today)})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert len(response.data['requests']) == 1

        # Invalid date formats should not crash the endpoint
        response_invalid = api_client.get(url, {'date_from': 'invalid-date', 'date_to': 'also-invalid'})
        assert response_invalid.status_code == status.HTTP_200_OK

    @pytest.mark.edge
    def test_update_legal_request_status_forbidden_for_non_lawyer(self, api_client, user, legal_request):
        """Only lawyers should be allowed to update the status."""
        api_client.force_authenticate(user=user)  # client role

        url = reverse('update-legal-request-status', args=[legal_request.id])
        response = api_client.put(url, {'status': 'IN_REVIEW'}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'Only lawyers can update request status' in response.data['detail']

    @pytest.mark.edge
    def test_update_legal_request_status_missing_status(self, api_client, lawyer_user, legal_request):
        """Status field is required in the payload."""
        api_client.force_authenticate(user=lawyer_user)

        url = reverse('update-legal-request-status', args=[legal_request.id])
        response = api_client.put(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'] == 'Status is required'

    @pytest.mark.edge
    def test_update_legal_request_status_invalid_status(self, api_client, lawyer_user, legal_request):
        """If an invalid status is provided, the view should return 400 with valid choices."""
        api_client.force_authenticate(user=lawyer_user)

        url = reverse('update-legal-request-status', args=[legal_request.id])
        response = api_client.put(url, {'status': 'NOT_A_REAL_STATUS'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid status. Valid choices:' in response.data['detail']

    @patch('gym_app.views.legal_request.send_status_update_notification')
    @pytest.mark.contract
    def test_update_legal_request_status_success(self, mock_notify, api_client, lawyer_user, legal_request):
        """Happy path: lawyer updates status successfully and notification is triggered."""
        api_client.force_authenticate(user=lawyer_user)

        # Ensure initial status is different
        legal_request.status = 'PENDING'
        legal_request.save()

        url = reverse('update-legal-request-status', args=[legal_request.id])
        response = api_client.put(url, {'status': 'IN_REVIEW'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert 'Status updated from PENDING to IN_REVIEW' in response.data['message']
        assert response.data['request']['id'] == legal_request.id

        legal_request.refresh_from_db()
        assert legal_request.status == 'IN_REVIEW'

        mock_notify.assert_called_once()

    @patch('gym_app.views.legal_request.send_status_update_notification', side_effect=Exception('SMTP error'))
    @pytest.mark.edge
    def test_update_legal_request_status_notification_failure_does_not_break(self, mock_notify, api_client, lawyer_user, legal_request):
        """If the notification fails, the endpoint should still return 200 and update the status."""
        api_client.force_authenticate(user=lawyer_user)

        legal_request.status = 'PENDING'
        legal_request.save()

        url = reverse('update-legal-request-status', args=[legal_request.id])
        response = api_client.put(url, {'status': 'IN_REVIEW'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        legal_request.refresh_from_db()
        assert legal_request.status == 'IN_REVIEW'
        mock_notify.assert_called_once()

    @pytest.mark.edge
    def test_create_legal_request_response_forbidden_for_unrelated_client(self, api_client, legal_request):
        """A client who is not the owner of the request should not be able to respond."""
        other_client = User.objects.create_user(
            email='other-client@example.com',
            password='testpassword',
            first_name='Other',
            last_name='Client',
            role='client',
        )

        api_client.force_authenticate(user=other_client)

        url = reverse('create-legal-request-response', args=[legal_request.id])
        response = api_client.post(url, {'response_text': 'Unauthorized response'}, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'You do not have permission to respond to this request' in response.data['detail']
        assert LegalRequestResponse.objects.count() == 0

    @pytest.mark.edge
    def test_create_legal_request_response_missing_text(self, api_client, user, legal_request):
        """response_text is required and cannot be empty or whitespace only."""
        api_client.force_authenticate(user=user)

        url = reverse('create-legal-request-response', args=[legal_request.id])
        response = api_client.post(url, {'response_text': '   '}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'] == 'Response text is required'
        assert LegalRequestResponse.objects.count() == 0

    @patch('gym_app.views.legal_request.notify_client_of_lawyer_response')
    @pytest.mark.contract
    def test_create_legal_request_response_lawyer_auto_updates_status(self, mock_notify, api_client, lawyer_user, legal_request):
        """When a lawyer responds to a PENDING request, status should auto-change to IN_REVIEW and notify client."""
        legal_request.status = 'PENDING'
        legal_request.save()

        api_client.force_authenticate(user=lawyer_user)

        url = reverse('create-legal-request-response', args=[legal_request.id])
        response = api_client.post(
            url,
            {'response_text': 'Here is my legal opinion.'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['message'] == 'Response created successfully'

        legal_request.refresh_from_db()
        assert legal_request.status == 'IN_REVIEW'

        # A single response should have been created and linked correctly
        responses = LegalRequestResponse.objects.filter(legal_request=legal_request)
        assert responses.count() == 1
        response_obj = responses.first()
        assert response_obj.user == lawyer_user
        assert response_obj.user_type == 'lawyer'

        mock_notify.assert_called_once_with(legal_request, response_obj)

    @patch('gym_app.views.legal_request.notify_lawyers_of_client_response')
    @pytest.mark.contract
    def test_create_legal_request_response_client_does_not_change_status(self, mock_notify, api_client, user, legal_request):
        """When the client responds, status should not auto-change and lawyers should be notified."""
        # Ensure an initial status
        legal_request.status = 'PENDING'
        legal_request.save()

        api_client.force_authenticate(user=user)

        url = reverse('create-legal-request-response', args=[legal_request.id])
        response = api_client.post(
            url,
            {'response_text': 'Client follow-up.'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED

        legal_request.refresh_from_db()
        # Status should remain unchanged for client responses
        assert legal_request.status == 'PENDING'

        responses = LegalRequestResponse.objects.filter(legal_request=legal_request)
        assert responses.count() == 1
        response_obj = responses.first()
        assert response_obj.user == user
        assert response_obj.user_type == 'client'

        mock_notify.assert_called_once_with(legal_request, response_obj)

    @patch('gym_app.views.legal_request.notify_client_of_lawyer_response', side_effect=Exception('SMTP error'))
    @pytest.mark.edge
    def test_create_legal_request_response_notification_failure_does_not_break_for_lawyer(self, mock_notify, api_client, lawyer_user, legal_request):
        """If notification fails for a lawyer response, the API should still succeed and create the response."""
        legal_request.status = 'PENDING'
        legal_request.save()

        api_client.force_authenticate(user=lawyer_user)

        url = reverse('create-legal-request-response', args=[legal_request.id])
        response = api_client.post(
            url,
            {'response_text': 'Lawyer response despite email failure.'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        legal_request.refresh_from_db()
        assert legal_request.status == 'IN_REVIEW'
        assert LegalRequestResponse.objects.filter(legal_request=legal_request).count() == 1
        mock_notify.assert_called_once()

    @patch('gym_app.views.legal_request.notify_lawyers_of_client_response', side_effect=Exception('SMTP error'))
    @pytest.mark.edge
    def test_create_legal_request_response_notification_failure_does_not_break_for_client(self, mock_notify, api_client, user, legal_request):
        """If notification fails for a client response, the API should still succeed and create the response."""
        legal_request.status = 'PENDING'
        legal_request.save()

        api_client.force_authenticate(user=user)

        url = reverse('create-legal-request-response', args=[legal_request.id])
        response = api_client.post(
            url,
            {'response_text': 'Client response despite email failure.'},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        legal_request.refresh_from_db()
        # Status remains unchanged for client responses
        assert legal_request.status == 'PENDING'
        assert LegalRequestResponse.objects.filter(legal_request=legal_request).count() == 1
        mock_notify.assert_called_once()

    @pytest.mark.edge
    def test_add_files_to_legal_request_forbidden_for_non_owner(self, api_client, user, lawyer_user, legal_request_type, legal_discipline):
        """A user who is not the owner of the request cannot add files."""
        request_owned_by_client = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Client request',
        )

        api_client.force_authenticate(user=lawyer_user)

        url = reverse('add-files-to-legal-request', args=[request_owned_by_client.id])
        response = api_client.post(url, {}, format='multipart')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'You do not have permission to add files to this request' in response.data['detail']

    @pytest.mark.edge
    def test_add_files_to_legal_request_forbidden_for_non_client(self, api_client, lawyer_user, legal_request_type, legal_discipline):
        """Even if the user owns the request, only clients (role=client) can add files."""
        # Create a request owned by a lawyer
        lawyer_request = LegalRequest.objects.create(
            user=lawyer_user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Lawyer-owned request',
        )

        api_client.force_authenticate(user=lawyer_user)

        url = reverse('add-files-to-legal-request', args=[lawyer_request.id])
        response = api_client.post(url, {}, format='multipart')

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data['detail'] == 'Only clients can add files to requests'


@pytest.mark.django_db
class TestLegalRequestRest:
    def test_rest_list_and_detail(self, api_client, user, legal_request_type, legal_discipline):
        request_obj = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Rest request',
        )

        api_client.force_authenticate(user=user)

        list_url = reverse('list-legal-requests')
        response = api_client.get(list_url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['requests'][0]['id'] == request_obj.id

        detail_url = reverse('get-or-delete-legal-request', kwargs={'request_id': request_obj.id})
        response = api_client.get(detail_url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == request_obj.id

    @patch('gym_app.views.legal_request.send_status_update_notification')
    def test_rest_update_status_and_delete(self, mock_notify, api_client, lawyer_user, user, legal_request_type, legal_discipline):
        request_obj = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Rest update',
            status='PENDING',
        )

        api_client.force_authenticate(user=lawyer_user)

        status_url = reverse('update-legal-request-status', args=[request_obj.id])
        response = api_client.put(status_url, {'status': 'IN_REVIEW'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        request_obj.refresh_from_db()
        assert request_obj.status == 'IN_REVIEW'
        mock_notify.assert_called_once()

        delete_url = reverse('delete-legal-request', args=[request_obj.id])
        response = api_client.delete(delete_url)

        assert response.status_code == status.HTTP_200_OK
        assert not LegalRequest.objects.filter(id=request_obj.id).exists()

    @pytest.mark.edge
    def test_add_files_to_legal_request_closed_request(self, api_client, user, legal_request):
        """Cannot add files to a CLOSED legal request."""
        legal_request.status = 'CLOSED'
        legal_request.save()

        api_client.force_authenticate(user=legal_request.user)

        url = reverse('add-files-to-legal-request', args=[legal_request.id])
        response = api_client.post(url, {}, format='multipart')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'] == 'Cannot add files to a closed request'

    @pytest.mark.edge
    def test_add_files_to_legal_request_no_files_provided(self, api_client, user, legal_request):
        """If no files are provided, the endpoint should return 400."""
        api_client.force_authenticate(user=user)

        url = reverse('add-files-to-legal-request', args=[legal_request.id])
        response = api_client.post(url, {}, format='multipart')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'] == 'No files provided.'

    @patch('gym_app.views.legal_request.process_file_upload')
    @pytest.mark.edge
    def test_add_files_to_legal_request_success_and_failure_mix(self, mock_process_upload, api_client, user, legal_request):
        """When some files succeed and others fail, the response should reflect both."""
        api_client.force_authenticate(user=user)

        # Configure process_file_upload to return one success and one failure
        mock_process_upload.side_effect = [
            {
                'success': True,
                'data': {
                    'id': 1,
                    'original_name': 'ok.pdf',
                    'sanitized_name': 'ok-sanitized.pdf',
                    'size': 123,
                },
            },
            {
                'success': False,
                'error': {
                    'name': 'bad.pdf',
                    'message': 'Invalid file',
                },
            },
        ]

        file1 = SimpleUploadedFile('ok.pdf', b'%PDF-1.4', content_type='application/pdf')
        file2 = SimpleUploadedFile('bad.pdf', b'%PDF-1.4', content_type='application/pdf')

        url = reverse('add-files-to-legal-request', args=[legal_request.id])
        response = api_client.post(
            url,
            {'files': [file1, file2]},
            format='multipart',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['successful_uploads'] == [
            {
                'id': 1,
                'filename': 'ok-sanitized.pdf',
                'size': 123,
            }
        ]
        assert response.data['failed_uploads'] == [
            {
                'filename': 'bad.pdf',
                'error': 'Invalid file',
            }
        ]
        assert 'warning' in response.data

    @patch('gym_app.views.legal_request.process_file_upload', side_effect=Exception('Unexpected error'))
    @pytest.mark.edge
    def test_add_files_to_legal_request_unexpected_error_returns_500(self, mock_process_upload, api_client, user, legal_request):
        """If an unexpected error occurs while adding files, the endpoint should return 500."""
        api_client.force_authenticate(user=user)

        file1 = SimpleUploadedFile('file.pdf', b'%PDF-1.4', content_type='application/pdf')

        url = reverse('add-files-to-legal-request', args=[legal_request.id])
        response = api_client.post(
            url,
            {'files': [file1]},
            format='multipart',
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data['detail'] == 'An error occurred while adding files.'

    def _create_file_for_request(self, legal_request):
        """Helper to create and attach a file to a legal request for download tests."""
        file_content = b'Test file content'
        test_file = SimpleUploadedFile('test.txt', file_content, content_type='text/plain')
        file_obj = LegalRequestFiles.objects.create(file=test_file)
        legal_request.files.add(file_obj)
        return file_obj

    @pytest.mark.edge
    def test_download_legal_request_file_forbidden_for_unrelated_client(self, api_client, legal_request):
        """A client who is not the owner of the request cannot download files."""
        other_client = User.objects.create_user(
            email='unrelated@example.com',
            password='testpassword',
            first_name='Unrelated',
            last_name='Client',
            role='client',
        )

        file_obj = self._create_file_for_request(legal_request)

        api_client.force_authenticate(user=other_client)

        url = reverse('download-legal-request-file', args=[legal_request.id, file_obj.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'You do not have permission to download files from this request' in response.data['detail']

    @pytest.mark.edge
    def test_download_legal_request_file_not_found(self, api_client, user, legal_request):
        """If the file does not exist, the endpoint should return 404."""
        api_client.force_authenticate(user=user)

        url = reverse('download-legal-request-file', args=[legal_request.id, 9999])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_download_legal_request_file_not_belonging_to_request(self, api_client, user, legal_request, legal_request_type, legal_discipline):
        """If the file does not belong to the given request, the endpoint should return 403."""
        other_request = LegalRequest.objects.create(
            user=user,
            request_type=legal_request_type,
            discipline=legal_discipline,
            description='Other request',
        )

        file_obj = self._create_file_for_request(other_request)

        api_client.force_authenticate(user=user)

        url = reverse('download-legal-request-file', args=[legal_request.id, file_obj.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data['detail'] == 'File does not belong to this request'

    @patch('gym_app.views.legal_request.os.path.exists', return_value=False)
    @pytest.mark.edge
    def test_download_legal_request_file_missing_on_disk(self, mock_exists, api_client, user, legal_request):
        """If the physical file is missing on disk, the endpoint should return 404."""
        api_client.force_authenticate(user=user)

        file_obj = self._create_file_for_request(legal_request)

        url = reverse('download-legal-request-file', args=[legal_request.id, file_obj.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['detail'] == 'File not found on server'

    @pytest.mark.contract
    def test_download_legal_request_file_success(self, api_client, user, legal_request):
        """Happy path: owner client can download a file successfully."""
        api_client.force_authenticate(user=user)

        file_obj = self._create_file_for_request(legal_request)

        url = reverse('download-legal-request-file', args=[legal_request.id, file_obj.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        content_disposition = response['Content-Disposition']
        # El almacenamiento puede agregar sufijos aleatorios al nombre del archivo,
        # por lo que solo verificamos que sea un adjunto y que termine en .txt
        assert content_disposition.startswith('attachment; filename="')
        assert content_disposition.endswith('.txt"')
        assert response['Content-Type'] == 'text/plain'
        assert response.content == b'Test file content'

    @patch('gym_app.views.legal_request.os.path.exists', return_value=True)
    @patch('gym_app.views.legal_request.open', side_effect=Exception('IO error'))
    @pytest.mark.edge
    def test_download_legal_request_file_read_error_returns_500(self, mock_open, mock_exists, api_client, user, legal_request):
        """If reading the file content fails, the endpoint should return 500."""
        api_client.force_authenticate(user=user)

        file_obj = self._create_file_for_request(legal_request)

        url = reverse('download-legal-request-file', args=[legal_request.id, file_obj.id])
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert response.data['detail'] == 'Error reading file content'
