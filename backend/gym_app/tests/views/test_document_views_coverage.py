"""Tests for uncovered branches in document_views.py (75%→higher)."""
import pytest
import io
import os
from unittest import mock
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models.dynamic_document import DynamicDocument, RecentDocument
from gym_app.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_dvc@e.com', password='p', role='lawyer',
        first_name='L', last_name='D')


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email='basic_dvc@e.com', password='p', role='basic',
        first_name='B', last_name='D')


@pytest.fixture
def doc(lawyer):
    """Document with rich HTML content for Word/PDF tests."""
    html = (
        '<h1>Title</h1>'
        '<h2>Subtitle</h2>'
        '<p style="text-align: center">Centered</p>'
        '<p style="text-align: right">Right</p>'
        '<p style="text-align: left">Left</p>'
        '<p style="text-align: justify">Justified</p>'
        '<p style="padding-left: 40px">Indented</p>'
        '<p style="line-height: 1.5">Spaced</p>'
        '<p><strong>Bold</strong> <em>Italic</em> <u>Under</u></p>'
        '<p><span style="text-decoration: underline">SpanUnder</span></p>'
        '<p><span style="text-decoration: line-through">Strike</span></p>'
        '<p><span style="font-size: 14pt">BigText</span></p>'
        '<p><span style="color: red">RedText</span></p>'
        '<p><span style="color: rgb(0,128,0)">GreenRGB</span></p>'
        '<p><span style="color: #0000FF">BlueHex</span></p>'
        '<div>DivContent</div>'
        '<hr/>'
        '<p></p>'
    )
    return DynamicDocument.objects.create(
        title='TestDocDVC', content=html, state='Draft',
        created_by=lawyer,
        created_at=timezone.now(), updated_at=timezone.now())


@pytest.fixture
def doc_empty(lawyer):
    return DynamicDocument.objects.create(
        title='EmptyDoc', content='', state='Draft',
        created_by=lawyer,
        created_at=timezone.now(), updated_at=timezone.now())


