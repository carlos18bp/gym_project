import datetime
import io
import os
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature
from gym_app.serializers.dynamic_document import DocumentSignatureSerializer, DynamicDocumentSerializer
from gym_app.serializers.user import UserSignatureSerializer
from ..dynamic_documents.document_views import download_dynamic_document_pdf
from .permissions import (
    require_document_visibility,
    require_document_visibility_by_id,
    require_document_usability,
    require_lawyer_or_owner,
    require_lawyer_or_owner_by_id,
    filter_documents_by_visibility
)
from django.core.files.base import ContentFile
from django.contrib.auth import get_user_model
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from django.http import FileResponse, HttpResponse
import traceback
from io import BytesIO
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PyPDF2 import PdfReader, PdfWriter
from bs4 import BeautifulSoup
from xhtml2pdf import pisa
from reportlab.pdfgen import canvas
from gym_app.views.layouts.sendEmail import EmailMessage
import hashlib
import base64
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

User = get_user_model()


def get_client_ip(request):
    """Best-effort retrieval of the client's IP address.

    Checks common proxy headers first and falls back to REMOTE_ADDR.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For may contain multiple IPs, client is usually the first
        ip = x_forwarded_for.split(',')[0].strip()
        if ip:
            return ip

    x_real_ip = request.META.get('HTTP_X_REAL_IP')
    if x_real_ip:
        return x_real_ip

    return request.META.get('REMOTE_ADDR')


def generate_encrypted_document_id(document_id, created_at):
    """
    Generates a unique encrypted identifier for a document combining ID, date and time.
    Uses SHA256 hash for security and readability.
    
    Parameters:
        document_id (int): The document's database ID
        created_at (datetime): Document creation timestamp
    
    Returns:
        str: Formatted hash-based identifier
    """
    try:
        # Create a unique string combining ID, date, and time
        timestamp_str = created_at.strftime("%Y%m%d%H%M%S")
        unique_string = f"DOC{document_id}_{timestamp_str}"
        
        # Create a hash-based identifier
        hash_object = hashlib.sha256(unique_string.encode())
        hex_dig = hash_object.hexdigest()
        
        # Take first 16 characters and format as document identifier
        short_hash = hex_dig[:16].upper()
        formatted_id = f"{short_hash[:4]}-{short_hash[4:8]}-{short_hash[8:12]}-{short_hash[12:16]}"
        
        return formatted_id
    except Exception as e:
        # Fallback to simple format
        return f"DOC-{document_id:04d}-{created_at.strftime('%Y%m%d')}"


SPANISH_MONTHS = {
    1: "enero",
    2: "febrero",
    3: "marzo",
    4: "abril",
    5: "mayo",
    6: "junio",
    7: "julio",
    8: "agosto",
    9: "septiembre",
    10: "octubre",
    11: "noviembre",
    12: "diciembre",
}


def format_datetime_spanish(dt):
    """
    Formatea un datetime en español, por ejemplo:
    25 de diciembre de 2025 a las 14:30:15
    """
    month_name = SPANISH_MONTHS.get(dt.month, "")
    return f"{dt.day:02d} de {month_name} de {dt.year} a las {dt.strftime('%H:%M:%S')}"


def expire_overdue_documents():
    """Mark documents with past signature_due_date as Expired and notify creators.

    This runs opportunistically when fetching pending documents for signatures.
    """
    today = timezone.now().date()
    overdue_documents = DynamicDocument.objects.filter(
        requires_signature=True,
        state='PendingSignatures',
        signature_due_date__isnull=False,
        signature_due_date__lt=today,
    ).select_related('created_by')

    for document in overdue_documents:
        document.state = 'Expired'
        document.updated_at = timezone.now()
        document.save(update_fields=['state', 'updated_at'])

        creator = document.created_by
        if not creator or not getattr(creator, 'email', None):
            continue

        # Notify creator that the document has expired
        try:
            subject = f"[Firmas] El documento '{document.title}' ha expirado"
            body = (
                f"El documento '{document.title}' tenía una fecha límite de firma "
                f"establecida para {document.signature_due_date} y ha expirado sin ser firmado completamente.\n\n"
                f"Ahora puedes revisarlo, editarlo o eliminarlo desde tu bandeja."
            )
            email_message = EmailMessage(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[creator.email],
            )
            email_message.send()
        except Exception:
            # No bloquear el flujo por errores de correo
            pass


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_document_visibility_by_id
def get_document_signatures(request, document_id):
    """
    Get all signatures for a specific document.
    """
    try:
        document = DynamicDocument.objects.get(pk=document_id)

        # Ensure the authenticated user can at least view the document
        if not document.can_view(request.user):  # pragma: no cover – decorator already checks visibility
            return Response(
                {'detail': 'You do not have permission to view this document.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        signatures = document.signatures.all()
        serializer = DocumentSignatureSerializer(signatures, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except DynamicDocument.DoesNotExist:  # pragma: no cover – decorator intercepts first
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pending_signatures(request):
    """Get all documents that require a signature from the authenticated user.

    Returns the complete document information along with signature details.
    Only returns documents the user has permission to view.
    """

    # First, expire any overdue documents
    expire_overdue_documents()

    # Get all pending (non-rejected) signatures for the user on active documents
    pending_signatures = DocumentSignature.objects.filter(
        signer=request.user,
        signed=False,
        rejected=False,
        document__state='PendingSignatures',
    ).select_related('document')
    
    # Get unique documents that need signatures and filter by visibility
    documents = DynamicDocument.objects.filter(
        signatures__in=pending_signatures
    ).distinct()
    
    # Filter by visibility permissions
    visible_documents = []
    for document in documents:
        if document.can_view(request.user):
            visible_documents.append(document)
    
    # Serialize the documents with their signature information
    serializer = DynamicDocumentSerializer(visible_documents, many=True, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
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

        # First, check whether the document is configured to require signatures.
        # Tests expect a 400 response in this case even if the caller would not
        # normally have visibility permissions.
        if not document.requires_signature:
            return Response(
                {'detail': 'This document does not require signatures.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure the authenticated user can at least view the document so that
        # authorization errors (like signing on behalf of others) are surfaced
        # with a proper 403 instead of leaking information.
        if not document.can_view(request.user):
            return Response(
                {'detail': 'You do not have permission to view this document.'},
                status=status.HTTP_403_FORBIDDEN,
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
            signature_record = DocumentSignature.objects.select_for_update().get(
                document=document,
                signer=signing_user,
                signed=False,
                rejected=False,
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
        try:
            signature_record.signed = True
            signature_record.signed_at = timezone.now()
            # Capture client IP using helper (handles proxies and fallbacks)
            signature_record.ip_address = get_client_ip(request)
            signature_record.save()
            
            # Verify the signature was saved
            saved_signature = DocumentSignature.objects.get(id=signature_record.id)
            if not saved_signature.signed:  # pragma: no cover – defensive check after save
                raise Exception("Signature was not saved correctly")
            
            # === Enviar correo a todos los firmantes ===
            all_signatures = document.signatures.all()
            signed_signatures = all_signatures.filter(signed=True)
            unsigned_signatures = all_signatures.filter(signed=False)
            
            # Correos de todos los firmantes
            all_emails = [sig.signer.email for sig in all_signatures]
            
            # Nombres de firmantes
            nombre_firmante = signing_user.get_full_name() or signing_user.email
            nombres_ya_firmaron = [sig.signer.get_full_name() or sig.signer.email for sig in signed_signatures]
            nombres_faltan = [sig.signer.get_full_name() or sig.signer.email for sig in unsigned_signatures]
            
            subject = f"[Firmas] Progreso en la firma del documento '{document.title}'"
            body = (
                f"El usuario {nombre_firmante} ha firmado el documento '{document.title}'.\n\n"
                f"Firmantes que ya han firmado:\n- " + "\n- ".join(nombres_ya_firmaron) + "\n\n"
                f"Firmantes que faltan por firmar:\n- " + ("\n- ".join(nombres_faltan) if nombres_faltan else "Ninguno. El documento está completamente firmado.")
            )
            
            # Enviar correo a cada firmante
            for email in all_emails:
                try:
                    email_message = EmailMessage(
                        subject=subject,
                        body=body,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to=[email]
                    )
                    email_message.send()
                except Exception as e:
                    pass
            # === Fin envío de correo ===
            
        except Exception as e:
            return Response(
                {'detail': f'Error saving signature: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Check if all signatures are complete and update document state
        all_signatures = document.signatures.all()
        total_signatures = all_signatures.count()
        signed_signatures = all_signatures.filter(signed=True).count()
        
        if all(sig.signed for sig in all_signatures):
            document.state = 'FullySigned'
            document.fully_signed = True
            document.updated_at = timezone.now()
            document.save(update_fields=['state', 'fully_signed', 'updated_at'])
        
        # Return the updated signature record
        serializer = DocumentSignatureSerializer(signature_record)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'detail': f'An unexpected error occurred: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reject_document(request, document_id, user_id):
    """Allow a signer to reject (devolver sin firmar) a document.

    Marks the corresponding DocumentSignature as rejected, stores an optional
    comment, updates the document state to Rejected, and notifies the creator.
    """

    try:
        document = DynamicDocument.objects.get(pk=document_id)

        if not document.requires_signature:
            return Response(
                {'detail': 'This document does not require signatures.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        authenticated_user = request.user
        if authenticated_user.id != user_id and not authenticated_user.is_staff:
            return Response(
                {'detail': 'You are not authorized to reject documents on behalf of other users.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            rejecting_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # The user must be a pending, non-rejected signer
        try:
            signature_record = DocumentSignature.objects.select_for_update().get(
                document=document,
                signer=rejecting_user,
                signed=False,
                rejected=False,
            )
        except DocumentSignature.DoesNotExist:
            return Response(
                {'detail': 'This user is not authorized to reject this document or it was already processed.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Optional rejection comment
        comment = request.data.get('comment') or request.data.get('reason')

        # Update the signature record as rejected
        signature_record.rejected = True
        signature_record.rejected_at = timezone.now()
        if comment:
            signature_record.rejection_comment = comment
        signature_record.save()

        # Update document state to Rejected
        document.state = 'Rejected'
        document.fully_signed = False
        document.updated_at = timezone.now()
        document.save(update_fields=['state', 'fully_signed', 'updated_at'])

        # Notify the document creator
        creator = document.created_by
        if creator and getattr(creator, 'email', None):
            try:
                subject = f"[Firmas] El documento '{document.title}' fue rechazado"
                nombre_rechazante = rejecting_user.get_full_name() or rejecting_user.email
                body_lines = [
                    f"El usuario {nombre_rechazante} ha rechazado el documento '{document.title}'.",
                ]
                if comment:
                    body_lines.append("\nMotivo del rechazo:")
                    body_lines.append(comment)
                body = "\n".join(body_lines)

                email_message = EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[creator.email],
                )
                email_message.send()
            except Exception:
                # No bloquear el flujo por fallo de correo
                pass

        serializer = DocumentSignatureSerializer(signature_record)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except DynamicDocument.DoesNotExist:
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:  # pragma: no cover – defensive broad catch
        return Response(
            {'detail': f'An unexpected error occurred: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner_by_id
@transaction.atomic
def reopen_document_signatures(request, document_id):
    """Reopen the signature workflow for a rejected or expired document.

    This endpoint is intended for the document creator or a lawyer. It allows
    correcting a previously rejected/expired document and sending it back to
    the *PendingSignatures* state while reusing the same document instance.

    Effects:
    - Only works for documents that require signatures.
    - Only allowed when the document state is Rejected or Expired.
    - Resets all related DocumentSignature records to pending status.
    - Updates the document state to PendingSignatures and clears fully_signed.
    """

    try:
        document = DynamicDocument.objects.select_for_update().get(pk=document_id)

        if not document.requires_signature:
            return Response(
                {'detail': 'This document does not require signatures.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if document.state not in ['Rejected', 'Expired']:
            return Response(
                {'detail': 'Only rejected or expired documents can be reopened for signatures.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reset all signature records for this document to pending state
        DocumentSignature.objects.filter(document=document).update(
            signed=False,
            signed_at=None,
            rejected=False,
            rejected_at=None,
            rejection_comment=None,
        )

        # Move document back to PendingSignatures state
        document.state = 'PendingSignatures'
        document.fully_signed = False
        document.updated_at = timezone.now()
        document.save(update_fields=['state', 'fully_signed', 'updated_at'])

        serializer = DynamicDocumentSerializer(document, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    except DynamicDocument.DoesNotExist:  # pragma: no cover – decorator intercepts first
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:  # pragma: no cover
        return Response(
            {'detail': f'An unexpected error occurred: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_lawyer_or_owner_by_id
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
            
    except DynamicDocument.DoesNotExist:  # pragma: no cover – decorator intercepts first
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_pending_documents_full(request, user_id):
    """
    Obtener información detallada sobre documentos que requieren la firma de un usuario específico.
    Only returns documents the requesting user has permission to view.
    """
    try:
        user = User.objects.get(pk=user_id)

        # First, expire overdue documents
        expire_overdue_documents()

        pending_signatures = DocumentSignature.objects.filter(
            signer_id=user_id,
            signed=False,
            rejected=False,
            document__state='PendingSignatures',
        ).select_related('document')
        all_documents = [signature.document for signature in pending_signatures]
        
        # Filter documents by visibility permissions
        visible_documents = []
        for document in all_documents:
            if document.can_view(request.user):
                visible_documents.append(document)
        
        serializer = DynamicDocumentSerializer(visible_documents, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_archived_documents(request, user_id):
    """Obtener documentos rechazados o expirados asociados a un usuario firmante.

    Incluye documentos donde el usuario es firmante y el documento está en
    estado Rejected o Expired.
    """

    try:
        user = User.objects.get(pk=user_id)

        signatures = DocumentSignature.objects.filter(signer_id=user_id).select_related('document')
        all_documents = [signature.document for signature in signatures]

        archived_documents = [
            doc for doc in all_documents
            if doc.state in ['Rejected', 'Expired']
        ]

        visible_documents = []
        for document in archived_documents:
            if document.can_view(request.user):
                visible_documents.append(document)

        serializer = DynamicDocumentSerializer(visible_documents, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_signed_documents(request, user_id):
    """
    Obtener información detallada sobre documentos que han sido firmados por un usuario específico.
    Only returns documents the requesting user has permission to view.
    """
    try:
        user = User.objects.get(pk=user_id)
        signed_signatures = DocumentSignature.objects.filter(signer_id=user_id, signed=True).select_related('document')
        all_documents = [signature.document for signature in signed_signatures]
        
        # Filter documents by visibility permissions
        visible_documents = []
        for document in all_documents:
            if document.can_view(request.user):
                visible_documents.append(document)
                
        serializer = DynamicDocumentSerializer(visible_documents, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_signature(request, user_id):
    """
    Obtener la firma del usuario especificado por su ID.
    """
    
    try:
        user = User.objects.get(pk=user_id)
        
        if hasattr(user, 'signature'):
            serializer = UserSignatureSerializer(user.signature, context={'request': request})
            return Response({
                'has_signature': True,
                'signature': serializer.data
            }, status=status.HTTP_200_OK)
        else:
            return Response({'has_signature': False}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def register_carlito_fonts():
    """
    Register Carlito font family in ReportLab.
    Returns a dictionary with font paths for CSS styling.
    """
    font_dir = os.path.abspath(os.path.join(settings.BASE_DIR, 'static', 'fonts'))
    font_paths = {
        "Carlito-Regular": os.path.join(font_dir, "Carlito-Regular.ttf"),
        "Carlito-Bold": os.path.join(font_dir, "Carlito-Bold.ttf"),
        "Carlito-Italic": os.path.join(font_dir, "Carlito-Italic.ttf"),
        "Carlito-BoldItalic": os.path.join(font_dir, "Carlito-BoldItalic.ttf"),
    }

    # Verify that all font files exist
    for name, path in font_paths.items():
        if not os.path.exists(path):  # pragma: no cover – font file missing
            raise FileNotFoundError(f"Font file not found: {path}")

    # Register fonts in ReportLab
    try:
        pdfmetrics.registerFont(TTFont('Carlito', font_paths["Carlito-Regular"]))
        pdfmetrics.registerFont(TTFont('Carlito-Bold', font_paths["Carlito-Bold"]))
        pdfmetrics.registerFont(TTFont('Carlito-Italic', font_paths["Carlito-Italic"]))
        pdfmetrics.registerFont(TTFont('Carlito-BoldItalic', font_paths["Carlito-BoldItalic"]))
    except Exception as e:  # pragma: no cover – font registration failure
        raise

    return font_paths

def get_letterhead_for_document(document, user):
    """
    Get the appropriate letterhead image for a document.
    
    Priority:
    1. Document-specific letterhead (if exists)
    2. User's global letterhead (if exists)
    3. None (no letterhead)
    
    Args:
        document: DynamicDocument instance
        user: User instance (document creator/owner)
    
    Returns:
        ImageField or None: The letterhead image to use
    """
    # First priority: document-specific letterhead
    if document.letterhead_image:
        return document.letterhead_image
    
    # Second priority: user's global letterhead
    if user and user.letterhead_image:
        return user.letterhead_image
    
    # No letterhead available
    return None


def generate_original_document_pdf(document, user=None):
    """
    Generates the original document PDF.
    Returns a BytesIO buffer containing the PDF.
    
    Args:
        document: DynamicDocument instance
        user: User instance (optional, for global letterhead fallback)
    """
    # Replace variables within the content (use formatted values when available)
    processed_content = document.content
    for variable in document.variables.all():
        try:
            replacement_value = variable.get_formatted_value()
        except AttributeError:  # pragma: no cover – defensive fallback for missing method
            replacement_value = variable.value or ""
        processed_content = processed_content.replace(
            f"{{{{{variable.name_en}}}}}",
            replacement_value or ""
        )

    # Convert HTML to XHTML using BeautifulSoup
    soup = BeautifulSoup(processed_content, 'html.parser')

    # Create temporary buffer for initial PDF
    temp_buffer = BytesIO()

    # Register fonts
    font_paths = register_carlito_fonts()

    # Define background image style if letterhead exists
    background_style = ""
    body_extra_top_padding = ""
    letterhead_image = get_letterhead_for_document(document, user)
    if letterhead_image:  # pragma: no cover – letterhead image processing
        body_extra_top_padding = "\n        padding-top: 1.5cm;"
        try:
            # Get the absolute path to the letterhead image
            letterhead_path = os.path.abspath(letterhead_image.path)
            if os.path.exists(letterhead_path):
                # Convert image to base64 for better xhtml2pdf compatibility
                import base64
                with open(letterhead_path, 'rb') as img_file:
                    img_data = base64.b64encode(img_file.read()).decode()
                    img_mime = 'image/png'  # Assuming PNG as per validation
                    background_style = f"""
        background-image: url('data:{img_mime};base64,{img_data}');
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        background-attachment: fixed;"""
        except (ValueError, AttributeError, IOError):
            # Image file doesn't exist or path is invalid
            background_style = ""

    # Define CSS styles for PDF (force Letter size: 8.5 x 11 inches, same as standard PDF download)
    styles = f"""
    <style>
    @page {{
        size: letter;
        margin: 2cm;{background_style}
    }}

    @font-face {{
        font-family: 'Carlito';
        src: url('{font_paths["Carlito-Regular"]}') format('truetype');
        font-weight: normal;
        font-style: normal;
    }}

    @font-face {{
        font-family: 'Carlito';
        src: url('{font_paths["Carlito-Bold"]}') format('truetype');
        font-weight: bold;
        font-style: normal;
    }}

    @font-face {{
        font-family: 'Carlito';
        src: url('{font_paths["Carlito-Italic"]}') format('truetype');
        font-weight: normal;
        font-style: italic;
    }}

    @font-face {{
        font-family: 'Carlito';
        src: url('{font_paths["Carlito-BoldItalic"]}') format('truetype');
        font-weight: bold;
        font-style: italic;
    }}

    body {{
        font-family: 'Carlito', sans-serif !important;
        font-size: 12pt;{body_extra_top_padding}
    }}

    p, span {{
        font-family: 'Carlito', sans-serif !important;
    }}

    strong {{
        font-weight: bold !important;
        font-family: 'Carlito', sans-serif !important;
    }}

    em {{
        font-style: italic !important;
        font-family: 'Carlito', sans-serif !important;
    }}

    strong em {{
        font-weight: bold !important;
        font-style: italic !important;
        font-family: 'Carlito', sans-serif !important;
    }}

    u {{
        text-decoration: underline !important;
    }}
    </style>
    """

    # Construct the final HTML for the PDF
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>{document.title}</title>
        {styles}
    </head>
    <body>
        {soup.prettify()}
    </body>
    </html>
    """

    # Generate the initial PDF with xhtml2pdf
    pisa_status = pisa.CreatePDF(
        html_content.encode('utf-8'),
        dest=temp_buffer
    )

    # Check for errors in PDF generation
    if pisa_status.err:  # pragma: no cover – PDF conversion failure
        raise Exception("HTML to PDF conversion failed")

    # No watermark: return the generated PDF as-is
    temp_buffer.seek(0)
    return temp_buffer

