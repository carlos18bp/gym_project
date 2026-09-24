"""Tests for SECOP views module."""
from datetime import datetime
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.db import connection
from django.db.models.signals import post_init
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status

from gym_app.models import (
    AlertNotification,
    ProcessClassification,
    SavedView,
    SECOPAlert,
    SECOPProcess,
    SyncLog,
    User,
)

MAX_SECOP_ALERT_LIST_QUERIES = 6
MAX_SECOP_PROCESS_LIST_QUERIES = 6
MAX_SECOP_MY_CLASSIFIED_QUERIES = 6
MAX_SECOP_PROCESS_DETAIL_QUERIES = 2


def _create_secop_processes(start, count):
    """Create distinct SECOP processes for alert notification fixtures."""
    return [
        SECOPProcess.objects.create(
            process_id=f"COUNT-SECOP-{index}",
            entity_name="Count entity",
        )
        for index in range(start, start + count)
    ]


def _set_alert_created_at(alert, created_at):
    """Set a deterministic list order after the auto timestamp is assigned."""
    SECOPAlert.objects.filter(pk=alert.pk).update(created_at=created_at)


def _create_secop_alert_entries(user, start, count):
    """Create owned alerts paired with distinct SECOP processes for list serialization."""
    entries = []
    for index in range(start, start + count):
        alert = SECOPAlert.objects.create(user=user, name=f"Performance alert {index}")
        process = SECOPProcess.objects.create(
            process_id=f"PERF-SECOP-{index}",
            entity_name=f"Performance entity {index}",
        )
        if index % 2:
            AlertNotification.objects.create(alert=alert, process=process, is_sent=bool(index % 4))
        entries.append(alert)
    return entries


def _create_prefetch_processes(owner, other_user, count):
    """Create processes with one owner and one foreign classification each."""
    fixed_timestamp = datetime(2026, 9, 24, 12, 0, tzinfo=dt_timezone.utc)
    processes = []
    owner_classifications = []
    for index in range(count):
        process = SECOPProcess.objects.create(
            process_id=f"PREFETCH-SECOP-{index}",
            entity_name=f"Prefetch entity {index}",
        )
        owner_classifications.append(ProcessClassification.objects.create(
            process=process,
            user=owner,
            status=ProcessClassification.Status.INTERESTING,
            notes=f"Owner note {index}",
        ))
        ProcessClassification.objects.create(
            process=process,
            user=other_user,
            status=ProcessClassification.Status.APPLIED,
            notes=f"Foreign note {index}",
        )
        processes.append(process)
    ProcessClassification.objects.filter(
        pk__in=[classification.pk for classification in owner_classifications]
    ).update(created_at=fixed_timestamp, updated_at=fixed_timestamp)
    expected_classifications = {
        classification.process.process_id: {
            'id': classification.pk,
            'status': ProcessClassification.Status.INTERESTING,
            'notes': classification.notes,
            'updated_at': '2026-09-24T12:00:00Z',
        }
        for classification in owner_classifications
    }
    return expected_classifications


def _create_detail_classifications(process, current_user, count):
    """Create deterministic detail rows with their related authors."""
    fixed_timestamp = datetime(2026, 9, 24, 12, 0, tzinfo=dt_timezone.utc)
    classifications = [
        ProcessClassification.objects.create(
            process=process,
            user=current_user,
            status=ProcessClassification.Status.INTERESTING,
            notes="Current user note",
        )
    ]
    for index in range(1, count):
        user = User.objects.create_user(
            email=f"detail-classification-{index}@test.com",
            password=None,
            first_name=f"Detail{index}",
            last_name="Reviewer",
            role="lawyer",
        )
        classifications.append(
            ProcessClassification.objects.create(
                process=process,
                user=user,
                status=ProcessClassification.Status.APPLIED,
                notes=f"Detail note {index}",
            )
        )
    ProcessClassification.objects.filter(
        pk__in=[classification.pk for classification in classifications]
    ).update(created_at=fixed_timestamp, updated_at=fixed_timestamp)
    expected = {
        (
            classification.pk,
            classification.user.id,
            classification.user.first_name,
            classification.user.last_name,
            classification.status.value,
            classification.notes,
            classification.user_id == current_user.id,
            "2026-09-24T12:00:00Z",
            "2026-09-24T12:00:00Z",
        )
        for classification in classifications
    }
    return expected

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
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
        base_price=Decimal(500000000),
        description='Construcción de vía terciaria en Bogotá',
        procedure_name='Obra vial Bogotá',
        publication_date='2026-03-01',
        closing_date='2026-04-14',
        unspsc_code='72101500',
    )


@pytest.fixture
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
        base_price=Decimal(100000000),
        description='Consultoría ambiental en Antioquia',
        procedure_name='Consultoría ambiental',
        publication_date='2026-02-01',
        closing_date='2026-03-05',
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

    def test_process_list_prefetches_only_current_user_classifications(
        self, api_client, lawyer, other_lawyer
    ):
        """Fails if process list materializes foreign classifications or restores N+1 queries."""
        expected_classifications = _create_prefetch_processes(
            lawyer, other_lawyer, 50
        )
        url = reverse('secop-process-list')

        with CaptureQueriesContext(connection) as one_row_queries:
            one_row_response = api_client.get(url, {'page_size': 1})
        initialized_classifications = []

        def record_classification(sender, instance, **kwargs):
            initialized_classifications.append(instance.pk)

        post_init.connect(record_classification, sender=ProcessClassification, weak=False)
        try:
            with CaptureQueriesContext(connection) as fifty_row_queries:
                fifty_row_response = api_client.get(url, {'page_size': 50})
        finally:
            post_init.disconnect(record_classification, sender=ProcessClassification)

        assert (
            one_row_response.status_code,
            len(one_row_response.data['results']),
            fifty_row_response.status_code,
            len(fifty_row_response.data['results']),
            len(initialized_classifications),
        ) == (status.HTTP_200_OK, 1, status.HTTP_200_OK, 50, 50)
        assert len(one_row_queries) == len(fifty_row_queries)
        assert len(fifty_row_queries) <= MAX_SECOP_PROCESS_LIST_QUERIES
        assert {
            item['process_id']: item['my_classification']
            for item in fifty_row_response.json()['results']
        } == expected_classifications

    def test_my_classified_prefetches_only_current_user_classifications(
        self, api_client, lawyer, other_lawyer
    ):
        """Fails if my-classified materializes foreign classifications or restores N+1 queries."""
        expected_classifications = _create_prefetch_processes(
            lawyer, other_lawyer, 50
        )
        url = reverse('secop-my-classified')

        with CaptureQueriesContext(connection) as one_row_queries:
            one_row_response = api_client.get(url, {'page_size': 1})
        initialized_classifications = []

        def record_classification(sender, instance, **kwargs):
            initialized_classifications.append(instance.pk)

        post_init.connect(record_classification, sender=ProcessClassification, weak=False)
        try:
            with CaptureQueriesContext(connection) as fifty_row_queries:
                fifty_row_response = api_client.get(url, {'page_size': 50})
        finally:
            post_init.disconnect(record_classification, sender=ProcessClassification)

        assert (
            one_row_response.status_code,
            len(one_row_response.data['results']),
            fifty_row_response.status_code,
            len(fifty_row_response.data['results']),
            len(initialized_classifications),
        ) == (status.HTTP_200_OK, 1, status.HTTP_200_OK, 50, 50)
        assert len(one_row_queries) == len(fifty_row_queries)
        assert len(fifty_row_queries) <= MAX_SECOP_MY_CLASSIFIED_QUERIES
        assert {
            item['process_id']: item['my_classification']
            for item in fifty_row_response.json()['results']
        } == expected_classifications

    def test_process_list_returns_none_for_empty_prefetched_classifications(
        self, api_client, lawyer, other_lawyer
    ):
        """Fails if an empty prefetched attribute falls back to a foreign classification query."""
        process = SECOPProcess.objects.create(
            process_id='EMPTY-PREFETCH-SECOP',
            entity_name='Empty prefetch entity',
        )
        ProcessClassification.objects.create(
            process=process,
            user=other_lawyer,
            status=ProcessClassification.Status.APPLIED,
        )
        initialized_classifications = []

        def record_classification(sender, instance, **kwargs):
            initialized_classifications.append(instance.pk)

        post_init.connect(record_classification, sender=ProcessClassification, weak=False)
        try:
            response = api_client.get(
                reverse('secop-process-list'),
                {'page_size': 50},
            )
        finally:
            post_init.disconnect(record_classification, sender=ProcessClassification)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'][0]['my_classification'] is None
        assert initialized_classifications == []

    def test_process_detail_preserves_prefetched_classification_payload(
        self, api_client, lawyer
    ):
        """Fails if detail serialization loses prefetched classification fields or authors."""
        process = SECOPProcess.objects.create(
            process_id='DETAIL-PAYLOAD-SECOP',
            entity_name='Detail payload entity',
        )
        expected_classifications = _create_detail_classifications(process, lawyer, 50)

        response = api_client.get(
            reverse('secop-process-detail', kwargs={'pk': process.pk})
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['classifications']) == 50
        actual_classifications = {
            (
                item['id'],
                item['user']['id'],
                item['user']['first_name'],
                item['user']['last_name'],
                item['status'],
                item['notes'],
                item['is_mine'],
                item['created_at'],
                item['updated_at'],
            )
            for item in response.json()['classifications']
        }
        assert actual_classifications == expected_classifications

    def test_process_detail_has_constant_query_budget(self, api_client, lawyer):
        """Fails if detail repeats its classification query after the prefetch."""
        one_classification_process = SECOPProcess.objects.create(
            process_id='DETAIL-ONE-SECOP',
            entity_name='One detail entity',
        )
        fifty_classification_process = SECOPProcess.objects.create(
            process_id='DETAIL-FIFTY-SECOP',
            entity_name='Fifty detail entity',
        )
        _create_detail_classifications(one_classification_process, lawyer, 1)
        _create_detail_classifications(fifty_classification_process, lawyer, 50)

        with CaptureQueriesContext(connection) as one_row_queries:
            one_row_response = api_client.get(
                reverse('secop-process-detail', kwargs={'pk': one_classification_process.pk})
            )
        with CaptureQueriesContext(connection) as fifty_row_queries:
            fifty_row_response = api_client.get(
                reverse('secop-process-detail', kwargs={'pk': fifty_classification_process.pk})
            )

        assert one_row_response.status_code == status.HTTP_200_OK
        assert len(one_row_response.data['classifications']) == 1
        assert fifty_row_response.status_code == status.HTTP_200_OK
        assert len(fifty_row_response.data['classifications']) == 50
        assert len(one_row_queries) == len(fifty_row_queries)
        assert len(fifty_row_queries) <= MAX_SECOP_PROCESS_DETAIL_QUERIES

    def test_process_detail_empty_classifications_has_bounded_queries(
        self, api_client, lawyer
    ):
        """Fails if an empty detail list bypasses the prefetched classification fast path."""
        process = SECOPProcess.objects.create(
            process_id='DETAIL-EMPTY-SECOP',
            entity_name='Empty detail entity',
        )
        url = reverse('secop-process-detail', kwargs={'pk': process.pk})

        with CaptureQueriesContext(connection) as queries:
            response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['classifications'] == []
        assert len(queries) <= MAX_SECOP_PROCESS_DETAIL_QUERIES


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

    def test_alert_list_returns_notification_counts_in_owner_order(self, api_client, lawyer, other_lawyer):
        """Fails if alert list drops zero counts, sent records, ordering, or tenant isolation."""
        processes = _create_secop_processes(0, 6)
        zero_alert = SECOPAlert.objects.create(user=lawyer, name="Zero notifications")
        one_alert = SECOPAlert.objects.create(user=lawyer, name="One notification")
        many_alert = SECOPAlert.objects.create(user=lawyer, name="Many notifications")
        other_alert = SECOPAlert.objects.create(user=other_lawyer, name="Other notification")
        AlertNotification.objects.create(alert=one_alert, process=processes[0], is_sent=False)
        AlertNotification.objects.create(alert=many_alert, process=processes[1], is_sent=False)
        AlertNotification.objects.create(alert=many_alert, process=processes[2], is_sent=True)
        AlertNotification.objects.create(alert=many_alert, process=processes[3], is_sent=False)
        AlertNotification.objects.create(alert=other_alert, process=processes[4], is_sent=True)
        fixed_now = datetime(2026, 9, 24, 12, 0, tzinfo=dt_timezone.utc)
        _set_alert_created_at(zero_alert, fixed_now - timezone.timedelta(minutes=3))
        _set_alert_created_at(one_alert, fixed_now - timezone.timedelta(minutes=2))
        _set_alert_created_at(many_alert, fixed_now - timezone.timedelta(minutes=1))

        response = api_client.get(reverse("secop-alerts-list-create"))

        assert response.status_code == status.HTTP_200_OK
        assert [(item["name"], item["notification_count"]) for item in response.data] == [("Many notifications", 3), ("One notification", 1), ("Zero notifications", 0)]

    def test_alert_list_has_constant_query_budget(self, api_client, lawyer):
        """Fails if notification_count falls back to one query for each alert row."""
        _create_secop_alert_entries(lawyer, 0, 1)
        url = reverse("secop-alerts-list-create")

        with CaptureQueriesContext(connection) as one_row_queries:
            one_row_response = api_client.get(url)
        _create_secop_alert_entries(lawyer, 1, 49)
        with CaptureQueriesContext(connection) as fifty_row_queries:
            fifty_row_response = api_client.get(url)

        assert one_row_response.status_code == status.HTTP_200_OK
        assert len(one_row_response.data) == 1
        assert fifty_row_response.status_code == status.HTTP_200_OK
        assert len(fifty_row_response.data) == 50
        assert len(one_row_queries) == len(fifty_row_queries)
        assert len(fifty_row_queries) <= MAX_SECOP_ALERT_LIST_QUERIES


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

    def test_set_favorite_marks_view_as_favorite(self, api_client, lawyer):
        """Verify set-favorite endpoint marks a view as favorite."""
        view = SavedView.objects.create(
            user=lawyer, name='Fav View',
            filters={'department': 'Bogotá D.C.'},
        )
        url = reverse('secop-saved-view-set-favorite', kwargs={'pk': view.pk})

        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_favorite'] is True
        view.refresh_from_db()
        assert view.is_favorite is True

    def test_set_favorite_toggles_off_when_already_favorite(self, api_client, lawyer):
        """Verify set-favorite toggles off if view is already favorite."""
        view = SavedView.objects.create(
            user=lawyer, name='Fav View',
            filters={'department': 'Bogotá D.C.'},
            is_favorite=True,
        )
        url = reverse('secop-saved-view-set-favorite', kwargs={'pk': view.pk})

        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_favorite'] is False
        view.refresh_from_db()
        assert view.is_favorite is False

    def test_set_favorite_unsets_previous_favorite(self, api_client, lawyer):
        """Verify only one view per user can be favorite at a time."""
        view_a = SavedView.objects.create(
            user=lawyer, name='View A',
            filters={'department': 'Bogotá D.C.'},
            is_favorite=True,
        )
        view_b = SavedView.objects.create(
            user=lawyer, name='View B',
            filters={'department': 'Antioquia'},
        )
        url = reverse('secop-saved-view-set-favorite', kwargs={'pk': view_b.pk})

        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_favorite'] is True
        view_a.refresh_from_db()
        view_b.refresh_from_db()
        assert view_a.is_favorite is False
        assert view_b.is_favorite is True

    @pytest.mark.edge
    def test_set_favorite_other_user_view_returns_404(
        self, api_client, lawyer, other_lawyer
    ):
        """Verify user cannot set favorite on another user's view."""
        view = SavedView.objects.create(
            user=other_lawyer, name='Other View',
            filters={'department': 'Antioquia'},
        )
        url = reverse('secop-saved-view-set-favorite', kwargs={'pk': view.pk})

        response = api_client.post(url)

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

    @pytest.mark.parametrize(
        ('role', 'is_staff', 'is_superuser'),
        [
            ('admin', False, False),
            ('basic', True, False),
            ('basic', False, True),
        ],
    )
    @patch('gym_app.secop_tasks.sync_secop_data')
    def test_trigger_sync_allowed_for_administrator(
        self, mock_task, api_client, role, is_staff, is_superuser
    ):
        """Verify every platform administrator can schedule a sync."""
        user = User.objects.create_user(
            email=f'secop-admin-{role}-{is_staff}-{is_superuser}@test.com',
            password='testpassword',
            role=role,
            is_staff=is_staff,
            is_superuser=is_superuser,
        )
        api_client.force_authenticate(user=user)
        mock_task.schedule.return_value = None

        response = api_client.post(reverse('secop-trigger-sync'))

        assert response.status_code == status.HTTP_200_OK
        mock_task.schedule.assert_called_once_with(delay=0)

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


