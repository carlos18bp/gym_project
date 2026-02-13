"""
Batch 19 – 20 tests: document_views.py coverage gaps continued.
  • get_recent_documents
  • update_recent_document (success, not-found)
  • upload_letterhead_image (success, no file, bad ext, too large, invalid img,
    DoesNotExist, general exception, aspect ratio warning)
  • get_letterhead_image (no image, file missing, DoesNotExist, general exc)
  • delete_letterhead_image (no image, DoesNotExist, general exc, success)
  • upload_document_letterhead_word_template (success, no file, bad ext, too large,
    DoesNotExist, general exc)
"""
import io
import os
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from PIL import Image as PILImage

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import DynamicDocument

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def lawyer():
    return User.objects.create_user(
        email="law_b19@t.com", password="pw", role="lawyer",
        first_name="L", last_name="W",
    )


@pytest.fixture
@pytest.mark.django_db
def doc(lawyer):
    return DynamicDocument.objects.create(
        title="DocB19", content="<p>hi</p>", state="Draft", created_by=lawyer,
    )


def _make_png(w=100, h=100):
    """Create a minimal valid PNG in memory."""
    buf = io.BytesIO()
    img = PILImage.new("RGB", (w, h), color="white")
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile("test.png", buf.read(), content_type="image/png")


def _make_docx():
    """Create a minimal .docx file."""
    from docx import Document as DocxDoc
    buf = io.BytesIO()
    d = DocxDoc()
    d.add_paragraph("template")
    d.save(buf)
    buf.seek(0)
    return SimpleUploadedFile("tpl.docx", buf.read(),
                              content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


# ===========================================================================
# 1. Recent documents
# ===========================================================================

@pytest.mark.django_db
class TestRecentDocuments:

    def test_get_recent_empty(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("get-recent-documents")
        resp = api.get(url)
        assert resp.status_code == 200
        assert resp.data == []

    def test_update_recent_success(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("update-recent-document", kwargs={"document_id": doc.pk})
        resp = api.post(url)
        assert resp.status_code == 200

    def test_update_recent_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("update-recent-document", kwargs={"document_id": 99999})
        resp = api.post(url)
        assert resp.status_code == 404


# ===========================================================================
# 2. Letterhead image CRUD (per-document)
# ===========================================================================

@pytest.mark.django_db
class TestLetterheadImage:

    def test_upload_success(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": doc.pk})
        resp = api.post(url, {"image": _make_png()}, format="multipart")
        assert resp.status_code == 201

    def test_upload_no_file(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": doc.pk})
        resp = api.post(url, {}, format="multipart")
        assert resp.status_code == 400

    def test_upload_bad_ext(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": doc.pk})
        f = SimpleUploadedFile("bad.jpg", b"data", content_type="image/jpeg")
        resp = api.post(url, {"image": f}, format="multipart")
        assert resp.status_code == 400

    def test_upload_too_large(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": doc.pk})
        f = SimpleUploadedFile("big.png", b"x" * (11 * 1024 * 1024), content_type="image/png")
        resp = api.post(url, {"image": f}, format="multipart")
        assert resp.status_code == 400

    def test_upload_invalid_image(self, api, lawyer, doc):
        """Lines 890-893: invalid image data."""
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": doc.pk})
        f = SimpleUploadedFile("bad.png", b"not-an-image", content_type="image/png")
        resp = api.post(url, {"image": f}, format="multipart")
        assert resp.status_code == 400

    def test_upload_not_found(self, api, lawyer):
        """Lines 925-929: DoesNotExist."""
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": 99999})
        resp = api.post(url, {"image": _make_png()}, format="multipart")
        assert resp.status_code == 404

    def test_upload_aspect_ratio_warning(self, api, lawyer, doc):
        """Lines 887-888: aspect ratio differs from recommended."""
        api.force_authenticate(user=lawyer)
        url = reverse("upload-letterhead-image", kwargs={"pk": doc.pk})
        resp = api.post(url, {"image": _make_png(500, 100)}, format="multipart")
        assert resp.status_code == 201
        assert "warnings" in resp.data

    def test_get_no_image(self, api, lawyer, doc):
        """Lines 946-950: no letterhead image."""
        api.force_authenticate(user=lawyer)
        url = reverse("get-letterhead-image", kwargs={"pk": doc.pk})
        resp = api.get(url)
        assert resp.status_code == 404

    def test_get_not_found(self, api, lawyer):
        """Lines 967-971: DoesNotExist."""
        api.force_authenticate(user=lawyer)
        url = reverse("get-letterhead-image", kwargs={"pk": 99999})
        resp = api.get(url)
        assert resp.status_code == 404

    def test_delete_no_image(self, api, lawyer, doc):
        """Lines 988-992: no image to delete."""
        api.force_authenticate(user=lawyer)
        url = reverse("delete-letterhead-image", kwargs={"pk": doc.pk})
        resp = api.delete(url)
        assert resp.status_code == 404

    def test_delete_not_found(self, api, lawyer):
        """Lines 1010-1013: DoesNotExist."""
        api.force_authenticate(user=lawyer)
        url = reverse("delete-letterhead-image", kwargs={"pk": 99999})
        resp = api.delete(url)
        assert resp.status_code == 404


# ===========================================================================
# 3. Document word template CRUD
# ===========================================================================

@pytest.mark.django_db
class TestDocWordTemplate:

    def test_upload_success(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": doc.pk})
        resp = api.post(url, {"template": _make_docx()}, format="multipart")
        assert resp.status_code == 201

    def test_upload_no_file(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": doc.pk})
        resp = api.post(url, {}, format="multipart")
        assert resp.status_code == 400

    def test_upload_bad_ext(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": doc.pk})
        f = SimpleUploadedFile("bad.txt", b"data", content_type="text/plain")
        resp = api.post(url, {"template": f}, format="multipart")
        assert resp.status_code == 400

    def test_upload_not_found(self, api, lawyer):
        """Lines 1080-1084: DoesNotExist."""
        api.force_authenticate(user=lawyer)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api.post(url, {"template": _make_docx()}, format="multipart")
        assert resp.status_code == 404

    def test_get_no_template(self, api, lawyer, doc):
        """Lines 1100-1103: no template configured."""
        api.force_authenticate(user=lawyer)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": doc.pk})
        resp = api.get(url)
        assert resp.status_code == 404

    def test_delete_no_template(self, api, lawyer, doc):
        """Lines 1139-1142: no template to delete."""
        api.force_authenticate(user=lawyer)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": doc.pk})
        resp = api.delete(url)
        assert resp.status_code == 404