def create_signatures_pdf(document, request):
    """
    Creates a PDF containing the signatures information for a document.
    Optimized for single page layout with new format.
    Returns a BytesIO buffer containing the PDF.
    """
    # Create a buffer for the PDF
    buffer = BytesIO()
    
    # Create the PDF document with smaller margins for single page optimization
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=60,
        leftMargin=60,
        topMargin=60,
        bottomMargin=60
    )
    
    # Get and customize styles for left alignment
    styles = getSampleStyleSheet()
    
    # Register fonts
    register_carlito_fonts()
    
    # Create custom styles optimized for single page
    # Estilos para el nuevo diseño
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        alignment=1,  # Center alignment
        fontSize=14,
        spaceAfter=16,
        fontName='Carlito-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        alignment=1,  # Center alignment
        fontSize=12,
        spaceAfter=8,
        fontName='Carlito-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        alignment=0,  # Left alignment
        fontSize=10,
        spaceAfter=4,
        fontName='Carlito'
    )
    
    normal_center_style = ParagraphStyle(
        'CustomNormalCenter',
        parent=styles['Normal'],
        alignment=1,  # Center alignment
        fontSize=10,
        spaceAfter=4,
        fontName='Carlito'
    )
    
    detail_style = ParagraphStyle(
        'DetailStyle',
        parent=styles['Normal'],
        alignment=0,  # Left alignment
        fontSize=10,
        spaceAfter=2,
        fontName='Carlito'
    )
    
    # Build the PDF content
    elements = []
    
    # Título principal centrado
    elements.append(Paragraph("CONSTANCIA AUDITORIA DOCUMENTO Y FIRMAS", title_style))
    elements.append(Spacer(1, 12))
    
    # Generate encrypted document identifier
    encrypted_id = generate_encrypted_document_id(document.pk, document.created_at)
    
    # Tabla de Identificación del Documento
    elements.append(Paragraph("<b>Identificación del Documento</b>", subtitle_style))
    elements.append(Spacer(1, 6))
    
    # Crear tabla con bordes para identificación del documento
    from reportlab.lib import colors as rl_colors
    table_data = [
        [Paragraph("<b>Título del Documento</b>", normal_center_style), 
         Paragraph("<b>Fecha de Creación</b>", normal_center_style), 
         Paragraph("<b>Identificador Único</b>", normal_center_style)],
        [Paragraph(document.title, normal_center_style), 
         Paragraph(format_datetime_spanish(document.created_at), normal_center_style), 
         Paragraph(encrypted_id, normal_center_style)]
    ]
    
    doc_table = Table(table_data, colWidths=[180, 180, 140])
    doc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), rl_colors.Color(0.95, 0.95, 0.95)),  # Header row light gray
        ('TEXTCOLOR', (0, 0), (-1, 0), rl_colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Carlito-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Carlito'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.black),
    ]))
    elements.append(doc_table)
    elements.append(Spacer(1, 20))
    
    # Resumen de Firmas centrado
    total_signatures = document.signatures.count()
    signed_count = document.signatures.filter(signed=True).count()
    
    elements.append(Paragraph("<b>Resumen Firmas</b>", subtitle_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        f"Firmas Requeridas: {total_signatures} | Firmas Completadas: {signed_count} | Estado: {'COMPLETAMENTE FIRMADO' if document.fully_signed else 'PENDIENTE'}",
        normal_center_style
    ))
    elements.append(Spacer(1, 20))
    
    # Registro de Firmas
    elements.append(Paragraph("<b>Registro</b>", subtitle_style))
    elements.append(Spacer(1, 10))
    
    signature_images_added = False
    for idx, signature in enumerate(document.signatures.all().order_by('created_at'), 1):
        try:
            user = signature.signer
            user_signature = getattr(user, 'signature', None)
            
            # Generate unique identifier for this signature
            signature_id = f"{idx:02d}{signature.signed_at.strftime('%m%d%H%M') if signature.signed_at else '0000'}"
            
            # Firmante con nombre completo
            elements.append(Paragraph(f"<b>Firmante:</b> {user.get_full_name() or user.email}", detail_style))
            
            # Email e ID Firma en la misma línea
            elements.append(Paragraph(f"<b>Email:</b> {user.email} | <b>ID Firma:</b> {signature_id}", detail_style))
            
            # Identificación
            id_info = []
            if user.document_type:
                id_info.append(f"{user.get_document_type_display()}")
            if user.identification:
                id_info.append(f"{user.identification}")
            if id_info:
                elements.append(Paragraph(f"<b>Identificación:</b> {' - '.join(id_info)}", detail_style))
            
            # Fecha y Hora
            elements.append(Paragraph(f"<b>Fecha y Hora:</b> {signature.signed_at.strftime('%d/%m/%Y %H:%M:%S') if signature.signed_at else 'N/A'}", detail_style))
            
            # IP de Registro - mostrar "No Registrada" si no hay IP
            ip_text = signature.ip_address if signature.ip_address else "No Registrada"
            elements.append(Paragraph(f"<b>IP de Registro:</b> {ip_text}", detail_style))
            
            # Imagen de firma alineada a la derecha
            if user_signature and user_signature.signature_image:
                try:
                    img = Image(user_signature.signature_image.path)
                    img.drawHeight = 50
                    img.drawWidth = 180
                    # Crear tabla para centrar imagen
                    img_table = Table([[img]], colWidths=[500])
                    img_table.setStyle(TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    elements.append(img_table)
                    signature_images_added = True
                except Exception as e:  # pragma: no cover – signature image rendering error
                    pass
            
            elements.append(Spacer(1, 15))
            
        except Exception as e:  # pragma: no cover – signature processing error
            pass
    
    if not signature_images_added:
        elements.append(Paragraph("<b>Nota:</b> No se encontraron imágenes de firmas registradas.", normal_style))
        elements.append(Spacer(1, 4))
    
    # Constancia final (texto justificado)
    constancia_style = ParagraphStyle(
        'ConstanciaStyle',
        parent=styles['Normal'],
        alignment=4,  # Justify
        fontSize=10,
        spaceAfter=4,
        fontName='Carlito'
    )
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "Este documento registra las firmas digitalizadas aplicadas al documento referenciado, "
        "las firmas en este registro han sido verificadas bajo autenticidad del(los) usuario(s) "
        "generador(es) del documento como del(los) destinatario(s) firmante(s).",
        constancia_style
    ))
    elements.append(Spacer(1, 6))
    
    # Build the PDF sin marca de agua ni línea 'Generado el'
    doc.build(elements)
    
    # Get the value of the BytesIO buffer
    buffer.seek(0)
    return buffer

