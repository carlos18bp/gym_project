import pytest
from django.utils import timezone

from gym_app.models.legal_update import LegalUpdate


@pytest.mark.django_db
class TestLegalUpdate:
    """Tests for the LegalUpdate model."""

    def test_create_legal_update_with_title(self):
        """Create a legal update with title and verify fields and __str__."""
        update = LegalUpdate.objects.create(
            title="Nueva norma tributaria",
            content="Contenido de la actualización legal.",
            image=None,
            link_text="Ver más",
            link_url="https://example.com/norma",
        )

        assert update.id is not None
        assert update.title == "Nueva norma tributaria"
        assert update.content == "Contenido de la actualización legal."
        assert update.link_text == "Ver más"
        assert update.link_url == "https://example.com/norma"
        # __str__ usa el título cuando existe
        assert str(update) == "Nueva norma tributaria"

    def test_legal_update_str_uses_fallback_when_no_title(self):
        """Cuando no hay título, __str__ debe usar el fallback con la fecha."""
        update = LegalUpdate.objects.create(
            title=None,
            content="Sin título explícito",
            image=None,
            link_text="Ver más",
            link_url="https://example.com/norma",
        )

        s = str(update)
        # Debe comenzar con el prefijo definido en el modelo
        assert s.startswith("Legal Update - ")

    def test_legal_update_ordering_by_created_at_desc(self):
        """Las instancias deben ordenarse por created_at descendente (más reciente primero)."""
        older = LegalUpdate.objects.create(
            title="Antigua",
            content="Old",
            link_text="Old",
            link_url="https://example.com/old",
        )
        # Ajustamos manualmente created_at para simular diferencia temporal
        older.created_at = timezone.now() - timezone.timedelta(days=1)
        older.save(update_fields=["created_at"])

        newer = LegalUpdate.objects.create(
            title="Nueva",
            content="New",
            link_text="New",
            link_url="https://example.com/new",
        )

        updates = list(LegalUpdate.objects.all())
        assert updates[0] == newer
        assert updates[1] == older
