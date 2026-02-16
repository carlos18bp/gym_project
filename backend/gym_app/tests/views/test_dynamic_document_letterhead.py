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


# ======================================================================
# Tests migrated from test_views_batch10.py
# ======================================================================

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
@pytest.mark.django_db
def b10_lawyer_user():
    return User.objects.create_user(
        email="lawyer_b10@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def b10_basic_user():
    return User.objects.create_user(
        email="basic_b10@test.com", password="pw", role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def b10_document(b10_lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc B10", content="<p>Hello</p>", state="Draft",
        created_by=b10_lawyer_user, is_public=True,
    )


# ===========================================================================
# 1. Document letterhead image – DoesNotExist / error paths
# ===========================================================================

@pytest.mark.django_db
class TestDocumentLetterheadImage:

    def test_upload_letterhead_doc_not_found(self, api_client, b10_lawyer_user):
        """Line 925-931: document not found."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-letterhead-image", kwargs={"pk": 99999})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_letterhead_doc_not_found(self, api_client, b10_lawyer_user):
        """Line 967-973: document not found."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("get-letterhead-image", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_letterhead_no_image(self, api_client, b10_lawyer_user, b10_document):
        """Line 946-950: document has no letterhead image."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("get-letterhead-image", kwargs={"pk": b10_document.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_letterhead_doc_not_found(self, api_client, b10_lawyer_user):
        """Line 1010-1016: document not found."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("delete-letterhead-image", kwargs={"pk": 99999})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_letterhead_no_image(self, api_client, b10_lawyer_user, b10_document):
        """Line 988-992: document has no letterhead to delete."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("delete-letterhead-image", kwargs={"pk": b10_document.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 2. Document word template – DoesNotExist / error paths
# ===========================================================================

@pytest.mark.django_db
class TestDocumentWordTemplate:

    def test_upload_word_template_doc_not_found(self, api_client, b10_lawyer_user):
        """Line 1080-1086: document not found."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_upload_word_template_no_file(self, api_client, b10_lawyer_user, b10_document):
        """Line 1034-1038: no template file provided."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": b10_document.id})
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_word_template_wrong_extension(self, api_client, b10_lawyer_user, b10_document):
        """Line 1043-1047: non-docx extension."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": b10_document.id})
        f = SimpleUploadedFile("test.txt", b"content", content_type="text/plain")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_word_template_too_large(self, api_client, b10_lawyer_user, b10_document):
        """Line 1050-1055: file too large."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-document-letterhead-word-template", kwargs={"pk": b10_document.id})
        # Create a file > 10MB
        f = SimpleUploadedFile("big.docx", b"x" * (11 * 1024 * 1024), content_type="application/octet-stream")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_word_template_doc_not_found(self, api_client, b10_lawyer_user):
        """Line 1119-1125: document not found."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_get_word_template_no_template(self, api_client, b10_lawyer_user, b10_document):
        """Line 1100-1104: no template configured."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("get-document-letterhead-word-template", kwargs={"pk": b10_document.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_word_template_doc_not_found(self, api_client, b10_lawyer_user):
        """Line 1159-1165: document not found."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": 99999})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_word_template_no_template(self, api_client, b10_lawyer_user, b10_document):
        """Line 1139-1143: no template to delete."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("delete-document-letterhead-word-template", kwargs={"pk": b10_document.id})
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ===========================================================================
# 3. User global word template endpoints
# ===========================================================================

@pytest.mark.django_db
class TestUserWordTemplate:

    def test_upload_user_word_template_no_file(self, api_client, b10_lawyer_user):
        """Line 1183-1187: no template file provided."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_user_word_template_wrong_ext(self, api_client, b10_lawyer_user):
        """Line 1192-1196: non-docx extension."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        f = SimpleUploadedFile("test.pdf", b"content", content_type="application/pdf")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_user_word_template_too_large(self, api_client, b10_lawyer_user):
        """Line 1200-1204: file too large."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("upload-user-letterhead-word-template")
        f = SimpleUploadedFile("big.docx", b"x" * (11 * 1024 * 1024), content_type="application/octet-stream")
        resp = api_client.post(url, {"template": f}, format="multipart")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_user_word_template_no_template(self, api_client, b10_lawyer_user):
        """Line 1243-1247: no template configured."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("get-user-letterhead-word-template")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_word_template_no_template(self, api_client, b10_lawyer_user):
        """Line 1281-1285: no template to delete."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("delete-user-letterhead-word-template")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_word_template_basic_forbidden(self, api_client, b10_basic_user):
        """Line 1273-1276: basic user forbidden."""
        api_client.force_authenticate(user=b10_basic_user)
        url = reverse("delete-user-letterhead-word-template")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN


# ===========================================================================
# 4. User global letterhead image endpoints
# ===========================================================================

@pytest.mark.django_db
class TestUserLetterheadImage:

    def test_upload_user_letterhead_basic_forbidden(self, api_client, b10_basic_user):
        """Line 1359-1362: basic user forbidden."""
        api_client.force_authenticate(user=b10_basic_user)
        url = reverse("upload-user-letterhead-image")
        resp = api_client.post(url, {}, format="multipart")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_get_user_letterhead_no_image(self, api_client, b10_lawyer_user):
        """Line 1469-1473: no letterhead image."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("get-user-letterhead-image")
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_user_letterhead_basic_forbidden(self, api_client, b10_basic_user):
        """Line 1507-1510: basic user forbidden."""
        api_client.force_authenticate(user=b10_basic_user)
        url = reverse("delete-user-letterhead-image")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_user_letterhead_no_image(self, api_client, b10_lawyer_user):
        """Line 1515-1519: no letterhead to delete."""
        api_client.force_authenticate(user=b10_lawyer_user)
        url = reverse("delete-user-letterhead-image")
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_404_NOT_FOUND


# ======================================================================
# Tests migrated from test_views_batch20.py
# ======================================================================

"""Batch 20 – 20 tests: user letterhead image/word CRUD + helper."""
import io, os, pytest
from unittest.mock import patch, MagicMock
from PIL import Image as PILImage
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import DynamicDocument

User = get_user_model()

@pytest.fixture
def b20_api():
    return APIClient()

@pytest.fixture
@pytest.mark.django_db
def lawyer():
    return User.objects.create_user(email="law_b20@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
@pytest.mark.django_db
def b20_basic_user():
    return User.objects.create_user(email="basic_b20@t.com", password="pw", role="basic", first_name="B", last_name="U")

def _png(w=100, h=100):
    buf = io.BytesIO()
    PILImage.new("RGB", (w, h), color="white").save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile("t.png", buf.read(), content_type="image/png")

def _docx():
    from docx import Document as D
    buf = io.BytesIO(); D().save(buf); buf.seek(0)
    return SimpleUploadedFile("t.docx", buf.read(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

@pytest.mark.django_db
class TestUploadUserLetterhead:
    def test_success(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-image"), {"image": _png()}, format="multipart").status_code == 201

    def test_no_file(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-image"), {}, format="multipart").status_code == 400

    def test_bad_ext(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-image"), {"image": SimpleUploadedFile("b.jpg", b"d", content_type="image/jpeg")}, format="multipart").status_code == 400

    def test_too_large(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-image"), {"image": SimpleUploadedFile("b.png", b"x"*(11*1024*1024), content_type="image/png")}, format="multipart").status_code == 400

    def test_invalid_img(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-image"), {"image": SimpleUploadedFile("b.png", b"bad", content_type="image/png")}, format="multipart").status_code == 400

    def test_basic_forbidden(self, b20_api, b20_basic_user):
        b20_api.force_authenticate(user=b20_basic_user)
        assert b20_api.post(reverse("upload-user-letterhead-image"), {"image": _png()}, format="multipart").status_code == 403

    def test_aspect_warning(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        r = b20_api.post(reverse("upload-user-letterhead-image"), {"image": _png(500, 100)}, format="multipart")
        assert r.status_code == 201 and "warnings" in r.data

@pytest.mark.django_db
class TestGetUserLetterhead:
    def test_no_image(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.get(reverse("get-user-letterhead-image")).status_code == 404

@pytest.mark.django_db
class TestDeleteUserLetterhead:
    def test_no_image(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.delete(reverse("delete-user-letterhead-image")).status_code == 404

    def test_basic_forbidden(self, b20_api, b20_basic_user):
        b20_api.force_authenticate(user=b20_basic_user)
        assert b20_api.delete(reverse("delete-user-letterhead-image")).status_code == 403

    def test_success(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        b20_api.post(reverse("upload-user-letterhead-image"), {"image": _png()}, format="multipart")
        assert b20_api.delete(reverse("delete-user-letterhead-image")).status_code == 200

@pytest.mark.django_db
class TestUploadUserWordTpl:
    def test_success(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-word-template"), {"template": _docx()}, format="multipart").status_code == 201

    def test_no_file(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-word-template"), {}, format="multipart").status_code == 400

    def test_bad_ext(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.post(reverse("upload-user-letterhead-word-template"), {"template": SimpleUploadedFile("b.txt", b"d")}, format="multipart").status_code == 400

    def test_basic_forbidden(self, b20_api, b20_basic_user):
        b20_api.force_authenticate(user=b20_basic_user)
        assert b20_api.post(reverse("upload-user-letterhead-word-template"), {"template": _docx()}, format="multipart").status_code == 403

@pytest.mark.django_db
class TestGetUserWordTpl:
    def test_no_tpl(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.get(reverse("get-user-letterhead-word-template")).status_code == 404

@pytest.mark.django_db
class TestDeleteUserWordTpl:
    def test_no_tpl(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        assert b20_api.delete(reverse("delete-user-letterhead-word-template")).status_code == 404

    def test_basic_forbidden(self, b20_api, b20_basic_user):
        b20_api.force_authenticate(user=b20_basic_user)
        assert b20_api.delete(reverse("delete-user-letterhead-word-template")).status_code == 403

    def test_success(self, b20_api, lawyer):
        b20_api.force_authenticate(user=lawyer)
        b20_api.post(reverse("upload-user-letterhead-word-template"), {"template": _docx()}, format="multipart")
        assert b20_api.delete(reverse("delete-user-letterhead-word-template")).status_code == 200


# ======================================================================
# Tests migrated from test_views_batch32.py
# ======================================================================

"""Batch 32 – 20 tests: document_views.py Part 2 – letterhead upload/delete, word template, user letterhead, create doc edges."""
import io
import pytest
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument
from PIL import Image as PILImage

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law32@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli32@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
def basic():
    return User.objects.create_user(email="bas32@t.com", password="pw", role="basic", first_name="B", last_name="U")

def _png_file(name="test.png", w=100, h=100):
    buf = io.BytesIO()
    PILImage.new("RGB", (w, h), color="red").save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


# -- upload_letterhead_image (document) --
class TestUploadDocLetterhead:
    def test_upload_no_image(self, api, law):
        doc = DynamicDocument.objects.create(title="UL1", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("upload-letterhead-image", args=[doc.id]))
        assert resp.status_code == 400
        assert "imagen" in resp.data["detail"].lower() or "image" in resp.data["detail"].lower()

    def test_upload_wrong_extension(self, api, law):
        doc = DynamicDocument.objects.create(title="UL2", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        f = SimpleUploadedFile("test.jpg", b"fake", content_type="image/jpeg")
        resp = api.post(reverse("upload-letterhead-image", args=[doc.id]), {"image": f})
        assert resp.status_code == 400
        assert "PNG" in resp.data["detail"]

    def test_upload_success(self, api, law):
        doc = DynamicDocument.objects.create(title="UL3", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("upload-letterhead-image", args=[doc.id]), {"image": _png_file()})
        assert resp.status_code == 201
        assert "message" in resp.data
        doc.refresh_from_db()
        assert doc.letterhead_image is not None


# -- delete_letterhead_image (document) --
class TestDeleteDocLetterhead:
    def test_delete_no_image(self, api, law):
        doc = DynamicDocument.objects.create(title="DL1", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-letterhead-image", args=[doc.id]))
        assert resp.status_code == 404

    def test_delete_success(self, api, law):
        doc = DynamicDocument.objects.create(title="DL2", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        doc.letterhead_image = _png_file("lh.png")
        doc.save()
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-letterhead-image", args=[doc.id]))
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert not doc.letterhead_image


# -- upload_user_letterhead_image --
class TestUploadUserLetterhead:
    def test_basic_user_forbidden(self, api, basic):
        api.force_authenticate(user=basic)
        resp = api.post(reverse("upload-user-letterhead-image"), {"image": _png_file()})
        assert resp.status_code == 403

    def test_no_image_field(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("upload-user-letterhead-image"))
        assert resp.status_code == 400

    def test_wrong_extension(self, api, law):
        api.force_authenticate(user=law)
        f = SimpleUploadedFile("test.gif", b"fake", content_type="image/gif")
        resp = api.post(reverse("upload-user-letterhead-image"), {"image": f})
        assert resp.status_code == 400

    def test_upload_success(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("upload-user-letterhead-image"), {"image": _png_file()})
        assert resp.status_code == 201
        assert "message" in resp.data
        law.refresh_from_db()
        assert law.letterhead_image is not None


# -- delete_user_letterhead_image --
class TestDeleteUserLetterhead:
    def test_basic_user_forbidden(self, api, basic):
        api.force_authenticate(user=basic)
        resp = api.delete(reverse("delete-user-letterhead-image"))
        assert resp.status_code == 403

    def test_no_image_to_delete(self, api, law):
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-user-letterhead-image"))
        assert resp.status_code == 404

    def test_delete_success(self, api, law):
        law.letterhead_image = _png_file("ulh.png")
        law.save()
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-user-letterhead-image"))
        assert resp.status_code == 200
        law.refresh_from_db()
        assert not law.letterhead_image


# -- upload_document_letterhead_word_template --
class TestUploadDocWordTemplate:
    def test_no_template_field(self, api, law):
        doc = DynamicDocument.objects.create(title="WT1", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("upload-document-letterhead-word-template", args=[doc.id]))
        assert resp.status_code == 400

    def test_wrong_extension(self, api, law):
        doc = DynamicDocument.objects.create(title="WT2", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        f = SimpleUploadedFile("test.pdf", b"fake", content_type="application/pdf")
        resp = api.post(reverse("upload-document-letterhead-word-template", args=[doc.id]), {"template": f})
        assert resp.status_code == 400

    def test_upload_success(self, api, law):
        doc = DynamicDocument.objects.create(title="WT3", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        f = SimpleUploadedFile("tpl.docx", b"PK\x03\x04fakecontent", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        resp = api.post(reverse("upload-document-letterhead-word-template", args=[doc.id]), {"template": f})
        assert resp.status_code == 201
        doc.refresh_from_db()
        assert doc.letterhead_word_template is not None


# -- get/delete document word template --
class TestDocWordTemplateGetDelete:
    def test_get_no_template(self, api, law):
        doc = DynamicDocument.objects.create(title="GT1", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-document-letterhead-word-template", args=[doc.id]))
        assert resp.status_code == 404

    def test_delete_no_template(self, api, law):
        doc = DynamicDocument.objects.create(title="DT1", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-document-letterhead-word-template", args=[doc.id]))
        assert resp.status_code == 404


# -- create_dynamic_document edge --
class TestCreateDynDocEdge:
    def test_create_assigns_to_self_on_progress(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(
            reverse("create_dynamic_document"),
            {"title": "CliDoc", "content": "<p>x</p>", "state": "Progress"},
            format="json",
        )
        assert resp.status_code == 201
        doc = DynamicDocument.objects.get(title="CliDoc")
        assert doc.assigned_to == cli


# -- upload_user_letterhead_word_template --
class TestUploadUserWordTemplate:
    def test_basic_user_forbidden(self, api, basic):
        api.force_authenticate(user=basic)
        f = SimpleUploadedFile("tpl.docx", b"PK\x03\x04fake", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        resp = api.post(reverse("upload-user-letterhead-word-template"), {"template": f})
        assert resp.status_code == 403

    def test_no_template_field(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("upload-user-letterhead-word-template"))
        assert resp.status_code == 400
