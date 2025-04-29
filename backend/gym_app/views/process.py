import json
import traceback
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from gym_app.models import Process, Stage, CaseFile, Case, User, RecentProcess
from gym_app.serializers.process import ProcessSerializer, RecentProcessSerializer
from django.shortcuts import get_object_or_404
from django.utils import timezone

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
        print("Received Main Data:", main_data)

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

        # Create the Process instance
        process = Process.objects.create(
            authority=main_data.get('authority'),
            plaintiff=main_data.get('plaintiff'),
            defendant=main_data.get('defendant'),
            ref=main_data.get('ref'),
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
    - REPLACE ALL existing stages with the ones from frontend.
    """
    process = get_object_or_404(Process, pk=pk)
    print("Received request.data:", request.data)

    # Check if the request data is already a dict or if it's a string
    if isinstance(request.data, dict) and 'mainData' not in request.data:
        main_data = request.data
    else:
        try:
            # Try to parse mainData as JSON
            main_data_str = request.data.get('mainData', '{}')
            print("Raw mainData string:", main_data_str)
            main_data = json.loads(main_data_str)
        except (TypeError, json.JSONDecodeError) as e:
            # If that fails, use request.data directly
            print(f"Error parsing JSON: {e}")
            main_data = request.data
    
    print("Processed main_data:", main_data)
    
    # Update basic fields directly
    if 'plaintiff' in main_data:
        print(f"Setting plaintiff to: {main_data['plaintiff']}")
        process.plaintiff = main_data['plaintiff']
    
    if 'defendant' in main_data:
        print(f"Setting defendant to: {main_data['defendant']}")
        process.defendant = main_data['defendant']
    
    if 'ref' in main_data:
        print(f"Setting ref to: {main_data['ref']}")
        process.ref = main_data['ref']
    
    if 'authority' in main_data:
        print(f"Setting authority to: {main_data['authority']}")
        process.authority = main_data['authority']
    
    if 'subcase' in main_data:
        print(f"Setting subcase to: {main_data['subcase']}")
        process.subcase = main_data['subcase']
    
    # Update client
    client_id = main_data.get('clientId')
    if client_id:
        try:
            client = User.objects.get(id=client_id)
            process.client = client
            print(f"Updated client to ID: {client_id}")
        except User.DoesNotExist:
            print(f"Client with ID {client_id} not found")
    
    # Update lawyer
    lawyer_id = main_data.get('lawyerId')
    if lawyer_id:
        try:
            lawyer = User.objects.get(id=lawyer_id)
            process.lawyer = lawyer
            print(f"Updated lawyer to ID: {lawyer_id}")
        except User.DoesNotExist:
            print(f"Lawyer with ID {lawyer_id} not found")

    # Update Case Type
    case_type_id = main_data.get('caseTypeId')
    if case_type_id:
        try:
            case = Case.objects.get(id=case_type_id)
            process.case = case
            print(f"Updated case type to ID: {case_type_id}")
        except Case.DoesNotExist:
            print(f"Case type with ID {case_type_id} not found")
    
    # First save to apply the basic field updates
    process.save()
    
    # Print current process state for debugging
    print(f"Process state after basic updates: authority={process.authority}, plaintiff={process.plaintiff}")
    
    # SIMPLIFIED STAGE HANDLING: Replace all existing stages with new ones
    stages_data = main_data.get('stages', [])
    print(f"New stages data from frontend: {stages_data}")
    
    # Remove all existing stages
    process.stages.clear()
    print("Cleared all existing stages")
    
    # Create and add new stages from frontend data
    for stage_data in stages_data:
        if 'status' in stage_data and stage_data['status']:
            stage_status = stage_data['status']
            print(f"Creating new stage with status: {stage_status}")
            new_stage = Stage.objects.create(status=stage_status)
            process.stages.add(new_stage)
    
    # Handle case files
    case_file_ids = main_data.get('caseFileIds', [])
    if case_file_ids:
        print(f"Setting case files to IDs: {case_file_ids}")
        process.case_files.set(CaseFile.objects.filter(id__in=case_file_ids))
    
    # Final save with all updates
    process.save()
    
    # Verify process state after all updates
    updated_process = Process.objects.get(pk=pk)
    print(f"Final process state: authority={updated_process.authority}, plaintiff={updated_process.plaintiff}")
    
    # Return the updated process
    serializer = ProcessSerializer(updated_process, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_case_file(request):
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recent_processes(request):
    """
    Get the 10 most recently viewed processes by the authenticated user.
    """
    recent_processes = RecentProcess.objects.filter(user=request.user).order_by('-last_viewed')[:10]
    serializer = RecentProcessSerializer(recent_processes, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_recent_process(request, process_id):
    """
    Update or create a recent process entry when a user views a process.
    """
    try:
        process = Process.objects.get(id=process_id)
    except Process.DoesNotExist:
        return Response({'error': 'Process not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Get or create the recent process entry
    recent_process, created = RecentProcess.objects.get_or_create(
        user=request.user,
        process=process,
        defaults={'last_viewed': timezone.now()}
    )
    
    if not created:
        recent_process.last_viewed = timezone.now()
        recent_process.save()
    
    return Response({'status': 'success'}, status=status.HTTP_200_OK)

