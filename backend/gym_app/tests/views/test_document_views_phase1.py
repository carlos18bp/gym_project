import io
import pytest
from unittest.mock import patch
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient
from PIL import Image

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument


User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="dv1-lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email="dv1-basic@example.com",
        password="testpassword",
        role="basic",
    )


@pytest.fixture
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="DV1 Coverage Doc",
        content="<p>test content</p>",
        state="Draft",
        created_by=lawyer_user,
    )


def _make_png_file(width=100, height=100, name="test.png"):
    """Create a valid in-memory PNG file for upload tests."""
    buf = io.BytesIO()
    img = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")



# ── Pagination edge cases (lines 124-125) ─────────────────────────────

class TestListDocumentsPagination:
    def test_page_not_an_integer_falls_back_to_page_1(self, api_client, lawyer_user, document):
        """Line 124-125: PageNotAnInteger → fall back to page 1."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("list_dynamic_documents")
        response = api_client.get(url, {"page": "abc", "limit": "10"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["currentPage"] == 1
        assert document.id in [d["id"] for d in response.data["items"]]


# ── Document letterhead image upload validations (lines 856, 864, 888-891, 921) ──

class TestUploadLetterheadImageValidation:
    def test_upload_letterhead_non_png_returns_400(self, api_client, lawyer_user, document):
        """Line 856: Non-PNG file rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        jpg_file = SimpleUploadedFile("test.jpg", b"fake", content_type="image/jpeg")
        response = api_client.post(url, {"image": jpg_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "PNG" in response.data["detail"]

    def test_upload_letterhead_too_large_returns_400(self, api_client, lawyer_user, document):
        """Line 864: File > 10MB rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        large_file = SimpleUploadedFile("big.png", b"x" * (11 * 1024 * 1024), content_type="image/png")
        response = api_client.post(url, {"image": large_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "10MB" in response.data["detail"]

    def test_upload_letterhead_invalid_image_returns_400(self, api_client, lawyer_user, document):
        """Lines 888-891: Invalid image data rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        bad_png = SimpleUploadedFile("bad.png", b"not-a-real-image", content_type="image/png")
        response = api_client.post(url, {"image": bad_png}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "inválido" in response.data["detail"].lower() or "invalid" in response.data["detail"].lower()

    def test_upload_letterhead_with_aspect_ratio_warning(self, api_client, lawyer_user, document):
        """Line 921: Square image triggers aspect ratio warning."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        square_png = _make_png_file(width=100, height=100)
        response = api_client.post(url, {"image": square_png}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        assert "warnings" in response.data


# ── Document letterhead image get/delete edge cases (line 954) ──────

class TestGetLetterheadImageEdgeCases:
    def test_get_letterhead_file_missing_on_disk(self, api_client, lawyer_user, document):
        """Line 954: Letterhead field set but file doesn't exist on disk."""
        document.letterhead_image = "nonexistent/path.png"
        document.save(update_fields=["letterhead_image"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no se encuentra" in response.data["detail"].lower() or "not found" in response.data["detail"].lower()


# ── Document word template upload validations (lines 1044, 1052) ────

class TestUploadDocWordTemplateValidation:
    def test_upload_word_template_non_docx_returns_400(self, api_client, lawyer_user, document):
        """Line 1044: Non-DOCX file rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        txt_file = SimpleUploadedFile("test.txt", b"fake", content_type="text/plain")
        response = api_client.post(url, {"template": txt_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert ".docx" in response.data["detail"]

    def test_upload_word_template_too_large_returns_400(self, api_client, lawyer_user, document):
        """Line 1052: File > 10MB rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        large_file = SimpleUploadedFile("big.docx", b"x" * (11 * 1024 * 1024), content_type="application/octet-stream")
        response = api_client.post(url, {"template": large_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "grande" in response.data["detail"].lower()


# ── Document word template get edge case (line 1107) ────────────────

class TestGetDocWordTemplateEdgeCases:
    def test_get_word_template_file_missing_on_disk(self, api_client, lawyer_user, document):
        """Line 1107: Word template field set but file doesn't exist on disk."""
        document.letterhead_word_template = "nonexistent/path.docx"
        document.save(update_fields=["letterhead_word_template"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── User global word template CRUD (lines 1184, 1193, 1201, 1250) ──

class TestUserWordTemplateCRUD:
    def test_upload_user_word_template_no_file_returns_400(self, api_client, lawyer_user):
        """Line 1184: No template file provided."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "plantilla" in response.data["detail"].lower()

    def test_upload_user_word_template_non_docx_returns_400(self, api_client, lawyer_user):
        """Line 1193: Non-DOCX file rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        txt_file = SimpleUploadedFile("test.pdf", b"fake", content_type="application/pdf")
        response = api_client.post(url, {"template": txt_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert ".docx" in response.data["detail"]

    def test_upload_user_word_template_too_large_returns_400(self, api_client, lawyer_user):
        """Line 1201: File > 10MB rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        large_file = SimpleUploadedFile("big.docx", b"x" * (11 * 1024 * 1024), content_type="application/octet-stream")
        response = api_client.post(url, {"template": large_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "grande" in response.data["detail"].lower()

    def test_get_user_word_template_file_missing_on_disk(self, api_client, lawyer_user):
        """Line 1250: Template field set but file doesn't exist on disk."""
        lawyer_user.letterhead_word_template = "nonexistent/path.docx"
        lawyer_user.save(update_fields=["letterhead_word_template"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-user-letterhead-word-template")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── User global letterhead image CRUD (lines 1360, 1377, 1385, 1408-1414, 1444, 1476-1491, 1516) ──

class TestUserLetterheadImageCRUD:
    def test_upload_user_letterhead_basic_user_forbidden(self, api_client, basic_user):
        """Line 1360: Basic users cannot upload letterhead."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("upload-user-letterhead-image")
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_upload_user_letterhead_non_png_returns_400(self, api_client, lawyer_user):
        """Line 1377: Non-PNG file rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-image")
        jpg_file = SimpleUploadedFile("test.jpg", b"fake", content_type="image/jpeg")
        response = api_client.post(url, {"image": jpg_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "PNG" in response.data["detail"]

    def test_upload_user_letterhead_too_large_returns_400(self, api_client, lawyer_user):
        """Line 1385: File > 10MB rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-image")
        large_file = SimpleUploadedFile("big.png", b"x" * (11 * 1024 * 1024), content_type="image/png")
        response = api_client.post(url, {"image": large_file}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "10MB" in response.data["detail"]

    def test_upload_user_letterhead_invalid_image_returns_400(self, api_client, lawyer_user):
        """Lines 1408-1414: Invalid image data rejected."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-image")
        bad_png = SimpleUploadedFile("bad.png", b"not-a-real-image", content_type="image/png")
        response = api_client.post(url, {"image": bad_png}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_user_letterhead_with_warnings(self, api_client, lawyer_user):
        """Line 1444: Square image triggers aspect ratio warning."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("upload-user-letterhead-image")
        square_png = _make_png_file(width=100, height=100)
        response = api_client.post(url, {"image": square_png}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        assert "warnings" in response.data

    def test_get_user_letterhead_file_missing_on_disk(self, api_client, lawyer_user):
        """Lines 1476-1491: Letterhead field set but file doesn't exist on disk."""
        lawyer_user.letterhead_image = "nonexistent/path.png"
        lawyer_user.save(update_fields=["letterhead_image"])

        api_client.force_authenticate(user=lawyer_user)
        url = reverse("get-user-letterhead-image")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_letterhead_no_image_returns_404(self, api_client, lawyer_user):
        """Line 1516: No letterhead image to delete."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
