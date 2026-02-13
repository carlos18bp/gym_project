"""
Email notification utilities for legal request management system.

This module provides functions to send email notifications for:
- Status updates on legal requests
- New responses from lawyers or clients
"""

import logging
from datetime import datetime
from django.conf import settings
from django.urls import reverse
from gym_app.views.layouts.sendEmail import send_template_email

logger = logging.getLogger(__name__)


def send_status_update_notification(legal_request, previous_status, new_status):
    """
    Send email notification when a legal request status is updated.
    
    Args:
        legal_request: LegalRequest instance
        previous_status: Previous status string
        new_status: New status string
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    try:
        # Get status display names
        status_choices = dict(legal_request._meta.get_field('status').choices)
        previous_status_display = status_choices.get(previous_status, previous_status)
        new_status_display = status_choices.get(new_status, new_status)
        
        # Prepare email context
        context = {
            'client_name': f"{legal_request.user.first_name} {legal_request.user.last_name}",
            'request_number': legal_request.request_number,
            'request_type': legal_request.request_type.name if legal_request.request_type else 'N/A',
            'discipline': legal_request.discipline.name if legal_request.discipline else 'N/A',
            'previous_status': previous_status_display,
            'new_status': new_status,
            'new_status_display': new_status_display,
            'update_date': datetime.now().strftime('%d de %B de %Y a las %H:%M'),
            'request_url': _get_request_detail_url(legal_request.id),
            'status_message': _get_status_message(new_status)
        }
        
        # Send email to client
        success = send_template_email(
            to_emails=[legal_request.user.email],
            subject=f"Actualización de Estado - Solicitud {legal_request.request_number}",
            template_name='legal_request_status_update',
            context=context
        )
        
        if success:
            logger.info(f"Status update notification sent for request {legal_request.request_number}")
        else:
            logger.error(f"Failed to send status update notification for request {legal_request.request_number}")
            
        return success
        
    except Exception as e:
        logger.error(f"Error sending status update notification: {str(e)}")
        return False


def send_new_response_notification(legal_request, response, recipient_email, recipient_name, recipient_type):
    """
    Send email notification when a new response is added to a legal request.
    
    Args:
        legal_request: LegalRequest instance
        response: LegalRequestResponse instance
        recipient_email: Email of the recipient
        recipient_name: Name of the recipient
        recipient_type: Type of recipient ('lawyer' or 'client')
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    try:
        # Get current status display
        status_choices = dict(legal_request._meta.get_field('status').choices)
        current_status_display = status_choices.get(legal_request.status, legal_request.status)
        
        # Get response user type display
        user_type_choices = dict(response._meta.get_field('user_type').choices)
        response_user_type_display = user_type_choices.get(response.user_type, response.user_type)
        
        # Derive a human-readable author name for the response
        author_name = getattr(response, 'user_name', None)
        if not author_name and getattr(response, 'user', None):
            first_name = getattr(response.user, 'first_name', '') or ""
            last_name = getattr(response.user, 'last_name', '') or ""
            full_name = f"{first_name} {last_name}".strip()
            author_name = full_name or getattr(response.user, 'email', '')

        # Prepare email context
        context = {
            'recipient_name': recipient_name,
            'request_number': legal_request.request_number,
            'request_type': legal_request.request_type.name if legal_request.request_type else 'N/A',
            'current_status': current_status_display,
            'response_author': author_name,
            'response_user_type': response.user_type,
            'response_user_type_display': response_user_type_display,
            'response_text': response.response_text,
            'response_date': response.created_at.strftime('%d de %B de %Y a las %H:%M'),
            'request_url': _get_request_detail_url(legal_request.id),
            'is_client_recipient': recipient_type == 'client'
        }
        
        # Determine subject based on who sent the response
        if response.user_type == 'lawyer':
            subject = f"Nueva Respuesta del Abogado - Solicitud {legal_request.request_number}"
        else:
            subject = f"Nueva Respuesta del Cliente - Solicitud {legal_request.request_number}"
        
        # Send email
        success = send_template_email(
            to_emails=[recipient_email],
            subject=subject,
            template_name='legal_request_new_response',
            context=context
        )
        
        if success:
            logger.info(f"New response notification sent for request {legal_request.request_number} to {recipient_type}")
        else:
            logger.error(f"Failed to send new response notification for request {legal_request.request_number}")
            
        return success
        
    except Exception as e:
        logger.error(f"Error sending new response notification: {str(e)}")
        return False


def notify_lawyers_of_client_response(legal_request, response):
    """
    Notify all lawyers when a client adds a response.
    
    Args:
        legal_request: LegalRequest instance
        response: LegalRequestResponse instance from client
    
    Returns:
        list: List of email addresses that were successfully notified
    """
    try:
        from gym_app.models import User
        
        # Get all lawyers in the system
        lawyers = User.objects.filter(role='lawyer', is_active=True)
        
        successful_notifications = []
        
        for lawyer in lawyers:
            lawyer_name = f"{lawyer.first_name} {lawyer.last_name}".strip() or lawyer.username
            
            success = send_new_response_notification(
                legal_request=legal_request,
                response=response,
                recipient_email=lawyer.email,
                recipient_name=lawyer_name,
                recipient_type='lawyer'
            )
            
            if success:
                successful_notifications.append(lawyer.email)
        
        logger.info(f"Client response notification sent to {len(successful_notifications)} lawyers for request {legal_request.request_number}")
        return successful_notifications
        
    except Exception as e:
        logger.error(f"Error notifying lawyers of client response: {str(e)}")
        return []


def notify_client_of_lawyer_response(legal_request, response):
    """
    Notify the client when a lawyer adds a response.
    
    Args:
        legal_request: LegalRequest instance
        response: LegalRequestResponse instance from lawyer
    
    Returns:
        bool: True if notification was sent successfully
    """
    try:
        client_name = f"{legal_request.user.first_name} {legal_request.user.last_name}"
        
        return send_new_response_notification(
            legal_request=legal_request,
            response=response,
            recipient_email=legal_request.user.email,
            recipient_name=client_name,
            recipient_type='client'
        )
        
    except Exception as e:
        logger.error(f"Error notifying client of lawyer response: {str(e)}")
        return False


def _get_request_detail_url(request_id):
    """
    Generate the URL for viewing request details.
    
    Args:
        request_id: ID of the legal request
    
    Returns:
        str: Full URL to the request detail page
    """
    try:
        # This would need to be adjusted based on your frontend routing
        base_url = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:3000')
        return f"{base_url}/legal-requests/{request_id}"
    except Exception:
        return "#"


def _get_status_message(status):
    """
    Get a descriptive message for each status.
    
    Args:
        status: Status string
    
    Returns:
        str: Descriptive message for the status
    """
    status_messages = {
        'PENDING': 'Tu solicitud está pendiente de revisión. Nuestro equipo la revisará pronto.',
        'IN_REVIEW': 'Tu solicitud está siendo revisada por nuestro equipo legal.',
        'RESPONDED': 'Hemos respondido a tu solicitud. Por favor revisa los detalles.',
        'CLOSED': 'Tu solicitud ha sido cerrada. Si tienes más preguntas, no dudes en crear una nueva solicitud.'
    }
    
    return status_messages.get(status, 'El estado de tu solicitud ha sido actualizado.')
