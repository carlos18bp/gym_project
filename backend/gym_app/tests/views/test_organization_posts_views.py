import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import Organization, OrganizationPost, OrganizationMembership


User = get_user_model()
@pytest.fixture
@pytest.mark.django_db
def corporate_client():
    return User.objects.create_user(
        email="corp@example.com",
        password="testpassword",
        first_name="Corp",
        last_name="Leader",
        role="corporate_client",
    )



@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        first_name="Client",
        last_name="User",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def basic_user():
    return User.objects.create_user(
        email="basic@example.com",
        password="testpassword",
        first_name="Basic",
        last_name="User",
        role="basic",
    )


@pytest.fixture
@pytest.mark.django_db
def organization(corporate_client):
    return Organization.objects.create(
        title="Org Title",
        description="Org Description",
        corporate_client=corporate_client,
    )


@pytest.fixture
@pytest.mark.django_db
def organization_post(corporate_client, organization):
    return OrganizationPost.objects.create(
        title="Post 1",
        content="Content 1",
        organization=organization,
        author=corporate_client,
        is_active=True,
        is_pinned=False,
    )


@pytest.mark.django_db
@pytest.mark.integration
class TestOrganizationPostsCreateAndList:
    @pytest.mark.contract
    def test_create_organization_post_corporate_leader_only(self, api_client, corporate_client, client_user, organization):
        url = reverse("create-organization-post", kwargs={"organization_id": organization.id})
        data = {"title": "Nuevo post", "content": "Contenido"}

        # Corporate leader can create
        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["message"] == "Post creado exitosamente"
        post_data = response.data["post"]
        assert post_data["title"] == "Nuevo post"
        assert post_data["organization"] == organization.id
        assert post_data["author_info"]["email"] == corporate_client.email

        # Normal client cannot create
        api_client.force_authenticate(user=client_user)
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_create_organization_post_invalid_link_validation(self, api_client, corporate_client, organization):
        api_client.force_authenticate(user=corporate_client)
        url = reverse("create-organization-post", kwargs={"organization_id": organization.id})

        # link_name sin link_url
        data = {"title": "Post", "content": "C", "link_name": "Ver más"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "link_url" in response.data["details"][0]

        # link_url sin link_name
        data = {"title": "Post", "content": "C", "link_url": "https://example.com"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "link_name" in response.data["details"][0]

    @pytest.mark.contract
    def test_get_organization_posts_pinned_first(self, api_client, corporate_client, organization):
        """Test posts are ordered with pinned first"""
        OrganizationPost.objects.create(title="Active", content="C", organization=organization, author=corporate_client, is_active=True, is_pinned=False)
        pinned = OrganizationPost.objects.create(title="Pinned", content="C", organization=organization, author=corporate_client, is_active=True, is_pinned=True)

        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        response = api_client.get(url)
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"][0]["id"] == pinned.id

    @pytest.mark.contract
    def test_get_organization_posts_filter_inactive(self, api_client, corporate_client, organization):
        """Test filtering posts by is_active=false"""
        OrganizationPost.objects.create(title="Inactive", content="C", organization=organization, author=corporate_client, is_active=False)
        OrganizationPost.objects.create(title="Active", content="C", organization=organization, author=corporate_client, is_active=True)

        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        response = api_client.get(url, {"is_active": "false"})
        
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["title"] == "Inactive"

    @pytest.mark.contract
    def test_get_organization_posts_filter_pinned(self, api_client, corporate_client, organization):
        """Test filtering posts by is_pinned=true"""
        OrganizationPost.objects.create(title="Not pinned", content="C", organization=organization, author=corporate_client, is_pinned=False)
        OrganizationPost.objects.create(title="Pinned", content="C", organization=organization, author=corporate_client, is_pinned=True)

        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        response = api_client.get(url, {"is_pinned": "true"})
        
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["title"] == "Pinned"

    @pytest.mark.edge
    def test_get_organization_posts_requires_corporate_client(self, api_client, client_user, organization):
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        api_client.force_authenticate(user=client_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@pytest.mark.integration
class TestOrganizationPostsPublicAndDetail:
    @pytest.mark.edge
    def test_get_organization_posts_public_permissions(self, api_client, corporate_client, client_user, basic_user, organization):
        # Crear algunos posts (solo activos deben aparecer)
        OrganizationPost.objects.create(
            title="Active 1",
            content="C1",
            organization=organization,
            author=corporate_client,
            is_active=True,
        )
        OrganizationPost.objects.create(
            title="Inactive",
            content="C2",
            organization=organization,
            author=corporate_client,
            is_active=False,
        )

        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})

        # Corporate líder puede ver
        api_client.force_authenticate(user=corporate_client)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        titles = {p["title"] for p in response.data["results"]}
        assert "Active 1" in titles
        assert "Inactive" not in titles

        # Cliente miembro puede ver
        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

        # Cliente sin membresía no puede ver
        api_client.force_authenticate(user=basic_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_get_organization_post_detail_corporate_only(self, api_client, corporate_client, client_user, organization, organization_post):
        url = reverse(
            "get-organization-post-detail",
            kwargs={"organization_id": organization.id, "post_id": organization_post.id},
        )

        # Corporate líder
        api_client.force_authenticate(user=corporate_client)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["post"]["id"] == organization_post.id

        # Cliente normal no puede ver detalle
        api_client.force_authenticate(user=client_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
@pytest.mark.integration
class TestOrganizationPostsUpdateDeleteToggle:
    @pytest.mark.edge
    def test_update_organization_post_success_and_validation(self, api_client, corporate_client, client_user, organization, organization_post):
        url = reverse(
            "update-organization-post",
            kwargs={"organization_id": organization.id, "post_id": organization_post.id},
        )

        # Corporate líder puede actualizar
        api_client.force_authenticate(user=corporate_client)
        data = {"title": "Updated", "content": "New content"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        organization_post.refresh_from_db()
        assert organization_post.title == "Updated"

        # Validación de link_name/link_url
        data = {"link_name": "Ver más"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        data = {"link_url": "https://example.com"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Cliente normal no puede actualizar
        api_client.force_authenticate(user=client_user)
        response = api_client.post(url, {"title": "X"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_update_organization_post_not_found(self, api_client, corporate_client, organization):
        url = reverse(
            "update-organization-post",
            kwargs={"organization_id": organization.id, "post_id": 9999},
        )

        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, {"title": "X"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_delete_organization_post(self, api_client, corporate_client, client_user, organization, organization_post):
        url = reverse(
            "delete-organization-post",
            kwargs={"organization_id": organization.id, "post_id": organization_post.id},
        )

        # Corporate puede borrar
        api_client.force_authenticate(user=corporate_client)
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_200_OK
        assert not OrganizationPost.objects.filter(id=organization_post.id).exists()

        # Cliente normal no puede borrar
        new_post = OrganizationPost.objects.create(
            title="Post 2",
            content="C2",
            organization=organization,
            author=corporate_client,
        )
        url = reverse(
            "delete-organization-post",
            kwargs={"organization_id": organization.id, "post_id": new_post.id},
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_delete_organization_post_not_found(self, api_client, corporate_client, organization):
        url = reverse(
            "delete-organization-post",
            kwargs={"organization_id": organization.id, "post_id": 9999},
        )

        api_client.force_authenticate(user=corporate_client)
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_toggle_organization_post_pin(self, api_client, corporate_client, client_user, organization, organization_post):
        url = reverse(
            "toggle-organization-post-pin",
            kwargs={"organization_id": organization.id, "post_id": organization_post.id},
        )

        # Corporate: toggle to pinned
        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        organization_post.refresh_from_db()
        assert organization_post.is_pinned is True

        # Toggle back to unpinned
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        organization_post.refresh_from_db()
        assert organization_post.is_pinned is False

        # Cliente normal no puede togglear
        api_client.force_authenticate(user=client_user)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestOrganizationPostsRest:
    def test_rest_create_and_list_post(self, api_client, corporate_client, organization):
        """Test creating and listing organization posts"""
        api_client.force_authenticate(user=corporate_client)
        create_url = reverse("create-organization-post", kwargs={"organization_id": organization.id})

        response = api_client.post(create_url, {"title": "Post", "content": "Body"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        post_id = response.data["post"]["id"]

        list_url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        response = api_client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        assert any(item["id"] == post_id for item in response.data["results"])

    def test_rest_toggle_pin_and_status(self, api_client, corporate_client, organization):
        """Test toggling post pin and status"""
        api_client.force_authenticate(user=corporate_client)
        post = OrganizationPost.objects.create(
            organization=organization, author=corporate_client, title="Test", content="Content"
        )

        pin_url = reverse("toggle-organization-post-pin", kwargs={"organization_id": organization.id, "post_id": post.id})
        response = api_client.post(pin_url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_pinned is True

        status_url = reverse("toggle-organization-post-status", kwargs={"organization_id": organization.id, "post_id": post.id})
        response = api_client.post(status_url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_active is False

    def test_rest_delete_post(self, api_client, corporate_client, organization):
        """Test deleting organization post"""
        api_client.force_authenticate(user=corporate_client)
        post = OrganizationPost.objects.create(
            organization=organization, author=corporate_client, title="ToDelete", content="X"
        )

        delete_url = reverse("delete-organization-post", kwargs={"organization_id": organization.id, "post_id": post.id})
        response = api_client.delete(delete_url)
        assert response.status_code == status.HTTP_200_OK
        assert not OrganizationPost.objects.filter(id=post.id).exists()

    def test_rest_create_forbidden_for_client(self, api_client, client_user, organization):
        """Test client user cannot create posts"""
        api_client.force_authenticate(user=client_user)
        create_url = reverse("create-organization-post", kwargs={"organization_id": organization.id})
        response = api_client.post(create_url, {"title": "No", "content": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_rest_public_posts_permissions(self, api_client, corporate_client, client_user, basic_user, organization):
        OrganizationPost.objects.create(
            title="Active",
            content="C",
            organization=organization,
            author=corporate_client,
            is_active=True,
        )
        OrganizationPost.objects.create(
            title="Inactive",
            content="C",
            organization=organization,
            author=corporate_client,
            is_active=False,
        )

        url = reverse("get-organization-posts-public", kwargs={"organization_id": organization.id})

        api_client.force_authenticate(user=basic_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        OrganizationMembership.objects.create(
            organization=organization,
            user=client_user,
            role="MEMBER",
            is_active=True,
        )
        api_client.force_authenticate(user=client_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        titles = {item["title"] for item in response.data["results"]}
        assert "Active" in titles
        assert "Inactive" not in titles

    @pytest.mark.edge
    def test_toggle_organization_post_status_not_found(self, api_client, corporate_client, organization):
        url = reverse(
            "toggle-organization-post-status",
            kwargs={"organization_id": organization.id, "post_id": 9999},
        )

        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_toggle_organization_post_pin_not_found(self, api_client, corporate_client, organization):
        url = reverse(
            "toggle-organization-post-pin",
            kwargs={"organization_id": organization.id, "post_id": 9999},
        )

        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.edge
    def test_toggle_organization_post_status(self, api_client, corporate_client, client_user, organization, organization_post):
        url = reverse(
            "toggle-organization-post-status",
            kwargs={"organization_id": organization.id, "post_id": organization_post.id},
        )

        # Corporate: desactivar
        api_client.force_authenticate(user=corporate_client)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        organization_post.refresh_from_db()
        assert organization_post.is_active is False

        # Activar de nuevo
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        organization_post.refresh_from_db()
        assert organization_post.is_active is True

        # Cliente normal no puede togglear
        api_client.force_authenticate(user=client_user)
        response = api_client.post(url, {}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ======================================================================
# Tests migrated from test_views_batch17.py
# ======================================================================

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
@pytest.mark.django_db
def _b17_lawyer_user():
    return User.objects.create_user(email="law_b17@t.com", password="pw", role="lawyer", first_name="L", last_name="Y")

@pytest.fixture
@pytest.mark.django_db
def _b17_client_user():
    return User.objects.create_user(email="cli_b17@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
@pytest.mark.django_db
def _b17_corp_user():
    return User.objects.create_user(email="corp_b17@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Cl")

@pytest.fixture
@pytest.mark.django_db
def _b17_organization(_b17_corp_user):
    return Organization.objects.create(title="OrgB17", corporate_client=_b17_corp_user, is_active=True)

# === 1. validate_file_security ===
@pytest.mark.django_db
class TestFileValidation:
    def _mk(self, name, size=100, content=b"x"):
        f = MagicMock(); f.name=name; f.size=size; f.read=MagicMock(return_value=content); f.seek=MagicMock()
        return f

    def test_too_large(self):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="exceeds") as exc_info:
            validate_file_security(self._mk("big.pdf", size=31*1024*1024))
        assert exc_info.value is not None

    def test_bad_ext(self):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="not allowed") as exc_info:
            validate_file_security(self._mk("h.exe"))
        assert exc_info.value is not None

    @patch("gym_app.views.legal_request.magic.from_buffer", return_value="application/octet-stream")
    def test_mime_not_allowed(self, _m):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="MIME") as exc_info:
            validate_file_security(self._mk("t.pdf"))
        assert exc_info.value is not None

    @patch("gym_app.views.legal_request.magic.from_buffer", return_value="image/png")
    def test_ext_mismatch(self, _m):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="doesn't match") as exc_info:
            validate_file_security(self._mk("t.pdf"))
        assert exc_info.value is not None

    @patch("gym_app.views.legal_request.magic.from_buffer", return_value="application/zip")
    def test_docx_zip_valid(self, mock_from_buffer):
        from gym_app.views.legal_request import validate_file_security
        c = b"PK\x03\x04word/document.xml"
        f = self._mk("t.docx", content=c); f.read=MagicMock(return_value=c)
        assert validate_file_security(f) is True
        mock_from_buffer.assert_called_once()

    @patch("gym_app.views.legal_request.magic.from_buffer", side_effect=Exception("err"))
    def test_magic_exc(self, mock_from_buffer):
        from gym_app.views.legal_request import validate_file_security
        with pytest.raises(ValidationError, match="Unable") as exc_info:
            validate_file_security(self._mk("t.pdf"))
        assert exc_info.value is not None
        mock_from_buffer.assert_called_once()

# === 2. process_file_upload exception ===
@pytest.mark.django_db
class TestProcessFileUpload:
    def test_general_exception(self, client_user):
        from gym_app.views.legal_request import process_file_upload
        from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline
        from types import SimpleNamespace
        lr = LegalRequest.objects.create(
            user=client_user, request_type=LegalRequestType.objects.create(name="T17"),
            discipline=LegalDiscipline.objects.create(name="D17"), description="T", status="OPEN",
        )
        f = SimpleNamespace(name="t.pdf", size=100, read=lambda: b"%PDF", seek=lambda x: None)
        with patch("gym_app.views.legal_request.validate_file_security", side_effect=Exception("fail")) as mock_validate:
            r = process_file_upload(f, lr)
        assert r["success"] is False
        mock_validate.assert_called_once()

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
    def test_get_detail(self, api_client, _b17_corp_user, _b17_organization):
        p = OrganizationPost.objects.create(organization=_b17_organization, author=_b17_corp_user, title="D", content="C", is_active=True)
        api_client.force_authenticate(user=_b17_corp_user)
        url = reverse("get-organization-post-detail", kwargs={"organization_id": _b17_organization.id, "post_id": p.id})
        assert api_client.get(url).status_code == status.HTTP_200_OK

    def test_update(self, api_client, _b17_corp_user, _b17_organization):
        p = OrganizationPost.objects.create(organization=_b17_organization, author=_b17_corp_user, title="U", content="C", is_active=True)
        api_client.force_authenticate(user=_b17_corp_user)
        url = reverse("update-organization-post", kwargs={"organization_id": _b17_organization.id, "post_id": p.id})
        resp = api_client.put(url, {"title": "Updated"}, format="json")
        assert resp.status_code == status.HTTP_200_OK

    def test_delete(self, api_client, _b17_corp_user, _b17_organization):
        p = OrganizationPost.objects.create(organization=_b17_organization, author=_b17_corp_user, title="X", content="C", is_active=True)
        api_client.force_authenticate(user=_b17_corp_user)
        url = reverse("delete-organization-post", kwargs={"organization_id": _b17_organization.id, "post_id": p.id})
        assert api_client.delete(url).status_code == status.HTTP_200_OK

# === 5. reports user_id filters ===
@pytest.mark.django_db
class TestReportsUserFilters:
    def test_processes_by_lawyer_with_user_id(self, api_client, _b17_lawyer_user):
        api_client.force_authenticate(user=_b17_lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"report_type": "processes_by_lawyer", "user_id": _b17_lawyer_user.id, "start_date": "2024-01-01", "end_date": "2025-12-31"}, format="json")
        assert resp.status_code in (200, 400)

    def test_processes_by_client_with_user_id(self, api_client, _b17_lawyer_user, _b17_client_user):
        api_client.force_authenticate(user=_b17_lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"report_type": "processes_by_client", "user_id": _b17_client_user.id, "start_date": "2024-01-01", "end_date": "2025-12-31"}, format="json")
        assert resp.status_code in (200, 400)

    def test_lawyers_workload_with_user_id(self, api_client, _b17_lawyer_user):
        api_client.force_authenticate(user=_b17_lawyer_user)
        url = reverse("generate-excel-report")
        resp = api_client.post(url, {"report_type": "lawyers_workload", "user_id": _b17_lawyer_user.id, "start_date": "2024-01-01", "end_date": "2025-12-31"}, format="json")
        assert resp.status_code in (200, 400)

# === 6. userAuth verify_passcode User.DoesNotExist ===
@pytest.mark.django_db
class TestVerifyPasscode:
    @patch("gym_app.views.userAuth.requests.post")
    def test_valid_captcha_invalid_code(self, mock_post):
        from types import SimpleNamespace
        mock_resp = SimpleNamespace(json=lambda: {"success": True}, raise_for_status=lambda: None)
        mock_post.return_value = mock_resp
        c = APIClient()
        url = reverse("verify_passcode_and_reset_password")
        resp = c.post(
            url,
            {
                "passcode": "000000",
                "new_password": "newpw",
                "email": "client@example.com",
                "captcha_token": "tok",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid" in resp.data.get("error", "").lower()
        mock_post.assert_called_once()

    @patch("gym_app.views.userAuth.requests.post")
    def test_captcha_failure(self, mock_post):
        from types import SimpleNamespace
        mock_resp = SimpleNamespace(json=lambda: {"success": False}, raise_for_status=lambda: None)
        mock_post.return_value = mock_resp
        c = APIClient()
        url = reverse("verify_passcode_and_reset_password")
        resp = c.post(
            url,
            {
                "passcode": "000000",
                "new_password": "newpw",
                "email": "client@example.com",
                "captcha_token": "tok",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        mock_post.assert_called_once()


# ======================================================================
# Tests moved from test_user_auth.py – batch14 (organization posts domain)
# ======================================================================

@pytest.fixture
@pytest.mark.django_db
def _b14_corp_user():
    return User.objects.create_user(
        email="corp_b14@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


@pytest.fixture
@pytest.mark.django_db
def _b14_org(_b14_corp_user):
    return Organization.objects.create(
        title="Org B14", corporate_client=_b14_corp_user, is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def _b14_client():
    return User.objects.create_user(
        email="client_b14@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def _b14_membership(_b14_org, _b14_client):
    return OrganizationMembership.objects.create(
        organization=_b14_org, user=_b14_client, role="MEMBER", is_active=True,
    )


@pytest.mark.django_db
class TestOrganizationPostsAdditionalScenarios:

    def test_create_post_success(self, api_client, _b14_corp_user, _b14_org):
        """Lines 42-63: create post."""
        api_client.force_authenticate(user=_b14_corp_user)
        url = reverse("create-organization-post", kwargs={"organization_id": _b14_org.id})
        resp = api_client.post(url, {
            "title": "Test Post",
            "content": "Post content here",
        }, format="json")
        assert resp.status_code == status.HTTP_201_CREATED

    def test_create_post_missing_title(self, api_client, _b14_corp_user, _b14_org):
        """Lines 65-72: validation error on missing title."""
        api_client.force_authenticate(user=_b14_corp_user)
        url = reverse("create-organization-post", kwargs={"organization_id": _b14_org.id})
        resp = api_client.post(url, {"content": "No title"}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_posts(self, api_client, _b14_corp_user, _b14_org):
        """Lines 78-120: list posts with filters."""
        OrganizationPost.objects.create(
            organization=_b14_org, author=_b14_corp_user,
            title="P1", content="C1",
        )
        api_client.force_authenticate(user=_b14_corp_user)
        url = reverse("get-organization-posts", kwargs={"organization_id": _b14_org.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_posts_public_member(self, api_client, _b14_client, _b14_org, _b14_membership):
        """Lines 125-172: public posts for member."""
        OrganizationPost.objects.create(
            organization=_b14_org, author=_b14_org.corporate_client,
            title="Public P1", content="C1", is_active=True,
        )
        api_client.force_authenticate(user=_b14_client)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": _b14_org.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_200_OK

    def test_get_posts_public_non_member_forbidden(self, api_client, _b14_org):
        """Lines 144-147: non-member forbidden."""
        outsider = User.objects.create_user(
            email="outsider_b14@test.com", password="pw", role="client",
        )
        api_client.force_authenticate(user=outsider)
        url = reverse("get-organization-posts-public", kwargs={"organization_id": _b14_org.id})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_pin(self, api_client, _b14_corp_user, _b14_org):
        """Lines 272-294: toggle pin status."""
        post = OrganizationPost.objects.create(
            organization=_b14_org, author=_b14_corp_user,
            title="Pin Post", content="C", is_pinned=False,
        )
        api_client.force_authenticate(user=_b14_corp_user)
        url = reverse("toggle-organization-post-pin", kwargs={
            "organization_id": _b14_org.id, "post_id": post.id,
        })
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_pinned is True

    def test_toggle_status(self, api_client, _b14_corp_user, _b14_org):
        """Lines 300-327: toggle active status."""
        post = OrganizationPost.objects.create(
            organization=_b14_org, author=_b14_corp_user,
            title="Status Post", content="C", is_active=True,
        )
        api_client.force_authenticate(user=_b14_corp_user)
        url = reverse("toggle-organization-post-status", kwargs={
            "organization_id": _b14_org.id, "post_id": post.id,
        })
        resp = api_client.post(url, {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_active is False

    def test_delete_post(self, api_client, _b14_corp_user, _b14_org):
        """Lines 245-266: delete post."""
        post = OrganizationPost.objects.create(
            organization=_b14_org, author=_b14_corp_user,
            title="Del Post", content="C",
        )
        api_client.force_authenticate(user=_b14_corp_user)
        url = reverse("delete-organization-post", kwargs={
            "organization_id": _b14_org.id, "post_id": post.id,
        })
        resp = api_client.delete(url)
        assert resp.status_code == status.HTTP_200_OK
        assert not OrganizationPost.objects.filter(id=post.id).exists()
