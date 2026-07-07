"""Tests for minuta ownership rules (allow_shared_edit flag).

Minutas (Draft/Published templates) are visible to all lawyers, but only the
creator may modify/delete/change-state them — unless the creator enables
``allow_shared_edit``, which grants other lawyers content-editing rights
(title/content/variables) while state, the flag itself, and permissions stay
creator-only.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from gym_app.models import DocumentVariable, DynamicDocument, User
from gym_app.views.dynamic_documents.permissions import can_modify_minuta

pytestmark = pytest.mark.django_db


@pytest.fixture
def creator_lawyer():
    """Lawyer who creates the minuta."""
    return User.objects.create_user(
        email='creator_lawyer@test.com',
        password='testpassword',
        first_name='Creator',
        last_name='Lawyer',
        role='lawyer',
        is_gym_lawyer=True,
    )


@pytest.fixture
def other_lawyer():
    """Create a different lawyer (non-creator)."""
    return User.objects.create_user(
        email='other_lawyer@test.com',
        password='testpassword',
        first_name='Other',
        last_name='Lawyer',
        role='lawyer',
        is_gym_lawyer=True,
    )


@pytest.fixture
def admin_user():
    """Admin role user (administrative override)."""
    return User.objects.create_user(
        email='admin_minuta@test.com',
        password='testpassword',
        role='admin',
    )


@pytest.fixture
def private_minuta(creator_lawyer):
    """Draft minuta with shared edit explicitly disabled by its creator."""
    document = DynamicDocument.objects.create(
        title='Minuta Privada',
        content='<p>Contenido {{var_uno}}</p>',
        state='Draft',
        created_by=creator_lawyer,
        allow_shared_edit=False,
    )
    DocumentVariable.objects.create(document=document, name_en='var_uno', value='v1')
    return document


@pytest.fixture
def shared_minuta(creator_lawyer):
    """Create a published minuta with shared edit enabled."""
    return DynamicDocument.objects.create(
        title='Minuta Compartida',
        content='<p>Contenido compartido</p>',
        state='Published',
        created_by=creator_lawyer,
        allow_shared_edit=True,
    )


class TestMinutaUpdateOwnership:
    """PUT/PATCH enforcement on minutas."""

    @pytest.mark.integration
    def test_non_creator_lawyer_cannot_update_private_minuta(self, api_client, other_lawyer, private_minuta):
        """Non creator lawyer cannot update private minuta."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': private_minuta.pk})
        response = api_client.patch(url, {'title': 'Hackeada'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.integration
    def test_creator_can_update_own_private_minuta(self, api_client, creator_lawyer, private_minuta):
        """Creator can update own private minuta."""
        api_client.force_authenticate(user=creator_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': private_minuta.pk})
        response = api_client.patch(url, {'title': 'Renombrada'}, format='json')
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    def test_admin_can_update_any_minuta(self, api_client, admin_user, private_minuta):
        """Admin can update any minuta."""
        api_client.force_authenticate(user=admin_user)
        url = reverse('update_dynamic_document', kwargs={'pk': private_minuta.pk})
        response = api_client.patch(url, {'title': 'Ajustada por admin'}, format='json')
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    def test_non_creator_lawyer_can_edit_shared_minuta_content(self, api_client, other_lawyer, shared_minuta):
        """Non creator lawyer can edit shared minuta content."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': shared_minuta.pk})
        response = api_client.patch(
            url, {'title': 'Colaborada', 'content': '<p>Mejorada</p>'}, format='json'
        )
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.integration
    def test_non_creator_lawyer_cannot_change_state_of_shared_minuta(self, api_client, other_lawyer, shared_minuta):
        """Non creator lawyer cannot change state of shared minuta."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': shared_minuta.pk})
        response = api_client.patch(url, {'state': 'Draft'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.integration
    def test_non_creator_lawyer_cannot_toggle_shared_flag(self, api_client, other_lawyer, shared_minuta):
        """Non creator lawyer cannot toggle shared flag."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': shared_minuta.pk})
        response = api_client.patch(url, {'allow_shared_edit': False}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.integration
    def test_non_creator_lawyer_can_update_progress_document(self, api_client, other_lawyer, creator_lawyer):
        """Non creator lawyer can update progress document."""
        document = DynamicDocument.objects.create(
            title='Doc en progreso',
            content='<p>Contenido</p>',
            state='Progress',
            created_by=creator_lawyer,
        )
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': document.pk})
        response = api_client.patch(url, {'title': 'Actualizado'}, format='json')
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.edge
    def test_client_cannot_update_published_unassigned_template(self, api_client, client_user, shared_minuta):
        """Client cannot update published unassigned template."""
        shared_minuta.allow_shared_edit = False
        shared_minuta.save()
        api_client.force_authenticate(user=client_user)
        url = reverse('update_dynamic_document', kwargs={'pk': shared_minuta.pk})
        response = api_client.patch(url, {'title': 'Cliente edita'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.edge
    def test_client_cannot_edit_shared_minuta(self, api_client, client_user, shared_minuta):
        """Client cannot edit shared minuta."""
        # The shared-edit grant is lawyer-only: a client must not edit a
        # minuta even when allow_shared_edit is enabled (the default).
        api_client.force_authenticate(user=client_user)
        url = reverse('update_dynamic_document', kwargs={'pk': shared_minuta.pk})
        response = api_client.patch(url, {'title': 'Cliente edita'}, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestMinutaDeleteOwnership:
    """DELETE enforcement on minutas."""

    @pytest.mark.integration
    def test_non_creator_lawyer_cannot_delete_private_minuta(self, api_client, other_lawyer, private_minuta):
        """Non creator lawyer cannot delete private minuta."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('delete_dynamic_document', kwargs={'pk': private_minuta.pk})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.integration
    def test_non_creator_lawyer_cannot_delete_shared_minuta(self, api_client, other_lawyer, shared_minuta):
        """Non creator lawyer cannot delete shared minuta."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('delete_dynamic_document', kwargs={'pk': shared_minuta.pk})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.integration
    def test_creator_can_delete_own_minuta(self, api_client, creator_lawyer, private_minuta):
        """Creator can delete own minuta."""
        api_client.force_authenticate(user=creator_lawyer)
        url = reverse('delete_dynamic_document', kwargs={'pk': private_minuta.pk})
        response = api_client.delete(url)
        assert response.status_code == status.HTTP_200_OK


class TestManagerRights:
    """The managing lawyer (post-reassignment) gets full minuta rights."""

    @pytest.mark.integration
    def test_manager_can_modify_transferred_minuta(self, other_lawyer, private_minuta):
        # Simulate a reassignment: other_lawyer now manages a minuta they
        # did not create; created_by stays untouched.
        private_minuta.managed_by = other_lawyer
        private_minuta.save(update_fields=['managed_by'])
        assert can_modify_minuta(private_minuta, other_lawyer, {'state': 'Published'}) is True

    @pytest.mark.integration
    def test_manager_can_delete_transferred_minuta(self, api_client, other_lawyer, private_minuta):
        private_minuta.managed_by = other_lawyer
        private_minuta.save(update_fields=['managed_by'])
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('delete_dynamic_document', args=[private_minuta.id])
        response = api_client.delete(url)
        assert response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT)
        assert not DynamicDocument.objects.filter(id=private_minuta.id).exists()

    @pytest.mark.edge
    def test_unrelated_lawyer_without_share_still_denied(self, other_lawyer, private_minuta):
        # Not creator, not manager, shared edit off → denied.
        assert can_modify_minuta(private_minuta, other_lawyer, {'title': 'x'}) is False


class TestManagedByListScope:
    """The `lawyer_id` list param scopes by the current manager."""

    @pytest.mark.integration
    def test_lawyer_id_filters_by_manager_not_creator(
        self, api_client, creator_lawyer, other_lawyer
    ):
        doc = DynamicDocument.objects.create(
            title='Doc gestionado por otro',
            content='<p>x</p>',
            state='Progress',
            created_by=creator_lawyer,
            managed_by=other_lawyer,
        )
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('list_dynamic_documents')

        managed = api_client.get(url, {'lawyer_id': other_lawyer.id})
        assert doc.id in [d['id'] for d in managed.data['items']]

        by_creator = api_client.get(url, {'lawyer_id': creator_lawyer.id})
        assert doc.id not in [d['id'] for d in by_creator.data['items']]


class TestSharedFilter:
    """`shared=true` list param scopes to flagged minutas."""

    @pytest.mark.integration
    def test_shared_param_returns_only_flagged_minutas(self, api_client, other_lawyer, private_minuta, shared_minuta):
        """Shared param returns only flagged minutas."""
        api_client.force_authenticate(user=other_lawyer)
        url = reverse('list_dynamic_documents')
        response = api_client.get(url, {'shared': 'true'})
        assert response.status_code == status.HTTP_200_OK
        titles = [doc['title'] for doc in response.data['items']]
        assert 'Minuta Compartida' in titles
        assert 'Minuta Privada' not in titles


class TestUpdateResponseFreshVariables:
    """Bug regression: PUT/PATCH response must reflect the NEW variables."""

    @pytest.mark.contract
    def test_update_response_contains_new_variables(self, api_client, creator_lawyer, private_minuta):
        """Update response contains new variables."""
        api_client.force_authenticate(user=creator_lawyer)
        url = reverse('update_dynamic_document', kwargs={'pk': private_minuta.pk})
        payload = {
            'content': '<p>Contenido {{var_uno}} y {{var_nueva}}</p>',
            'variables': [
                {'name_en': 'var_uno', 'name_es': 'var uno', 'field_type': 'input', 'value': 'v1'},
                {'name_en': 'var_nueva', 'name_es': 'var nueva', 'field_type': 'input', 'value': ''},
            ],
        }
        response = api_client.patch(url, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        names = [var['name_en'] for var in response.data['variables']]
        assert 'var_nueva' in names

    @pytest.mark.contract
    def test_serializer_exposes_allow_shared_edit(self, api_client, creator_lawyer, shared_minuta):
        """Serializer exposes allow shared edit."""
        api_client.force_authenticate(user=creator_lawyer)
        url = reverse('list_dynamic_documents')
        response = api_client.get(url, {'shared': 'true'})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['items'][0]['allow_shared_edit'] is True


class TestCanModifyMinutaUnit:
    """Unit coverage of the can_modify_minuta policy branches."""

    @pytest.mark.edge
    def test_creator_always_allowed(self, creator_lawyer, private_minuta):
        """Creator always allowed."""
        assert can_modify_minuta(private_minuta, creator_lawyer) is True

    @pytest.mark.edge
    def test_assigned_user_allowed(self, other_lawyer, private_minuta):
        """Assigned user allowed."""
        private_minuta.assigned_to = other_lawyer
        assert can_modify_minuta(private_minuta, other_lawyer) is True

    @pytest.mark.edge
    def test_other_lawyer_denied_without_flag(self, other_lawyer, private_minuta):
        """Other lawyer denied without flag."""
        assert can_modify_minuta(private_minuta, other_lawyer, {'title': 'x'}) is False

    @pytest.mark.edge
    def test_other_lawyer_allowed_with_flag_and_clean_payload(self, other_lawyer, shared_minuta):
        """Other lawyer allowed with flag and clean payload."""
        assert can_modify_minuta(shared_minuta, other_lawyer, {'title': 'x'}) is True

    @pytest.mark.edge
    def test_other_lawyer_denied_with_flag_and_state_payload(self, other_lawyer, shared_minuta):
        """Other lawyer denied with flag and state payload."""
        assert can_modify_minuta(shared_minuta, other_lawyer, {'state': 'Draft'}) is False

    @pytest.mark.edge
    def test_flag_does_not_grant_delete(self, other_lawyer, shared_minuta):
        """Flag does not grant delete."""
        assert can_modify_minuta(shared_minuta, other_lawyer) is False

    @pytest.mark.edge
    def test_non_minuta_state_unrestricted(self, other_lawyer, creator_lawyer):
        """Non minuta state unrestricted."""
        document = DynamicDocument.objects.create(
            title='Doc completado',
            content='<p>x</p>',
            state='Completed',
            created_by=creator_lawyer,
        )
        assert can_modify_minuta(document, other_lawyer, {'state': 'Progress'}) is True

    @pytest.mark.edge
    def test_new_minutas_default_to_shared(self, creator_lawyer):
        """New minutas default to shared."""
        document = DynamicDocument.objects.create(
            title='Minuta nueva',
            content='<p>x</p>',
            state='Draft',
            created_by=creator_lawyer,
        )
        assert document.allow_shared_edit is True
