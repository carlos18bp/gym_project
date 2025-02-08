from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument, DocumentVariable
from gym_app.serializers.dynamic_document import DynamicDocumentSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_dynamic_document(request):
    """
    Create a new dynamic document.
    """
    print("Request data received:", request.data)

    # If it's a creation from the client, assign `assigned_to`.
    if request.data.get('state') in ['Progress', 'Completed'] and not request.data.get('assigned_to'):
        request.data['assigned_to'] = request.user.id

    # Validar y guardar el documento
    serializer = DynamicDocumentSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        print("Serializer is valid. Saving document...")
        instance = serializer.save()
        print("Document saved successfully:", instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    print("Serializer errors:", serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_dynamic_documents(request):
    """
    Get a list of all dynamic documents.
    """
    documents = DynamicDocument.objects.prefetch_related('variables').all()
    serializer = DynamicDocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_dynamic_document(request, pk):
    """
    Update an existing dynamic document.
    """
    print(request.data)
    try:
        # Obtener el documento y cargar sus variables relacionadas
        document = DynamicDocument.objects.prefetch_related('variables').get(pk=pk)
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Dynamic document not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Evitar modificar el campo `created_by`
    if 'created_by' in request.data:
        request.data.pop('created_by')

    # Validar y actualizar el documento
    serializer = DynamicDocumentSerializer(document, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        print("Serializer is valid. Updating document...")
        instance = serializer.save()
        print("Document updated successfully:", instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    print("Serializer errors:", serializer.errors)
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
    return Response({'detail': 'Dynamic document deleted successfully.'}, status=status.HTTP_200_OK)

