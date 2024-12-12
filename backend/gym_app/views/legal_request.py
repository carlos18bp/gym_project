import json
import traceback
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
from gym_app.serializers import LegalRequestSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_legal_request(request):
    """
    API view to create a new legal request.
    This view will:
    - Validate the `request_type` and `discipline`.
    - Handle file uploads and associate them with the created request.
    """
    try:
        # Parse the main data from the request
        main_data = json.loads(request.data.get('mainData', '{}'))
        print("Received Main Data:", main_data)  # Debugging

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

        # Handle file uploads
        files = request.FILES.getlist('files')
        for file in files:
            legal_request_file = LegalRequestFiles.objects.create(file=file)
            legal_request.files.add(legal_request_file)

        # Save the request with associated files
        legal_request.save()

        # Serialize and return the created request
        serializer = LegalRequestSerializer(legal_request, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
