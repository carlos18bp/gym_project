"""
Batch 17 – final sweep: legal_request file validation, admin, org posts CRUD,
reports user_id filters, userAuth verify_passcode.
"""
import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from gym_app.models import Organization, OrganizationPost

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(email="law_b17@t.com", password="pw", role="lawyer", first_name="L", last_name="Y")

@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(email="cli_b17@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(email="corp_b17@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Cl")

@pytest.fixture
@pytest.mark.django_db
def organization(corp_user):
    return Organization.objects.create(title="OrgB17", corporate_client=corp_user, is_active=True)

# === 1. validate_file_security ===
@pytest.mark.django_db
class TestFileValidation:
    def _mk(self, name, size=100, content=b"x"):
        f = MagicMock(); f.name=name; f.size=size; f.read=MagicMock(return_value=content); f.seek=MagicMock()
        return f

    def test_too_large(self):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="exceeds"):
            validate_file_security(self._mk("big.pdf", size=31*1024*1024))

    def test_bad_ext(self):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="not allowed"):
            validate_file_security(self._mk("h.exe"))

    @patch("gym_app.views.legal_request.magic.from_buffer", return_value="application/octet-stream")
    def test_mime_not_allowed(self, _m):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="MIME"):
            validate_file_security(self._mk("t.pdf"))

    @patch("gym_app.views.legal_request.magic.from_buffer", return_value="image/png")
    def test_ext_mismatch(self, _m):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="doesn't match"):
            validate_file_security(self._mk("t.pdf"))

    @patch("gym_app.views.legal_request.magic.from_buffer", return_value="application/zip")
    def test_docx_zip_valid(self, _m):
        from gym_app.views.legal_request import validate_file_security
        c = b"PK\x03\x04word/document.xml"
        f = self._mk("t.docx", content=c); f.read=MagicMock(return_value=c)
        assert validate_file_security(f) is True

    @patch("gym_app.views.legal_request.magic.from_buffer", side_effect=Exception("err"))
    def test_magic_exc(self, _m):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="Unable"):
            validate_file_security(self._mk("t.pdf"))

# === 2. process_file_upload exception ===
@pytest.mark.django_db
class TestProcessFileUpload:
    def test_general_exception(self, client_user):
        from gym_app.views.legal_request import process_file_upload
        from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline
        lr = LegalRequest.objects.create(
            user=client_user, request_type=LegalRequestType.objects.create(name="T17"),
            discipline=LegalDiscipline.objects.create(name="D17"), description="T", status="OPEN",
        )
        f = MagicMock(); f.name="t.pdf"; f.size=100; f.read=MagicMock(return_value=b"%PDF"); f.seek=MagicMock()
        with patch("gym_app.views.legal_request.validate_file_security", side_effect=Exception("fail")):
            r = process_file_upload(f, lr)
        assert r["success"] is False

# === 3. admin GyMAdminSite ===
@pytest.mark.django_db
class TestGyMAdminSite:
    def test_get_app_list(self):
        from gym_app.admin import GyMAdminSite
        site = GyMAdminSite(name="testadmin")
        req = RequestFactory().get("/admin/")
        req.user = User.objects.create_superuser(email="adm_b17@t.com", password="pw")
        result = site.get_app_list(req)
        assert isinstance(result, list)

# === 4. org posts CRUD ===
@pytest.mark.django_db
class TestOrgPostsCRUD:
    def test_get_detail(self, api_client, corp_user, organization):
        p = OrganizationPost.objects.create(organization=organization, author=corp_user, title="D", content="C", is_active=True)
        api_client.force_authenticate(user=corp_user)
        url = reverse("get-organization-post-detail", kwargs={"organization_id": organization.id, "post_id": p.id})
        assert api_client.get(url).status_code == status.HTTP_200_OK

    def test_update(self, api_client, corp_user, organization):
        p = OrganizationPost.objects.create(organization=organization, author=corp_user, title="U", content="C", is_active=True)
        api_client.force_authenticate(user=corp_user)
        url = reverse("update-organization-post", kwargs={"organization_id": organization.id, "post_id": p.id})
        resp = api_client.put(url, {"title": "Updated"}, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_delete(self, api_client, corp_user, organization):
        p = OrganizationPost.objects.create(organization=organization, author=corp_user, title="X", content="C", is_active=True)
        api_client.force_authenticate(user=corp_user)
        url = reverse("delete-organization-post", kwargs={"organization_id": organization.id, "post_id": p.id})
        assert api_client.delete(url).status_code == status.HTTP_200_OK

# === 5. reports user_id filters ===
@pytest.mark.django_db
class TestReportsUserFilters:
    def test_processes_by_lawyer_with_user_id(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"report_type": "processes_by_lawyer", "user_id": lawyer_user.id, "start_date": "2024-01-01", "end_date": "2025-12-31"}, format="json")
        assert resp.status_code in (200, 400)

    def test_processes_by_client_with_user_id(self, api_client, lawyer_user, client_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"report_type": "processes_by_client", "user_id": client_user.id, "start_date": "2024-01-01", "end_date": "2025-12-31"}, format="json")
        assert resp.status_code in (200, 400)

    def test_lawyers_workload_with_user_id(self, api_client, lawyer_user):
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"report_type": "lawyers_workload", "user_id": lawyer_user.id, "start_date": "2024-01-01", "end_date": "2025-12-31"}, format="json")
        assert resp.status_code in (200, 400)

# === 6. userAuth verify_passcode User.DoesNotExist ===
@pytest.mark.django_db
class TestVerifyPasscode:
    @patch("gym_app.views.userAuth.requests.post")
    def test_valid_captcha_invalid_code(self, mock_post):
        mock_resp = MagicMock(); mock_resp.json.return_value={"success": True}; mock_resp.raise_for_status=MagicMock()
        mock_post.return_value = mock_resp
        c = APIClient()
        url = reverse("verify_passcode_and_reset_password")
        resp = c.post(url, {"passcode": "000000", "new_password": "newpw", "captcha_token": "tok"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid" in resp.data.get("error", "")

    @patch("gym_app.views.userAuth.requests.post")
    def test_captcha_failure(self, mock_post):
        mock_resp = MagicMock(); mock_resp.json.return_value={"success": False}; mock_resp.raise_for_status=MagicMock()
        mock_post.return_value = mock_resp
        c = APIClient()
        url = reverse("verify_passcode_and_reset_password")
        resp = c.post(url, {"passcode": "000000", "new_password": "newpw", "captcha_token": "tok"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
