import datetime
import io
import os
from django.utils import timezone
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature
from gym_app.serializers.dynamic_document import DocumentSignatureSerializer, DynamicDocumentSerializer
from gym_app.serializers.user import UserSignatureSerializer
from ..dynamic_documents.document_views import download_dynamic_document_pdf
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
from rest_framework.views import APIView
from gym_app.serializers.dynamic_document import DocumentVariableSerializer

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
    Returns the complete document information along with signature details.
    """
    # Get all pending signatures for the user
    pending_signatures = DocumentSignature.objects.filter(
        signer=request.user,
        signed=False
    ).select_related('document')
    
    # Get unique documents that need signatures
    documents = DynamicDocument.objects.filter(
        signatures__in=pending_signatures
    ).distinct()
    
    # Serialize the documents with their signature information
    serializer = DynamicDocumentSerializer(documents, many=True, context={'request': request})
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
    print("\n=== STARTING DOCUMENT SIGNING PROCESS ===")
    print(f"Document ID: {document_id}")
    print(f"User ID: {user_id}")
    print(f"Authenticated user: {request.user.email}")
    
    try:
        # Check that the document exists
        document = DynamicDocument.objects.get(pk=document_id)
        print(f"\nDocument found:")
        print(f"- Title: {document.title}")
        print(f"- State: {document.state}")
        print(f"- Requires signature: {document.requires_signature}")
        print(f"- Current signatures: {document.signatures.count()}")
        
        # Check that the document requires signatures
        if not document.requires_signature:
            print("\nError: Document does not require signatures")
            return Response(
                {'detail': 'This document does not require signatures.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check that the authenticated user has permission to sign
        # Only the user themselves or an administrator can sign on behalf of a user
        authenticated_user = request.user
        if authenticated_user.id != user_id and not authenticated_user.is_staff:
            print(f"\nError: Unauthorized signing attempt")
            print(f"Authenticated user ID: {authenticated_user.id}")
            print(f"Requested user ID: {user_id}")
            return Response(
                {'detail': 'You are not authorized to sign documents on behalf of other users.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check that the user exists
        try:
            signing_user = User.objects.get(pk=user_id)
            print(f"\nSigning user found:")
            print(f"- Email: {signing_user.email}")
            print(f"- Has signature: {hasattr(signing_user, 'signature')}")
        except User.DoesNotExist:
            print(f"\nError: User {user_id} not found")
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check that the user is an authorized signer for this document
        try:
            signature_record = DocumentSignature.objects.select_for_update().get(
                document=document,
                signer=signing_user,
                signed=False
            )
            print(f"\nSignature record found:")
            print(f"- ID: {signature_record.id}")
            print(f"- Created at: {signature_record.created_at}")
            print(f"- Currently signed: {signature_record.signed}")
        except DocumentSignature.DoesNotExist:
            print(f"\nError: No valid signature record found for user {signing_user.email}")
            return Response(
                {'detail': 'This user is not authorized to sign this document or has already signed it.'},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check that the user has an electronic signature
        if not hasattr(signing_user, 'signature'):
            print(f"\nError: User {signing_user.email} has no signature")
            return Response(
                {'detail': f'User {signing_user.email} needs to create a signature before signing documents.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Update the signature record
        print("\nUpdating signature record...")
        try:
            signature_record.signed = True
            signature_record.signed_at = timezone.now()
            signature_record.ip_address = request.META.get('REMOTE_ADDR')
            signature_record.save()
            print(f"Signature record updated successfully:")
            print(f"- Signed at: {signature_record.signed_at}")
            print(f"- IP: {signature_record.ip_address}")
            
            # Verify the signature was saved
            saved_signature = DocumentSignature.objects.get(id=signature_record.id)
            if not saved_signature.signed:
                raise Exception("Signature was not saved correctly")
                
        except Exception as e:
            print(f"\nError saving signature record: {str(e)}")
            return Response(
                {'detail': f'Error saving signature: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Check if all signatures are complete and update document state
        all_signatures = document.signatures.all()
        total_signatures = all_signatures.count()
        signed_signatures = all_signatures.filter(signed=True).count()
        print(f"\nChecking document completion:")
        print(f"- Total signatures required: {total_signatures}")
        print(f"- Signatures completed: {signed_signatures}")
        
        if all(sig.signed for sig in all_signatures):
            print("\nAll signatures complete, updating document state...")
            document.state = 'FullySigned'
            document.fully_signed = True
            document.save()
            print(f"Document state updated to: {document.state}")
        
        # Return the updated signature record
        serializer = DocumentSignatureSerializer(signature_record)
        print("\n=== SIGNING PROCESS COMPLETED SUCCESSFULLY ===")
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except DynamicDocument.DoesNotExist:
        print(f"\nError: Document {document_id} not found")
        return Response(
            {'detail': 'Document not found.'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"\nUnexpected error: {str(e)}")
        return Response(
            {'detail': f'An unexpected error occurred: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
def get_user_pending_documents_full(request, user_id):
    """
    Obtener información detallada sobre documentos que requieren la firma de un usuario específico.
    """
    try:
        user = User.objects.get(pk=user_id)
        pending_signatures = DocumentSignature.objects.filter(signer_id=user_id, signed=False).select_related('document')
        documents = [signature.document for signature in pending_signatures]
        serializer = DynamicDocumentSerializer(documents, many=True, context={'request': request})
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
    """
    try:
        user = User.objects.get(pk=user_id)
        signed_signatures = DocumentSignature.objects.filter(signer_id=user_id, signed=True).select_related('document')
        documents = [signature.document for signature in signed_signatures]
        serializer = DynamicDocumentSerializer(documents, many=True, context={'request': request})
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
    print("\n=== GETTING USER SIGNATURE ===")
    print(f"Requested user ID: {user_id}")
    print(f"Authenticated user: {request.user.email}")
    
    try:
        user = User.objects.get(pk=user_id)
        print(f"\nUser found:")
        print(f"- Email: {user.email}")
        print(f"- Has signature: {hasattr(user, 'signature')}")
        
        if hasattr(user, 'signature'):
            print("\nUser has signature, serializing...")
            serializer = UserSignatureSerializer(user.signature, context={'request': request})
            print(f"Serialized data: {serializer.data}")
            return Response({
                'has_signature': True,
                'signature': serializer.data
            }, status=status.HTTP_200_OK)
        else:
            print("\nUser has no signature")
            return Response({'has_signature': False}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        print(f"\nError: User {user_id} not found")
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"\nUnexpected error: {str(e)}")
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
        if not os.path.exists(path):
            raise FileNotFoundError(f"Font file not found: {path}")

    # Register fonts in ReportLab
    try:
        pdfmetrics.registerFont(TTFont('Carlito', font_paths["Carlito-Regular"]))
        pdfmetrics.registerFont(TTFont('Carlito-Bold', font_paths["Carlito-Bold"]))
        pdfmetrics.registerFont(TTFont('Carlito-Italic', font_paths["Carlito-Italic"]))
        pdfmetrics.registerFont(TTFont('Carlito-BoldItalic', font_paths["Carlito-BoldItalic"]))
    except Exception as e:
        print(f"Error registering fonts: {e}")
        raise

    return font_paths

