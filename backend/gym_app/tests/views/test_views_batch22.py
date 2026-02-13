"""Batch 22 – permission_views.py remaining uncovered edges."""
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch
from django.contrib.auth import get_user_model
from gym_app.models import DynamicDocument, DocumentVisibilityPermission, DocumentUsabilityPermission

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def lawyer():
    return User.objects.create_user(email="law_b22@t.com", password="pw", role="lawyer")

@pytest.fixture
def client_user():
    return User.objects.create_user(email="cli_b22@t.com", password="pw", role="client", first_name="C", last_name="L")

@pytest.fixture
def doc(lawyer):
    return DynamicDocument.objects.create(title="DocB22", content="<p>x</p>", state="Draft", created_by=lawyer)


class TestPermViewsEdgesBatch22:

    # 1. get_document_permissions – generic exception
    def test_get_perms_internal_error(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("get-document-permissions", kwargs={"pk": doc.pk})
        with patch("gym_app.views.dynamic_documents.permission_views.DocumentVisibilityPermission.objects") as m:
            m.filter.side_effect = Exception("db boom")
            resp = api.get(url)
        assert resp.status_code == 500

    # 2. manage unified – invalid usability roles
    def test_manage_unified_invalid_usability_roles(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": doc.pk})
        resp = api.post(url, {"usability": {"roles": ["bad_role"]}}, format="json")
        assert resp.status_code == 200
        assert any("bad_role" in str(e) for e in resp.data.get("errors", []))

    # 3. manage unified – doc not found
    def test_manage_unified_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("manage-document-permissions-unified", kwargs={"pk": 99999})
        resp = api.post(url, {"is_public": True}, format="json")
        assert resp.status_code == 404

    # 4. toggle public – doc not found
    def test_toggle_public_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("toggle-public-access", kwargs={"pk": 99999})
        resp = api.post(url, {}, format="json")
        assert resp.status_code == 404

    # 5. grant visibility – doc not found
    def test_grant_visibility_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("grant-visibility-permissions", kwargs={"pk": 99999})
        resp = api.post(url, {"user_ids": [1]}, format="json")
        assert resp.status_code == 404

    # 6. grant usability – lawyer skipped
    def test_grant_usability_lawyer_skipped(self, api, lawyer, doc):
        law2 = User.objects.create_user(email="law2_b22@t.com", password="pw", role="lawyer")
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions", kwargs={"pk": doc.pk})
        resp = api.post(url, {"user_ids": [law2.pk]}, format="json")
        assert resp.status_code == 200
        assert len(resp.data["granted_permissions"]) == 0

    # 7. grant usability – doc not found
    def test_grant_usability_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions", kwargs={"pk": 99999})
        resp = api.post(url, {"user_ids": [1]}, format="json")
        assert resp.status_code == 404

    # 8. revoke visibility – doc not found
    def test_revoke_visibility_doc_not_found(self, api, lawyer, client_user):
        api.force_authenticate(user=lawyer)
        url = reverse("revoke-visibility-permission", kwargs={"pk": 99999, "user_id": client_user.pk})
        resp = api.delete(url)
        assert resp.status_code == 404

    # 9. revoke usability – user not found
    def test_revoke_usability_user_not_found(self, api, lawyer, doc):
        api.force_authenticate(user=lawyer)
        url = reverse("revoke-usability-permission", kwargs={"pk": doc.pk, "user_id": 99999})
        resp = api.delete(url)
        assert resp.status_code == 404

    # 10. grant visibility by role – doc not found
    def test_grant_vis_by_role_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("grant-visibility-permissions-by-role", kwargs={"pk": 99999})
        resp = api.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == 404

    # 11. grant usability by role – public warning
    def test_grant_usab_by_role_public_warning(self, api, lawyer, client_user):
        pub_doc = DynamicDocument.objects.create(title="Pub", content="<p>x</p>", state="Draft", created_by=lawyer, is_public=True)
        # Grant visibility first so model-level clean() passes
        DocumentVisibilityPermission.objects.create(document=pub_doc, user=client_user, granted_by=lawyer)
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": pub_doc.pk})
        resp = api.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == 200
        assert resp.data.get("warning") is not None

    # 12. grant usability by role – doc not found
    def test_grant_usab_by_role_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions-by-role", kwargs={"pk": 99999})
        resp = api.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == 404

    # 13. revoke by role – doc not found
    def test_revoke_by_role_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("revoke-permissions-by-role", kwargs={"pk": 99999})
        resp = api.delete(url, {"roles": ["client"], "permission_type": "both"}, format="json")
        assert resp.status_code == 404

    # 14. grant visibility combined – doc not found
    def test_grant_vis_combined_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": 99999})
        resp = api.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == 404

    # 15. grant usability combined – roles + excludes + doc not found
    def test_grant_usab_combined_roles_excludes(self, api, lawyer, client_user):
        pub_doc = DynamicDocument.objects.create(title="Pub2", content="<p>x</p>", state="Draft", created_by=lawyer, is_public=True)
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": pub_doc.pk})
        resp = api.post(url, {"roles": ["client"], "exclude_user_ids": [client_user.pk]}, format="json")
        assert resp.status_code == 200

    def test_grant_usab_combined_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": 99999})
        resp = api.post(url, {"roles": ["client"]}, format="json")
        assert resp.status_code == 404

    # 17. revoke combined – roles + excludes + doc not found
    def test_revoke_combined_roles_excludes(self, api, lawyer, client_user, doc):
        DocumentVisibilityPermission.objects.create(document=doc, user=client_user, granted_by=lawyer)
        api.force_authenticate(user=lawyer)
        url = reverse("revoke-permissions-combined", kwargs={"pk": doc.pk})
        resp = api.delete(url, {"roles": ["client"], "exclude_user_ids": [client_user.pk], "permission_type": "both"}, format="json")
        assert resp.status_code == 200

    def test_revoke_combined_doc_not_found(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("revoke-permissions-combined", kwargs={"pk": 99999})
        resp = api.delete(url, {"roles": ["client"], "permission_type": "both"}, format="json")
        assert resp.status_code == 404

    # 19. grant visibility combined – lawyer skip (line 1192)
    def test_grant_vis_combined_lawyer_skipped(self, api, lawyer, doc):
        law2 = User.objects.create_user(email="law3_b22@t.com", password="pw", role="lawyer")
        api.force_authenticate(user=lawyer)
        url = reverse("grant-visibility-permissions-combined", kwargs={"pk": doc.pk})
        resp = api.post(url, {"user_ids": [law2.pk]}, format="json")
        assert resp.status_code == 200
        assert len(resp.data["granted_permissions"]) == 0

    # 20. grant usability combined – lawyer skip (line 1313)
    def test_grant_usab_combined_lawyer_skipped(self, api, lawyer, doc):
        law2 = User.objects.create_user(email="law4_b22@t.com", password="pw", role="lawyer")
        api.force_authenticate(user=lawyer)
        url = reverse("grant-usability-permissions-combined", kwargs={"pk": doc.pk})
        resp = api.post(url, {"user_ids": [law2.pk]}, format="json")
        assert resp.status_code == 200
        assert len(resp.data["granted_permissions"]) == 0