# ---------------------------------------------------------------------------
# Additional filter/edge-case tests for coverage
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopFilterBranches:
    """Tests for SECOP views filter branches not yet covered."""

    def test_process_list_filters_by_procurement_method(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify procurement_method filter returns matching processes."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'procurement_method': 'Licitación pública'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['procurement_method'] == 'Licitación pública'

    def test_process_list_filters_by_status(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify status filter returns matching processes."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'status': 'Cerrado'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['status'] == 'Cerrado'

    def test_process_list_filters_by_contract_type(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify contract_type filter returns matching processes."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'contract_type': 'Obra'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

    def test_process_list_filters_by_min_budget(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify min_budget filter excludes processes below threshold."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'min_budget': '200000000'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['base_price'] == '500000000.00'

    def test_process_list_filters_by_max_budget(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify max_budget filter excludes processes above threshold."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'max_budget': '200000000'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['base_price'] == '100000000.00'

    def test_process_list_invalid_min_budget_ignored(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify non-numeric min_budget is silently ignored."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'min_budget': 'abc'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2

    def test_process_list_invalid_max_budget_ignored(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify non-numeric max_budget is silently ignored."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'max_budget': 'xyz'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2

    def test_process_list_filters_by_publication_date_from(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify publication_date_from filter."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'publication_date_from': '2026-02-15'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

    def test_process_list_filters_by_publication_date_to(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify publication_date_to filter."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'publication_date_to': '2026-02-15'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

    @freeze_time('2026-03-15 12:00:00')
    def test_process_list_filters_by_closing_date_from(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify closing_date_from filter excludes processes with earlier closing."""
        url = reverse('secop-process-list')
        tomorrow = (timezone.now() + timezone.timedelta(days=1)).strftime('%Y-%m-%d')

        response = api_client.get(url, {'closing_date_from': tomorrow})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

    @freeze_time('2026-03-15 12:00:00')
    def test_process_list_filters_by_closing_date_to(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify closing_date_to filter excludes processes with later closing."""
        url = reverse('secop-process-list')
        yesterday = (timezone.now() - timezone.timedelta(days=1)).strftime('%Y-%m-%d')

        response = api_client.get(url, {'closing_date_to': yesterday})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

    @freeze_time('2026-03-15 12:00:00')
    def test_process_list_filters_is_open_true(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify is_open=true returns only open processes with future closing."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'is_open': 'true'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['status'] == 'Abierto'

    def test_process_list_invalid_ordering_uses_default(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Verify invalid ordering falls back to -publication_date."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'ordering': 'INVALID_FIELD'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2

    def test_process_list_invalid_page_number_falls_back(
        self, api_client, lawyer, process_open
    ):
        """Verify invalid page number falls back to page 1."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'page': '999'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['current_page'] == 1

    def test_process_list_page_size_capped_at_max(
        self, api_client, lawyer, process_open
    ):
        """Verify page_size over MAX_PAGE_SIZE is capped."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'page_size': '9999'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['page_size'] <= 100

    def test_process_list_invalid_page_size_uses_default(
        self, api_client, lawyer, process_open
    ):
        """Verify non-numeric page_size falls back to default."""
        url = reverse('secop-process-list')

        response = api_client.get(url, {'page_size': 'abc'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['page_size'] == 20

    def test_my_classified_invalid_page_falls_back(
        self, api_client, lawyer, process_open
    ):
        """Verify my-classified with invalid page falls back to page 1."""
        ProcessClassification.objects.create(
            process=process_open, user=lawyer,
        )
        url = reverse('secop-my-classified')

        response = api_client.get(url, {'page': '999'})

        assert response.status_code == status.HTTP_200_OK
        assert response.data['current_page'] == 1


@pytest.mark.django_db
@pytest.mark.integration
class TestSecopAlertEdgeCases:
    """Additional alert endpoint edge cases."""

    def test_update_alert_invalid_data_returns_400(self, api_client, lawyer):
        """Verify 400 when alert update payload is invalid."""
        alert = SECOPAlert.objects.create(
            user=lawyer, name='Valid Alert',
        )
        url = reverse('secop-alert-update-delete', kwargs={'pk': alert.pk})

        response = api_client.put(url, {'name': ''}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_toggle_alert_false_to_true(self, api_client, lawyer):
        """Verify toggle flips is_active from False to True."""
        alert = SECOPAlert.objects.create(
            user=lawyer, name='Inactive Alert', is_active=False,
        )
        url = reverse('secop-alert-toggle', kwargs={'pk': alert.pk})

        response = api_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['is_active'] is True

    def test_toggle_alert_not_found_returns_404(self, api_client, lawyer):
        """Verify 404 for toggle on non-existent alert."""
        url = reverse('secop-alert-toggle', kwargs={'pk': 99999})

        response = api_client.post(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
@pytest.mark.integration
class TestSecopSavedViewEdgeCases:
    """Additional saved view edge cases."""

    def test_create_saved_view_invalid_data_returns_400(self, api_client, lawyer):
        """Verify 400 when saved view payload is invalid (missing name)."""
        url = reverse('secop-saved-views')

        response = api_client.post(url, {'filters': {}}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
@pytest.mark.integration
class TestSecopExportEdgeCases:
    """Additional export edge cases."""

    @freeze_time('2026-03-15 12:00:00')
    def test_export_excel_handles_null_fields(self, api_client, lawyer):
        """Verify export works when process has null base_price and dates."""
        SECOPProcess.objects.create(
            process_id='CO1.REQ.NULL1',
            entity_name='Null Fields Entity',
            reference='NULL-001',
            procedure_name='Test procedure',
            base_price=None,
            publication_date=None,
            closing_date=None,
        )
        url = reverse('secop-export-excel')

        response = api_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'spreadsheet' in response['Content-Type']


# ---------------------------------------------------------------------------
# Multi-value filters, keywords and saved-view edit (coverage batch 2026-07-16)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
@pytest.mark.integration
class TestSecopMultiValueFilters:
    """CSV multi-value branches of _apply_common_filters."""

    def _ids(self, api_client, params):
        url = reverse('secop-process-list')
        response = api_client.get(url, params)
        assert response.status_code == status.HTTP_200_OK
        return {p['process_id'] for p in response.data['results']}

    def test_entity_name_accepts_csv_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Entity name accepts csv values."""
        ids = self._ids(api_client, {'entity_name': 'Ministerio de Transporte,INVIAS'})
        assert ids == {process_open.process_id, process_closed.process_id}

    def test_department_accepts_csv_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Department accepts csv values."""
        ids = self._ids(api_client, {'department': 'Bogotá D.C.,Antioquia'})
        assert ids == {process_open.process_id, process_closed.process_id}

    def test_procurement_method_accepts_csv_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Procurement method accepts csv values."""
        ids = self._ids(
            api_client,
            {'procurement_method': 'Licitación pública,Concurso de méritos'},
        )
        assert ids == {process_open.process_id, process_closed.process_id}

    def test_status_accepts_csv_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Status accepts csv values."""
        ids = self._ids(api_client, {'status': 'Abierto,Cerrado'})
        assert ids == {process_open.process_id, process_closed.process_id}

    def test_contract_type_accepts_csv_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Contract type accepts csv values."""
        ids = self._ids(api_client, {'contract_type': 'Obra,Consultoría'})
        assert ids == {process_open.process_id, process_closed.process_id}

    def test_unspsc_code_accepts_csv_values(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Unspsc code accepts csv values."""
        ids = self._ids(api_client, {'unspsc_code': '72101500,81101500'})
        assert ids == {process_open.process_id, process_closed.process_id}

    def test_keywords_all_words_of_phrase_must_match(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Keywords all words of phrase must match."""
        ids = self._ids(api_client, {'keywords': 'vía terciaria'})
        assert ids == {process_open.process_id}

    def test_keywords_pipe_separated_phrases_are_unioned(
        self, api_client, lawyer, process_open, process_closed
    ):
        """Keywords pipe separated phrases are unioned."""
        ids = self._ids(api_client, {'keywords': 'terciaria|ambiental'})
        assert ids == {process_open.process_id, process_closed.process_id}


@pytest.mark.django_db
@pytest.mark.integration
class TestSecopSavedViewEdit:
    """PUT/PATCH branch of the saved-view detail endpoint."""

    def test_patch_renames_saved_view(self, api_client, lawyer):
        """Patch renames saved view."""
        view = SavedView.objects.create(
            user=lawyer, name='Old Name', filters={'status': 'Abierto'},
        )
        url = reverse('secop-delete-saved-view', args=[view.pk])

        response = api_client.patch(url, {'name': 'New Name'}, format='json')

        assert response.status_code == status.HTTP_200_OK
        view.refresh_from_db()
        assert view.name == 'New Name'

    def test_patch_duplicate_name_returns_400(self, api_client, lawyer):
        """Patch duplicate name returns 400."""
        SavedView.objects.create(user=lawyer, name='Taken', filters={})
        view = SavedView.objects.create(user=lawyer, name='Mine', filters={})
        url = reverse('secop-delete-saved-view', args=[view.pk])

        response = api_client.patch(url, {'name': 'Taken'}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
