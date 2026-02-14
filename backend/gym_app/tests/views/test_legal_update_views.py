import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from gym_app.models import LegalUpdate


User = get_user_model()
@pytest.fixture
@pytest.mark.django_db
def user():
    return User.objects.create_user(
        email="user@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def legal_update_active():
    return LegalUpdate.objects.create(
        title="Active Update",
        content="Content",
        link_text="Ver más",
        link_url="https://example.com/active",
        is_active=True,
    )


@pytest.fixture
@pytest.mark.django_db
def legal_update_inactive():
    return LegalUpdate.objects.create(
        title="Inactive Update",
        content="Content",
        link_text="Ver más",
        link_url="https://example.com/inactive",
        is_active=False,
    )


@pytest.mark.django_db
@pytest.mark.integration
class TestLegalUpdateListAndActive:
    @pytest.mark.edge
    def test_legal_update_list_requires_authentication(self, api_client):
        url = reverse("legal-updates-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.contract
    def test_legal_update_list_returns_only_active(self, api_client, user, legal_update_active, legal_update_inactive):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-list")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["title"] == "Active Update"

    @pytest.mark.contract
    def test_active_legal_updates_endpoint(self, api_client, user, legal_update_active, legal_update_inactive):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-active")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["title"] == "Active Update"


    @pytest.mark.edge
    def test_create_legal_update_invalid_payload(self, api_client, user):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-list")

        response = api_client.post(url, {"title": "Missing fields"}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "content" in response.data
        assert "link_text" in response.data
        assert "link_url" in response.data


@pytest.mark.django_db
@pytest.mark.integration
class TestLegalUpdateDetail:
    @pytest.mark.edge
    def test_legal_update_detail_not_found_when_inactive(self, api_client, user, legal_update_inactive):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-detail", kwargs={"pk": legal_update_inactive.id})

        response = api_client.get(url)

        # Detail view filtra por is_active=True
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.contract
    def test_get_legal_update_detail_success(self, api_client, user, legal_update_active):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-detail", kwargs={"pk": legal_update_active.id})

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == legal_update_active.id
        assert response.data["title"] == legal_update_active.title

    @pytest.mark.contract
    def test_update_legal_update_success(self, api_client, user, legal_update_active):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-detail", kwargs={"pk": legal_update_active.id})
        data = {
            "title": "Updated Title",
            "content": legal_update_active.content,
            "link_text": legal_update_active.link_text,
            "link_url": legal_update_active.link_url,
        }

        response = api_client.put(url, data, format="json")

        assert response.status_code == status.HTTP_200_OK
        legal_update_active.refresh_from_db()
        assert legal_update_active.title == "Updated Title"

    @pytest.mark.contract
    def test_delete_legal_update_marks_inactive(self, api_client, user, legal_update_active):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-detail", kwargs={"pk": legal_update_active.id})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        legal_update_active.refresh_from_db()
        assert legal_update_active.is_active is False

    @pytest.mark.contract
    def test_create_legal_update_via_list_endpoint(self, api_client, user):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-list")
        data = {
            "title": "New Update",
            "content": "Contenido",
            "link_text": "Ver más",
            "link_url": "https://example.com/new",
        }

        response = api_client.post(url, data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert LegalUpdate.objects.filter(title="New Update").exists()


@pytest.mark.django_db
class TestLegalUpdateValidation:
    def test_update_legal_update_invalid_data(self, api_client, user, legal_update_active):
        """Line 46: PUT with invalid data returns serializer errors (400)."""
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-detail", kwargs={"pk": legal_update_active.id})
        data = {
            "title": "",
            "content": "",
            "link_text": "",
            "link_url": "not-a-url",
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert isinstance(response.data, dict)


@pytest.mark.django_db
class TestLegalUpdateRest:
    def test_legal_update_list_create_and_active_rest(self, api_client, user, legal_update_active, legal_update_inactive):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-list")

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["id"] == legal_update_active.id

        active_url = reverse("legal-updates-active")
        response = api_client.get(active_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["id"] == legal_update_active.id

        payload = {
            "title": "Rest Update",
            "content": "Contenido",
            "link_text": "Ver más",
            "link_url": "https://example.com/rest",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert LegalUpdate.objects.filter(title="Rest Update").exists()

    def test_legal_update_detail_update_delete_rest(self, api_client, user, legal_update_active):
        api_client.force_authenticate(user=user)
        url = reverse("legal-updates-detail", kwargs={"pk": legal_update_active.id})

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK

        payload = {
            "title": "Updated via Rest",
            "content": legal_update_active.content,
            "link_text": legal_update_active.link_text,
            "link_url": legal_update_active.link_url,
        }
        response = api_client.put(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        legal_update_active.refresh_from_db()
        assert legal_update_active.title == "Updated via Rest"

        response = api_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        legal_update_active.refresh_from_db()
        assert legal_update_active.is_active is False