def generate_original_document_pdf(document):
    """
    Generates the original document PDF.
    Returns a BytesIO buffer containing the PDF.
    """
    # Replace variables within the content
    processed_content = document.content
    for variable in document.variables.all():
        processed_content = processed_content.replace(f"{{{{{variable.name_en}}}}}", variable.value or "")

    # Convert HTML to XHTML using BeautifulSoup
    soup = BeautifulSoup(processed_content, 'html.parser')

    # Create temporary buffer for initial PDF
    temp_buffer = BytesIO()

    # Register fonts
    font_paths = register_carlito_fonts()

    # Define CSS styles for PDF
    styles = f"""
    <style>
    @page {{
        margin: 2cm;
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
        font-size: 12pt;
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
    if pisa_status.err:
        raise Exception("HTML to PDF conversion failed")

    # Create a new buffer for the watermarked PDF
    watermarked_buffer = BytesIO()

    # Create PDF reader and writer objects
    reader = PdfReader(temp_buffer)
    writer = PdfWriter()

    # Create watermark canvas
    watermark_buffer = BytesIO()
    c = canvas.Canvas(watermark_buffer, pagesize=letter)
    c.saveState()
    c.translate(300, 400)  # Move to center of page
    c.rotate(45)  # Rotate 45 degrees
    c.setFont('Carlito-Bold', 60)
    c.setFillColor(colors.lightgrey)
    c.setFillAlpha(0.3)  # Set transparency to 30%
    c.drawCentredString(0, 30, "ESTADO REGISTRO DIGITAL")
    c.drawCentredString(0, -30, "VERIFICADO")
    c.restoreState()
    c.save()
    watermark_buffer.seek(0)
    watermark_pdf = PdfReader(watermark_buffer)

    # Add watermark to each page
    for page in reader.pages:
        page.merge_page(watermark_pdf.pages[0])
        writer.add_page(page)

    # Write the watermarked PDF to the output buffer
    writer.write(watermarked_buffer)
    watermarked_buffer.seek(0)

    return watermarked_buffer

def create_signatures_pdf(document, request):
    """
    Creates a PDF containing the signatures information for a document.
    Returns a BytesIO buffer containing the PDF.
    """
    # Create a buffer for the PDF
    buffer = BytesIO()
    
    # Create the PDF document with wider margins for formal appearance
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=90,
        leftMargin=90,
        topMargin=90,
        bottomMargin=90
    )
    
    # Get and customize styles for left alignment
    styles = getSampleStyleSheet()
    
    # Register fonts
    register_carlito_fonts()
    
    # Create custom styles with left alignment
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        alignment=0,  # Left alignment
        fontSize=18,
        spaceAfter=24,
        fontName='Carlito-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        alignment=0,  # Left alignment
        fontSize=14,
        spaceAfter=12,
        fontName='Carlito-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        alignment=0,  # Left alignment
        fontSize=11,
        spaceAfter=8,
        fontName='Carlito'
    )
    
    detail_style = ParagraphStyle(
        'DetailStyle',
        parent=styles['Normal'],
        alignment=0,  # Left alignment
        fontSize=10,
        spaceAfter=6,
        fontName='Carlito',
        leftIndent=20
    )
    
    # Build the PDF content
    elements = []
    
    # Add formal document header
    elements.append(Paragraph("REGISTRO OFICIAL DE FIRMAS ELECTRÓNICAS", title_style))
    elements.append(Spacer(1, 4))
    
    elements.append(Paragraph("CERTIFICACIÓN DE AUTENTICIDAD DE FIRMAS DIGITALES", subtitle_style))
    elements.append(Spacer(1, 3))
    
    # Add document identification section
    elements.append(Paragraph("I. IDENTIFICACIÓN DEL DOCUMENTO", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"<b>Título del Documento:</b> {document.title}", normal_style))
    elements.append(Paragraph(f"<b>Fecha de Creación:</b> {document.created_at.strftime('%d de %B de %Y a las %H:%M:%S')}", normal_style))
    elements.append(Paragraph(f"<b>Identificador Único:</b> {document.pk}", normal_style))
    if hasattr(document, 'description') and document.description:
        elements.append(Paragraph(f"<b>Descripción:</b> {document.description}", normal_style))
    elements.append(Spacer(1, 10))
    
    # Add signature verification section
    total_signatures = document.signatures.count()
    signed_count = document.signatures.filter(signed=True).count()
    
    elements.append(Paragraph("II. RESUMEN DE FIRMAS", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"<b>Total de Firmas Requeridas:</b> {total_signatures}", normal_style))
    elements.append(Paragraph(f"<b>Total de Firmas Completadas:</b> {signed_count}", normal_style))
    elements.append(Paragraph(f"<b>Estado de Completitud:</b> {'COMPLETAMENTE FIRMADO' if document.fully_signed else 'PENDIENTE'}", normal_style))
    elements.append(Spacer(1, 10))
    
    # Add detailed signatures registry
    elements.append(Paragraph("III. REGISTRO DETALLADO DE FIRMAS", subtitle_style))
    elements.append(Spacer(1, 10))
    
    signature_images_added = False
    for signature in document.signatures.all().order_by('created_at'):
        try:
            user = signature.signer
            user_signature = getattr(user, 'signature', None)
            
            if user_signature and user_signature.signature_image:
                role_mapping = {
                    "lawyer": "Abogado Responsable",
                    "client": "Cliente",
                    "admin": "Administrador",
                    "staff": "Personal Autorizado"
                }
                role = role_mapping.get(user.role, "Usuario Autorizado")
                
                # Add signature details with additional identification information
                elements.append(Paragraph(f"<b>Firmante:</b> {user.get_full_name() or user.email}", normal_style))
                elements.append(Paragraph(f"<b>Rol:</b> {role}", detail_style))
                elements.append(Paragraph(f"<b>Correo Electrónico:</b> {user.email}", detail_style))
                
                # Add identification information
                if user.document_type:
                    elements.append(Paragraph(f"<b>Tipo de Identificación:</b> {user.get_document_type_display()}", detail_style))
                if user.identification:
                    elements.append(Paragraph(f"<b>Número de Identificación:</b> {user.identification}", detail_style))
                
                elements.append(Paragraph(f"<b>Fecha y Hora de Firma:</b> {signature.signed_at.strftime('%d/%m/%Y %H:%M:%S') if signature.signed_at else 'N/A'}", detail_style))
                elements.append(Paragraph(f"<b>IP de Registro:</b> {signature.ip_address or 'No Registrada'}", detail_style))
                elements.append(Spacer(1, 8))
                
                # Add signature image
                try:
                    img = Image(user_signature.signature_image.path)
                    img.drawHeight = 60
                    img.drawWidth = 240
                    elements.append(img)
                    elements.append(Spacer(1, 10))
                    signature_images_added = True
                    print(f"✅ Signature image added for user: {user.email}")
                except Exception as e:
                    print(f"❌ Error adding signature image for user {user.email}: {str(e)}")
                    elements.append(Paragraph("<b>Error:</b> al cargar la imagen de la firma", detail_style))
                    elements.append(Spacer(1, 10))
            
        except Exception as e:
            print(f"❌ Error processing signature image: {str(e)}")
    
    if not signature_images_added:
        elements.append(Paragraph("<b>Nota:</b> No se encontraron imágenes de firmas registradas.", normal_style))
        elements.append(Spacer(1, 10))
    
    # Add legal certification footer
    elements.append(Spacer(1, 15))
    elements.append(Paragraph("IV. CERTIFICACIÓN LEGAL", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "Este documento constituye un registro oficial de las firmas electrónicas aplicadas al documento referenciado. "
        "Las firmas electrónicas contenidas en este registro han sido verificadas y cumplen con los estándares "
        "de autenticidad requeridos por la legislación vigente en materia de documentos electrónicos.",
        normal_style
    ))
    elements.append(Spacer(1, 10))
    
    # Add generation timestamp
    from datetime import datetime
    generation_time = datetime.now().strftime('%d de %B de %Y a las %H:%M:%S')
    elements.append(Paragraph(f"<b>Documento generado el:</b> {generation_time}", detail_style))
    elements.append(Paragraph(f"<b>Generado por:</b> {request.user.get_full_name() or request.user.email}", detail_style))
    
    # Build the PDF
    print("\nBuilding comprehensive PDF...")
    
    # Create a custom canvas class to add watermark
    class WatermarkCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            canvas.Canvas.__init__(self, *args, **kwargs)
            self.pages = []
            
        def showPage(self):
            self.pages.append(dict(self.__dict__))
            self._startPage()
            
        def save(self):
            page_count = len(self.pages)
            for page in self.pages:
                self.__dict__.update(page)
                self.drawWatermark()
                canvas.Canvas.showPage(self)
            canvas.Canvas.save(self)
            
        def drawWatermark(self):
            self.saveState()
            self.translate(300, 400)  # Move to center of page
            self.rotate(45)  # Rotate 45 degrees
            self.setFont('Carlito-Bold', 60)
            self.setFillColor(colors.lightgrey)
            self.setFillAlpha(0.3)  # Set transparency to 30%
            self.drawCentredString(0, 30, "ESTADO REGISTRO DIGITAL")
            self.drawCentredString(0, -30, "VERIFICADO")
            self.restoreState()
    
    # Build the PDF with watermark
    doc.build(elements, canvasmaker=WatermarkCanvas)
    print("✅ Comprehensive PDF built successfully")
    
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
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
        print(f"\n=== GENERATING COMBINED PDF FOR DOCUMENT {pk} ===")
        
        # Retrieve the document from the database
        document = DynamicDocument.objects.prefetch_related('signatures__signer', 'variables').get(pk=pk)
        print(f"Document found: {document.title}")
        
        # Verify document state
        if document.state != 'FullySigned':
            print(f"❌ Document is not fully signed. Current state: {document.state}")
            return Response(
                {'detail': 'El documento debe estar completamente firmado para generar el PDF de firmas.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify signatures exist
        if not document.signatures.exists():
            print("❌ Document has no signatures")
            return Response(
                {'detail': 'El documento no tiene firmas registradas.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the original document PDF
        original_pdf_buffer = generate_original_document_pdf(document)
        
        # Create the signatures PDF
        signatures_pdf_buffer = create_signatures_pdf(document, request)
        
        # Combine both PDFs
        combined_pdf_buffer = combine_pdfs(original_pdf_buffer, signatures_pdf_buffer)
        
        # Create the HTTP response with proper headers
        response = HttpResponse(content_type='application/pdf')
        # Clean filename for better compatibility
        clean_filename = "".join(c for c in document.title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        response['Content-Disposition'] = f'attachment; filename="Documento_Completo_{clean_filename}.pdf"'
        response['Content-Length'] = len(combined_pdf_buffer.getvalue())
        response.write(combined_pdf_buffer.getvalue())
        
        print("✅ Combined PDF response created successfully")
        return response
        
    except DynamicDocument.DoesNotExist:
        print(f"\n❌ Error: Document with ID {pk} not found")
        return Response(
            {'detail': 'Documento no encontrado.'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        print(f"Error details: {traceback.format_exc()}")
        return Response(
            {'detail': f'Error al generar el PDF de firmas: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class DocumentPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        try:
            document = DynamicDocument.objects.get(id=document_id)
            
            # Check if user has permission to view this document
            if not document.can_view(request.user):
                return Response(
                    {"error": "You don't have permission to view this document"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get document variables
            variables = document.variables.all()
            variables_data = DocumentVariableSerializer(variables, many=True).data
            
            # Return document data with variables
            return Response({
                "id": document.id,
                "title": document.title,
                "content": document.content,
                "variables": variables_data,
                "status": document.status,
                "created_at": document.created_at,
                "updated_at": document.updated_at
            })
            
        except DynamicDocument.DoesNotExist:
            return Response(
                {"error": "Document not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )