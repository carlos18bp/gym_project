import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from gym_app.models import LegalUpdate
from gym_app.serializers.legal_update import LegalUpdateSerializer


@pytest.mark.django_db
class TestLegalUpdateSerializer:
    def test_serialize_legal_update_basic_fields(self):
        """Test basic field serialization."""
        image = SimpleUploadedFile(
            "update.jpg",
            b"image-bytes",
            content_type="image/jpeg",
        )
        update = LegalUpdate.objects.create(
            title="Nueva norma",
            content="Contenido",
            image=image,
            link_text="Ver más",
            link_url="https://example.com/norma",
            is_active=True,
        )

        serializer = LegalUpdateSerializer(update)
        data = serializer.data

        assert data["id"] == update.id
        assert data["title"] == update.title
        assert data["content"] == update.content
        assert data["link_text"] == update.link_text
        assert data["link_url"] == update.link_url
        assert data["is_active"] is True

    def test_serialize_legal_update_image_url_with_request(self):
        """Debe construir image_url absoluta cuando hay request en contexto."""
        image = SimpleUploadedFile(
            "update2.jpg",
            b"image-bytes",
            content_type="image/jpeg",
        )
        update = LegalUpdate.objects.create(
            title="Otra norma",
            content="Contenido",
            image=image,
            is_active=True,
        )

        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = LegalUpdateSerializer(update, context={"request": MockRequest()})
        data = serializer.data

        assert data["image_url"].startswith("http://testserver")
        assert "update" in data["image_url"]

    def test_serialize_legal_update_without_request(self):
        """Sin request, image_url debe ser relativa y sin http://."""
        image = SimpleUploadedFile(
            "update2.jpg",
            b"image-bytes",
            content_type="image/jpeg",
        )
        update = LegalUpdate.objects.create(
            title="Otra norma",
            content="Contenido",
            image=image,
            link_text="Ver más",
            link_url="https://example.com/otra",
            is_active=False,
        )

        serializer = LegalUpdateSerializer(update)
        data = serializer.data

        assert not data["image_url"].startswith("http://")
        assert "update2" in data["image_url"]

    def test_serialize_legal_update_without_image(self):
        """Sin imagen, image_url debe ser None."""
        update = LegalUpdate.objects.create(
            title="Sin imagen",
            content="Contenido",
            link_text="Ver más",
            link_url="https://example.com/sin",
            is_active=True,
        )

        serializer = LegalUpdateSerializer(update)
        data = serializer.data

        assert data["image"] is None
        assert data["image_url"] is None
