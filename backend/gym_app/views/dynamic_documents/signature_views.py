import datetime
import io
import os
from django.utils import timezone
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature, DocumentVersion
from gym_app.serializers.dynamic_document import DocumentSignatureSerializer, DynamicDocumentSerializer
from ..dynamic_documents.document_views import download_dynamic_document_pdf
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model

User = get_user_model()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_document_signatures(request, document_id):
    """
    Get all signatures for a specific document.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id)
        signatures = document.signatures.all()
        serializer = DocumentSignatureSerializer(signatures, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pending_signatures(request):
    """
    Get all documents that require a signature from the authenticated user.
    """
    pending_signatures = DocumentSignature.objects.filter(
        signer=request.user,
        signed=False
    ).select_related('document')
    
    serializer = DocumentSignatureSerializer(pending_signatures, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_document(request, document_id, user_id):
    """
    Sign a document using the user's signature.
    
    The user must have a valid signature stored in their profile.
    The user must be one of the requested signers for the document.
    
    Parameters:
        request: The HTTP request
        document_id: The ID of the document to sign
        user_id: The ID of the user who is signing the document
    """
    try:
        # Check that the document exists
        document = DynamicDocument.objects.get(pk=document_id)
        
        # Check that the document requires signatures
        if not document.requires_signature:
            return Response(
                {'detail': 'This document does not require signatures.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check that the authenticated user has permission to sign
        # Only the user themselves or an administrator can sign on behalf of a user
        authenticated_user = request.user
        if authenticated_user.id != user_id and not authenticated_user.is_staff:
            return Response(
                {'detail': 'You are not authorized to sign documents on behalf of other users.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check that the user exists
        try:
            signing_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check that the user is an authorized signer for this document
        try:
            signature_record = DocumentSignature.objects.get(
                document=document,
                signer=signing_user,
                signed=False
            )
        except DocumentSignature.DoesNotExist:
            return Response(
                {'detail': 'This user is not authorized to sign this document or has already signed it.'},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check that the user has an electronic signature
        if not hasattr(signing_user, 'signature'):
            return Response(
                {'detail': f'User {signing_user.email} needs to create a signature before signing documents.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Update the signature record
        signature_record.signed = True
        signature_record.signed_at = timezone.now()
        signature_record.ip_address = request.META.get('REMOTE_ADDR')
        signature_record.save()
        
        # Create a new version of the document with this signature
        save_document_version(document, signing_user)
        
        # Check if all signatures are complete
        document.check_fully_signed()
        
        # Return the updated signature record
        serializer = DocumentSignatureSerializer(signature_record)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


def save_document_version(document, signer=None):
    """
    Save a new version of the document after it's been signed.
    
    Args:
        document: The DynamicDocument instance
        signer: The User who just signed the document
    """
    try:
        # If it's the first signature, also save an original version
        if not DocumentVersion.objects.filter(document=document, version_type='original').exists():
            # Create an in-memory PDF of the original document without signatures
            response = download_dynamic_document_pdf(None, document.id, for_version=True)
            
            if hasattr(response, 'getvalue'):
                # Create the original version
                version = DocumentVersion(
                    document=document,
                    version_type='original',
                    version_number=1,
                    content_type='application/pdf'
                )
                version.file.save(f"{document.id}_original.pdf", ContentFile(response.getvalue()))
        
        # Get the next version number
        last_version = DocumentVersion.objects.filter(
            document=document, 
            version_type='signed'
        ).order_by('-version_number').first()
        
        version_number = 1
        if last_version:
            version_number = last_version.version_number + 1
        
        # Create a PDF with current signatures
        response = download_dynamic_document_pdf(None, document.id, for_version=True)
        
        if hasattr(response, 'getvalue'):
            # Create the signed version
            version = DocumentVersion(
                document=document,
                version_type='signed',
                version_number=version_number,
                content_type='application/pdf',
                signed_by=signer
            )
            version.file.save(f"{document.id}_signed_v{version_number}.pdf", ContentFile(response.getvalue()))
            
    except Exception as e:
        print(f"Error saving document version: {str(e)}")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_document_versions(request, document_id):
    """
    Get all versions of a document.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id)
        versions = document.versions.all()
        
        result = []
        for version in versions:
            result.append({
                'id': version.id,
                'version_type': version.version_type,
                'version_display': version.get_version_type_display(),
                'version_number': version.version_number,
                'created_at': version.created_at,
                'file_url': request.build_absolute_uri(version.file.url) if version.file else None,
                'filename': version.filename(),
                'signed_by': version.signed_by.email if version.signed_by else None
            })
            
        return Response(result, status=status.HTTP_200_OK)
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_signature_request(request, document_id, user_id):
    """
    Remove a signature request for a specific user on a document.
    Only the document creator can remove signature requests.
    Signatures that have already been added cannot be removed.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id)
        
        # Check if the user is the creator of the document
        if document.created_by != request.user:
            return Response(
                {'detail': 'Only the document creator can remove signature requests.'},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Find the signature record
        try:
            signature_record = DocumentSignature.objects.get(
                document=document,
                signer_id=user_id
            )
            
            # Check if the document has already been signed
            if signature_record.signed:
                return Response(
                    {'detail': 'Cannot remove a signature that has already been added.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Delete the signature record
            signature_record.delete()
            
            return Response(
                {'detail': 'Signature request removed successfully.'},
                status=status.HTTP_200_OK
            )
            
        except DocumentSignature.DoesNotExist:
            return Response(
                {'detail': 'Signature request not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
            
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_pending_documents(request, user_id):
    """
    Get all documents that require a signature from a specific user.
    
    This endpoint allows checking which documents are pending signature
    for any user, not just the authenticated user.
    
    Parameters:
        request: The HTTP request
        user_id: The ID of the user to check for pending documents
        
    Returns:
        A list of documents pending signature from the specified user
    """
    try:
        # Check if the user exists
        user = User.objects.get(pk=user_id)
        
        # Search for all pending signatures for this user
        pending_signatures = DocumentSignature.objects.filter(
            signer_id=user_id,
            signed=False
        ).select_related('document')
        
        # Prepare the response with pending documents
        pending_documents = []
        for signature in pending_signatures:
            document = signature.document
            document_data = {
                'id': document.id,
                'title': document.title,
                'state': document.state,
                'created_at': document.created_at,
                'updated_at': document.updated_at,
                'signature_id': signature.id,
                'signature_position': signature.signature_position,
                'requires_signature': document.requires_signature,
                'fully_signed': document.fully_signed
            }
            pending_documents.append(document_data)
            
        return Response(pending_documents, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_pending_documents_full(request, user_id):
    """
    Get detailed information about documents that require a signature from a specific user.
    
    This endpoint provides complete information about the documents pending signature,
    including details about all signers (not just the specified user), their signature
    status, and signature dates.
    
    Parameters:
        request: The HTTP request
        user_id: The ID of the user to check for pending documents
        
    Returns:
        A list of documents pending signature with complete signer information
    """
    try:
        # Check if the user exists
        user = User.objects.get(pk=user_id)
        
        # Search for all pending signatures for this user
        pending_signatures = DocumentSignature.objects.filter(
            signer_id=user_id,
            signed=False
        ).select_related('document')
        
        # Get the IDs of pending documents
        document_ids = [sig.document_id for sig in pending_signatures]
        
        # List to store the final response
        result = []
        
        # Process each document
        for document_id in document_ids:
            try:
                # Get the complete document
                document = DynamicDocument.objects.get(pk=document_id)
                
                # Get all signatures related to this document
                all_signatures = DocumentSignature.objects.filter(
                    document_id=document_id
                ).select_related('signer')
                
                # Prepare signer information
                signers_info = []
                for signature in all_signatures:
                    # Get signer information
                    signer = signature.signer
                    signer_info = {
                        'signature_id': signature.id,
                        'signer_id': signer.id,
                        'signer_email': signer.email,
                        'signer_name': f"{signer.first_name or ''} {signer.last_name or ''}".strip() or signer.email,
                        'signature_position': signature.signature_position,
                        'signed': signature.signed,
                        'signed_at': signature.signed_at,
                        'is_current_user': signer.id == user_id
                    }
                    signers_info.append(signer_info)
                
                # Sort signers by position
                signers_info.sort(key=lambda x: x['signature_position'])
                
                # Get creator information
                creator_info = None
                if document.created_by:
                    creator = document.created_by
                    creator_info = {
                        'id': creator.id,
                        'email': creator.email,
                        'name': f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.email
                    }
                
                # Build object with complete document information
                document_info = {
                    'id': document.id,
                    'title': document.title,
                    'state': document.state,
                    'state_display': document.get_state_display(),
                    'requires_signature': document.requires_signature,
                    'fully_signed': document.fully_signed,
                    'created_at': document.created_at,
                    'updated_at': document.updated_at,
                    'creator': creator_info,
                    'signers': signers_info,
                    'total_signatures': len(signers_info),
                    'completed_signatures': sum(1 for s in signers_info if s['signed']),
                    'pending_signatures': sum(1 for s in signers_info if not s['signed'])
                }
                
                result.append(document_info)
                
            except DynamicDocument.DoesNotExist:
                # If the document doesn't exist, skip it
                continue
        
        return Response(result, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_signed_documents(request, user_id):
    """
    Get detailed information about documents that have been signed by a specific user.
    
    This endpoint provides complete information about the documents already signed by the user,
    including details about all signers, their signature status, and signature dates.
    
    Parameters:
        request: The HTTP request
        user_id: The ID of the user to check for signed documents
        
    Returns:
        A list of documents signed by the user with complete signer information
    """
    try:
        # Check if the user exists
        user = User.objects.get(pk=user_id)
        
        # Search for all completed signatures by this user
        signed_signatures = DocumentSignature.objects.filter(
            signer_id=user_id,
            signed=True
        ).select_related('document')
        
        # Get the IDs of signed documents
        document_ids = [sig.document_id for sig in signed_signatures]
        
        # List to store the final response
        result = []
        
        # Process each document
        for document_id in document_ids:
            try:
                # Get the complete document
                document = DynamicDocument.objects.get(pk=document_id)
                
                # Get all signatures related to this document
                all_signatures = DocumentSignature.objects.filter(
                    document_id=document_id
                ).select_related('signer')
                
                # Prepare signer information
                signers_info = []
                for signature in all_signatures:
                    # Get signer information
                    signer = signature.signer
                    signer_info = {
                        'signature_id': signature.id,
                        'signer_id': signer.id,
                        'signer_email': signer.email,
                        'signer_name': f"{signer.first_name or ''} {signer.last_name or ''}".strip() or signer.email,
                        'signature_position': signature.signature_position,
                        'signed': signature.signed,
                        'signed_at': signature.signed_at,
                        'is_current_user': signer.id == user_id
                    }
                    signers_info.append(signer_info)
                
                # Sort signers by position
                signers_info.sort(key=lambda x: x['signature_position'])
                
                # Get creator information
                creator_info = None
                if document.created_by:
                    creator = document.created_by
                    creator_info = {
                        'id': creator.id,
                        'email': creator.email,
                        'name': f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.email
                    }
                
                # Get document versions
                versions = []
                for version in document.versions.all():
                    version_info = {
                        'id': version.id,
                        'version_type': version.version_type,
                        'version_display': version.get_version_type_display(),
                        'version_number': version.version_number,
                        'created_at': version.created_at,
                        'file_url': request.build_absolute_uri(version.file.url) if version.file else None,
                        'signed_by': version.signed_by.email if version.signed_by else None
                    }
                    versions.append(version_info)
                
                # Build object with complete document information
                document_info = {
                    'id': document.id,
                    'title': document.title,
                    'state': document.state,
                    'state_display': document.get_state_display(),
                    'requires_signature': document.requires_signature,
                    'fully_signed': document.fully_signed,
                    'created_at': document.created_at,
                    'updated_at': document.updated_at,
                    'creator': creator_info,
                    'signers': signers_info,
                    'total_signatures': len(signers_info),
                    'completed_signatures': sum(1 for s in signers_info if s['signed']),
                    'pending_signatures': sum(1 for s in signers_info if not s['signed']),
                    'user_signed_at': next((s['signed_at'] for s in signers_info if s['is_current_user'] and s['signed']), None),
                    'versions': versions
                }
                
                result.append(document_info)
                
            except DynamicDocument.DoesNotExist:
                # If the document doesn't exist, skip it
                continue
        
        return Response(result, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 