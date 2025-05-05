import os
from django.core.mail import EmailMessage
from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from gym_app.models import LegalDocument
from gym_app.serializers import LegalDocumentSerializer
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_legal_intranet_documents(request):
    legal_intranet_documents = LegalDocument.objects.all()
    serializer = LegalDocumentSerializer(
        legal_intranet_documents, 
        many=True, 
        context={'request': request}  # Pass request here
    )
    return Response(serializer.data, status=status.HTTP_200_OK)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_report(request):
    """
    Handles the creation of a report request.

    This view processes form data and attached files from the request, 
    composes an email with the provided information, and sends it to 
    a predefined email address. All attached files are temporarily stored 
    to be included as email attachments and deleted after sending the email.

    Request body:
    - contract (string): Contract number.
    - initialDate (string): Start date of the report period.
    - endDate (string): End date of the report period.
    - paymentConcept (string): Concept of payment.
    - paymentAmount (string): Payment amount.
    - userName (string): User's first name.
    - userLastName (string): User's last name.
    - files (file[]): List of files attached as part of the request.

    Returns:
    - HTTP 201 Created: If the report is successfully sent via email.
    - HTTP 400 Bad Request: If there is an error processing the request.
    """
    try:
        # Extract form data from the request
        contract = request.data.get("contract", "")
        initial_date = request.data.get("initialDate", "")
        end_date = request.data.get("endDate", "")
        payment_concept = request.data.get("paymentConcept", "")
        payment_amount = request.data.get("paymentAmount", "")
        
        # Extract user information
        user_name = request.data.get("userName", "")
        user_last_name = request.data.get("userLastName", "")
        full_name = f"{user_name} {user_last_name}".strip()

        # Retrieve attached files from the request.FILES object
        files = []
        for key in request.FILES:
            if key.startswith("files["):  # Match keys like "files[0]", "files[1]"
                files.append(request.FILES[key])

        # Temporarily save files to include them as email attachments
        attachments = []
        for file in files:
            file_path = default_storage.save(file.name, file)  # Save the file
            attachments.append({
                "path": os.path.join(settings.MEDIA_ROOT, file_path),  # Full path of the file
                "name": file.name,  # Original file name
            })

        # Compose the email
        email_subject = f"Cta Cobro y/o Factura - {full_name}"
        email_body = (
            f"Se ha recibido una nueva solicitud de informe con los siguientes detalles:\n\n"
            f"Nombre: {full_name}\n"
            f"No. Contrato: {contract}\n"
            f"Fecha Inicial: {initial_date}\n"
            f"Fecha Final: {end_date}\n"
            f"Concepto de Pago: {payment_concept}\n"
            f"Valor a Cobrar y/o Facturar: {payment_amount}\n\n"
            f"Por favor, revise los archivos adjuntos para más información."
        )
        recipient_email = "facturacion@gymconsultoresjuridicos.com"  # Update this email address as needed

        # Create the email object with the provided information
        email = EmailMessage(
            email_subject,
            email_body,
            settings.EMAIL_HOST_USER,
            [recipient_email],
        )

        # Attach each file to the email
        for attachment in attachments:
            email.attach_file(attachment["path"])

        # Send the email
        email.send()

        # Clean up temporary files after the email is sent
        for attachment in attachments:
            os.remove(attachment["path"])

        # Return a success response
        return Response(
            {"message": "Informe creado y enviado con éxito."},
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        # Handle errors and return a bad request response
        return Response(
            {"error": f"Ha ocurrido un error al procesar la solicitud: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST,
        )