import json
import traceback
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from gym_app.models import Process, Stage, CaseFile, Case, User
from gym_app.serializers.process import ProcessSerializer
from django.shortcuts import get_object_or_404

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def process_list(request):
    """
    API view to retrieve a list of processes based on the authenticated user's role.
    - If the user is a client, return the processes where the user is the client.
    - If the user is a lawyer, return the processes where the user is the lawyer.
    - If the user has any other role, return all processes.
    """
    user = request.user  # Get the authenticated user

    try:
        # Check the role of the authenticated user
        if user.role == 'Client':
            processes = Process.objects.filter(client=user) \
                .select_related('client', 'lawyer') \
                .prefetch_related('stages', 'case_files') \
                .order_by('-created_at')
        
        elif user.role == 'Lawyer':
            processes = Process.objects.filter(lawyer=user) \
                .select_related('client', 'lawyer') \
                .prefetch_related('stages', 'case_files') \
                .order_by('-created_at')
        else:
            # If the user has any other role, return all processes
            processes = Process.objects.all() \
                .select_related('client', 'lawyer') \
                .prefetch_related('stages', 'case_files') \
                .order_by('-created_at')

        serializer = ProcessSerializer(processes, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_process(request):
    """
    API view to create a new process.
    This view will:
    - Validate client, lawyer, and case type.
    - Check for unique 'ref' value.
    - Create the process and stages based on the provided data.
    """
    try:
        # Parse the main data from the request
        main_data = json.loads(request.data.get('mainData', '{}'))
        print("Received Main Data:", main_data)  # Debugging

        # Validate client and lawyer
        try:
            client = User.objects.get(pk=main_data.get('clientId'))
            lawyer = User.objects.get(pk=main_data.get('lawyerId'))
        except User.DoesNotExist:
            return Response({'detail': 'Client or Lawyer not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Validate case type
        try:
            case_type = Case.objects.get(pk=main_data.get('caseTypeId'))
        except Case.DoesNotExist:
            return Response({'detail': 'Case type not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check for unique 'ref' value
        ref_value = main_data.get('ref')
        if Process.objects.filter(ref=ref_value).exists():
            return Response({'detail': f'Process with ref {ref_value} already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create the Process instance
        process = Process.objects.create(
            authority=main_data.get('authority'),
            plaintiff=main_data.get('plaintiff'),
            defendant=main_data.get('defendant'),
            ref=ref_value,
            client=client,
            lawyer=lawyer,
            case=case_type,
            subcase=main_data.get('subcase'),
        )

        # Handle Stage instances
        stages_data = main_data.get('stages', [])
        print("Parsed Stages Data:", stages_data)

        # Create and add stages to process
        for stage_data in stages_data:
            if 'status' in stage_data:
                stage = Stage.objects.create(
                    status=stage_data.get('status')
                )
                process.stages.add(stage)

        # Save process with associated stages
        process.save()

        # Serialize and return the created process
        serializer = ProcessSerializer(process, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_process(request, pk):
    """
    API view to update an existing process.
    This view will:
    - Update the process data using the provided main data.
    - Retain only the specified case files by 'caseFileIds'.
    """
    process = get_object_or_404(Process, pk=pk)
    print("Received request.data:", request.data)

    # Extract main data
    main_data = json.loads(request.data.get('mainData', '{}'))

    # Update process main data using the serializer
    serializer = ProcessSerializer(process, data=main_data, partial=True, context={'request': request})
    if serializer.is_valid():
        process = serializer.save()

        # Step 1: Retain only the specified case files by 'caseFileIds'
        case_file_ids_to_retain = set(main_data.get('caseFileIds', []))
        print("Case File IDs to retain:", case_file_ids_to_retain)

        # Remove any case files not in the list of 'caseFileIds'
        process.case_files.set(process.case_files.filter(id__in=case_file_ids_to_retain))

        # Save the process with updated case files
        process.save()

        return Response(serializer.data, status=status.HTTP_200_OK)
    else:
        print("Serializer Errors:", serializer.errors)  # Print any errors in the serializer validation
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_file(request):
    """
    Upload a single file and associate it with an existing process.

    This API endpoint allows authenticated users to upload a file and link it 
    to an existing legal process identified by its `processId`.

    **Request parameters**:
    - `processId` (str): The ID of the process to which the file will be associated.
    - `file` (File): The file to be uploaded.

    **Responses**:
    - `201 Created`: File successfully uploaded and associated with the process.
        - Example response: `{"detail": "File uploaded successfully.", "fileId": 123}`
    - `400 Bad Request`: Missing required parameters or invalid data.
        - Example response: `{"detail": "Process ID is required."}`
    - `404 Not Found`: Process with the specified ID does not exist.
        - Example response: `{"detail": "Not found."}`
    - `500 Internal Server Error`: An unexpected error occurred while processing the request.
        - Example response: `{"detail": "Internal error uploading file."}`

    **Permission required**:
    - Authenticated users only.

    **Example usage**:
    ```bash
    curl -X POST http://127.0.0.1:8000/api/upload_file/ \
      -H "Authorization: Token <your_token>" \
      -F "processId=1" \
      -F "file=@/path/to/file.pdf"
    ```
    """
    # Extract request data
    process_id = request.data.get('processId')  # ID of the process
    file = request.FILES.get('file')  # File to be uploaded

    # Validate required parameters
    if not process_id:
        return Response({'detail': 'Process ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not file:
        return Response({'detail': 'File is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Ensure the process exists
        process = get_object_or_404(Process, pk=process_id)

        # Create a new CaseFile instance and associate it with the process
        case_file = CaseFile.objects.create(file=file)
        process.case_files.add(case_file)

        # Return success response with the ID of the uploaded file
        return Response({'detail': 'File uploaded successfully.', 'fileId': case_file.id}, status=status.HTTP_201_CREATED)

    except Exception as e:
        # Log the exception for debugging purposes
        print("Error uploading file:", str(e))
        return Response({'detail': 'Internal error uploading file.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

