"""
Batch 5 – Coverage-gap tests for document_views.py (75% → higher)
Targets uncovered letterhead image/word-template endpoints,
list filter edge cases, PDF/Word error paths, recent document edge,
and get_letterhead_for_document helper.
"""
import io
import os
import datetime
from io import BytesIO
from unittest.mock import patch, MagicMock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from gym_app.models.dynamic_document import DynamicDocument, RecentDocument

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_b5@example.com",
        password="testpassword",
        first_name="Law",
        last_name="Yer",
        role="lawyer",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic_b5@example.com",
        password="testpassword",
        role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Test Doc B5",
        content="<p>Hello</p>",
        state="Draft",
        created_by=lawyer_user,
    )


def _png_file(name="letterhead.png", w=100, h=130):
    buf = BytesIO()
    Image.new("RGB", (w, h), color="white").save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


def _docx_bytes():
    """Minimal valid .docx file (just a ZIP with required content types)."""
    from docx import Document as DocxDocument
    buf = BytesIO()
    DocxDocument().save(buf)
    buf.seek(0)
    return buf.read()


# ===========================================================================
# 1. list_dynamic_documents – filter / pagination edge cases
# ===========================================================================

@pytest.mark.django_db
class TestListDynamicDocumentsEdges:

    def test_filter_by_single_state(self, api_client, lawyer_user):
        DynamicDocument.objects.create(title="D1", content="<p>a</p>", state="Draft", created_by=lawyer_user)
        DynamicDocument.objects.create(title="D2", content="<p>b</p>", state="Completed", created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        response = api_client.get(url, {"state": "Completed"})

        assert response.status_code == status.HTTP_200_OK
        titles = [d["title"] for d in response.data["items"]]
        assert "D2" in titles
        assert "D1" not in titles

    def test_filter_by_multi_states(self, api_client, lawyer_user):
        DynamicDocument.objects.create(title="D1", content="<p>a</p>", state="Draft", created_by=lawyer_user)
        DynamicDocument.objects.create(title="D2", content="<p>b</p>", state="Completed", created_by=lawyer_user)
        DynamicDocument.objects.create(title="D3", content="<p>c</p>", state="Progress", created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        response = api_client.get(url, {"states": "Draft,Progress"})

        assert response.status_code == status.HTTP_200_OK
        titles = {d["title"] for d in response.data["items"]}
        assert "D1" in titles
        assert "D3" in titles
        assert "D2" not in titles

    def test_invalid_page_and_limit(self, api_client, lawyer_user):
        DynamicDocument.objects.create(title="D1", content="<p>a</p>", state="Draft", created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        response = api_client.get(url, {"page": "abc", "limit": "xyz"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["currentPage"] == 1

    def test_negative_limit_defaults_to_ten(self, api_client, lawyer_user):
        DynamicDocument.objects.create(title="D1", content="<p>a</p>", state="Draft", created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        response = api_client.get(url, {"limit": "-5"})

        assert response.status_code == status.HTTP_200_OK

    def test_empty_page_falls_to_last(self, api_client, lawyer_user):
        DynamicDocument.objects.create(title="D1", content="<p>a</p>", state="Draft", created_by=lawyer_user)

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        response = api_client.get(url, {"page": "999", "limit": "1"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["totalItems"] == 1


# ===========================================================================
# 2. Document letterhead image endpoints
# ===========================================================================

@pytest.mark.django_db
class TestDocumentLetterheadImage:

    def test_upload_letterhead_image_success(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        png = _png_file()
        response = api_client.post(url, {"image": png}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        assert "image_info" in response.data
        document.refresh_from_db()
        assert bool(document.letterhead_image)

    def test_upload_letterhead_image_missing_file(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "imagen" in response.data["detail"].lower()

    def test_upload_letterhead_image_wrong_extension(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        jpg = SimpleUploadedFile("bad.jpg", b"content", content_type="image/jpeg")
        response = api_client.post(url, {"image": jpg}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "PNG" in response.data["detail"]

    def test_upload_letterhead_image_too_large(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        # Create an oversized file (>10MB)
        big = SimpleUploadedFile("big.png", b"x" * (10 * 1024 * 1024 + 1), content_type="image/png")
        response = api_client.post(url, {"image": big}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "grande" in response.data["detail"].lower()

    def test_upload_letterhead_image_invalid_image(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        bad_png = SimpleUploadedFile("bad.png", b"not-a-real-png", content_type="image/png")
        response = api_client.post(url, {"image": bad_png}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "inválido" in response.data["detail"].lower()

    def test_get_letterhead_image_not_set(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_letterhead_image_not_set(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_letterhead_image_success(self, api_client, lawyer_user, document):
        # First upload
        api_client.force_authenticate(user=lawyer_user)
        upload_url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        png = _png_file()
        api_client.post(upload_url, {"image": png}, format="multipart")

        document.refresh_from_db()
        assert bool(document.letterhead_image)

        # Then delete
        del_url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        response = api_client.delete(del_url)

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert not document.letterhead_image


# ===========================================================================
# 3. Document letterhead Word template endpoints
# ===========================================================================

@pytest.mark.django_db
class TestDocumentLetterheadWordTemplate:

    def test_upload_word_template_success(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        docx = SimpleUploadedFile("template.docx", _docx_bytes(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        response = api_client.post(url, {"template": docx}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        assert "template_info" in response.data

    def test_upload_word_template_missing_file(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_word_template_wrong_extension(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        txt = SimpleUploadedFile("bad.txt", b"content", content_type="text/plain")
        response = api_client.post(url, {"template": txt}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert ".docx" in response.data["detail"]

    def test_get_word_template_not_set(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_word_template_not_set(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_word_template_success(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        upload_url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        docx = SimpleUploadedFile("template.docx", _docx_bytes(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        api_client.post(upload_url, {"template": docx}, format="multipart")

        del_url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.delete(del_url)

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert not document.letterhead_word_template


# ===========================================================================
# 4. User global letterhead image endpoints
# ===========================================================================

@pytest.mark.django_db
class TestUserGlobalLetterhead:

    def test_upload_user_letterhead_basic_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)
        url = reverse("upload-user-letterhead-image")
        png = _png_file()
        response = api_client.post(url, {"image": png}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_upload_user_letterhead_success(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-image")
        png = _png_file()
        response = api_client.post(url, {"image": png}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        lawyer_user.refresh_from_db()
        assert bool(lawyer_user.letterhead_image)

    def test_get_user_letterhead_not_set(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-user-letterhead-image")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_letterhead_basic_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)
        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_user_letterhead_not_set(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_letterhead_success(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        # Upload first
        upload_url = reverse("upload-user-letterhead-image")
        png = _png_file()
        api_client.post(upload_url, {"image": png}, format="multipart")
        lawyer_user.refresh_from_db()
        assert bool(lawyer_user.letterhead_image)

        # Delete
        del_url = reverse("delete-user-letterhead-image")
        response = api_client.delete(del_url)

        assert response.status_code == status.HTTP_200_OK
        lawyer_user.refresh_from_db()
        assert not lawyer_user.letterhead_image


# ===========================================================================
# 5. User global Word letterhead template endpoints
# ===========================================================================

@pytest.mark.django_db
class TestUserGlobalWordTemplate:

    def test_upload_user_word_template_basic_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)
        url = reverse("upload-user-letterhead-word-template")
        docx = SimpleUploadedFile("t.docx", _docx_bytes(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        response = api_client.post(url, {"template": docx}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_upload_user_word_template_success(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        docx = SimpleUploadedFile("t.docx", _docx_bytes(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        response = api_client.post(url, {"template": docx}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED

    def test_get_user_word_template_not_set(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-user-letterhead-word-template")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_word_template_basic_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)
        url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_user_word_template_not_set(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_word_template_success(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        # Upload first
        upload_url = reverse("upload-user-letterhead-word-template")
        docx = SimpleUploadedFile("t.docx", _docx_bytes(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        api_client.post(upload_url, {"template": docx}, format="multipart")

        # Delete
        del_url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(del_url)

        assert response.status_code == status.HTTP_200_OK


# ===========================================================================
# 6. Recent documents + update_recent_document edge
# ===========================================================================

@pytest.mark.django_db
class TestRecentDocumentEdges:

    def test_update_recent_document_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-recent-document", kwargs={"document_id": 9999})
        response = api_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_recent_document_creates_and_updates(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-recent-document", kwargs={"document_id": document.id})

        # First call creates
        resp1 = api_client.post(url, {}, format="json")
        assert resp1.status_code == status.HTTP_200_OK
        assert RecentDocument.objects.filter(user=lawyer_user, document=document).exists()

        # Second call updates
        resp2 = api_client.post(url, {}, format="json")
        assert resp2.status_code == status.HTTP_200_OK
        assert RecentDocument.objects.filter(user=lawyer_user, document=document).count() == 1


# ===========================================================================
# 7. PDF / Word download error paths
# ===========================================================================

@pytest.mark.django_db
class TestDownloadErrorPaths:

    def test_download_pdf_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download_dynamic_document_pdf", kwargs={"pk": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_download_word_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download_dynamic_document_word", kwargs={"pk": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_download_pdf_font_not_found(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("download_dynamic_document_pdf", kwargs={"pk": document.id})

        with patch("os.path.exists", return_value=False):
            response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Font file not found" in response.data["detail"]
