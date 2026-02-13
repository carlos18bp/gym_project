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
def api():
    return APIClient()

@pytest.fixture
@pytest.mark.django_db
def lawyer():
    return User.objects.create_user(email="law_b20@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
@pytest.mark.django_db
def basic_user():
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
    def test_success(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-image"), {"image": _png()}, format="multipart").status_code == 201

    def test_no_file(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-image"), {}, format="multipart").status_code == 400

    def test_bad_ext(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-image"), {"image": SimpleUploadedFile("b.jpg", b"d", content_type="image/jpeg")}, format="multipart").status_code == 400

    def test_too_large(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-image"), {"image": SimpleUploadedFile("b.png", b"x"*(11*1024*1024), content_type="image/png")}, format="multipart").status_code == 400

    def test_invalid_img(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-image"), {"image": SimpleUploadedFile("b.png", b"bad", content_type="image/png")}, format="multipart").status_code == 400

    def test_basic_forbidden(self, api, basic_user):
        api.force_authenticate(user=basic_user)
        assert api.post(reverse("upload-user-letterhead-image"), {"image": _png()}, format="multipart").status_code == 403

    def test_aspect_warning(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        r = api.post(reverse("upload-user-letterhead-image"), {"image": _png(500, 100)}, format="multipart")
        assert r.status_code == 201 and "warnings" in r.data

@pytest.mark.django_db
class TestGetUserLetterhead:
    def test_no_image(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.get(reverse("get-user-letterhead-image")).status_code == 404

@pytest.mark.django_db
class TestDeleteUserLetterhead:
    def test_no_image(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.delete(reverse("delete-user-letterhead-image")).status_code == 404

    def test_basic_forbidden(self, api, basic_user):
        api.force_authenticate(user=basic_user)
        assert api.delete(reverse("delete-user-letterhead-image")).status_code == 403

    def test_success(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        api.post(reverse("upload-user-letterhead-image"), {"image": _png()}, format="multipart")
        assert api.delete(reverse("delete-user-letterhead-image")).status_code == 200

@pytest.mark.django_db
class TestUploadUserWordTpl:
    def test_success(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-word-template"), {"template": _docx()}, format="multipart").status_code == 201

    def test_no_file(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-word-template"), {}, format="multipart").status_code == 400

    def test_bad_ext(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.post(reverse("upload-user-letterhead-word-template"), {"template": SimpleUploadedFile("b.txt", b"d")}, format="multipart").status_code == 400

    def test_basic_forbidden(self, api, basic_user):
        api.force_authenticate(user=basic_user)
        assert api.post(reverse("upload-user-letterhead-word-template"), {"template": _docx()}, format="multipart").status_code == 403

@pytest.mark.django_db
class TestGetUserWordTpl:
    def test_no_tpl(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.get(reverse("get-user-letterhead-word-template")).status_code == 404

@pytest.mark.django_db
class TestDeleteUserWordTpl:
    def test_no_tpl(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        assert api.delete(reverse("delete-user-letterhead-word-template")).status_code == 404

    def test_basic_forbidden(self, api, basic_user):
        api.force_authenticate(user=basic_user)
        assert api.delete(reverse("delete-user-letterhead-word-template")).status_code == 403

    def test_success(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        api.post(reverse("upload-user-letterhead-word-template"), {"template": _docx()}, format="multipart")
        assert api.delete(reverse("delete-user-letterhead-word-template")).status_code == 200
