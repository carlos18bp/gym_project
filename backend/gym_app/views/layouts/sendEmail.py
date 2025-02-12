from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.core.mail import EmailMessage
from django.conf import settings

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_email_with_attachments(request):
    """
    API view to send an email with attachments (requires authentication).
    
    This endpoint allows an authenticated user to send an email with optional attachments.
    
    Request Data:
    - to_email (str): Recipient's email address (required).
    - subject (str): Email subject (optional, defaults to 'Sin asunto').
    - body (str): Email body content (optional, defaults to 'Sin contenido').
    - FILES (dict): Dictionary of files to be attached to the email.
    
    Returns:
    - 200 OK: If the email is successfully sent.
    - 400 Bad Request: If 'to_email' is missing.
    - 500 Internal Server Error: If an unexpected error occurs.
    """
    try:
        # Extract data from the request
        to_email = request.data.get('to_email')
        subject = request.data.get('subject', 'Sin asunto')
        body = request.data.get('body', 'Sin contenido')

        # Validate required fields
        if not to_email:
            return Response({'error': 'The "to_email" field is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Configure the email message
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email]
        )

        # Process attached files
        for file_key in request.FILES:
            file = request.FILES[file_key]
            email.attach(file.name, file.read(), file.content_type)

        # Send the email
        email.send()

        return Response({'message': 'Email sent successfully.'}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
