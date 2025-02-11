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
    """
    try:
        # Extraer datos del request
        to_email = request.data.get('to_email')
        subject = request.data.get('subject', 'Sin asunto')
        body = request.data.get('body', 'Sin contenido')

        # Validar los datos requeridos
        if not to_email:
            return Response({'error': 'El campo "to_email" es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        # Configurar el mensaje de correo
        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email]
        )

        # Procesar archivos adjuntos
        for file_key in request.FILES:
            file = request.FILES[file_key]
            email.attach(file.name, file.read(), file.content_type)

        # Enviar el correo
        email.send()

        return Response({'message': 'Correo enviado exitosamente.'}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)