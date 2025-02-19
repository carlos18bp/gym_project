import io
import re
from django.http import FileResponse
from bs4 import BeautifulSoup
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from django.template.loader import get_template
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument
from gym_app.serializers.dynamic_document import DynamicDocumentSerializer
from weasyprint import HTML


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


# Mapping of supported fonts
SUPPORTED_FONTS = {
    "andale mono": "Andale Mono",
    "arial": "Arial",
    "arial black": "Arial Black",
    "book antiqua": "Book Antiqua",
    "comic sans ms": "Comic Sans MS",
    "courier new": "Courier New",
    "georgia": "Georgia",
    "helvetica": "Helvetica",
    "impact": "Impact",
    "símbolo": "Symbol",
    "tahoma": "Tahoma",
    "terminal": "Terminal",
    "times new roman": "Times New Roman",
    "trebuchet ms": "Trebuchet MS",
    "verdana": "Verdana",
    "webdings": "Webdings",
    "wingdings": "Wingdings"
}

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_dynamic_document_pdf(request, pk):
    """
    Generates and returns a PDF file for the given document.
    """
    try:
        document = DynamicDocument.objects.prefetch_related('variables').get(pk=pk)

        # Replace variables in the content
        processed_content = document.content
        for variable in document.variables.all():
            processed_content = processed_content.replace(f"{{{{{variable.name_en}}}}}", variable.value or "")

        # Render HTML
        template = get_template("pdf_template.html")
        html_content = template.render({"content": processed_content})

        # Generate PDF using BytesIO
        pdf_buffer = io.BytesIO()
        HTML(string=html_content).write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        return FileResponse(pdf_buffer, as_attachment=True, filename=f"{document.title}.pdf", content_type='application/pdf')
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': f'Error generating PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_dynamic_document_word(request, pk):
    """
    Generates and returns a Word (.docx) file for the given document using python-docx.
    """
    try:
        document = DynamicDocument.objects.prefetch_related('variables').get(pk=pk)

        # Replace variables dynamically
        def replace_variables(text):
            for variable in document.variables.all():
                pattern = re.compile(rf"{{{{{variable.name_en}}}}}")
                text = pattern.sub(variable.value or "", text)
            return text

        processed_content = replace_variables(document.content)
        
        # Render HTML with template
        template = get_template("pdf_template.html")
        html_content = template.render({"content": processed_content})

        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(html_content, "html.parser")

        # Create Word document
        doc = Document()

        for tag in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "span", "hr"]):
            if tag.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                level = int(tag.name[1])
                doc.add_heading(tag.get_text().strip(), level=level)

            elif tag.name == "p":
                if tag.get_text().strip() == "":
                    continue

                paragraph = doc.add_paragraph()
                style = tag.get("style", "")

                if "text-align: center" in style:
                    paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
                elif "text-align: right" in style:
                    paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.RIGHT
                elif "text-align: left" in style:
                    paragraph.alignment = WD_PARAGRAPH_ALIGNMENT.LEFT

                if "padding-left" in style:
                    padding_value = int(style.split("padding-left:")[1].split("px")[0].strip())
                    paragraph.paragraph_format.left_indent = Pt(padding_value)

                if "line-height" in style:
                    try:
                        line_height = float(style.split("line-height:")[1].split(";")[0].strip())
                        paragraph.paragraph_format.line_spacing = line_height
                    except ValueError:
                        pass

                for content in tag.contents:
                    text_content = content.get_text() if hasattr(content, "get_text") else str(content)
                    run = paragraph.add_run(text_content)

                    if content.name == "strong":
                        run.bold = True
                    if content.name == "em":
                        run.italic = True

                    if content.name == "span":
                        if "font-size" in content.get("style", ""):
                            try:
                                font_size = int(content["style"].split("font-size:")[1].split("pt")[0].strip())
                                run.font.size = Pt(font_size)
                            except ValueError:
                                pass

                        if "color" in content.get("style", ""):
                            color_code = content["style"].split("color:")[1].split(";")[0].strip()
                            color_code = color_code.replace("rgb(", "").replace(")", "").split(",")
                            run.font.color.rgb = RGBColor(int(color_code[0]), int(color_code[1]), int(color_code[2]))

                        if "font-family" in content.get("style", ""):
                            font_family = content["style"].split("font-family:")[1].split(";")[0].strip().lower()
                            if font_family in SUPPORTED_FONTS:
                                rPr = run._element.find(qn("w:rPr"))
                                rFonts = OxmlElement("w:rFonts")
                                rFonts.set(qn("w:ascii"), SUPPORTED_FONTS[font_family])
                                rFonts.set(qn("w:hAnsi"), SUPPORTED_FONTS[font_family])
                                rPr.append(rFonts)

            elif tag.name == "hr":
                doc.add_paragraph("_" * 100)

        docx_buffer = io.BytesIO()
        doc.save(docx_buffer)
        docx_buffer.seek(0)

        return FileResponse(docx_buffer, as_attachment=True, filename=f"{document.title}.docx", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    except DynamicDocument.DoesNotExist:
        return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'detail': f'Error generating Word document: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