@pytest.mark.django_db
class TestDocViewsCoverage:

    # --- Pagination: multi-state filter (line 97) ---
    def test_list_multi_state_filter(self, api_client, lawyer, doc):
        """Line 97: states query param filters by multiple states."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('list_dynamic_documents'),
            {'states': 'Draft,Published'})
        assert r.status_code == 200
        assert r.data['totalItems'] >= 1

    # --- Pagination: non-integer limit (lines 113-114) ---
    def test_list_non_integer_limit(self, api_client, lawyer, doc):
        """Lines 113-114: non-integer limit falls back to 10."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('list_dynamic_documents'),
            {'limit': 'abc'})
        assert r.status_code == 200

    # --- Pagination: PageNotAnInteger (lines 124-125) ---
    def test_list_non_integer_page(self, api_client, lawyer, doc):
        """Lines 124-125: non-integer page falls back to 1."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('list_dynamic_documents'),
            {'page': 'xyz'})
        assert r.status_code == 200

    # --- Word download with rich HTML (lines 556-710+) ---
    def test_download_word_rich_content(self, api_client, lawyer, doc):
        """Lines 556-710: Word generation with styled HTML content."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('download_dynamic_document_word', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert 'application/vnd.openxmlformats' in r['Content-Type']

    # --- Word download empty content ---
    def test_download_word_empty(self, api_client, lawyer, doc_empty):
        """Word generation with empty content."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('download_dynamic_document_word',
                    kwargs={'pk': doc_empty.pk}))
        assert r.status_code == 200

    # --- Upload user letterhead word template ---
    def test_upload_user_word_template(self, api_client, lawyer):
        """Lines 1173+: upload user letterhead word template."""
        api_client.force_authenticate(user=lawyer)
        # Minimal valid .docx (PK header)
        docx = SimpleUploadedFile(
            "template.docx",
            b"PK\x03\x04" + b"\x00" * 500,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        r = api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {'template': docx}, format='multipart')
        assert r.status_code in (201, 400)

    # --- Get user letterhead word template (no template) ---
    def test_get_user_word_template_none(self, api_client, lawyer):
        """Line 1243: user has no word template → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('get-user-letterhead-word-template'))
        assert r.status_code == 404

    # --- Delete user letterhead word template (no template) ---
    def test_delete_user_word_template_none(self, api_client, lawyer):
        """Line 1281: user has no word template → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.delete(
            reverse('delete-user-letterhead-word-template'))
        assert r.status_code == 404

    # --- Basic user blocked from word template ---
    def test_basic_user_blocked_word_template(self, api_client, basic_user):
        """Line 1175+1273: basic users get 403 for letterhead ops."""
        api_client.force_authenticate(user=basic_user)
        r = api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {}, format='multipart')
        assert r.status_code == 403
        r2 = api_client.delete(
            reverse('delete-user-letterhead-word-template'))
        assert r2.status_code == 403

    # --- Upload letterhead image to document ---
    def test_upload_letterhead_no_image(self, api_client, lawyer, doc):
        """Line 827-828: no image file provided."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.post(
            reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
            {}, format='multipart')
        assert r.status_code == 400

    # --- Get letterhead image (no image) ---
    def test_get_letterhead_no_image(self, api_client, lawyer, doc):
        """Letterhead image not set → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('get-letterhead-image', kwargs={'pk': doc.pk}))
        assert r.status_code == 404

    # --- Delete letterhead image (no image) ---
    def test_delete_letterhead_no_image(self, api_client, lawyer, doc):
        """Line 988: no letterhead image to delete → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.delete(
            reverse('delete-letterhead-image', kwargs={'pk': doc.pk}))
        assert r.status_code == 404

    # --- Upload doc word template (no file) ---
    def test_upload_doc_word_template_no_file(self, api_client, lawyer, doc):
        """Line 1034: no template file → 400."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.post(
            reverse('upload-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}),
            {}, format='multipart')
        assert r.status_code == 400

    # --- Get doc word template (no template) ---
    def test_get_doc_word_template_none(self, api_client, lawyer, doc):
        """Line 1100: doc has no word template → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('get-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}))
        assert r.status_code == 404

    # --- Delete doc word template (no template) ---
    def test_delete_doc_word_template_none(self, api_client, lawyer, doc):
        """Line 1139: doc has no word template → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.delete(
            reverse('delete-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}))
        assert r.status_code == 404

    # --- Upload user letterhead image (no file) ---
    def test_upload_user_letterhead_no_file(self, api_client, lawyer):
        """User letterhead image upload with no file → 400."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.post(
            reverse('upload-user-letterhead-image'),
            {}, format='multipart')
        assert r.status_code == 400

    # --- Get user letterhead image (none set) ---
    def test_get_user_letterhead_none(self, api_client, lawyer):
        """User has no letterhead image → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse('get-user-letterhead-image'))
        assert r.status_code == 404

    # --- PDF download covers lines 305-342 (font reg + letterhead) ---
    def test_download_pdf_rich_content(self, api_client, lawyer, doc):
        """Lines 305-342: PDF generation with styled HTML content."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('download_dynamic_document_pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- Upload user letterhead image with valid image ---
    def test_upload_user_letterhead_valid(self, api_client, lawyer):
        """Lines 1380-1446: upload valid user letterhead image."""
        from io import BytesIO
        from PIL import Image as PILImage
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        r = api_client.post(
            reverse('upload-user-letterhead-image'),
            {'image': img}, format='multipart')
        assert r.status_code == 201
        assert 'message' in r.data

    # --- Delete user letterhead image (basic user blocked) ---
    def test_delete_user_letterhead_basic_blocked(self, api_client, basic_user):
        """Line 1507: basic user blocked from deleting letterhead."""
        api_client.force_authenticate(user=basic_user)
        r = api_client.delete(reverse('delete-user-letterhead-image'))
        assert r.status_code == 403

    # --- Upload letterhead image with valid PNG to document ---
    def test_upload_letterhead_valid(self, api_client, lawyer, doc):
        """Lines 860-931: upload valid letterhead image to document."""
        from io import BytesIO
        from PIL import Image as PILImage
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        r = api_client.post(
            reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
            {'image': img}, format='multipart')
        assert r.status_code == 201

    # --- PDF download with letterhead image set ---
    def test_download_pdf_with_letterhead(self, api_client, lawyer, doc):
        """Lines 320-342: PDF with letterhead image from document."""
        from io import BytesIO
        from PIL import Image as PILImage
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        # Upload letterhead first
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        api_client.post(
            reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
            {'image': img}, format='multipart')
        # Now download PDF with letterhead
        r = api_client.get(
            reverse('download_dynamic_document_pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- Get/delete letterhead after upload ---
    def test_get_and_delete_letterhead(self, api_client, lawyer, doc):
        """Lines 960-1016: get and delete letterhead image."""
        from io import BytesIO
        from PIL import Image as PILImage
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        api_client.post(
            reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
            {'image': img}, format='multipart')
        # Get it
        r = api_client.get(
            reverse('get-letterhead-image', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        # Delete it
        r2 = api_client.delete(
            reverse('delete-letterhead-image', kwargs={'pk': doc.pk}))
        assert r2.status_code == 200

    # --- Pagination: EmptyPage (lines 124-125) ---
    def test_list_empty_page(self, api_client, lawyer, doc):
        """Lines 124-125: page number too high falls back."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('list_dynamic_documents'),
            {'page': '9999'})
        assert r.status_code == 200

    # --- Upload valid docx template to document, get, delete ---
    def test_upload_get_delete_doc_word_template(self, api_client, lawyer, doc):
        """Lines 1059-1165: upload/get/delete doc word template lifecycle."""
        from io import BytesIO
        from docx import Document as DocxDoc
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        # Upload
        r = api_client.post(
            reverse('upload-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}),
            {'template': tpl}, format='multipart')
        assert r.status_code == 201
        # Get
        r2 = api_client.get(
            reverse('get-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}))
        assert r2.status_code == 200
        # Delete
        r3 = api_client.delete(
            reverse('delete-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}))
        assert r3.status_code == 200

    # --- Upload valid docx template to user, get, delete ---
    def test_upload_get_delete_user_word_template(self, api_client, lawyer):
        """Lines 1208-1302: upload/get/delete user word template lifecycle."""
        from io import BytesIO
        from docx import Document as DocxDoc
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        # Upload
        r = api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {'template': tpl}, format='multipart')
        assert r.status_code == 201
        # Get
        r2 = api_client.get(
            reverse('get-user-letterhead-word-template'))
        assert r2.status_code == 200
        # Delete
        r3 = api_client.delete(
            reverse('delete-user-letterhead-word-template'))
        assert r3.status_code == 200

    # --- Re-upload letterhead image to cover old file deletion (lines 898-902) ---
    def test_reupload_letterhead_image(self, api_client, lawyer, doc):
        """Lines 898-902: re-upload letterhead covers old file deletion."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        for _ in range(2):
            buf = BytesIO()
            PILImage.new('RGB', (816, 1056), color='white').save(
                buf, format='PNG')
            buf.seek(0)
            img = SimpleUploadedFile(
                "lhead.png", buf.read(), content_type="image/png")
            r = api_client.post(
                reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
                {'image': img}, format='multipart')
            assert r.status_code == 201

    # --- Re-upload user letterhead image (lines 1421-1425) ---
    def test_reupload_user_letterhead_image(self, api_client, lawyer):
        """Lines 1421-1425: re-upload user letterhead covers old file deletion."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        for _ in range(2):
            buf = BytesIO()
            PILImage.new('RGB', (816, 1056), color='white').save(
                buf, format='PNG')
            buf.seek(0)
            img = SimpleUploadedFile(
                "lhead.png", buf.read(), content_type="image/png")
            r = api_client.post(
                reverse('upload-user-letterhead-image'),
                {'image': img}, format='multipart')
            assert r.status_code == 201

    # --- Delete user letterhead after upload (lines 1525-1526) ---
    def test_delete_user_letterhead_after_upload(self, api_client, lawyer):
        """Lines 1525-1526: delete user letterhead image after upload."""
        from io import BytesIO
        from PIL import Image as PILImage
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        api_client.post(
            reverse('upload-user-letterhead-image'),
            {'image': img}, format='multipart')
        r = api_client.delete(reverse('delete-user-letterhead-image'))
        assert r.status_code == 200

    # --- Word download with malformed styles (lines 599-600, 606-607, 648-649) ---
    def test_download_word_malformed_styles(self, api_client, lawyer):
        """Lines 599-607, 648-649: malformed padding/line-height/font-size."""
        malformed_html = (
            '<p style="padding-left: badpx">A</p>'
            '<p style="line-height: bad;">B</p>'
            '<p style="font-size: badpt;">C</p>'
            '<p><span style="color: rgb(bad)">D</span></p>'
        )
        d = DynamicDocument.objects.create(
            title='MalformedDoc', content=malformed_html, state='Draft',
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('download_dynamic_document_word', kwargs={'pk': d.pk}))
        assert r.status_code == 200

    # --- Word download with word template on document (line 577) ---
    def test_download_word_with_template(self, api_client, lawyer, doc):
        """Line 577: Word download uses document word template."""
        from io import BytesIO
        from docx import Document as DocxDoc
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        api_client.post(
            reverse('upload-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}),
            {'template': tpl}, format='multipart')
        r = api_client.get(
            reverse('download_dynamic_document_word', kwargs={'pk': doc.pk}))
        assert r.status_code == 200

    # --- Single state filter (line 97) ---
    def test_list_single_state_filter(self, api_client, lawyer, doc):
        """Line 97: single state filter via state param."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(
            reverse('list_dynamic_documents'),
            {'state': 'Draft'})
        assert r.status_code == 200
        assert r.data['totalItems'] >= 1

    # ========== PDF with user global letterhead fallback (line 1332) ==========

    def test_pdf_with_user_global_letterhead_fallback(self, api_client, lawyer, doc):
        """Line 1332: PDF uses user global letterhead when document has none."""
        from io import BytesIO
        from PIL import Image as PILImage
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(buf, format='PNG')
        buf.seek(0)
        api_client.force_authenticate(user=lawyer)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        r_upload = api_client.post(
            reverse('upload-user-letterhead-image'),
            {'image': img}, format='multipart')
        assert r_upload.status_code == 201
        assert not doc.letterhead_image
        r = api_client.get(
            reverse('download_dynamic_document_pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # ========== os.remove exception tests (file I/O boundary) ==========

    def test_reupload_letterhead_os_remove_fails(self, api_client, lawyer, doc):
        """Lines 901-902: old image deletion failure is caught silently."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(buf, format='PNG')
        buf.seek(0)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        r1 = api_client.post(
            reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
            {'image': img}, format='multipart')
        assert r1.status_code == 201
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            buf2 = BytesIO()
            PILImage.new('RGB', (816, 1056), color='blue').save(
                buf2, format='PNG')
            buf2.seek(0)
            img2 = SimpleUploadedFile(
                "lhead2.png", buf2.read(), content_type="image/png")
            r2 = api_client.post(
                reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
                {'image': img2}, format='multipart')
            assert r2.status_code == 201
            assert 'message' in r2.data

    def test_delete_letterhead_os_remove_fails(self, api_client, lawyer, doc):
        """Lines 998-999: file deletion exception during delete is caught."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(buf, format='PNG')
        buf.seek(0)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        api_client.post(
            reverse('upload-letterhead-image', kwargs={'pk': doc.pk}),
            {'image': img}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            r = api_client.delete(
                reverse('delete-letterhead-image', kwargs={'pk': doc.pk}))
            assert r.status_code == 200
            assert 'message' in r.data

    def test_reupload_doc_word_template_os_remove_fails(
        self, api_client, lawyer, doc
    ):
        """Lines 1059-1063: old template deletion exception is caught."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        api_client.post(
            reverse('upload-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}),
            {'template': tpl}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            buf2 = BytesIO()
            DocxDoc().save(buf2)
            buf2.seek(0)
            tpl2 = SimpleUploadedFile(
                "tpl2.docx", buf2.read(),
                content_type="application/vnd.openxmlformats-officedocument"
                             ".wordprocessingml.document")
            r = api_client.post(
                reverse('upload-document-letterhead-word-template',
                        kwargs={'pk': doc.pk}),
                {'template': tpl2}, format='multipart')
            assert r.status_code == 201

    def test_delete_doc_word_template_os_remove_fails(
        self, api_client, lawyer, doc
    ):
        """Lines 1148-1149: template file deletion exception is caught."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        api_client.post(
            reverse('upload-document-letterhead-word-template',
                    kwargs={'pk': doc.pk}),
            {'template': tpl}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            r = api_client.delete(
                reverse('delete-document-letterhead-word-template',
                        kwargs={'pk': doc.pk}))
            assert r.status_code == 200

    def test_reupload_user_letterhead_os_remove_fails(
        self, api_client, lawyer
    ):
        """Lines 1424-1425: old user letterhead deletion exception caught."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        api_client.post(
            reverse('upload-user-letterhead-image'),
            {'image': img}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            buf2 = BytesIO()
            PILImage.new('RGB', (816, 1056), color='blue').save(
                buf2, format='PNG')
            buf2.seek(0)
            img2 = SimpleUploadedFile(
                "lhead2.png", buf2.read(), content_type="image/png")
            r = api_client.post(
                reverse('upload-user-letterhead-image'),
                {'image': img2}, format='multipart')
            assert r.status_code == 201

    def test_delete_user_letterhead_os_remove_fails(
        self, api_client, lawyer
    ):
        """Lines 1525-1526: user letterhead file deletion exception caught."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        api_client.post(
            reverse('upload-user-letterhead-image'),
            {'image': img}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            r = api_client.delete(reverse('delete-user-letterhead-image'))
            assert r.status_code == 200
            assert 'message' in r.data

    def test_reupload_user_word_template_os_remove_fails(
        self, api_client, lawyer
    ):
        """Lines 1208-1212: old user template deletion exception caught."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {'template': tpl}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            buf2 = BytesIO()
            DocxDoc().save(buf2)
            buf2.seek(0)
            tpl2 = SimpleUploadedFile(
                "tpl2.docx", buf2.read(),
                content_type="application/vnd.openxmlformats-officedocument"
                             ".wordprocessingml.document")
            r = api_client.post(
                reverse('upload-user-letterhead-word-template'),
                {'template': tpl2}, format='multipart')
            assert r.status_code == 201

    def test_delete_user_word_template_os_remove_fails(
        self, api_client, lawyer
    ):
        """Lines 1290-1291: user template file deletion exception caught."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {'template': tpl}, format='multipart')
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.remove',
            side_effect=OSError("mock")
        ):
            r = api_client.delete(
                reverse('delete-user-letterhead-word-template'))
            assert r.status_code == 200

    # ========== Generic exception handlers (user endpoints) ==========

    def test_upload_user_word_template_generic_exception(
        self, api_client, lawyer
    ):
        """Lines 1229-1230: generic exception in upload → 500."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        with mock.patch.object(
            User, 'save', side_effect=Exception("DB error")
        ):
            r = api_client.post(
                reverse('upload-user-letterhead-word-template'),
                {'template': tpl}, format='multipart')
        assert r.status_code == 500
        assert 'Error' in r.data['detail']

    def test_get_user_word_template_generic_exception(
        self, api_client, lawyer
    ):
        """Lines 1262-1263: generic exception in get → 500."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {'template': tpl}, format='multipart')
        lawyer.refresh_from_db()
        file_path = lawyer.letterhead_word_template.path
        if os.path.exists(file_path):
            os.remove(file_path)
        with mock.patch(
            'gym_app.views.dynamic_documents.document_views.os.path.exists',
            return_value=True
        ):
            r = api_client.get(
                reverse('get-user-letterhead-word-template'))
        assert r.status_code == 500
        assert 'Error' in r.data['detail']

    def test_delete_user_word_template_generic_exception(
        self, api_client, lawyer
    ):
        """Lines 1301-1302: generic exception in delete → 500."""
        from io import BytesIO
        from docx import Document as DocxDoc
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        DocxDoc().save(buf)
        buf.seek(0)
        tpl = SimpleUploadedFile(
            "tpl.docx", buf.read(),
            content_type="application/vnd.openxmlformats-officedocument"
                         ".wordprocessingml.document")
        api_client.post(
            reverse('upload-user-letterhead-word-template'),
            {'template': tpl}, format='multipart')
        with mock.patch.object(
            User, 'save', side_effect=Exception("DB error")
        ):
            r = api_client.delete(
                reverse('delete-user-letterhead-word-template'))
        assert r.status_code == 500
        assert 'Error' in r.data['detail']

    def test_upload_user_letterhead_generic_exception(
        self, api_client, lawyer
    ):
        """Lines 1448-1449: generic exception in upload user letterhead → 500."""
        from io import BytesIO
        from PIL import Image as PILImage
        api_client.force_authenticate(user=lawyer)
        buf = BytesIO()
        PILImage.new('RGB', (816, 1056), color='white').save(
            buf, format='PNG')
        buf.seek(0)
        img = SimpleUploadedFile(
            "lhead.png", buf.read(), content_type="image/png")
        with mock.patch.object(
            User, 'save', side_effect=Exception("DB error")
        ):
            r = api_client.post(
                reverse('upload-user-letterhead-image'),
                {'image': img}, format='multipart')
        assert r.status_code == 500
        assert 'Error' in r.data['detail']

    # ========== Dead code behind decorators (DoesNotExist) ==========

    def test_update_recent_document_nonexistent(
        self, api_client, lawyer
    ):
        """Line 827-828: DoesNotExist in update_recent_document → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.post(
            reverse('update-recent-document',
                    kwargs={'document_id': 99999}))
        assert r.status_code == 404
        assert 'not found' in r.data.get('detail', '').lower()