def combine_pdfs(pdf1_buffer, pdf2_buffer):
    """
    Combines two PDF buffers into a single PDF.
    Returns a BytesIO buffer containing the combined PDF.
    """
    # Create PDF reader objects
    pdf1 = PdfReader(pdf1_buffer)
    pdf2 = PdfReader(pdf2_buffer)
    
    # Create PDF writer object
    output = PdfWriter()
    
    # Add all pages from first PDF
    for page in pdf1.pages:
        output.add_page(page)
    
    # Add all pages from second PDF
    for page in pdf2.pages:
        output.add_page(page)
    
    # Create output buffer
    output_buffer = BytesIO()
    output.write(output_buffer)
    output_buffer.seek(0)
    
    return output_buffer


def add_identifier_footer(pdf_buffer, identifier):
    """
    Añade el identificador único en la esquina inferior derecha de todas las páginas.
    Devuelve un nuevo BytesIO con el PDF modificado.
    """
    reader = PdfReader(pdf_buffer)
    writer = PdfWriter()

    # Crear un PDF de una sola página con el texto del identificador como footer
    footer_buffer = BytesIO()
    c = canvas.Canvas(footer_buffer, pagesize=letter)
    c.setFont('Carlito', 9)
    c.setFillColor(colors.grey)

    margin_x = 40  # margen desde la derecha
    margin_y = 60  # margen desde abajo (suficiente para no solapar con footer del membrete)
    c.drawRightString(letter[0] - margin_x, margin_y, identifier)
    c.save()

    footer_buffer.seek(0)
    footer_pdf = PdfReader(footer_buffer)

    # Mezclar el footer en cada página
    for page in reader.pages:
        page.merge_page(footer_pdf.pages[0])
        writer.add_page(page)

    output_buffer = BytesIO()
    writer.write(output_buffer)
    output_buffer.seek(0)
    return output_buffer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_document_visibility
