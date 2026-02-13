"""
Batch 10 – 20 tests for document_views.py letterhead and word template endpoints.

Targets uncovered lines:
  - upload/get/delete_letterhead_image DoesNotExist paths (925-931, 967-973, 998-999, 1010-1016)
  - upload/get/delete_document_letterhead_word_template DoesNotExist (1059-1063, 1080-1086, 1119-1125, 1148-1149, 1159-1165)
  - upload/get/delete_user_letterhead_word_template (1208-1212, 1229-1230, 1262-1263, 1290-1291, 1301-1302)
  - upload/get/delete_user_letterhead_image (1328, 1332, 1421-1425, 1448-1449, 1525-1526)
"""
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models.dynamic_document import DynamicDocument

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
        email="lawyer_b10@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic_b10@test.com", password="pw", role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc B10", content="<p>Hello</p>", state="Draft",
        created_by=lawyer_user, is_public=True,
    )


# ===========================================================================
# 1. Document letterhead image – DoesNotExist / error paths
# ===========================================================================

@pytest.mark.django_db
class TestDocumentLetterheadImage:

    def test_upload_letterhead_doc_not_found(self, api_client, lawyer_user):
        """Line 925-931: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": 99999})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_letterhead_doc_not_found(self, api_client, lawyer_user):
        """Line 967-973: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-letterhead-image", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_letterhead_no_image(self, api_client, lawyer_user, document):
        """Line 946-950: document has no letterhead image."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_letterhead_doc_not_found(self, api_client, lawyer_user):
        """Line 1010-1016: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-letterhead-image", kwargs={"pk": 99999})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_letterhead_no_image(self, api_client, lawyer_user, document):
        """Line 988-992: document has no letterhead to delete."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. Document word template – DoesNotExist / error paths
# ===========================================================================

@pytest.mark.django_db
class TestDocumentWordTemplate:

    def test_upload_word_template_doc_not_found(self, api_client, lawyer_user):
        """Line 1080-1086: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_upload_word_template_no_file(self, api_client, lawyer_user, document):
        """Line 1034-1038: no template file provided."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_word_template_wrong_extension(self, api_client, lawyer_user, document):
        """Line 1043-1047: non-docx extension."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        f = SimpleUploadedFile("test.txt", b"content", content_type="text/plain")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_word_template_too_large(self, api_client, lawyer_user, document):
        """Line 1050-1055: file too large."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        # Create a file > 10MB
        f = SimpleUploadedFile("big.docx", b"x" * (11 * 1024 * 1024), content_type="application/octet-stream")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_word_template_doc_not_found(self, api_client, lawyer_user):
        """Line 1119-1125: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_word_template_no_template(self, api_client, lawyer_user, document):
        """Line 1100-1104: no template configured."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_word_template_doc_not_found(self, api_client, lawyer_user):
        """Line 1159-1165: document not found."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_word_template_no_template(self, api_client, lawyer_user, document):
        """Line 1139-1143: no template to delete."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 3. User global word template endpoints
# ===========================================================================

@pytest.mark.django_db
class TestUserWordTemplate:

    def test_upload_user_word_template_no_file(self, api_client, lawyer_user):
        """Line 1183-1187: no template file provided."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_user_word_template_wrong_ext(self, api_client, lawyer_user):
        """Line 1192-1196: non-docx extension."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        f = SimpleUploadedFile("test.pdf", b"content", content_type="application/pdf")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_user_word_template_too_large(self, api_client, lawyer_user):
        """Line 1200-1204: file too large."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        f = SimpleUploadedFile("big.docx", b"x" * (11 * 1024 * 1024), content_type="application/octet-stream")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_user_word_template_no_template(self, api_client, lawyer_user):
        """Line 1243-1247: no template configured."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-user-letterhead-word-template")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_word_template_no_template(self, api_client, lawyer_user):
        """Line 1281-1285: no template to delete."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-user-letterhead-word-template")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_word_template_basic_forbidden(self, api_client, basic_user):
        """Line 1273-1276: basic user forbidden."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("delete-user-letterhead-word-template")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# 4. User global letterhead image endpoints
# ===========================================================================

@pytest.mark.django_db
class TestUserLetterheadImage:

    def test_upload_user_letterhead_basic_forbidden(self, api_client, basic_user):
        """Line 1359-1362: basic user forbidden."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("upload-user-letterhead-image")
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_get_user_letterhead_no_image(self, api_client, lawyer_user):
        """Line 1469-1473: no letterhead image."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-user-letterhead-image")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_letterhead_basic_forbidden(self, api_client, basic_user):
        """Line 1507-1510: basic user forbidden."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("delete-user-letterhead-image")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_user_letterhead_no_image(self, api_client, lawyer_user):
        """Line 1515-1519: no letterhead to delete."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-user-letterhead-image")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND
