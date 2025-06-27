import json
import traceback
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
from gym_app.serializers import LegalRequestSerializer, LegalRequestTypeSerializer, LegalDisciplineSerializer
from gym_app.views.layouts.sendEmail import send_template_email

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_legal_request(request):
    """
    API view to create a new legal request (text data only).
    """
    try:
        # Parse the main data from the request
        main_data = json.loads(request.data.get('mainData', '{}'))

        # Validate request type
        try:
            request_type = LegalRequestType.objects.get(pk=main_data.get('requestTypeId'))
        except LegalRequestType.DoesNotExist:
            return Response({'detail': 'Request type not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Validate discipline
        try:
            discipline = LegalDiscipline.objects.get(pk=main_data.get('disciplineId'))
        except LegalDiscipline.DoesNotExist:
            return Response({'detail': 'Discipline not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Create the LegalRequest instance
        legal_request = LegalRequest.objects.create(
            first_name=main_data.get('firstName'),
            last_name=main_data.get('lastName'),
            email=main_data.get('email'),
            request_type=request_type,
            discipline=discipline,
            description=main_data.get('description')
        )

        # Serialize and return the created request
        serializer = LegalRequestSerializer(legal_request, context={'request': request})

        # === Send confirmation email to the requester ===
        try:
            context = {
                "first_name": legal_request.first_name,
                "last_name": legal_request.last_name,
                "description": legal_request.description,
            }
            send_template_email(
                template_name="legal_request",
                subject="Confirmación de solicitud legal",
                to_emails=[legal_request.email],
                context=context,
            )
        except Exception as e:
            # Do not interrupt the flow if the email fails; just log the error
            print(f"Error enviando correo de confirmación: {e}")

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_legal_request_file(request):
    """
    API view to upload a single file and associate it with a legal request.
    """
    try:
        # Get the legal request ID from the request data
        legal_request_id = request.data.get('legalRequestId')
        if not legal_request_id:
            return Response({'detail': 'Legal request ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate the existence of the LegalRequest instance
        try:
            legal_request = LegalRequest.objects.get(pk=legal_request_id)
        except LegalRequest.DoesNotExist:
            return Response({'detail': 'Legal request not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Handle the file upload
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create the LegalRequestFiles instance
        legal_request_file = LegalRequestFiles.objects.create(file=file)

        # Associate the file with the LegalRequest
        legal_request.files.add(legal_request_file)
        legal_request.save()

        return Response({'detail': 'File uploaded successfully.'}, status=status.HTTP_201_CREATED)

    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_dropdown_options(request):
    # Get the data from the models
    legal_request_types = LegalRequestType.objects.all()
    legal_disciplines = LegalDiscipline.objects.all()

    # Serializing the data
    legal_request_types_serialized = LegalRequestTypeSerializer(legal_request_types, many=True)
    legal_disciplines_serialized = LegalDisciplineSerializer(legal_disciplines, many=True)

    # Build the response JSON
    return Response({
        "legal_request_types": legal_request_types_serialized.data,
        "legal_disciplines": legal_disciplines_serialized.data
    })