"""
Permission decorators for dynamic documents.

This module provides decorators to control access to dynamic documents based on
visibility and usability permissions. Lawyers automatically have full access to all documents.
"""

from functools import wraps
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument


def require_document_visibility(view_func):
    """
    Decorator that requires visibility permissions for a document.
    
    Lawyers automatically have access to all documents.
    Other users must have explicit visibility permissions.
    
    Args:
        view_func: The view function to protect
        
    Returns:
        Decorated view function
    """
    @wraps(view_func)
    def wrapper(request, pk, *args, **kwargs):
        try:
            document = DynamicDocument.objects.get(pk=pk)
            
            if not document.can_view(request.user):
                return Response(
                    {'detail': 'You do not have permission to view this document.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            return view_func(request, pk, *args, **kwargs)
            
        except DynamicDocument.DoesNotExist:
            return Response(
                {'detail': 'Document not found.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    return wrapper


def require_document_visibility_by_id(view_func):
    """
    Decorator that requires visibility permissions for a document using document_id parameter.
    
    Lawyers automatically have access to all documents.
    Other users must have explicit visibility permissions.
    
    Args:
        view_func: The view function to protect
        
    Returns:
        Decorated view function
    """
    @wraps(view_func)
    def wrapper(request, document_id, *args, **kwargs):
        try:
            document = DynamicDocument.objects.get(pk=document_id)
            
            if not document.can_view(request.user):
                return Response(
                    {'detail': 'You do not have permission to view this document.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            return view_func(request, document_id, *args, **kwargs)
            
        except DynamicDocument.DoesNotExist:
            return Response(
                {'detail': 'Document not found.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    return wrapper


def require_lawyer_or_owner_by_id(view_func):
    """
    Decorator that requires user to be a lawyer or document owner using document_id parameter.
    
    This is used for administrative actions like managing permissions with document_id param.
    
    Args:
        view_func: The view function to protect
        
    Returns:
        Decorated view function
    """
    @wraps(view_func)
    def wrapper(request, document_id, *args, **kwargs):
        try:
            document = DynamicDocument.objects.get(pk=document_id)
            
            # Check if user is lawyer or document owner
            if not (document.is_lawyer(request.user) or document.created_by == request.user):
                return Response(
                    {'detail': 'Only lawyers or document owners can perform this action.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            return view_func(request, document_id, *args, **kwargs)
            
        except DynamicDocument.DoesNotExist:
            return Response(
                {'detail': 'Document not found.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    return wrapper


def require_document_usability(permission_type='read_only'):
    """
    Decorator that requires usability permissions for a document.
    
    Lawyers automatically have full access to all documents.
    Other users must have explicit usability permissions.
    
    Args:
        permission_type (str): Required permission level
                              ('public_access', 'usability', 'owner', 'lawyer')
        
    Returns:
        Decorator function
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, pk, *args, **kwargs):
            try:
                document = DynamicDocument.objects.get(pk=pk)
                user_permission = document.get_user_permission_level(request.user)
                
                if not user_permission:
                    return Response(
                        {'detail': 'You do not have permission to access this document.'}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Define permission hierarchy (higher index = higher permission)
                permission_hierarchy = ['view_only', 'public_access', 'usability', 'owner', 'lawyer']
                
                try:
                    required_level = permission_hierarchy.index(permission_type)
                    user_level = permission_hierarchy.index(user_permission)
                    
                    if user_level < required_level:
                        return Response(
                            {'detail': f'You need {permission_type} level permissions for this action.'}, 
                            status=status.HTTP_403_FORBIDDEN
                        )
                except ValueError:
                    # If permission type not found in hierarchy, deny access
                    return Response(
                        {'detail': 'Invalid permission type.'}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                return view_func(request, pk, *args, **kwargs)
                
            except DynamicDocument.DoesNotExist:
                return Response(
                    {'detail': 'Document not found.'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        return wrapper
    return decorator


def require_lawyer_or_owner(view_func):
    """
    Decorator that requires user to be a lawyer or document owner.
    
    This is used for administrative actions like managing permissions.
    
    Args:
        view_func: The view function to protect
        
    Returns:
        Decorated view function
    """
    @wraps(view_func)
    def wrapper(request, pk, *args, **kwargs):
        try:
            document = DynamicDocument.objects.get(pk=pk)
            
            # Check if user is lawyer or document owner
            if not (document.is_lawyer(request.user) or document.created_by == request.user):
                return Response(
                    {'detail': 'Only lawyers or document owners can perform this action.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            return view_func(request, pk, *args, **kwargs)
            
        except DynamicDocument.DoesNotExist:
            return Response(
                {'detail': 'Document not found.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    return wrapper


def require_lawyer_only(view_func):
    """
    Decorator that requires user to be a lawyer.
    
    This is used for lawyer-specific actions like creating documents from templates.
    
    Args:
        view_func: The view function to protect
        
    Returns:
        Decorated view function
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Check if user is a lawyer
        if not (request.user.role == 'lawyer' or request.user.is_gym_lawyer):
            return Response(
                {'detail': 'Only lawyers can perform this action.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        return view_func(request, *args, **kwargs)
    return wrapper


def filter_documents_by_visibility(view_func):
    """
    Decorator that filters document lists based on user visibility permissions.
    
    Lawyers see all documents. Other users see only documents they have visibility for.
    Published documents without assigned_to are visible to all clients (templates).
    
    Args:
        view_func: The view function to protect (must return documents queryset)
        
    Returns:
        Decorated view function
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Call the original view
        response = view_func(request, *args, **kwargs)
        
        # If user is a lawyer, return all documents
        if request.user.role == 'lawyer' or request.user.is_gym_lawyer:
            return response
        
        # For non-lawyers, we need to filter the response data
        # This assumes the view returns documents in response.data
        if hasattr(response, 'data') and isinstance(response.data, list):
            # Filter documents based on visibility
            user = request.user
            filtered_documents = []
            
            for doc_data in response.data:
                doc_id = doc_data.get('id')
                doc_state = doc_data.get('state')
                doc_assigned_to = doc_data.get('assigned_to')
                
                if doc_id:
                    try:
                        document = DynamicDocument.objects.prefetch_related('tags').get(pk=doc_id)
                        
                        # Published documents without assigned_to are templates visible to all clients
                        is_template = (doc_state == 'Published' and doc_assigned_to is None)
                        
                        if is_template or document.can_view(user):
                            filtered_documents.append(doc_data)
                    except DynamicDocument.DoesNotExist:
                        continue
            
            response.data = filtered_documents
        
        return response
    return wrapper 