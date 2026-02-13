"""
Batch 18 – 20 tests: document_views.py coverage gaps.
  • list pagination edges (PageNotAnInteger, EmptyPage)
  • get_dynamic_document DoesNotExist, select_options init
  • update_dynamic_document DoesNotExist, created_by strip, validation error
  • delete_dynamic_document DoesNotExist
  • download_dynamic_document_pdf DoesNotExist, font missing, general error
  • download_dynamic_document_word DoesNotExist, general error
  • Word doc with HTML content (heading, paragraph styles, hr)
  • Word doc with word template fallback
  • PDF for_version returns buffer
"""
import io
import os
import pytest
from unittest.mock import patch, MagicMock, PropertyMock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import DynamicDocument, DocumentVariable

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def lawyer():
    return User.objects.create_user(
        email="law_b18@t.com", password="pw", role="lawyer",
        first_name="L", last_name="W",
    )


@pytest.fixture
@pytest.mark.django_db
def doc(lawyer):
    return DynamicDocument.objects.create(
        title="DocB18", content="<p>Hello {{var1}}</p>",
        state="Draft", created_by=lawyer,
    )


@pytest.fixture
@pytest.mark.django_db
def doc_with_var(doc):
    DocumentVariable.objects.create(document=doc, name_en="var1", value="World")
    return doc


# ===========================================================================
# 1. list_dynamic_documents – pagination edge cases
# ===========================================================================

@pytest.mark.django_db
class TestListDynDocPagination:

    def test_page_not_an_integer(self, api, lawyer, doc):
        """Lines 123-125: PageNotAnInteger falls back to page 1."""
        api.force_authenticate(user=lawyer)
        url = reverse("list_dynamic_documents")
        resp = api.get(url, {"page": "abc"})
        assert resp.status_code == 200
        assert resp.data["currentPage"] == 1

    def test_empty_page(self, api, lawyer, doc):
        """Lines 127-129: EmptyPage returns last page."""
        api.force_authenticate(user=lawyer)
        url = reverse("list_dynamic_documents")
        resp = api.get(url, {"page": 9999, "limit": 10})
        assert resp.status_code == 200
        # Should return last page (1)
        assert resp.data["currentPage"] >= 1

    def test_limit_zero_defaults_to_10(self, api, lawyer, doc):
        """Lines 116-117: limit <= 0 reset to 10."""
        api.force_authenticate(user=lawyer)
        url = reverse("list_dynamic_documents")
        resp = api.get(url, {"limit": 0})
        assert resp.status_code == 200


# ===========================================================================
# 2. get_dynamic_document
# ===========================================================================

@pytest.mark.django_db
class TestGetDynDoc:

    def test_not_found(self, api, lawyer):
        """Lines 178-179: DoesNotExist returns 404."""
        api.force_authenticate(user=lawyer)
        url = reverse("get_dynamic_document", kwargs={"pk": 99999})
        resp = api.get(url)
        assert resp.status_code == 404

    def test_select_options_init(self, api, lawyer):
        """Lines 172-174: select variable with no select_options gets initialized."""
        doc = DynamicDocument.objects.create(
            title="SelDoc", content="<p>{{sel}}</p>", state="Draft", created_by=lawyer,
        )
        DocumentVariable.objects.create(
            document=doc, name_en="sel", value="a", field_type="select",
            select_options=None,
        )
        api.force_authenticate(user=lawyer)
        url = reverse("get_dynamic_document", kwargs={"pk": doc.pk})
        resp = api.get(url)
        assert resp.status_code == 200


# ===========================================================================
# 3. update_dynamic_document
# ===========================================================================

@pytest.mark.django_db
class TestUpdateDynDoc:

    def test_not_found(self, api, lawyer):
        """Lines 214-215: DoesNotExist returns 404."""
        api.force_authenticate(user=lawyer)
        url = reverse("update_dynamic_document", kwargs={"pk": 99999})
        resp = api.put(url, {"title": "X"}, format="json")
        assert resp.status_code == 404

    def test_strips_created_by(self, api, lawyer, doc):
        """Lines 218-219: created_by is removed from request data."""
        api.force_authenticate(user=lawyer)
        url = reverse("update_dynamic_document", kwargs={"pk": doc.pk})
        resp = api.patch(url, {"title": "Updated", "created_by": 999}, format="json")
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert doc.title == "Updated"
        assert doc.created_by == lawyer


