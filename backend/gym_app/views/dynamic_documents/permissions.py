"""
Permission decorators for dynamic documents.

This module provides decorators to control access to dynamic documents based on
visibility and usability permissions. Lawyers automatically have full access to all documents.
"""

import math
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
        # The view can return either a plain list of documents or a
        # paginated structure with an 'items' list.
        if not hasattr(response, 'data'):  # pragma: no cover – DRF Response always has .data
            return response

        data = response.data

        # Determine the list of document payloads we need to filter
        documents_payload = None
        wraps_items = False

        if isinstance(data, dict) and isinstance(data.get('items'), list):
            # Paginated response: filter only the items while keeping
            # the outer pagination metadata untouched.
            documents_payload = data.get('items') or []
            wraps_items = True
        elif isinstance(data, list):
            # Legacy behaviour: plain list of documents
            documents_payload = data

        if documents_payload is None:
            # Unsupported shape, nothing to filter
            return response

        user = request.user
        filtered_documents = []

        # Batch-fetch all documents in a single query with prefetched
        # relations so can_view_prefetched() evaluates in Python without
        # extra DB hits.  Reduces ~30-40 queries to 3 per page.
        doc_ids = [d.get('id') for d in documents_payload if d.get('id')]
        docs_by_id = {
            doc.pk: doc
            for doc in DynamicDocument.objects.filter(pk__in=doc_ids)
                .select_related('created_by')
                .prefetch_related('signatures', 'visibility_permissions')
        } if doc_ids else {}

        for doc_data in documents_payload:
            doc_id = doc_data.get('id')
            if not doc_id:
                continue

            document = docs_by_id.get(doc_id)
            if document and document.can_view_prefetched(user):
                filtered_documents.append(doc_data)

        if wraps_items:
            original_count = len(documents_payload)
            removed_count = original_count - len(filtered_documents)
            data['items'] = filtered_documents
            if removed_count > 0:
                # Adjust totalItems by the number of items removed on this page.
                # This is an approximation — the decorator cannot know how many
                # items would be filtered on other pages.
                original_total = data.get('totalItems', original_count)
                data['totalItems'] = max(0, original_total - removed_count)
                # Recalculate totalPages based on the page size used by the view.
                page_size = original_count if original_count > 0 else 10
                data['totalPages'] = max(1, math.ceil(data['totalItems'] / page_size))
            response.data = data
        else:
            response.data = filtered_documents
        
        return response
    return wrapper 