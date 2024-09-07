from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models import Process
from gym_app.serializers.process import ProcessSerializer

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
                .prefetch_related('stages', 'case_files')
        
        elif user.role == 'Lawyer':
            processes = Process.objects.filter(lawyer=user) \
                .select_related('client', 'lawyer') \
                .prefetch_related('stages', 'case_files')
        
        else:
            # If the user has any other role, return all processes
            processes = Process.objects.all() \
                .select_related('client', 'lawyer') \
                .prefetch_related('stages', 'case_files')

        serializer = ProcessSerializer(processes, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def process_detail(request, pk):
    """
    API view to retrieve a single process by id (requires authentication).
    """
    try:
        process = Process.objects.get(pk=pk)
    except Process.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ProcessSerializer(process, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)