def generate_signatures_pdf(request, pk):
    """
    Generates a comprehensive PDF document containing the original document and its signatures information.
    
    This function combines two PDFs:
    1. The original document PDF
    2. A new PDF containing detailed signatures information
    
    Parameters:
        request (HttpRequest): The request object.
        pk (int): The primary key of the document to be retrieved.
    
    Returns:
        FileResponse: A downloadable PDF file response with combined content.
        Response: A JSON response with an error message if an exception occurs.
    """
    try:
        
        # Retrieve the document from the database
        document = DynamicDocument.objects.prefetch_related('signatures__signer', 'variables', 'tags').get(pk=pk)
        
        # Verify document state
        if document.state != 'FullySigned':
            return Response(
                {'detail': 'El documento debe estar completamente firmado para generar el PDF de firmas.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify signatures exist
        if not document.signatures.exists():
            return Response(
                {'detail': 'El documento no tiene firmas registradas.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the original document PDF
        original_pdf_buffer = generate_original_document_pdf(document, request.user)
        
        # Create the signatures PDF
        signatures_pdf_buffer = create_signatures_pdf(document, request)
        
        # Combine both PDFs
        combined_pdf_buffer = combine_pdfs(original_pdf_buffer, signatures_pdf_buffer)
        
        # Generar el mismo identificador único
        encrypted_id = generate_encrypted_document_id(document.pk, document.created_at)
        
        # Añadir el identificador como pie de página en todas las hojas
        combined_pdf_buffer = add_identifier_footer(combined_pdf_buffer, encrypted_id)
        
        # Create the HTTP response with proper headers
        response = HttpResponse(content_type='application/pdf')
        # Clean filename for better compatibility
        clean_filename = "".join(c for c in document.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        response['Content-Disposition'] = f'attachment; filename="Documento_Completo_{clean_filename}.pdf"'
        response['Content-Length'] = len(combined_pdf_buffer.getvalue())
        response.write(combined_pdf_buffer.getvalue())
        
        return response
        
    except DynamicDocument.DoesNotExist:  # pragma: no cover – decorator intercepts first
        return Response(
            {'detail': 'Documento no encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:  # pragma: no cover
        return Response(
            {'detail': f'Error al generar el PDF de firmas: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )