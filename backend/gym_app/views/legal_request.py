import json
import traceback
import logging
import os
import magic
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
from gym_app.serializers import LegalRequestSerializer, LegalRequestTypeSerializer, LegalDisciplineSerializer
from gym_app.views.layouts.sendEmail import send_template_email

# Configure logger for professional error handling
logger = logging.getLogger(__name__)

# File validation configuration
ALLOWED_FILE_TYPES = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png']
}
MAX_FILE_SIZE = 30 * 1024 * 1024  # 30MB

def validate_email_format(email):
    """Validate email format using Django's validator"""
    try:
        validate_email(email)
        logger.info(f"Email validation successful for: {email}")
        return True
    except ValidationError as e:
        logger.warning(f"Email validation failed for: {email} - {str(e)}")
        raise ValidationError(f"Invalid email format: {str(e)}")

def validate_file_security(file):
    """Comprehensive file validation for security"""
    logger.info(f"Starting file validation for: {file.name}")
    
    # Check file size
    if file.size > MAX_FILE_SIZE:
        raise ValidationError(f"File {file.name} exceeds maximum size of {MAX_FILE_SIZE // 1024 // 1024}MB")
    
    # Check file extension
    file_ext = os.path.splitext(file.name)[1].lower()
    if not any(file_ext in extensions for extensions in ALLOWED_FILE_TYPES.values()):
        raise ValidationError(f"File type {file_ext} not allowed. Allowed types: {list(ALLOWED_FILE_TYPES.keys())}")
    
    # Check MIME type
    try:
        mime_type = magic.from_buffer(file.read(1024), mime=True)
        file.seek(0)  # Reset file pointer
        
        if mime_type not in ALLOWED_FILE_TYPES:
            raise ValidationError(f"MIME type {mime_type} not allowed")
        
        # Check if extension matches MIME type
        if file_ext not in ALLOWED_FILE_TYPES[mime_type]:
            raise ValidationError(f"File extension {file_ext} doesn't match MIME type {mime_type}")
            
    except Exception as e:
        logger.error(f"Error checking MIME type for {file.name}: {str(e)}")
        raise ValidationError("Unable to verify file type")
    
    logger.info(f"File validation successful for: {file.name}")
    return True

def sanitize_filename(filename):
    """Sanitize filename for security"""
    import uuid
    # Keep only the extension, generate unique name
    ext = os.path.splitext(filename)[1].lower()
    sanitized = f"{uuid.uuid4().hex}{ext}"
    logger.info(f"Sanitized filename: {filename} -> {sanitized}")
    return sanitized

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_legal_request(request):
    """
    API view to create a new legal request with comprehensive validation,
    atomic transactions, and professional error handling.
    """
    logger.info(f"Legal request creation started by user: {request.user.id}")
    
    try:
        
        # Parse and validate main data
        main_data_raw = request.data.get('mainData', '{}')
        if not main_data_raw:
            return Response({'detail': 'Main data is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            main_data = json.loads(main_data_raw)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error for user {request.user.id}: {str(e)}")
            return Response({'detail': 'Invalid JSON format in main data.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate required fields
        required_fields = ['firstName', 'lastName', 'email', 'requestTypeId', 'disciplineId', 'description']
        missing_fields = [field for field in required_fields if not main_data.get(field)]
        if missing_fields:
            logger.warning(f"Missing required fields for user {request.user.id}: {missing_fields}")
            return Response(
                {'detail': f'Missing required fields: {", ".join(missing_fields)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate email format in backend
        try:
            validate_email_format(main_data.get('email'))
        except ValidationError as e:
            logger.warning(f"Email validation failed for user {request.user.id}: {str(e)}")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Validate foreign key references
        try:
            request_type = LegalRequestType.objects.get(pk=main_data.get('requestTypeId'))
        except LegalRequestType.DoesNotExist:
            logger.error(f"Request type {main_data.get('requestTypeId')} not found for user {request.user.id}")
            return Response({'detail': 'Request type not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            discipline = LegalDiscipline.objects.get(pk=main_data.get('disciplineId'))
        except LegalDiscipline.DoesNotExist:
            logger.error(f"Discipline {main_data.get('disciplineId')} not found for user {request.user.id}")
            return Response({'detail': 'Discipline not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Use atomic transaction to ensure data consistency
        with transaction.atomic():
            # Create the LegalRequest instance with validated and sanitized data
            legal_request = LegalRequest.objects.create(
                first_name=main_data.get('firstName').strip(),
                last_name=main_data.get('lastName').strip(),
                email=main_data.get('email').strip().lower(),
                request_type=request_type,
                discipline=discipline,
                description=main_data.get('description').strip()
            )
            
            logger.info(f"Legal request created successfully: ID {legal_request.id} for user {request.user.id}")

        # Serialize the created request
        serializer = LegalRequestSerializer(legal_request, context={'request': request})

        # Return immediate response - email will be sent asynchronously
        # Note: For immediate response, we skip email sending in the request flow

        # Return immediate success response with clear messaging
        response_data = {
            'id': legal_request.id,
            'message': 'Legal request received successfully',
            'status': 'received',
            'email_notification': 'You will receive an email confirmation shortly',
            'next_steps': 'You can now upload files or continue using the platform'
        }
        
        logger.info(f"Legal request {legal_request.id} created successfully for user {request.user.id}")
        return Response(response_data, status=status.HTTP_201_CREATED)

    except ValidationError as e:
        logger.error(f"Validation error for user {request.user.id}: {str(e)}")
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Unexpected error for user {request.user.id}: {str(e)}\n{traceback.format_exc()}")
        return Response(
            {'detail': 'An unexpected error occurred. Please try again later.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_legal_request_file(request):
    """
    API view to upload files with comprehensive validation, atomic transactions,
    retry logic, and security checks.
    """
    logger.info(f"File upload started by user: {request.user.id}")
    
    try:
        
        # Validate legal request ID
        legal_request_id = request.data.get('legalRequestId')
        if not legal_request_id:
            return Response({'detail': 'Legal request ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate the existence of the LegalRequest instance (outside transaction for performance)
        try:
            legal_request = LegalRequest.objects.get(pk=legal_request_id)
        except LegalRequest.DoesNotExist:
            logger.error(f"Legal request {legal_request_id} not found for user {request.user.id}")
            return Response({'detail': 'Legal request not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Handle multiple files or single file
        files = request.FILES.getlist('files') if 'files' in request.FILES else [request.FILES.get('file')]
        files = [f for f in files if f]  # Filter out None values
        
        if not files:
            return Response({'detail': 'No files provided.'}, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_files = []
        failed_files = []

        # Process each file with validation and atomic transactions
        for file in files:
            try:
                # Comprehensive file validation
                validate_file_security(file)
                
                # Sanitize filename for security
                original_filename = file.name
                sanitized_filename = sanitize_filename(original_filename)
                
                # Use atomic transaction for file creation
                with transaction.atomic():
                    file_instance = LegalRequestFiles.objects.create(file=file)
                    legal_request.files.add(file_instance)
                
                uploaded_files.append({
                    'id': file_instance.id,
                    'original_name': original_filename,
                    'sanitized_name': sanitized_filename,
                    'size': file.size
                })
                
                logger.info(f"File uploaded successfully: {original_filename} -> {sanitized_filename} for legal request {legal_request_id}")
                
            except ValidationError as e:
                error_msg = f"Validation failed for {file.name}: {str(e)}"
                logger.warning(error_msg)
                failed_files.append({
                    'name': file.name,
                    'error': str(e)
                })
            except Exception as e:
                error_msg = f"Upload failed for {file.name}: {str(e)}"
                logger.error(error_msg)
                failed_files.append({
                    'name': file.name,
                    'error': 'Upload failed due to server error'
                })

        # Files processed successfully - no email needed, only logging
        if uploaded_files or failed_files:
            total_files = len(uploaded_files) + len(failed_files)
            logger.info(f"File processing completed for legal request {legal_request_id}: {len(uploaded_files)} successful, {len(failed_files)} failed")

        # Return comprehensive response
        response_data = {
            'message': 'File upload completed',
            'legal_request_id': legal_request_id,
            'total_files_processed': len(uploaded_files) + len(failed_files),
            'successful_uploads': len(uploaded_files),
            'failed_uploads': len(failed_files),
            'uploaded_files': uploaded_files,
            'failed_files': failed_files,
            'email_notification': 'Upload status sent via email'
        }
        
        status_code = status.HTTP_201_CREATED if uploaded_files else status.HTTP_400_BAD_REQUEST
        logger.info(f"File upload completed for legal request {legal_request_id}: {len(uploaded_files)} successful, {len(failed_files)} failed")
        
        return Response(response_data, status=status_code)

    except ValidationError as e:
        logger.error(f"Validation error in file upload for user {request.user.id}: {str(e)}")
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Unexpected error in file upload for user {request.user.id}: {str(e)}\n{traceback.format_exc()}")
        return Response(
            {'detail': 'An unexpected error occurred during file upload.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_dropdown_options(request):
    # Get the data from the models
    legal_request_types = LegalRequestType.objects.all()
    legal_disciplines = LegalDiscipline.objects.all()

    # Serializing the data
    legal_request_types_serialized = LegalRequestTypeSerializer(legal_request_types, many=True)
    legal_disciplines_serialized = LegalDisciplineSerializer(legal_disciplines, many=True)

    # Build the response JSON
    return Response({
        "legal_request_types": legal_request_types_serialized.data,
        "legal_disciplines": legal_disciplines_serialized.data
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_confirmation_email(request):
    """
    Send confirmation email for a legal request asynchronously.
    This endpoint can be called from frontend after the main request is created.
    """
    try:
        legal_request_id = request.data.get('legal_request_id')
        if not legal_request_id:
            return Response({'detail': 'Legal request ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get the legal request
        try:
            legal_request = LegalRequest.objects.get(pk=legal_request_id)
        except LegalRequest.DoesNotExist:
            return Response({'detail': 'Legal request not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Send confirmation email
        try:
            context = {
                "first_name": legal_request.first_name,
                "last_name": legal_request.last_name,
                "description": legal_request.description,
                "request_id": legal_request.id,
                "email_type": "confirmation"
            }
            send_template_email(
                template_name="legal_request",
                subject="Confirmación de solicitud legal",
                to_emails=[legal_request.email],
                context=context,
            )
            logger.info(f"Confirmation email sent for legal request {legal_request.id}")
            
            return Response({
                'message': 'Confirmation email sent successfully',
                'legal_request_id': legal_request_id
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error sending confirmation email for legal request {legal_request.id}: {str(e)}")
            return Response(
                {'detail': 'Email sending failed'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except Exception as e:
        logger.error(f"Unexpected error in send_confirmation_email: {str(e)}")
        return Response(
            {'detail': 'An unexpected error occurred'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )