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
