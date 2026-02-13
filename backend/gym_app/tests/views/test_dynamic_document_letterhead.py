import io
import os
import pytest
from PIL import Image
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument


User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def api_client():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic@example.com",
        password="testpassword",
        role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc letterhead",
        content="<p>x</p>",
        state="Draft",
        created_by=lawyer_user,
    )


@pytest.mark.django_db
class TestUserGlobalLetterhead:
    def test_upload_user_letterhead_image_basic_user_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)

        url = reverse("upload-user-letterhead-image")
        image = SimpleUploadedFile("membrete.png", b"fake-bytes", content_type="image/png")
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Los usuarios básicos" in response.data["error"]

    def test_upload_user_letterhead_image_no_image(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-user-letterhead-image")
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Se requiere un archivo de imagen" in response.data["detail"]

    def test_upload_user_letterhead_image_wrong_extension(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-user-letterhead-image")
        image = SimpleUploadedFile("membrete.jpg", b"fake-bytes", content_type="image/jpeg")
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Solo se permiten archivos PNG" in response.data["detail"]

    def test_upload_user_letterhead_image_too_large(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        large_content = b"0" * (10 * 1024 * 1024 + 1)
        image = SimpleUploadedFile("membrete.png", large_content, content_type="image/png")

        url = reverse("upload-user-letterhead-image")
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "demasiado grande" in response.data["detail"].lower()

    def test_upload_user_letterhead_image_invalid_image(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        image = SimpleUploadedFile("membrete.png", b"not-an-image", content_type="image/png")

        url = reverse("upload-user-letterhead-image")
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "imagen inválido" in response.data["detail"].lower()

    def test_get_user_letterhead_image_not_configured(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-user-letterhead-image")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "No tienes una imagen de membrete global configurada" in response.data["detail"]

    def test_delete_user_letterhead_image_not_configured(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "para eliminar" in response.data["detail"].lower()

    def test_delete_user_letterhead_image_basic_user_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)

        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Los usuarios básicos" in response.data["error"]

    def test_get_user_letterhead_image_internal_error(self, api_client, lawyer_user, settings, tmp_path, monkeypatch):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("membrete.png", buffer.read(), content_type="image/png")
        lawyer_user.letterhead_image = image
        lawyer_user.save(update_fields=["letterhead_image"])

        def raise_error(*args, **kwargs):
            raise Exception("boom")

        monkeypatch.setattr(os.path, "exists", raise_error)

        url = reverse("get-user-letterhead-image")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error al obtener la imagen" in response.data["detail"]

    def test_delete_user_letterhead_image_internal_error(self, api_client, lawyer_user, settings, tmp_path, monkeypatch):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("membrete.png", buffer.read(), content_type="image/png")
        lawyer_user.letterhead_image = image
        lawyer_user.save(update_fields=["letterhead_image"])

        def raise_error(*args, **kwargs):
            raise Exception("boom")

        monkeypatch.setattr(User, "save", raise_error)

        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Error al eliminar la imagen" in response.data["detail"]

    def test_upload_get_delete_user_letterhead_image_success(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("membrete.png", buffer.read(), content_type="image/png")

        upload_url = reverse("upload-user-letterhead-image")
        response = api_client.post(upload_url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        lawyer_user.refresh_from_db()
        assert lawyer_user.letterhead_image

        get_url = reverse("get-user-letterhead-image")
        response = api_client.get(get_url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/png"

        delete_url = reverse("delete-user-letterhead-image")
        response = api_client.delete(delete_url)

        assert response.status_code == status.HTTP_200_OK
        lawyer_user.refresh_from_db()
        assert not lawyer_user.letterhead_image

    def test_upload_user_letterhead_image_warning_aspect_ratio(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (800, 800), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("membrete.png", buffer.read(), content_type="image/png")

        upload_url = reverse("upload-user-letterhead-image")
        response = api_client.post(upload_url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        assert "warnings" in response.data

    def test_get_user_letterhead_image_missing_file(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("membrete.png", buffer.read(), content_type="image/png")
        lawyer_user.letterhead_image = image
        lawyer_user.save(update_fields=["letterhead_image"])

        file_path = lawyer_user.letterhead_image.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("get-user-letterhead-image")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no se encuentra en el servidor" in response.data["detail"].lower()

    def test_delete_document_word_template_missing_file(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile(
            "doc-template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        document.letterhead_word_template = template
        document.save(update_fields=["letterhead_word_template"])

        file_path = document.letterhead_word_template.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert not document.letterhead_word_template

    def test_delete_user_word_template_missing_file(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile(
            "template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        lawyer_user.letterhead_word_template = template
        lawyer_user.save(update_fields=["letterhead_word_template"])

        file_path = lawyer_user.letterhead_word_template.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        lawyer_user.refresh_from_db()
        assert not lawyer_user.letterhead_word_template

    def test_delete_letterhead_image_missing_file(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("doc.png", buffer.read(), content_type="image/png")
        document.letterhead_image = image
        document.save(update_fields=["letterhead_image"])

        file_path = document.letterhead_image.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert not document.letterhead_image

    def test_delete_user_letterhead_image_missing_file(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("membrete.png", buffer.read(), content_type="image/png")
        lawyer_user.letterhead_image = image
        lawyer_user.save(update_fields=["letterhead_image"])

        file_path = lawyer_user.letterhead_image.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("delete-user-letterhead-image")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        lawyer_user.refresh_from_db()
        assert not lawyer_user.letterhead_image


@pytest.mark.django_db
class TestDocumentLetterhead:
    def test_upload_letterhead_image_no_image(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "No se proporcionó ninguna imagen" in response.data["detail"]

    def test_upload_letterhead_image_wrong_extension(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        image = SimpleUploadedFile("doc.jpg", b"fake-bytes", content_type="image/jpeg")
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Solo se permiten archivos PNG" in response.data["detail"]

    def test_upload_letterhead_image_too_large(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        large_content = b"0" * (10 * 1024 * 1024 + 1)
        image = SimpleUploadedFile("doc.png", large_content, content_type="image/png")

        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "demasiado grande" in response.data["detail"].lower()

    def test_upload_letterhead_image_invalid_image(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        image = SimpleUploadedFile("doc.png", b"not-an-image", content_type="image/png")

        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "imagen inválido" in response.data["detail"].lower()

    def test_get_letterhead_image_not_configured(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no tiene imagen de membrete" in response.data["detail"]

    def test_get_letterhead_image_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-letterhead-image", kwargs={"pk": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_get_letterhead_image_forbidden_when_no_visibility(self, api_client, lawyer_user, document):
        client_user = User.objects.create_user(
            email="client@example.com",
            password="testpassword",
            role="client",
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission to view" in response.data["detail"].lower()

    def test_delete_letterhead_image_not_configured(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "para eliminar" in response.data["detail"].lower()

    def test_delete_letterhead_image_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("delete-letterhead-image", kwargs={"pk": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_delete_letterhead_image_forbidden_when_no_usability(self, api_client, lawyer_user, document):
        client_user = User.objects.create_user(
            email="client2@example.com",
            password="testpassword",
            role="client",
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission to access" in response.data["detail"].lower()

    def test_upload_letterhead_image_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-letterhead-image", kwargs={"pk": 9999})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_upload_letterhead_image_forbidden_when_no_usability(self, api_client, lawyer_user, document):
        client_user = User.objects.create_user(
            email="client3@example.com",
            password="testpassword",
            role="client",
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission to access" in response.data["detail"].lower()

    def test_upload_get_delete_letterhead_image_success(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("doc.png", buffer.read(), content_type="image/png")

        upload_url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(upload_url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        document.refresh_from_db()
        assert document.letterhead_image

        get_url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        response = api_client.get(get_url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "image/png"

        delete_url = reverse("delete-letterhead-image", kwargs={"pk": document.id})
        response = api_client.delete(delete_url)

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert not document.letterhead_image

    def test_upload_letterhead_image_warning_aspect_ratio(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (800, 800), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("doc.png", buffer.read(), content_type="image/png")

        upload_url = reverse("upload-letterhead-image", kwargs={"pk": document.id})
        response = api_client.post(upload_url, {"image": image}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        assert "warnings" in response.data

    def test_get_letterhead_image_missing_file(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        img = Image.new("RGB", (612, 792), color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        image = SimpleUploadedFile("doc.png", buffer.read(), content_type="image/png")
        document.letterhead_image = image
        document.save(update_fields=["letterhead_image"])

        file_path = document.letterhead_image.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("get-letterhead-image", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no se encuentra en el servidor" in response.data["detail"].lower()


@pytest.mark.django_db
class TestUserWordLetterheadTemplate:
    def test_upload_user_word_template_basic_user_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)

        url = reverse("upload-user-letterhead-word-template")
        template = SimpleUploadedFile(
            "template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        response = api_client.post(url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Los usuarios básicos" in response.data["error"]

    def test_delete_user_word_template_basic_user_forbidden(self, api_client, basic_user):
        api_client.force_authenticate(user=basic_user)

        url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Los usuarios básicos" in response.data["error"]

    def test_upload_user_word_template_missing_file(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-user-letterhead-word-template")
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Se requiere un archivo de plantilla" in response.data["detail"]

    def test_upload_user_word_template_invalid_extension(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile("template.txt", b"docx-content", content_type="text/plain")

        url = reverse("upload-user-letterhead-word-template")
        response = api_client.post(url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Solo se permiten archivos .docx" in response.data["detail"]

    def test_get_user_word_template_not_configured(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-user-letterhead-word-template")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "plantilla word de membrete global configurada" in response.data["detail"].lower()

    def test_delete_user_word_template_not_configured(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "para eliminar" in response.data["detail"].lower()

    def test_upload_get_delete_user_word_template(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        upload_url = reverse("upload-user-letterhead-word-template")
        template = SimpleUploadedFile(
            "template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        response = api_client.post(upload_url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        lawyer_user.refresh_from_db()
        assert lawyer_user.letterhead_word_template

        get_url = reverse("get-user-letterhead-word-template")
        response = api_client.get(get_url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        delete_url = reverse("delete-user-letterhead-word-template")
        response = api_client.delete(delete_url)

        assert response.status_code == status.HTTP_200_OK
        lawyer_user.refresh_from_db()
        assert not lawyer_user.letterhead_word_template

    def test_upload_user_word_template_too_large(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        large_content = b"0" * (10 * 1024 * 1024 + 1)
        template = SimpleUploadedFile(
            "template.docx",
            large_content,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        url = reverse("upload-user-letterhead-word-template")
        response = api_client.post(url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "demasiado grande" in response.data["detail"].lower()

    def test_get_user_word_template_missing_file(self, api_client, lawyer_user, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile(
            "template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        lawyer_user.letterhead_word_template = template
        lawyer_user.save(update_fields=["letterhead_word_template"])

        file_path = lawyer_user.letterhead_word_template.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("get-user-letterhead-word-template")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no se encuentra en el servidor" in response.data["detail"].lower()


@pytest.mark.django_db
class TestDocumentWordLetterheadTemplate:
    def test_get_document_word_template_forbidden_when_no_visibility(self, api_client, lawyer_user, document):
        client_user = User.objects.create_user(
            email="client4@example.com",
            password="testpassword",
            role="client",
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission to view" in response.data["detail"].lower()

    def test_delete_document_word_template_forbidden_when_no_usability(self, api_client, lawyer_user, document):
        client_user = User.objects.create_user(
            email="client5@example.com",
            password="testpassword",
            role="client",
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission to access" in response.data["detail"].lower()

    def test_upload_document_word_template_forbidden_when_no_usability(self, api_client, lawyer_user, document):
        client_user = User.objects.create_user(
            email="client6@example.com",
            password="testpassword",
            role="client",
        )

        api_client.force_authenticate(user=client_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permission to access" in response.data["detail"].lower()
    def test_upload_document_word_template_missing_file(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.post(url, {}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Se requiere un archivo de plantilla" in response.data["detail"]

    def test_upload_document_word_template_invalid_extension(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile("doc-template.txt", b"docx-content", content_type="text/plain")

        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.post(url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Solo se permiten archivos .docx" in response.data["detail"]

    def test_get_document_word_template_not_configured(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "plantilla word de membrete" in response.data["detail"].lower()

    def test_delete_document_word_template_not_configured(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "para eliminar" in response.data["detail"].lower()

    def test_get_document_word_template_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("get-document-letterhead-word-template", kwargs={"pk": 9999})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_delete_document_word_template_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": 9999})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_upload_document_word_template_not_found(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile(
            "doc-template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": 9999})
        response = api_client.post(url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "document not found" in response.data["detail"].lower()

    def test_upload_get_delete_document_word_template(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        upload_url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        template = SimpleUploadedFile(
            "doc-template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        response = api_client.post(upload_url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        document.refresh_from_db()
        assert document.letterhead_word_template

        get_url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.get(get_url)

        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        delete_url = reverse("delete-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.delete(delete_url)

        assert response.status_code == status.HTTP_200_OK
        document.refresh_from_db()
        assert not document.letterhead_word_template

    def test_upload_document_word_template_too_large(self, api_client, lawyer_user, document):
        api_client.force_authenticate(user=lawyer_user)

        large_content = b"0" * (10 * 1024 * 1024 + 1)
        template = SimpleUploadedFile(
            "doc-template.docx",
            large_content,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.post(url, {"template": template}, format="multipart")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "demasiado grande" in response.data["detail"].lower()

    def test_get_document_word_template_missing_file(self, api_client, lawyer_user, document, settings, tmp_path):
        settings.MEDIA_ROOT = tmp_path
        api_client.force_authenticate(user=lawyer_user)

        template = SimpleUploadedFile(
            "doc-template.docx",
            b"docx-content",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        document.letterhead_word_template = template
        document.save(update_fields=["letterhead_word_template"])

        file_path = document.letterhead_word_template.path
        if os.path.exists(file_path):
            os.remove(file_path)

        url = reverse("get-document-letterhead-word-template", kwargs={"pk": document.id})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no se encuentra en el servidor" in response.data["detail"].lower()
