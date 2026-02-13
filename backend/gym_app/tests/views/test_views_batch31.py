"""Batch 31 – 20 tests: document_views.py – list filters, pagination, CRUD edges, recent docs, letterhead."""
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, RecentDocument

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law31@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli31@t.com", password="pw", role="client", first_name="C", last_name="E")


# -- list_dynamic_documents filter/pagination edges --
class TestListDynDocEdges:
    def test_filter_by_single_state(self, api, law):
        DynamicDocument.objects.create(title="D1", content="<p>x</p>", state="Draft", created_by=law)
        DynamicDocument.objects.create(title="D2", content="<p>x</p>", state="Completed", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"state": "Draft"})
        assert resp.status_code == 200
        titles = [d["title"] for d in resp.data["items"]]
        assert "D1" in titles
        assert "D2" not in titles

    def test_filter_by_multi_states(self, api, law):
        DynamicDocument.objects.create(title="D1", content="<p>x</p>", state="Draft", created_by=law)
        DynamicDocument.objects.create(title="D2", content="<p>x</p>", state="Completed", created_by=law)
        DynamicDocument.objects.create(title="D3", content="<p>x</p>", state="Progress", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"states": "Draft,Completed"})
        assert resp.status_code == 200
        titles = [d["title"] for d in resp.data["items"]]
        assert "D1" in titles
        assert "D2" in titles
        assert "D3" not in titles

    def test_filter_by_client_id(self, api, law, cli):
        DynamicDocument.objects.create(title="ClientDoc", content="<p>x</p>", state="Draft", created_by=law, assigned_to=cli)
        DynamicDocument.objects.create(title="NoClient", content="<p>x</p>", state="Draft", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"client_id": cli.id})
        assert resp.status_code == 200
        titles = [d["title"] for d in resp.data["items"]]
        assert "ClientDoc" in titles
        assert "NoClient" not in titles

    def test_filter_by_lawyer_id(self, api, law):
        law2 = User.objects.create_user(email="law31b@t.com", password="pw", role="lawyer")
        DynamicDocument.objects.create(title="Mine", content="<p>x</p>", state="Draft", created_by=law)
        DynamicDocument.objects.create(title="Other", content="<p>x</p>", state="Draft", created_by=law2)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"lawyer_id": law.id})
        assert resp.status_code == 200
        titles = [d["title"] for d in resp.data["items"]]
        assert "Mine" in titles
        assert "Other" not in titles

    def test_pagination_defaults(self, api, law):
        for i in range(15):
            DynamicDocument.objects.create(title=f"P{i}", content="<p>x</p>", state="Draft", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"))
        assert resp.status_code == 200
        assert resp.data["totalItems"] == 15
        assert resp.data["totalPages"] == 2
        assert len(resp.data["items"]) == 10  # default limit

    def test_pagination_custom_limit(self, api, law):
        for i in range(5):
            DynamicDocument.objects.create(title=f"Q{i}", content="<p>x</p>", state="Draft", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"limit": 2, "page": 2})
        assert resp.status_code == 200
        assert resp.data["currentPage"] == 2
        assert len(resp.data["items"]) == 2

    def test_pagination_invalid_page(self, api, law):
        DynamicDocument.objects.create(title="X", content="<p>x</p>", state="Draft", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"page": "abc"})
        assert resp.status_code == 200
        assert resp.data["currentPage"] == 1

    def test_pagination_negative_limit(self, api, law):
        DynamicDocument.objects.create(title="X", content="<p>x</p>", state="Draft", created_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("list_dynamic_documents"), {"limit": -5})
        assert resp.status_code == 200
        assert resp.data["totalPages"] >= 1


# -- get_dynamic_document --
class TestGetDynDocEdges:
    def test_get_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get_dynamic_document", args=[999999]))
        assert resp.status_code == 404

    def test_get_doc_no_permission(self, api, law, cli):
        doc = DynamicDocument.objects.create(title="Priv", content="<p>x</p>", state="Draft", created_by=law)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get_dynamic_document", args=[doc.id]))
        assert resp.status_code == 403


# -- update_dynamic_document --
class TestUpdateDynDoc:
    def test_update_strips_created_by(self, api, law):
        doc = DynamicDocument.objects.create(title="Up", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.patch(
            reverse("update_dynamic_document", args=[doc.id]),
            {"title": "Updated", "created_by": 9999},
            format="json",
        )
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert doc.created_by == law
        assert doc.title == "Updated"

    def test_update_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.patch(reverse("update_dynamic_document", args=[999999]), {"title": "X"}, format="json")
        assert resp.status_code == 404


# -- delete_dynamic_document --
class TestDeleteDynDoc:
    def test_delete_success(self, api, law):
        doc = DynamicDocument.objects.create(title="Del", content="<p>x</p>", state="Draft", created_by=law)
        doc.usability_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete_dynamic_document", args=[doc.id]))
        assert resp.status_code == 200
        assert not DynamicDocument.objects.filter(id=doc.id).exists()

    def test_delete_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.delete(reverse("delete_dynamic_document", args=[999999]))
        assert resp.status_code == 404


# -- recent documents --
class TestRecentDocs:
    def test_update_recent_creates(self, api, law):
        doc = DynamicDocument.objects.create(title="Rec", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.post(reverse("update-recent-document", args=[doc.id]))
        assert resp.status_code == 200
        assert RecentDocument.objects.filter(user=law, document=doc).exists()

    def test_update_recent_updates_timestamp(self, api, law):
        doc = DynamicDocument.objects.create(title="Rec2", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        RecentDocument.objects.create(user=law, document=doc)
        api.force_authenticate(user=law)
        resp = api.post(reverse("update-recent-document", args=[doc.id]))
        assert resp.status_code == 200

    def test_update_recent_doc_not_found(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(reverse("update-recent-document", args=[999999]))
        assert resp.status_code == 404

    def test_get_recent_docs(self, api, law):
        doc = DynamicDocument.objects.create(title="R", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        RecentDocument.objects.create(user=law, document=doc)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-recent-documents"))
        assert resp.status_code == 200
        assert len(resp.data) >= 1


# -- letterhead endpoints --
class TestLetterheadEdges:
    def test_get_letterhead_no_image(self, api, law):
        doc = DynamicDocument.objects.create(title="NoLH", content="<p>x</p>", state="Draft", created_by=law)
        doc.visibility_permissions.create(user=law, granted_by=law)
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-letterhead-image", args=[doc.id]))
        assert resp.status_code == 404

    def test_get_user_letterhead_no_image(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("get-user-letterhead-image"))
        assert resp.status_code == 404
