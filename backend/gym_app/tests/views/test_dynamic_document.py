# backend/gym_app/tests/views/test_dynamic_document.py

import pytest
import io
import json
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import User, DynamicDocument, DocumentVariable, RecentDocument
from gym_app.views.dynamic_documents import document_views

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def user():
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword'
    )

@pytest.fixture
def sample_document(user):
    """Create a sample dynamic document for testing"""
    document = DynamicDocument.objects.create(
        title="Test Document",
        content="<p>This is a test document with {{variable1}} and {{variable2}}.</p>",
        state="Draft",
        created_by=user
    )
    
    # Create variables for the document
    DocumentVariable.objects.create(
        document=document,
        name_en="variable1",
        value="Value 1"
    )
    
    DocumentVariable.objects.create(
        document=document,
        name_en="variable2",
        value="Value 2"
    )
    
    return document

@pytest.mark.django_db
class TestDynamicDocumentViews:
    
    def test_list_dynamic_documents_authenticated(self, api_client, user, sample_document):
        """Test retrieving a list of dynamic documents when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('list_dynamic_documents')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        # The list endpoint now returns a paginated structure
        # {
        #   "items": [...],
        #   "totalItems": N,
        #   "totalPages": P,
        #   "currentPage": page
        # }
        assert 'items' in response.data
        assert response.data['totalItems'] == 1
        assert response.data['totalPages'] == 1
        assert response.data['currentPage'] == 1

        assert len(response.data['items']) == 1
        first_doc = response.data['items'][0]
        assert first_doc['title'] == "Test Document"
        assert first_doc['state'] == "Draft"
    
    def test_list_dynamic_documents_pagination_default_limit_10(self, api_client, user):
        """list_dynamic_documents debe paginar de 10 en 10 y devolver totales correctos."""
        api_client.force_authenticate(user=user)

        # Crear más de 10 documentos para forzar paginación
        for i in range(15):
            DynamicDocument.objects.create(
                title=f"Doc {i}",
                content="<p>content</p>",
                state="Draft",
                created_by=user,
            )

        url = reverse('list_dynamic_documents')

        # Primera página
        response_page_1 = api_client.get(url, {'page': 1})
        assert response_page_1.status_code == status.HTTP_200_OK
        assert response_page_1.data['totalItems'] == 15
        assert response_page_1.data['totalPages'] == 2
        assert response_page_1.data['currentPage'] == 1
        # El límite por defecto debe ser 10 elementos en la primera página
        assert len(response_page_1.data['items']) == 10

        # Segunda página
        response_page_2 = api_client.get(url, {'page': 2})
        assert response_page_2.status_code == status.HTTP_200_OK
        assert response_page_2.data['totalItems'] == 15
        assert response_page_2.data['totalPages'] == 2
        assert response_page_2.data['currentPage'] == 2
        # Restantes 5 elementos en la segunda página
        assert len(response_page_2.data['items']) == 5

    def test_list_dynamic_documents_filter_by_states(self, api_client, user):
        """list_dynamic_documents debe permitir filtrar por múltiples estados usando 'states'."""
        api_client.force_authenticate(user=user)

        # Crear documentos en distintos estados
        DynamicDocument.objects.create(
            title="Doc Draft",
            content="<p>x</p>",
            state="Draft",
            created_by=user,
        )
        DynamicDocument.objects.create(
            title="Doc Published",
            content="<p>x</p>",
            state="Published",
            created_by=user,
        )
        DynamicDocument.objects.create(
            title="Doc Progress",
            content="<p>x</p>",
            state="Progress",
            created_by=user,
        )

        url = reverse('list_dynamic_documents')

        # Filtrar solo Draft y Published usando el nuevo parámetro states
        response = api_client.get(url, {'states': 'Draft,Published'})
        assert response.status_code == status.HTTP_200_OK

        # Debe devolver únicamente los documentos en esos estados
        assert response.data['totalItems'] == 2
        returned_states = {item['state'] for item in response.data['items']}
        assert returned_states.issubset({"Draft", "Published"})

    def test_list_dynamic_documents_filter_by_lawyer_and_states(self, api_client, user):
        """list_dynamic_documents debe filtrar por lawyer_id y estados (caso Minutas)."""
        # Creamos dos abogados distintos
        lawyer_1 = User.objects.create_user(email='lawyer1@example.com', password='pwd', role='lawyer')
        lawyer_2 = User.objects.create_user(email='lawyer2@example.com', password='pwd', role='lawyer')

        # Autenticamos como admin genérico para listar (role no debería limitar por ser abogado en el decorador)
        api_client.force_authenticate(user=lawyer_1)

        # Documentos del lawyer_1 en distintos estados
        doc1 = DynamicDocument.objects.create(
            title="L1 Draft",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_1,
        )
        doc2 = DynamicDocument.objects.create(
            title="L1 Published",
            content="<p>x</p>",
            state="Published",
            created_by=lawyer_1,
        )
        # Documento de otro abogado que no debería aparecer
        doc_other = DynamicDocument.objects.create(
            title="L2 Draft",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_2,
        )

        url = reverse('list_dynamic_documents')

        response = api_client.get(url, {
            'lawyer_id': lawyer_1.id,
            'states': 'Draft,Published',
        })

        assert response.status_code == status.HTTP_200_OK
        assert response.data['totalItems'] == 2
        returned_ids = {item['id'] for item in response.data['items']}
        assert returned_ids == {doc1.id, doc2.id}

    def test_list_dynamic_documents_filter_by_client_and_states(self, api_client):
        """list_dynamic_documents debe filtrar por client_id y estados (caso Mis Documentos)."""
        # Creamos un cliente y otro usuario cualquiera
        client = User.objects.create_user(email='client@example.com', password='pwd', role='client')
        other_client = User.objects.create_user(email='other_client@example.com', password='pwd', role='client')

        # Autenticamos como cliente principal
        api_client.force_authenticate(user=client)

        # Documentos asignados al cliente en distintos estados
        doc_progress = DynamicDocument.objects.create(
            title="C1 Progress",
            content="<p>x</p>",
            state="Progress",
            created_by=client,
            assigned_to=client,
        )
        doc_completed = DynamicDocument.objects.create(
            title="C1 Completed",
            content="<p>x</p>",
            state="Completed",
            created_by=client,
            assigned_to=client,
        )

        # Documento asignado a otro cliente que no debería aparecer
        DynamicDocument.objects.create(
            title="C2 Progress",
            content="<p>x</p>",
            state="Progress",
            created_by=other_client,
            assigned_to=other_client,
        )

        url = reverse('list_dynamic_documents')

        response = api_client.get(url, {
            'client_id': client.id,
            'states': 'Progress,Completed',
        })

        assert response.status_code == status.HTTP_200_OK
        # Solo deben contarse los documentos del cliente autenticado en esos estados
        assert response.data['totalItems'] == 2
        returned_ids = {item['id'] for item in response.data['items']}
        assert returned_ids == {doc_progress.id, doc_completed.id}

    def test_list_dynamic_documents_unauthenticated(self, api_client, sample_document):
        """Test that unauthenticated users cannot access the document list"""
        url = reverse('list_dynamic_documents')
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_dynamic_documents_invalid_page_and_limit(self, api_client, user):
        """Invalid page/limit should fall back to defaults and return first page."""
        api_client.force_authenticate(user=user)

        for i in range(12):
            DynamicDocument.objects.create(
                title=f"Doc {i}",
                content="<p>x</p>",
                state="Draft",
                created_by=user,
            )

        url = reverse('list_dynamic_documents')
        response = api_client.get(url, {'page': 'abc', 'limit': -5})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['currentPage'] == 1
        assert response.data['totalItems'] == 12
        assert len(response.data['items']) == 10

    def test_list_dynamic_documents_out_of_range_page_returns_last(self, api_client, user):
        """Out-of-range page should return last available page."""
        api_client.force_authenticate(user=user)

        for i in range(12):
            DynamicDocument.objects.create(
                title=f"Doc {i}",
                content="<p>x</p>",
                state="Draft",
                created_by=user,
            )

        url = reverse('list_dynamic_documents')
        response = api_client.get(url, {'page': 99, 'limit': 5})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['currentPage'] == 3
        assert response.data['totalPages'] == 3
        assert len(response.data['items']) == 2
    
    def test_create_dynamic_document_authenticated(self, api_client, user):
        """Test creating a new dynamic document when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create document data
        data = {
            "title": "New Document",
            "content": "<p>This is a new document with {{variable1}}.</p>",
            "state": "Draft",
            "variables": [
                {
                    "name_en": "variable1",
                    "value": "Test Value"
                }
            ]
        }
        
        # Make the request
        url = reverse('create_dynamic_document')
        response = api_client.post(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == "New Document"
        
        # Verify document was created in the database
        assert DynamicDocument.objects.count() == 1
        document = DynamicDocument.objects.first()
        assert document.title == "New Document"
        assert document.created_by == user
        
        # Verify variable was created
        assert document.variables.count() == 1
        variable = document.variables.first()
        assert variable.name_en == "variable1"
        assert variable.value == "Test Value"

    def test_create_dynamic_document_assigns_user_when_progress(self, api_client, user):
        """Progress documents created without assigned_to should default to request.user."""
        api_client.force_authenticate(user=user)

        data = {
            "title": "Progress Doc",
            "content": "<p>x</p>",
            "state": "Progress",
        }

        url = reverse('create_dynamic_document')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['assigned_to'] == user.id

    def test_create_dynamic_document_invalid_select_variable(self, api_client, user):
        """Select variables require options; invalid payload should return 400."""
        api_client.force_authenticate(user=user)

        data = {
            "title": "Bad Doc",
            "content": "<p>x</p>",
            "state": "Draft",
            "variables": [
                {
                    "name_en": "choice",
                    "field_type": "select",
                    "select_options": [],
                }
            ],
        }

        url = reverse('create_dynamic_document')
        response = api_client.post(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'variables' in response.data
    
    def test_update_dynamic_document_authenticated(self, api_client, user, sample_document):
        """Test updating an existing dynamic document when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Create update data
        data = {
            "title": "Updated Document",
            "content": "<p>This is the updated content.</p>",
            "state": "Progress",
            "variables": [
                {
                    "name_en": "variable1",
                    "value": "Updated Value 1"
                },
                {
                    "name_en": "variable2",
                    "value": "Updated Value 2"
                }
            ]
        }
        
        # Make the request
        url = reverse('update_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.put(url, data, format='json')
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response.data['title'] == "Updated Document"
        assert response.data['state'] == "Progress"
        
        # Verify document was updated in the database
        sample_document.refresh_from_db()
        assert sample_document.title == "Updated Document"
        assert sample_document.state == "Progress"
        
        # Verify variables were updated
        variables = {var.name_en: var.value for var in sample_document.variables.all()}
        assert variables["variable1"] == "Updated Value 1"
        assert variables["variable2"] == "Updated Value 2"

    def test_update_dynamic_document_ignores_created_by(self, api_client, user, sample_document):
        """created_by should not be updated via the endpoint."""
        api_client.force_authenticate(user=user)
        other_user = User.objects.create_user(email='other@example.com', password='pass')

        url = reverse('update_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.put(url, {'created_by': other_user.id, 'title': 'Keep owner'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        sample_document.refresh_from_db()
        assert sample_document.created_by == user

    def test_update_dynamic_document_invalid_variable_returns_400(self, api_client, user, sample_document):
        """Invalid variables should return serializer errors."""
        api_client.force_authenticate(user=user)

        data = {
            "variables": [
                {
                    "name_en": "select_var",
                    "field_type": "select",
                    "select_options": [],
                }
            ]
        }

        url = reverse('update_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.put(url, data, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'variables' in response.data

    def test_get_dynamic_document_initializes_select_options(self, api_client, user, sample_document):
        """Select variables without options should be initialized to empty list."""
        api_client.force_authenticate(user=user)

        select_var = DocumentVariable.objects.create(
            document=sample_document,
            name_en='select_var',
            field_type='select',
            select_options=None,
        )

        url = reverse('get_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        select_var.refresh_from_db()
        assert select_var.select_options == []

    def test_get_dynamic_document_not_found(self, api_client, user):
        api_client.force_authenticate(user=user)

        url = reverse('get_dynamic_document', kwargs={'pk': 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_delete_dynamic_document_authenticated(self, api_client, user, sample_document):
        """Test deleting a dynamic document when authenticated"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('delete_dynamic_document', kwargs={'pk': sample_document.pk})
        response = api_client.delete(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response.data['detail'] == "Dynamic document deleted successfully."
        
        # Verify document was deleted from the database
        assert DynamicDocument.objects.count() == 0

@pytest.mark.django_db
class TestDynamicDocumentExport:
    
    def test_download_dynamic_document_pdf_authenticated(self, api_client, user, sample_document, monkeypatch):
        """Test downloading a dynamic document as PDF when authenticated"""
        # Mock the pisa.CreatePDF function to avoid actual PDF creation
        class MockPisaStatus:
            err = False
            
        def mock_create_pdf(*args, **kwargs):
            return MockPisaStatus()
            
        monkeypatch.setattr('xhtml2pdf.pisa.CreatePDF', mock_create_pdf)
        
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('download_dynamic_document_pdf', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/pdf'
        assert response['Content-Disposition'] == f'attachment; filename="{sample_document.title}.pdf"'
    
    def test_download_dynamic_document_word_authenticated(self, api_client, user, sample_document, monkeypatch):
        """Test downloading a dynamic document as Word when authenticated"""
        # Create a mock for Document.save
        class MockDocument:  # pragma: no cover – mock methods not invoked
            def __init__(self):
                self.styles = {
                    'Normal': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading1': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading2': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading3': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading4': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading5': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading6': type('Style', (), {'font': type('Font', (), {'name': None})})
                }
                
            def add_paragraph(self, *args, **kwargs):
                return type('Paragraph', (), {
                    'runs': [],
                    'add_run': lambda text: type('Run', (), {'font': type('Font', (), {'name': None})}),
                    'alignment': None,
                    'paragraph_format': type('ParagraphFormat', (), {'left_indent': None, 'line_spacing': None})
                })
                
            def add_heading(self, *args, **kwargs):
                return type('Heading', (), {
                    'runs': [type('Run', (), {'font': type('Font', (), {'name': None})})],
                })
                
            def save(self, *args, **kwargs):
                pass
        
        # Replace Document with our mock
        monkeypatch.setattr('docx.Document', lambda: MockDocument())
        
        # Create a mock for get_template
        def mock_get_template(*args, **kwargs):  # pragma: no cover – mock factory not invoked
            return type('Template', (), {
                'render': lambda context: f'<html><body>{context["content"]}</body></html>'
            })
        
        monkeypatch.setattr('django.template.loader.get_template', mock_get_template)
        
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Make the request
        url = reverse('download_dynamic_document_word', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)
        
        # Assert the response
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        assert response['Content-Disposition'] == f'attachment; filename="{sample_document.title}.docx"'

    def test_download_dynamic_document_pdf_missing_fonts_returns_500(self, api_client, user, sample_document, monkeypatch):
        api_client.force_authenticate(user=user)

        monkeypatch.setattr(document_views.os.path, "exists", lambda path: False)

        url = reverse('download_dynamic_document_pdf', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Font file not found" in response.data['detail']

    def test_download_dynamic_document_pdf_pisa_error_returns_500(self, api_client, user, sample_document, monkeypatch):
        api_client.force_authenticate(user=user)

        class MockPisaStatus:
            err = True

        def mock_create_pdf(*args, **kwargs):
            return MockPisaStatus()

        monkeypatch.setattr(document_views.os.path, "exists", lambda path: True)
        monkeypatch.setattr(document_views.pdfmetrics, "registerFont", lambda *args, **kwargs: None)
        monkeypatch.setattr(document_views, "TTFont", lambda *args, **kwargs: object())
        monkeypatch.setattr(document_views.pisa, "CreatePDF", mock_create_pdf)

        url = reverse('download_dynamic_document_pdf', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error generating PDF" in response.data['detail']

    def test_download_dynamic_document_word_template_error_returns_500(self, api_client, user, sample_document, monkeypatch):
        api_client.force_authenticate(user=user)

        def raise_error(*args, **kwargs):
            raise Exception("template fail")

        monkeypatch.setattr(document_views, "get_template", raise_error)

        url = reverse('download_dynamic_document_word', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error generating Word document" in response.data['detail']

    def test_download_dynamic_document_word_invalid_template_falls_back(self, api_client, user, sample_document, monkeypatch, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=user)

        template_file = SimpleUploadedFile(
            "template.docx",
            b"bad-template",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        user.letterhead_word_template = template_file
        user.save(update_fields=["letterhead_word_template"])

        class MockDocument:
            def __init__(self, *args, **kwargs):
                self.styles = {
                    'Normal': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading1': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading2': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading3': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading4': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading5': type('Style', (), {'font': type('Font', (), {'name': None})}),
                    'Heading6': type('Style', (), {'font': type('Font', (), {'name': None})}),
                }
                self.paragraphs = [type('Paragraph', (), {'text': '', 'runs': []})]
                self.sections = [type('Section', (), {})]

            def add_paragraph(self, *args, **kwargs):
                return type('Paragraph', (), {
                    'runs': [],
                    'add_run': lambda text: type('Run', (), {'font': type('Font', (), {'name': None})}),
                    'alignment': None,
                    'paragraph_format': type('ParagraphFormat', (), {'left_indent': None, 'line_spacing': None})
                })

            def add_heading(self, *args, **kwargs):  # pragma: no cover – mock method not invoked
                return type('Heading', (), {'runs': [type('Run', (), {'font': type('Font', (), {'name': None})})]})

            def save(self, *args, **kwargs):
                pass

        def document_factory(path=None):
            if path:
                raise Exception("bad template")
            return MockDocument()

        monkeypatch.setattr(document_views, "Document", document_factory)

        url = reverse('download_dynamic_document_word', kwargs={'pk': sample_document.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
    
    def test_document_download_unauthenticated(self, api_client, sample_document):
        """Test that unauthenticated users cannot download documents"""
        # Try PDF download
        pdf_url = reverse('download_dynamic_document_pdf', kwargs={'pk': sample_document.pk})
        pdf_response = api_client.get(pdf_url)
        assert pdf_response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Try Word download
        word_url = reverse('download_dynamic_document_word', kwargs={'pk': sample_document.pk})
        word_response = api_client.get(word_url)
        assert word_response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_download_nonexistent_document(self, api_client, user):
        """Test trying to download a document that doesn't exist"""
        # Authenticate the user
        api_client.force_authenticate(user=user)
        
        # Try PDF download with non-existent ID
        pdf_url = reverse('download_dynamic_document_pdf', kwargs={'pk': 9999})
        pdf_response = api_client.get(pdf_url)
        assert pdf_response.status_code == status.HTTP_404_NOT_FOUND
        
        # Try Word download with non-existent ID
        word_url = reverse('download_dynamic_document_word', kwargs={'pk': 9999})
        word_response = api_client.get(word_url)
        assert word_response.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.django_db
class TestDynamicDocumentRecentViews:

    def test_get_recent_documents_empty(self, api_client, user):
        api_client.force_authenticate(user=user)

        url = reverse('get-recent-documents')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_get_recent_documents_filters_by_can_view_and_limits_to_10(self, api_client, user):
        """get_recent_documents debe devolver como máximo 10 documentos y respetar can_view."""
        # Crear 11 documentos visibles para el usuario
        visible_docs = []
        for i in range(11):
            doc = DynamicDocument.objects.create(
                title=f"Doc {i}",
                content="<p>x</p>",
                state="Draft",
                created_by=user,
            )
            visible_docs.append(doc)
            RecentDocument.objects.create(user=user, document=doc)

        # Crear un documento que el usuario NO puede ver (otro creador, no público)
        other_user = User.objects.create_user(
            email='other@example.com',
            password='testpassword',
        )
        hidden_doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>secret</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )
        RecentDocument.objects.create(user=user, document=hidden_doc)

        api_client.force_authenticate(user=user)

        url = reverse('get-recent-documents')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Debe devolver como máximo 10 documentos
        assert len(response.data) == 10
        # Ninguno de los documentos debe ser el oculto
        doc_ids = {item['document']['id'] for item in response.data}
        assert hidden_doc.id not in doc_ids

    def test_update_recent_document_creates_and_updates_entry(self, api_client, user):
        """update_recent_document debe crear o actualizar la entrada de RecentDocument"""
        document = DynamicDocument.objects.create(
            title="Doc reciente",
            content="<p>x</p>",
            state="Draft",
            created_by=user,
        )

        api_client.force_authenticate(user=user)

        url = reverse('update-recent-document', kwargs={'document_id': document.id})

        # Primera llamada: crea la entrada
        response = api_client.post(url, {})
        assert response.status_code == status.HTTP_200_OK

        recent = RecentDocument.objects.get(user=user, document=document)
        first_last_visited = recent.last_visited

        # Segunda llamada: actualiza last_visited
        response = api_client.post(url, {})
        assert response.status_code == status.HTTP_200_OK

        recent.refresh_from_db()
        assert recent.last_visited >= first_last_visited

    def test_update_recent_document_forbidden_when_no_visibility(self, api_client, user):
        """update_recent_document debe devolver 403 si el usuario no puede ver el documento"""
        other_user = User.objects.create_user(
            email='other2@example.com',
            password='testpassword',
        )
        document = DynamicDocument.objects.create(
            title="Doc oculto",
            content="<p>secret</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )

        api_client.force_authenticate(user=user)

        url = reverse('update-recent-document', kwargs={'document_id': document.id})
        response = api_client.post(url, {})

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'permission' in response.data['detail'].lower()

    def test_update_recent_document_not_found(self, api_client, user):
        """update_recent_document debe devolver 404 si el documento no existe"""
        api_client.force_authenticate(user=user)

        url = reverse('update-recent-document', kwargs={'document_id': 9999})
        response = api_client.post(url, {})

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert 'not found' in response.data['detail']