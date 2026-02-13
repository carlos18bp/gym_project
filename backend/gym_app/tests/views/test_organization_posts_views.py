import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import Organization, OrganizationPost, OrganizationMembership


User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def api_client():
    return APIClient()


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
    def test_get_organization_posts_filters_and_ordering(self, api_client, corporate_client, organization):
        # Crear posts con combinaciones de activo/pinned
        OrganizationPost.objects.create(
            title="Old inactive",
            content="C1",
            organization=organization,
            author=corporate_client,
            is_active=False,
            is_pinned=False,
        )
        pinned = OrganizationPost.objects.create(
            title="Pinned active",
            content="C2",
            organization=organization,
            author=corporate_client,
            is_active=True,
            is_pinned=True,
        )
        active = OrganizationPost.objects.create(
            title="Active",
            content="C3",
            organization=organization,
            author=corporate_client,
            is_active=True,
            is_pinned=False,
        )

        api_client.force_authenticate(user=corporate_client)
        url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})

        # Sin filtros: pinned primero
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data["results"]
        assert results[0]["id"] == pinned.id

        # Filtro is_active=false
        response = api_client.get(url, {"is_active": "false"})
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["title"] == "Old inactive"

        # Filtro is_pinned=true
        response = api_client.get(url, {"is_pinned": "true"})
        results = response.data["results"]
        assert len(results) == 1
        assert results[0]["title"] == "Pinned active"

        # Búsqueda por texto
        response = api_client.get(url, {"search": "Active"})
        titles = {p["title"] for p in response.data["results"]}
        assert {"Pinned active", "Active"}.issubset(titles)

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
    def test_rest_create_list_toggle_delete(self, api_client, corporate_client, client_user, organization):
        api_client.force_authenticate(user=corporate_client)
        create_url = reverse("create-organization-post", kwargs={"organization_id": organization.id})

        response = api_client.post(create_url, {"title": "Post", "content": "Body"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        post_id = response.data["post"]["id"]

        list_url = reverse("get-organization-posts", kwargs={"organization_id": organization.id})
        response = api_client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        assert any(item["id"] == post_id for item in response.data["results"])

        pin_url = reverse(
            "toggle-organization-post-pin",
            kwargs={"organization_id": organization.id, "post_id": post_id},
        )
        response = api_client.post(pin_url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        post = OrganizationPost.objects.get(id=post_id)
        assert post.is_pinned is True

        status_url = reverse(
            "toggle-organization-post-status",
            kwargs={"organization_id": organization.id, "post_id": post_id},
        )
        response = api_client.post(status_url, {}, format="json")
        assert response.status_code == status.HTTP_200_OK
        post.refresh_from_db()
        assert post.is_active is False

        api_client.force_authenticate(user=client_user)
        response = api_client.post(create_url, {"title": "No", "content": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

        api_client.force_authenticate(user=corporate_client)
        delete_url = reverse(
            "delete-organization-post",
            kwargs={"organization_id": organization.id, "post_id": post_id},
        )
        response = api_client.delete(delete_url)
        assert response.status_code == status.HTTP_200_OK
        assert not OrganizationPost.objects.filter(id=post_id).exists()

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
