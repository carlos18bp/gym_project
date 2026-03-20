"""Tests for SECOP views module."""
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status

from gym_app.models import (
    ProcessClassification,
    SavedView,
    SECOPAlert,
    SECOPProcess,
    SyncLog,
    User,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
@pytest.mark.django_db
def lawyer(api_client):
    """Create authenticated lawyer user."""
    user = User.objects.create_user(
        email='secop_view_lawyer@test.com',
        password='testpassword',
        first_name='View',
        last_name='Lawyer',
        role='lawyer',
        is_gym_lawyer=True,
    )
    api_client.force_authenticate(user=user)
    return user


@pytest.fixture
@pytest.mark.django_db
def other_lawyer():
    """Another lawyer user (not authenticated by default)."""
    return User.objects.create_user(
        email='secop_view_other@test.com',
        password='testpassword',
        first_name='Other',
        last_name='ViewLawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    """Client user (non-lawyer)."""
    return User.objects.create_user(
        email='secop_view_client@test.com',
        password='testpassword',
        first_name='Client',
        last_name='User',
        role='client',
    )


@pytest.fixture
@pytest.mark.django_db
def process_open():
    """Open SECOP process."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.VIEW001',
        reference='SA-VIEW-001',
        entity_name='Ministerio de Transporte',
        department='Bogotá D.C.',
        city='Bogotá D.C.',
        status='Abierto',
        procurement_method='Licitación pública',
        contract_type='Obra',
        base_price=Decimal('500000000'),
        description='Construcción de vía terciaria en Bogotá',
        procedure_name='Obra vial Bogotá',
        publication_date='2026-03-01',
        closing_date=timezone.now() + timezone.timedelta(days=30),
        unspsc_code='72101500',
    )


@pytest.fixture
@pytest.mark.django_db
def process_closed():
    """Create closed SECOP process."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.VIEW002',
        reference='SA-VIEW-002',
        entity_name='INVIAS',
        department='Antioquia',
        city='Medellín',
        status='Cerrado',
        procurement_method='Concurso de méritos',
        contract_type='Consultoría',
        base_price=Decimal('100000000'),
        description='Consultoría ambiental en Antioquia',
        procedure_name='Consultoría ambiental',
        publication_date='2026-02-01',
        closing_date=timezone.now() - timezone.timedelta(days=10),
        unspsc_code='81101500',
    )


# ---------------------------------------------------------------------------
# Process endpoints
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopProcessViews:
    """Tests for SECOP process list and detail views."""

    @pytest.mark.edge
    def test_process_list_requires_auth(self, api_client):
        """Verify unauthenticated request returns 401."""
        url = reverse('secop-process-list')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.contract
    def test_process_list_returns_paginated_results(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify list endpoint returns paginated response with correct shape."""
        url = reverse('secop-process-list')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
        assert 'count' in response.data
        assert 'total_pages' in response.data
        assert 'current_page' in response.data
        assert response.data['count'] == 2

    def test_process_list_filters_by_department(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify department filter returns matching processes only."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'department': 'Bogotá D.C.'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['department'] == 'Bogotá D.C.'

    def test_process_list_search_in_description(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify search filters across description, procedure_name, entity_name."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'search': 'ambiental'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert 'ambiental' in response.data['results'][0]['description'].lower()

    def test_process_list_filters_by_entity_name(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify entity_name filter returns matching processes only."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'entity_name': 'Ministerio de Transporte'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['entity_name'] == 'Ministerio de Transporte'

    def test_process_list_filters_by_unspsc_code(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify unspsc_code filter returns matching processes only."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'unspsc_code': '72101500'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['unspsc_code'] == '72101500'

    def test_process_list_filters_by_unspsc_code_partial_match(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify unspsc_code filter supports partial (icontains) match."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'unspsc_code': '7210'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert '7210' in response.data['results'][0]['unspsc_code']

    def test_process_list_respects_page_size(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify page_size parameter controls number of results per page."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'page_size': 1})

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['count'] == 2
        assert response.data['total_pages'] == 2

    def test_process_list_ordering_by_base_price(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify ordering by base_price ascending."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'ordering': 'base_price'})

        assert response.status_code == status.HTTP_200_OK
        prices = [
            Decimal(str(r['base_price']))
            for r in response.data['results']
        ]
        assert prices == sorted(prices)

    @pytest.mark.contract
    def test_process_detail_returns_full_data(
        self, api_client, lawyer, process_open
    ):
        """Verify detail endpoint returns all expected fields."""
        url = reverse('secop-process-detail', kwargs={'pk': process_open.pk})

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['process_id'] == 'CO1.REQ.VIEW001'
        assert 'classifications' in response.data
        assert 'is_open' in response.data

    @pytest.mark.edge
    def test_process_detail_not_found(self, api_client, lawyer):
        """Verify 404 for non-existent process."""
        url = reverse('secop-process-detail', kwargs={'pk': 99999})

        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_my_classified_returns_only_user_processes(
        self, api_client, lawyer, other_lawyer, process_open, process_closed
    ):
        """Verify my-classified returns only processes classified by current user."""
        ProcessClassification.objects.create(
            process=process_open, user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )
        ProcessClassification.objects.create(
            process=process_closed, user=other_lawyer,
            status=ProcessClassification.Status.APPLIED,
        )

        url = reverse('secop-my-classified')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['process_id'] == 'CO1.REQ.VIEW001'


# ---------------------------------------------------------------------------
# Classification endpoints
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopClassificationViews:
    """Tests for SECOP classification CRUD views."""

    def test_create_classification_returns_201(
        self, api_client, lawyer, process_open
    ):
        """Verify successful classification creation."""
        url = reverse('secop-create-classification')

        response = api_client.post(url, {
            'process': process_open.pk,
            'status': 'INTERESTING',
            'notes': 'Looks good',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['status'] == 'INTERESTING'

    @pytest.mark.edge
    def test_create_classification_invalid_data_returns_400(
        self, api_client, lawyer
    ):
        """Verify 400 when required fields are missing."""
        url = reverse('secop-create-classification')

        response = api_client.post(url, {}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_classification_own_returns_204(
        self, api_client, lawyer, process_open
    ):
        """Verify user can delete their own classification."""
        classification = ProcessClassification.objects.create(
            process=process_open, user=lawyer,
        )
        url = reverse('secop-delete-classification', kwargs={'pk': classification.pk})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ProcessClassification.objects.filter(pk=classification.pk).exists()

    @pytest.mark.edge
    def test_delete_other_user_classification_returns_404(
        self, api_client, lawyer, other_lawyer, process_open
    ):
        """Verify user cannot delete another user's classification."""
        classification = ProcessClassification.objects.create(
            process=process_open, user=other_lawyer,
        )
        url = reverse('secop-delete-classification', kwargs={'pk': classification.pk})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert ProcessClassification.objects.filter(pk=classification.pk).exists()

    def test_create_classification_upserts_on_duplicate(
        self, api_client, lawyer, process_open
    ):
        """Verify creating classification for same process updates existing."""
        ProcessClassification.objects.create(
            process=process_open, user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )
        url = reverse('secop-create-classification')

        response = api_client.post(url, {
            'process': process_open.pk,
            'status': 'APPLIED',
            'notes': 'Updated',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert ProcessClassification.objects.filter(
            process=process_open, user=lawyer
        ).count() == 1


# ---------------------------------------------------------------------------
# Alert endpoints
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopAlertViews:
    """Tests for SECOP alert CRUD views."""

    def test_alert_list_returns_only_user_alerts(
        self, api_client, lawyer, other_lawyer
    ):
        """Verify alert list returns only current user's alerts."""
        SECOPAlert.objects.create(user=lawyer, name='My Alert')
        SECOPAlert.objects.create(user=other_lawyer, name='Other Alert')

        url = reverse('secop-alerts-list-create')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'My Alert'

    def test_create_alert_returns_201(self, api_client, lawyer):
        """Verify successful alert creation."""
        url = reverse('secop-alerts-list-create')

        response = api_client.post(url, {
            'name': 'New Alert',
            'keywords': 'consultoría',
            'frequency': 'DAILY',
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Alert'

    @pytest.mark.edge
    def test_create_alert_invalid_returns_400(self, api_client, lawyer):
        """Verify 400 when name is missing."""
        url = reverse('secop-alerts-list-create')

        response = api_client.post(url, {
            'keywords': 'test',
        }, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_alert_returns_200(self, api_client, lawyer):
        """Verify alert can be updated."""
        alert = SECOPAlert.objects.create(
            user=lawyer, name='Old Name', keywords='old',
        )
        url = reverse('secop-alert-update-delete', kwargs={'pk': alert.pk})

        response = api_client.put(url, {
            'name': 'Updated Name',
            'keywords': 'new',
            'frequency': 'WEEKLY',
        }, format='json')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Updated Name'

    def test_delete_alert_returns_204(self, api_client, lawyer):
        """Verify alert can be deleted."""
        alert = SECOPAlert.objects.create(user=lawyer, name='Delete Me')
        url = reverse('secop-alert-update-delete', kwargs={'pk': alert.pk})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not SECOPAlert.objects.filter(pk=alert.pk).exists()

    def test_toggle_alert_flips_is_active(self, api_client, lawyer):
        """Verify toggle flips is_active from True to False."""
        alert = SECOPAlert.objects.create(
            user=lawyer, name='Toggle Alert', is_active=True,
        )
        url = reverse('secop-alert-toggle', kwargs={'pk': alert.pk})

        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_active'] is False

    @pytest.mark.edge
    def test_alert_not_found_returns_404(self, api_client, lawyer):
        """Verify 404 for non-existent alert."""
        url = reverse('secop-alert-update-delete', kwargs={'pk': 99999})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Saved views endpoints
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopSavedViewViews:
    """Tests for SECOP saved view CRUD views."""

    def test_saved_views_list_returns_user_views(
        self, api_client, lawyer, other_lawyer
    ):
        """Verify list returns only current user's saved views."""
        SavedView.objects.create(
            user=lawyer, name='My View',
            filters={'department': 'Bogotá D.C.'},
        )
        SavedView.objects.create(
            user=other_lawyer, name='Other View',
            filters={'department': 'Antioquia'},
        )

        url = reverse('secop-saved-views')
        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]['name'] == 'My View'

    def test_create_saved_view_returns_201(self, api_client, lawyer):
        """Verify successful saved view creation."""
        url = reverse('secop-saved-views')

        response = api_client.post(url, {
            'name': 'New View',
            'filters': {'status': 'Abierto'},
        }, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New View'

    def test_delete_saved_view_returns_204(self, api_client, lawyer):
        """Verify saved view can be deleted."""
        view = SavedView.objects.create(
            user=lawyer, name='Delete View',
            filters={'department': 'Bogotá D.C.'},
        )
        url = reverse('secop-delete-saved-view', kwargs={'pk': view.pk})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT

    @pytest.mark.edge
    def test_delete_other_user_saved_view_returns_404(
        self, api_client, lawyer, other_lawyer
    ):
        """Verify user cannot delete another user's saved view."""
        view = SavedView.objects.create(
            user=other_lawyer, name='Other View',
            filters={'department': 'Antioquia'},
        )
        url = reverse('secop-delete-saved-view', kwargs={'pk': view.pk})

        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Filters, Sync, Export endpoints
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopFiltersAndSyncViews:
    """Tests for SECOP filters, sync status, and export views."""

    def test_available_filters_returns_expected_keys(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify filters endpoint returns all expected filter keys."""
        url = reverse('secop-available-filters')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'departments' in response.data
        assert 'procurement_methods' in response.data
        assert 'entity_names' in response.data
        assert 'unspsc_codes' in response.data

    def test_available_filters_contains_distinct_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify filters endpoint returns correct distinct values from fixtures."""
        url = reverse('secop-available-filters')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'Bogotá D.C.' in response.data['departments']
        assert 'Antioquia' in response.data['departments']
        assert 'Ministerio de Transporte' in response.data['entity_names']
        assert 'INVIAS' in response.data['entity_names']
        assert '72101500' in response.data['unspsc_codes']
        assert '81101500' in response.data['unspsc_codes']

    @freeze_time('2026-03-15 12:00:00')
    def test_sync_status_returns_recent_logs(self, api_client, lawyer):
        """Verify sync status returns last_success and recent logs."""
        SyncLog.objects.create(
            status=SyncLog.Status.SUCCESS,
            finished_at=timezone.now(),
            records_processed=50,
        )
        url = reverse('secop-sync-status')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'last_success' in response.data
        assert 'recent' in response.data
        assert 'total_processes' in response.data

    @pytest.mark.edge
    def test_trigger_sync_forbidden_for_non_lawyer(
        self, api_client, client_user
    ):
        """Verify non-lawyer cannot trigger sync."""
        api_client.force_authenticate(user=client_user)
        url = reverse('secop-trigger-sync')

        response = api_client.post(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @patch('gym_app.secop_tasks.sync_secop_data')
    def test_trigger_sync_allowed_for_lawyer(
        self, mock_task, api_client, lawyer
    ):
        """Verify lawyer can trigger sync."""
        mock_task.schedule.return_value = None
        url = reverse('secop-trigger-sync')

        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'triggered' in response.data['detail'].lower()

    def test_export_excel_returns_xlsx_content_type(
        self, api_client, lawyer, process_open
    ):
        """Verify export returns Excel file with correct content type."""
        url = reverse('secop-export-excel')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'spreadsheet' in response['Content-Type']

    def test_export_excel_applies_filters(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify export respects department filter."""
        url = reverse('secop-export-excel')

        response = api_client.get(url, {'department': 'Antioquia'})

        assert response.status_code == status.HTTP_200_OK
        assert 'spreadsheet' in response['Content-Type']

    def test_my_classified_filters_by_classification_status(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify my-classified endpoint filters by classification_status param."""
        ProcessClassification.objects.create(
            process=process_open, user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )
        ProcessClassification.objects.create(
            process=process_closed, user=lawyer,
            status=ProcessClassification.Status.DISCARDED,
        )
        url = reverse('secop-my-classified')

        response = api_client.get(url, {'classification_status': 'INTERESTING'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['process_id'] == 'CO1.REQ.VIEW001'