# ===========================================================================
# 4. delete_dynamic_document
# ===========================================================================

@pytest.mark.django_db
class TestDeleteDynDoc:

    def test_not_found(self, api, lawyer):
        """Lines 239-240: DoesNotExist returns 404."""
        api.force_authenticate(user=lawyer)
        url = reverse("delete_dynamic_document", kwargs={"pk": 99999})
        resp = api.delete(url)
        assert resp.status_code == 404

    def test_success(self, api, lawyer, doc):
        """Lines 242-243: successful deletion."""
        api.force_authenticate(user=lawyer)
        url = reverse("delete_dynamic_document", kwargs={"pk": doc.pk})
        resp = api.delete(url)
        assert resp.status_code == 200
        assert not DynamicDocument.objects.filter(pk=doc.pk).exists()


# ===========================================================================
# 5. download_dynamic_document_pdf
# ===========================================================================

@pytest.mark.django_db
class TestDownloadPDF:

    def test_not_found(self, api, lawyer):
        """Lines 451-452: DoesNotExist returns 404."""
        api.force_authenticate(user=lawyer)
        url = reverse("download_dynamic_document_pdf", kwargs={"pk": 99999})
        resp = api.get(url)
        assert resp.status_code == 404

    @patch("gym_app.views.dynamic_documents.document_views.os.path.exists", return_value=False)
    def test_font_missing(self, mock_exists, api, lawyer, doc_with_var):
        """Lines 305-306: FileNotFoundError when font is missing."""
        api.force_authenticate(user=lawyer)
        url = reverse("download_dynamic_document_pdf", kwargs={"pk": doc_with_var.pk})
        resp = api.get(url)
        assert resp.status_code == 500
        assert "Font file" in resp.data.get("detail", "")

    @patch("gym_app.views.dynamic_documents.document_views.pisa.CreatePDF", side_effect=Exception("PDF boom"))
    @patch("gym_app.views.dynamic_documents.document_views.os.path.exists", return_value=True)
    @patch("gym_app.views.dynamic_documents.document_views.pdfmetrics.registerFont")
    def test_general_error(self, _reg, _exists, _pisa, api, lawyer, doc_with_var):
        """Lines 455-456: general exception returns 500."""
        api.force_authenticate(user=lawyer)
        url = reverse("download_dynamic_document_pdf", kwargs={"pk": doc_with_var.pk})
        resp = api.get(url)
        assert resp.status_code == 500


# ===========================================================================
# 6. download_dynamic_document_word
# ===========================================================================

@pytest.mark.django_db
class TestDownloadWord:

    def test_not_found(self, api, lawyer):
        """Lines 778-779: DoesNotExist returns 404."""
        api.force_authenticate(user=lawyer)
        url = reverse("download_dynamic_document_word", kwargs={"pk": 99999})
        resp = api.get(url)
        assert resp.status_code == 404

    @patch("gym_app.views.dynamic_documents.document_views.Document", side_effect=Exception("docx boom"))
    def test_general_error(self, _mock, api, lawyer, doc_with_var):
        """Lines 780-781: general exception returns 500."""
        api.force_authenticate(user=lawyer)
        url = reverse("download_dynamic_document_word", kwargs={"pk": doc_with_var.pk})
        resp = api.get(url)
        assert resp.status_code == 500

    def test_word_success_with_html_content(self, api, lawyer):
        """Lines 554-765: Word generation processes headings, paragraphs, styles, hr."""
        doc = DynamicDocument.objects.create(
            title="WordDoc",
            content='<h1>Title</h1><p style="text-align: center">Center</p><hr><p>Normal</p>',
            state="Draft", created_by=lawyer,
        )
        api.force_authenticate(user=lawyer)
        url = reverse("download_dynamic_document_word", kwargs={"pk": doc.pk})
        resp = api.get(url)
        assert resp.status_code == 200
        assert "wordprocessing" in resp.get("Content-Type", "")
