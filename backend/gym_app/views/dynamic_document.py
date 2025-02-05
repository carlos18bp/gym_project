from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument
from gym_app.serializers.dynamic_document import DynamicDocumentSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_dynamic_document(request):
    """
    Create a new dynamic document.
    """
    print("Request data received:", request.data)  # Log the received data
    data = request.data.copy()

    # Automatically set the current user as the creator
    data['created_by'] = request.user.id

    serializer = DynamicDocumentSerializer(data=data)
    if serializer.is_valid():
        print("Serializer is valid. Saving document...")
        instance = serializer.save()
        print("Document saved successfully:", instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    print("Serializer errors:", serializer.errors)  # Log serializer errors
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_dynamic_documents(request):
    """
    Get a list of all dynamic documents.
    """
    documents = DynamicDocument.objects.all()
    serializer = DynamicDocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_dynamic_document(request, pk):
    """
    Update an existing dynamic document.
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Dynamic document not found.'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data.copy()

    # Ensure `created_by` is not modified during updates
    if 'created_by' in data:
        data.pop('created_by')

    serializer = DynamicDocumentSerializer(document, data=data, partial=True)
    if serializer.is_valid():
        print("Serializer is valid. Updating document...")
        instance = serializer.save()
        print("Document updated successfully:", instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    print("Serializer errors:", serializer.errors)  # Log serializer errors
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_dynamic_document(request, pk):
    """
    Delete a dynamic document.
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Dynamic document not found.'}, status=status.HTTP_404_NOT_FOUND)

    document.delete()
    print(f"Document with ID {pk} deleted successfully.")
    return Response({'detail': 'Dynamic document deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)
