import os
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import User
from gym_app.views.layouts.sendEmail import send_template_email

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        email='emailer@example.com',
        password='testpassword',
    )


def _mock_template(html="<html><body>{{ content_html }}</body></html>"):
    template = MagicMock()
    template.render.return_value = html
    return template


def test_send_template_email_missing_layout_template_raises():
    with patch('gym_app.views.layouts.sendEmail.get_template', side_effect=Exception('missing layout')):
        with pytest.raises(FileNotFoundError):
            send_template_email(
                template_name='legal_request',
                subject='Test',
                to_emails=['test@example.com'],
            )


def test_send_template_email_missing_content_template_raises():
    layout_template = _mock_template()

    with patch('gym_app.views.layouts.sendEmail.get_template', side_effect=[layout_template, Exception('missing content')]):
        with pytest.raises(FileNotFoundError):
            send_template_email(
                template_name='legal_request',
                subject='Test',
                to_emails=['test@example.com'],
            )


def test_send_template_email_skips_missing_attachments():
    layout_template = _mock_template()
    content_template = _mock_template("<p>content</p>")

    email_instance = MagicMock()
    email_instance.attach_file.side_effect = [FileNotFoundError(), None]

    with patch('gym_app.views.layouts.sendEmail.get_template', side_effect=[layout_template, content_template]), patch(
        'gym_app.views.layouts.sendEmail.EmailMessage', return_value=email_instance
    ):
        send_template_email(
            template_name='send_files',
            subject='Subject',
            to_emails=['test@example.com'],
            attachments=['/tmp/missing.txt', '/tmp/ok.txt'],
        )

    assert email_instance.attach_file.call_count == 2
    email_instance.send.assert_called_once()


def test_send_email_with_attachments_missing_to_email(api_client, user):
    api_client.force_authenticate(user=user)

    url = reverse('send_email_with_attachments')
    response = api_client.post(url, {}, format='multipart')

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data['error'] == 'El campo "to_email" es obligatorio.'


@pytest.mark.contract
@patch('gym_app.views.layouts.sendEmail.send_template_email')
@patch('os.remove')
@patch('django.core.files.storage.default_storage.save', return_value='tmp/upload.txt')
def test_send_email_with_attachments_success(mock_save, mock_remove, mock_send, api_client, user):
    api_client.force_authenticate(user=user)

    file1 = SimpleUploadedFile('doc.txt', b'data', content_type='text/plain')
    url = reverse('send_email_with_attachments')

    response = api_client.post(
        url,
        {'to_email': 'dest@example.com', 'context': '{}', 'file1': file1},
        format='multipart',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['message'] == 'Email sent successfully.'

    expected_path = os.path.join(settings.MEDIA_ROOT, 'tmp/upload.txt')
    mock_send.assert_called_once()
    _, kwargs = mock_send.call_args
    assert kwargs['attachments'] == [expected_path]
    mock_remove.assert_called_once_with(expected_path)


@patch('gym_app.views.layouts.sendEmail.send_template_email')
@patch('os.remove')
@patch('django.core.files.storage.default_storage.save', return_value='tmp/upload.txt')
def test_send_email_with_attachments_rest_success(mock_save, mock_remove, mock_send, api_client, user):
    api_client.force_authenticate(user=user)

    file1 = SimpleUploadedFile('doc.txt', b'data', content_type='text/plain')
    url = reverse('send_email_with_attachments')

    response = api_client.post(
        url,
        {'to_email': 'dest@example.com', 'context': '{}', 'file1': file1},
        format='multipart',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['message'] == 'Email sent successfully.'

    expected_path = os.path.join(settings.MEDIA_ROOT, 'tmp/upload.txt')
    mock_send.assert_called_once()
    mock_remove.assert_called_once_with(expected_path)


@patch('gym_app.views.layouts.sendEmail.send_template_email')
def test_send_email_with_attachments_invalid_context_defaults(mock_send, api_client, user):
    api_client.force_authenticate(user=user)

    url = reverse('send_email_with_attachments')
    response = api_client.post(
        url,
        {'to_email': 'dest@example.com', 'context': 'not-json'},
        format='multipart',
    )

    assert response.status_code == status.HTTP_200_OK
    _, kwargs = mock_send.call_args
    assert kwargs['context'] == {}


@patch('gym_app.views.layouts.sendEmail.send_template_email', side_effect=FileNotFoundError('missing'))
def test_send_email_with_attachments_returns_404_on_missing_template(mock_send, api_client, user):
    api_client.force_authenticate(user=user)

    url = reverse('send_email_with_attachments')
    response = api_client.post(
        url,
        {'to_email': 'dest@example.com'},
        format='multipart',
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.data['error'] == 'missing'


@patch('gym_app.views.layouts.sendEmail.send_template_email', side_effect=Exception('boom'))
def test_send_email_with_attachments_returns_500_on_unexpected_error(mock_send, api_client, user):
    api_client.force_authenticate(user=user)

    url = reverse('send_email_with_attachments')
    response = api_client.post(
        url,
        {'to_email': 'dest@example.com'},
        format='multipart',
    )

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.data['error'] == 'boom'


@pytest.mark.edge
@patch('gym_app.views.layouts.sendEmail.send_template_email')
@patch('os.remove', side_effect=OSError('cleanup failed'))
@patch('django.core.files.storage.default_storage.save', return_value='tmp/upload.txt')
def test_send_email_with_attachments_context_list_and_cleanup_error(
    mock_save,
    mock_remove,
    mock_send,
    api_client,
    user,
):
    api_client.force_authenticate(user=user)

    file1 = SimpleUploadedFile('doc.txt', b'data', content_type='text/plain')
    url = reverse('send_email_with_attachments')

    response = api_client.post(
        url,
        {'to_email': 'dest@example.com', 'context': ['not', 'json'], 'file1': file1},
        format='multipart',
    )

    assert response.status_code == status.HTTP_200_OK
    _, kwargs = mock_send.call_args
    assert kwargs['context'] == {}
    assert mock_remove.call_count == 1
