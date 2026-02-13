"""Batch 36 – 20 tests: final sweep – user/auth views, permission views, model edges, tag/folder views."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import (
    DynamicDocument, DocumentVariable, Tag, DocumentFolder,
)
from gym_app.models.user import ActivityFeed

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law36@t.com", password="pw", role="lawyer", first_name="L", last_name="W")


# -- user views --
class TestUserViews:
    def test_user_list(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("user-list"))
        assert resp.status_code == 200

    def test_update_profile(self, api, law):
        api.force_authenticate(user=law)
        resp = api.put(
            reverse("update_profile", args=[law.id]),
            {"first_name": "Updated", "last_name": "Name"},
            format="json",
        )
        assert resp.status_code == 200
        law.refresh_from_db()
        assert law.first_name == "Updated"

    def test_get_user_activities(self, api, law):
        ActivityFeed.objects.create(user=law, action_type="login", description="Logged in")
        api.force_authenticate(user=law)
        resp = api.get(reverse("user-activities"))
        assert resp.status_code == 200

    def test_create_activity(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(
            reverse("create-activity"),
            {"action_type": "create", "description": "Test activity"},
            format="json",
        )
        assert resp.status_code == 201
        assert ActivityFeed.objects.filter(user=law, action_type="create").exists()


# -- auth views --
class TestAuthViews:
    def test_validate_token_invalid(self, api):
        resp = api.post(reverse("validate_token"), {"token": "invalid"}, format="json")
        assert resp.status_code in (400, 401)

    def test_sign_in_missing_fields(self, api):
        resp = api.post(reverse("sign_in"), {}, format="json")
        assert resp.status_code == 400

    def test_sign_in_wrong_credentials(self, api):
        User.objects.create_user(email="auth36@t.com", password="pw", role="client")
        resp = api.post(reverse("sign_in"), {"email": "auth36@t.com", "password": "wrong"}, format="json")
        assert resp.status_code in (400, 401)


# -- tag views --
class TestTagViews:
    def test_list_tags(self, api, law):
        Tag.objects.create(name="Tag36", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list-tags"))
        assert resp.status_code == 200

    def test_create_tag(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("create-tag"), {"name": "NewTag36"}, format="json")
        assert resp.status_code == 201
        assert Tag.objects.filter(name="NewTag36").exists()

    def test_delete_tag(self, api, law):
        tag = Tag.objects.create(name="DelTag36", created_by=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-tag", args=[tag.id]))
        assert resp.status_code in (200, 204)
        assert not Tag.objects.filter(id=tag.id).exists()


# -- folder views --
class TestFolderViews:
    def test_list_folders(self, api, law):
        DocumentFolder.objects.create(name="Folder36", owner=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list-folders"))
        assert resp.status_code == 200

    def test_create_folder(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("create-folder"), {"name": "NewFolder36"}, format="json")
        assert resp.status_code == 201
        assert DocumentFolder.objects.filter(name="NewFolder36").exists()

    def test_delete_folder(self, api, law):
        folder = DocumentFolder.objects.create(name="DelFolder36", owner=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete-folder", args=[folder.id]))
        assert resp.status_code in (200, 204)
        assert not DocumentFolder.objects.filter(id=folder.id).exists()


# -- permission views --
class TestPermissionViews:
    def test_get_document_permissions(self, api, law):
        doc = DynamicDocument.objects.create(title="Perm36", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-document-permissions", args=[doc.id]))
        assert resp.status_code == 200

    def test_toggle_public_access(self, api, law):
        doc = DynamicDocument.objects.create(title="Pub36", content="<p>x</p>", state="Draft", created_by=law, is_public=False)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("toggle-public-access", args=[doc.id]))
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert doc.is_public is True

    def test_get_available_clients(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-available-clients"))
        assert resp.status_code == 200

    def test_get_available_roles(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-available-roles"))
        assert resp.status_code == 200


# -- model edge: DocumentVariable __str__ --
class TestDocumentVariableStr:
    def test_variable_str(self, law):
        doc = DynamicDocument.objects.create(title="V36", content="<p>x</p>", state="Draft", created_by=law)
        v = DocumentVariable.objects.create(document=doc, name_en="full_name", name_es="Nombre", field_type="input", value="John")
        s = str(v)
        assert s  # verify no crash and non-empty string


# -- legal updates --
class TestLegalUpdatesViews:
    def test_list_legal_updates(self, api, law):
        from gym_app.models import LegalUpdate
        LegalUpdate.objects.create(title="LU36", content="Body", is_active=True)
        api.force_authenticate(user=law)
        resp = api.get(reverse("legal-updates-list"))
        assert resp.status_code == 200

    def test_list_legal_updates_unauthenticated(self, api):
        resp = api.get(reverse("legal-updates-list"))
        assert resp.status_code in (401, 403)
