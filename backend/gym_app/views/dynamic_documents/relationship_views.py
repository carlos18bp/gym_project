"""
API endpoints for managing bidirectional document relationships.

This module provides RESTful endpoints for creating, retrieving, and deleting
relationships between dynamic documents. All operations require authentication
and enforce strict security policies.

Security Features:
- User authentication required for all endpoints
- Document ownership validation (only completed, user-owned documents)
- Permission-based access control using document visibility rules
- Prevention of self-relationships and duplicate relationships

Available Endpoints:
- GET /api/dynamic-documents/{id}/relationships/ - List document relationships
- GET /api/dynamic-documents/{id}/related-documents/ - Get related documents
- GET /api/dynamic-documents/{id}/available-for-relationship/ - Get available documents
- POST /api/dynamic-documents/relationships/create/ - Create new relationship
- DELETE /api/dynamic-documents/relationships/{id}/delete/ - Delete relationship

Business Rules:
- By default, only documents in 'Completed' state can be related
- Documents in 'PendingSignatures' can only add relationships during formalization
- Documents in 'PendingSignatures' or 'FullySigned' cannot change relationships afterward
- Users can only relate documents they own (created_by or assigned_to)
- Relationships are bidirectional (A->B implies B->A)
- No duplicate relationships allowed
- Self-relationships are prevented
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from gym_app.models.dynamic_document import DynamicDocument, DocumentRelationship
from gym_app.serializers.dynamic_document import DynamicDocumentSerializer, DocumentRelationshipSerializer
from gym_app.views.dynamic_documents.permissions import require_document_visibility


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_document_relationships(request, document_id):
    """
    Get all relationships for a specific document.
    
    Returns both incoming and outgoing relationships for the given document.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id)
        
        # Check if user can view this document
        if not document.can_view(request.user):
            return Response(
                {'detail': 'You do not have permission to view this document.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get all relationships where this document is either source or target
        relationships = DocumentRelationship.objects.filter(
            Q(source_document=document) | Q(target_document=document)
        ).select_related('source_document', 'target_document', 'created_by')
        
        serializer = DocumentRelationshipSerializer(relationships, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_related_documents(request, document_id):
    """Get all documents related to a specific document.

    Returns the actual documents that are related, filtered by user permissions.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id)

        # Check if user can view this document
        if not document.can_view(request.user):
            return Response(
                {'detail': 'You do not have permission to view this document.'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # Get related documents using the model method
        related_documents = document.get_related_documents(user=request.user)

        serializer = DynamicDocumentSerializer(related_documents, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_available_documents_for_relationship(request, document_id):
    """
    Get all documents that can be related to a specific document.
    
    Returns documents that the user can view, excluding:
    - The document itself
    - Documents already related to this document
    """
    try:
        source_document = DynamicDocument.objects.get(pk=document_id)
        
        # Check if user can view this document
        if not source_document.can_view(request.user):
            return Response(
                {'detail': 'You do not have permission to view this document.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        allow_pending_signatures = str(
            request.query_params.get('allow_pending_signatures', '')
        ).lower() in {'1', 'true', 'yes'}

        allowed_states = ['Completed']
        if allow_pending_signatures:
            allowed_states.extend(['PendingSignatures', 'FullySigned'])

        # Get documents that belong to the user and are in allowed states.
        user_documents = DynamicDocument.objects.filter(
            Q(created_by=request.user) | Q(assigned_to=request.user),
            state__in=allowed_states
        )
        
        available_documents = []
        
        for doc in user_documents:
            # Skip the source document itself
            if doc.id == source_document.id:
                continue
                
            # Double-check if user can view this document (additional security)
            if not doc.can_view(request.user):
                continue
            
            # Check if already related - Only exclude if EXACT same relationship exists
            existing_relationship = DocumentRelationship.objects.filter(
                Q(source_document=source_document, target_document=doc) |
                Q(source_document=doc, target_document=source_document)
            ).exists()
            
            if not existing_relationship:
                available_documents.append(doc)
        
        serializer = DynamicDocumentSerializer(available_documents, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_document_relationship(request):
    """Create a new relationship between two documents.

    Expected payload::

        {"source_document": 1, "target_document": 2}

    Optional payload::

        {"allow_pending_signatures": true}
    """
    serializer = DocumentRelationshipSerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        source_document = serializer.validated_data['source_document']
        target_document = serializer.validated_data['target_document']

        allow_pending_signatures = bool(request.data.get('allow_pending_signatures'))
        allow_locked_targets = allow_pending_signatures and source_document.state == 'PendingSignatures'
        
        # Check if user can view both documents
        if not source_document.can_view(request.user):
            return Response(
                {'detail': 'You do not have permission to view the source document.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not target_document.can_view(request.user):
            return Response(
                {'detail': 'You do not have permission to view the target document.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Additional validation: both documents must belong to the user and be completed
        source_belongs_to_user = (source_document.created_by == request.user or 
                                source_document.assigned_to == request.user)
        target_belongs_to_user = (target_document.created_by == request.user or 
                                target_document.assigned_to == request.user)
        
        if not source_belongs_to_user:
            return Response(
                {'detail': 'You can only create relationships with your own documents.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not target_belongs_to_user:
            return Response(
                {'detail': 'You can only create relationships with your own documents.'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        if source_document.state == 'PendingSignatures' and not allow_pending_signatures:
            return Response(
                {'detail': 'You cannot modify relationships for documents pending signatures.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if source_document.state == 'FullySigned':
            return Response(
                {'detail': 'You cannot modify relationships for fully signed documents.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not allow_locked_targets and target_document.state in ['PendingSignatures', 'FullySigned']:
            return Response(
                {'detail': 'You cannot modify relationships for documents pending signatures or already signed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Only allow relating documents in final or pending signature states
        allowed_source_states = ['Completed']
        if allow_pending_signatures:
            allowed_source_states.append('PendingSignatures')
        allowed_target_states = ['Completed']
        if allow_locked_targets:
            allowed_target_states.extend(['PendingSignatures', 'FullySigned'])
        source_is_valid = source_document.state in allowed_source_states
        target_is_valid = target_document.state in allowed_target_states

        if not source_is_valid:
            allowed_label = ", ".join(allowed_source_states)
            return Response(
                {'detail': f'You can only relate documents in final state ({allowed_label}). Source document is in state: {source_document.state}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if not target_is_valid:
            allowed_label = ", ".join(allowed_target_states)
            return Response(
                {'detail': f'You can only relate documents in final state ({allowed_label}). Target document is in state: {target_document.state}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if relationship already exists
        existing_relationship = DocumentRelationship.objects.filter(
            Q(source_document=source_document, target_document=target_document) |
            Q(source_document=target_document, target_document=source_document)
        ).exists()
        
        if existing_relationship:
            return Response(
                {'detail': 'A relationship between these documents already exists.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create the relationship
        relationship = serializer.save()
        return Response(
            DocumentRelationshipSerializer(relationship).data, 
            status=status.HTTP_201_CREATED
        )
    
    # If serializer is invalid, normalize duplicate-relationship errors so
    # callers (and tests) can always read a human-friendly message from
    # the "detail" field instead of DRF's non_field_errors structure.
    errors = serializer.errors
    non_field_errors = errors.get('non_field_errors')
    if non_field_errors:
        # Convert any list/array of messages to a single string
        joined = " ".join([str(e) for e in non_field_errors])
        if 'already exists' in joined.lower() or 'must make a unique set' in joined.lower():
            return Response(
                {'detail': 'A relationship between these documents already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    return Response(errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_document_relationship(request, relationship_id):
    """
    Delete a relationship between documents.
    
    Only the creator of the relationship or lawyers can delete relationships.
    """
    try:
        relationship = DocumentRelationship.objects.get(pk=relationship_id)
        
        # Check permissions: only creator or lawyers can delete
        is_lawyer = request.user.role == 'lawyer' or request.user.is_gym_lawyer
        is_creator = relationship.created_by == request.user
        
        if not (is_lawyer or is_creator):
            return Response(
                {'detail': 'You do not have permission to delete this relationship.'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        locked_states = ['PendingSignatures', 'FullySigned']
        if (
            relationship.source_document.state in locked_states
            or relationship.target_document.state in locked_states
        ):
            return Response(
                {'detail': 'You cannot modify relationships for documents pending signatures or already signed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        relationship.delete()
        return Response(
            {'detail': 'Relationship deleted successfully.'}, 
            status=status.HTTP_200_OK
        )
        
    except DocumentRelationship.DoesNotExist:
        return Response(
            {'detail': 'Relationship not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


