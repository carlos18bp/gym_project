"""
Views for managing document permissions.

This module contains views that allow lawyers to manage document visibility 
and usability permissions for clients.

Public Documents:
- Documents with is_public=True are accessible to all authenticated users
- No explicit permissions need to be managed for public documents
- Lawyers can toggle is_public to make documents universally accessible
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django.db import transaction

from gym_app.models.dynamic_document import (
    DynamicDocument, 
    DocumentVisibilityPermission, 
    DocumentUsabilityPermission
)
from .permissions import require_lawyer_or_owner, require_lawyer_only

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner
def get_document_permissions(request, pk):
    """
    Get all visibility and usability permissions for a specific document.
    
    Returns:
        dict: Contains lists of users with visibility and usability permissions,
              plus document public status
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
        
        # Get all visibility permissions
        visibility_permissions = DocumentVisibilityPermission.objects.filter(
            document=document
        ).select_related('user', 'granted_by')
        
        # Get all usability permissions  
        usability_permissions = DocumentUsabilityPermission.objects.filter(
            document=document
        ).select_related('user', 'granted_by')
        
        # Format response data
        visibility_users = []
        for perm in visibility_permissions:
            visibility_users.append({
                'user_id': perm.user.id,
                'email': perm.user.email,
                'full_name': f"{perm.user.first_name} {perm.user.last_name}".strip(),
                'granted_by': perm.granted_by.email if perm.granted_by else None,
                'granted_at': perm.granted_at
            })
        
        usability_users = []
        for perm in usability_permissions:
            usability_users.append({
                'user_id': perm.user.id,
                'email': perm.user.email,
                'full_name': f"{perm.user.first_name} {perm.user.last_name}".strip(),
                'granted_by': perm.granted_by.email if perm.granted_by else None,
                'granted_at': perm.granted_at
            })
        
        return Response({
            'document_id': document.id,
            'document_title': document.title,
            'is_public': document.is_public,
            'visibility_permissions': visibility_users,
            'usability_permissions': usability_users
        }, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner
def toggle_public_access(request, pk):
    """
    Toggle the public access status of a document.
    
    When is_public=True, all authenticated users can view and edit the document.
    When is_public=False, only users with explicit permissions can access it.
    
    Expected payload:
    {
        "is_public": true/false
    }
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
        is_public = request.data.get('is_public')
        
        if is_public is None:
            return Response(
                {'detail': 'is_public field is required.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        document.is_public = is_public
        document.save(update_fields=['is_public'])
        
        status_text = "public" if is_public else "private"
        
        return Response({
            'document_id': document.id,
            'document_title': document.title,
            'is_public': document.is_public,
            'message': f'Document access changed to {status_text}.'
        }, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner
def grant_visibility_permissions(request, pk):
    """
    Grant visibility permissions to multiple users for a document.
    
    Note: If document is public, explicit permissions are not necessary
    but can still be granted for tracking purposes.
    
    Expected payload:
    {
        "user_ids": [1, 2, 3, ...]
    }
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response(
                {'detail': 'user_ids list is required.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate all users exist
        users = User.objects.filter(id__in=user_ids)
        if len(users) != len(user_ids):
            found_ids = [user.id for user in users]
            missing_ids = [uid for uid in user_ids if uid not in found_ids]
            return Response(
                {'detail': f'Users not found: {missing_ids}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Grant permissions (use get_or_create to avoid duplicates)
        created_permissions = []
        with transaction.atomic():
            for user in users:
                # Skip if user is lawyer (they have automatic access)
                if user.role == 'lawyer' or user.is_gym_lawyer:
                    continue
                    
                permission, created = DocumentVisibilityPermission.objects.get_or_create(
                    document=document,
                    user=user,
                    defaults={'granted_by': request.user}
                )
                
                if created:
                    created_permissions.append({
                        'user_id': user.id,
                        'email': user.email,
                        'full_name': f"{user.first_name} {user.last_name}".strip()
                    })
        
        warning = None
        if document.is_public:
            warning = "Note: Document is public, so all users already have access regardless of explicit permissions."
        
        return Response({
            'document_id': document.id,
            'granted_permissions': created_permissions,
            'warning': warning,
            'message': f'Visibility permissions granted to {len(created_permissions)} users.'
        }, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner
def grant_usability_permissions(request, pk):
    """
    Grant usability permissions to multiple users for a document.
    Users must already have visibility permissions (unless document is public).
    
    Note: If document is public, all users already have usability access.
    
    Expected payload:
    {
        "user_ids": [1, 2, 3, ...]
    }
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response(
                {'detail': 'user_ids list is required.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate all users exist
        users = User.objects.filter(id__in=user_ids)
        if len(users) != len(user_ids):
            found_ids = [user.id for user in users]
            missing_ids = [uid for uid in user_ids if uid not in found_ids]
            return Response(
                {'detail': f'Users not found: {missing_ids}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_permissions = []
        errors = []
        
        with transaction.atomic():
            for user in users:
                # Skip if user is lawyer (they have automatic access)
                if user.role == 'lawyer' or user.is_gym_lawyer:
                    continue
                
                # Check if user has visibility permission (unless document is public)
                if not document.is_public:
                    has_visibility = DocumentVisibilityPermission.objects.filter(
                        document=document, user=user
                    ).exists()
                    
                    if not has_visibility:
                        errors.append({
                            'user_id': user.id,
                            'email': user.email,
                            'error': 'User must have visibility permission first (or document must be public)'
                        })
                        continue
                
                # Grant usability permission
                permission, created = DocumentUsabilityPermission.objects.get_or_create(
                    document=document,
                    user=user,
                    defaults={'granted_by': request.user}
                )
                
                if created:
                    created_permissions.append({
                        'user_id': user.id,
                        'email': user.email,
                        'full_name': f"{user.first_name} {user.last_name}".strip()
                    })
        
        warning = None
        if document.is_public:
            warning = "Note: Document is public, so all users already have usability access regardless of explicit permissions."
        
        return Response({
            'document_id': document.id,
            'granted_permissions': created_permissions,
            'errors': errors,
            'warning': warning,
            'message': f'Usability permissions granted to {len(created_permissions)} users.'
        }, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner
def revoke_visibility_permission(request, pk, user_id):
    """
    Revoke visibility permission for a specific user on a document.
    This will also revoke their usability permission if they have one.
    
    Note: If document is public, user will still have access through public access.
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
        user = User.objects.get(pk=user_id)
        
        # Remove visibility permission
        visibility_deleted = DocumentVisibilityPermission.objects.filter(
            document=document, user=user
        ).delete()[0]
        
        # Remove usability permission if exists
        usability_deleted = DocumentUsabilityPermission.objects.filter(
            document=document, user=user
        ).delete()[0]
        
        if visibility_deleted == 0:
            return Response(
                {'detail': 'User does not have visibility permission for this document.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        warning = None
        if document.is_public:
            warning = "Note: User still has access because document is public."
        
        return Response({
            'message': f'Revoked permissions for {user.email}',
            'visibility_revoked': True,
            'usability_revoked': usability_deleted > 0,
            'warning': warning
        }, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except User.DoesNotExist:
        return Response(
            {'detail': 'User not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner
def revoke_usability_permission(request, pk, user_id):
    """
    Revoke usability permission for a specific user on a document.
    The user will retain visibility permission.
    
    Note: If document is public, user will still have edit access through public access.
    """
    try:
        document = DynamicDocument.objects.get(pk=pk)
        user = User.objects.get(pk=user_id)
        
        # Remove usability permission
        deleted_count = DocumentUsabilityPermission.objects.filter(
            document=document, user=user
        ).delete()[0]
        
        if deleted_count == 0:
            return Response(
                {'detail': 'User does not have usability permission for this document.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        warning = None
        if document.is_public:
            warning = "Note: User still has edit access because document is public."
        
        return Response({
            'message': f'Revoked usability permission for {user.email}',
            'usability_revoked': True,
            'warning': warning
        }, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except User.DoesNotExist:
        return Response(
            {'detail': 'User not found.'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_lawyer_only
def get_available_clients(request):
    """
    Get a list of all clients (non-lawyer users) that can be granted permissions.
    """
    clients = User.objects.filter(
        role__in=['client', 'corporate_client', 'basic']
    ).values('id', 'email', 'first_name', 'last_name').order_by('email')
    
    # Format the response
    client_list = []
    for client in clients:
        client_list.append({
            'user_id': client['id'],
            'email': client['email'],
            'full_name': f"{client['first_name']} {client['last_name']}".strip()
        })
    
    return Response({
        'clients': client_list,
        'total_count': len(client_list)
    }, status=status.HTTP_200_OK) 