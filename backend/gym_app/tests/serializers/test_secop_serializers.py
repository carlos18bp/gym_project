"""Tests for SECOP serializers module."""
from decimal import Decimal

import pytest
from django.test import RequestFactory
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import (
    AlertNotification,
    ProcessClassification,
    SavedView,
    SECOPAlert,
    SECOPProcess,
    SyncLog,
    User,
)
from gym_app.serializers.secop import (
    ProcessClassificationSerializer,
    SavedViewSerializer,
    SECOPAlertSerializer,
    SECOPProcessDetailSerializer,
    SECOPProcessListSerializer,
    SyncLogSerializer,
)

FROZEN_NOW = '2026-03-19T20:00:00+00:00'


@pytest.fixture
def rf():
    """Django RequestFactory."""
    return RequestFactory()


@pytest.fixture
@pytest.mark.django_db
def lawyer():
    """Lawyer user for serializer tests."""
    return User.objects.create_user(
        email='ser_lawyer@test.com',
        password='testpassword',
        first_name='Ser',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def other_lawyer():
    """Other lawyer user for ownership tests."""
    return User.objects.create_user(
        email='ser_other_lawyer@test.com',
        password='testpassword',
        first_name='Other',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def process():
    """SECOP process for serializer tests."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.SER001',
        reference='SA-SER-001',
        entity_name='Test Entity',
        department='Bogotá D.C.',
        status='Abierto',
        base_price=Decimal('500000000'),
        closing_date=timezone.make_aware(
            timezone.datetime(2026, 4, 30, 17, 0, 0)
        ),
    )


def _build_request(rf, user):
    """Build a fake GET request with authenticated user."""
    request = rf.get('/')
    request.user = user
    return request


# ---------------------------------------------------------------------------
# SECOPProcessListSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSECOPProcessListSerializer:
    """Tests for SECOPProcessListSerializer."""

    @freeze_time(FROZEN_NOW)
    def test_list_serializer_includes_is_open(self, rf, lawyer, process):
        """Verify is_open computed field is present in output."""
        request = _build_request(rf, lawyer)
        serializer = SECOPProcessListSerializer(
            process, context={'request': request}
        )

        assert 'is_open' in serializer.data
        assert serializer.data['is_open'] is True

    @freeze_time(FROZEN_NOW)
    def test_list_serializer_includes_days_remaining(self, rf, lawyer, process):
        """Verify days_remaining computed field is present."""
        request = _build_request(rf, lawyer)
        serializer = SECOPProcessListSerializer(
            process, context={'request': request}
        )

        assert 'days_remaining' in serializer.data
        assert serializer.data['days_remaining'] > 0

    def test_list_serializer_my_classification_returns_data_for_owner(
        self, rf, lawyer, process
    ):
        """Verify my_classification returns data when user has classified."""
        ProcessClassification.objects.create(
            process=process,
            user=lawyer,
            status=ProcessClassification.Status.UNDER_REVIEW,
            notes='My notes',
        )
        request = _build_request(rf, lawyer)
        serializer = SECOPProcessListSerializer(
            process, context={'request': request}
        )

        classification = serializer.data['my_classification']
        assert classification is not None
        assert classification['status'] == 'UNDER_REVIEW'
        assert classification['notes'] == 'My notes'

    def test_list_serializer_my_classification_returns_none_for_other_user(
        self, rf, lawyer, other_lawyer, process
    ):
        """Verify my_classification is None when another user classified."""
        ProcessClassification.objects.create(
            process=process,
            user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )
        request = _build_request(rf, other_lawyer)
        serializer = SECOPProcessListSerializer(
            process, context={'request': request}
        )

        assert serializer.data['my_classification'] is None

    def test_list_serializer_my_classification_returns_none_unauthenticated(
        self, rf, process
    ):
        """Verify my_classification is None when no request context."""
        serializer = SECOPProcessListSerializer(process, context={})

        assert serializer.data['my_classification'] is None


# ---------------------------------------------------------------------------
# SECOPProcessDetailSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSECOPProcessDetailSerializer:
    """Tests for SECOPProcessDetailSerializer."""

    def test_detail_serializer_includes_classifications_with_is_mine(
        self, rf, lawyer, other_lawyer, process
    ):
        """Verify classifications include is_mine boolean for current user."""
        ProcessClassification.objects.create(
            process=process, user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )
        ProcessClassification.objects.create(
            process=process, user=other_lawyer,
            status=ProcessClassification.Status.APPLIED,
        )

        request = _build_request(rf, lawyer)
        serializer = SECOPProcessDetailSerializer(
            process, context={'request': request}
        )

        classifications = serializer.data['classifications']
        assert len(classifications) == 2

        mine = [c for c in classifications if c['is_mine'] is True]
        others = [c for c in classifications if c['is_mine'] is False]
        assert len(mine) == 1
        assert len(others) == 1
        assert mine[0]['status'] == 'INTERESTING'

    def test_detail_serializer_is_mine_false_for_other_user(
        self, rf, lawyer, other_lawyer, process
    ):
        """Verify is_mine is False when viewing another user's classification."""
        ProcessClassification.objects.create(
            process=process, user=lawyer,
            status=ProcessClassification.Status.UNDER_REVIEW,
        )
        request = _build_request(rf, other_lawyer)
        serializer = SECOPProcessDetailSerializer(
            process, context={'request': request}
        )

        classifications = serializer.data['classifications']
        assert len(classifications) == 1
        assert classifications[0]['is_mine'] is False


# ---------------------------------------------------------------------------
# ProcessClassificationSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProcessClassificationSerializer:
    """Tests for ProcessClassificationSerializer."""

    def test_classification_serializer_create_uses_request_user(
        self, rf, lawyer, process
    ):
        """Verify create auto-assigns user from request context."""
        request = _build_request(rf, lawyer)
        serializer = ProcessClassificationSerializer(
            data={
                'process': process.pk,
                'status': 'INTERESTING',
                'notes': 'Auto-assign test',
            },
            context={'request': request},
        )

        assert serializer.is_valid(), serializer.errors
        classification = serializer.save()

        assert classification.user == lawyer
        assert classification.process == process

    def test_classification_serializer_update_or_create_on_duplicate(
        self, rf, lawyer, process
    ):
        """Verify create method uses update_or_create for same user+process."""
        ProcessClassification.objects.create(
            process=process, user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
        )

        request = _build_request(rf, lawyer)
        serializer = ProcessClassificationSerializer(
            data={
                'process': process.pk,
                'status': 'APPLIED',
                'notes': 'Updated',
            },
            context={'request': request},
        )

        assert serializer.is_valid(), serializer.errors
        classification = serializer.save()

        assert classification.status == 'APPLIED'
        assert classification.notes == 'Updated'
        assert ProcessClassification.objects.filter(
            process=process, user=lawyer
        ).count() == 1


# ---------------------------------------------------------------------------
# SECOPAlertSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSECOPAlertSerializer:
    """Tests for SECOPAlertSerializer."""

    def test_alert_serializer_create_assigns_user(self, rf, lawyer):
        """Verify create auto-assigns user from request context."""
        request = _build_request(rf, lawyer)
        serializer = SECOPAlertSerializer(
            data={
                'name': 'Test Alert',
                'keywords': 'test',
                'frequency': 'DAILY',
            },
            context={'request': request},
        )

        assert serializer.is_valid(), serializer.errors
        alert = serializer.save()

        assert alert.user == lawyer
        assert alert.name == 'Test Alert'

    def test_alert_serializer_notification_count(self, rf, lawyer, process):
        """Verify notification_count computed field is accurate."""
        alert = SECOPAlert.objects.create(
            user=lawyer, name='Count Alert',
        )
        AlertNotification.objects.create(alert=alert, process=process)

        serializer = SECOPAlertSerializer(alert)

        assert serializer.data['notification_count'] == 1


# ---------------------------------------------------------------------------
# SyncLogSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSyncLogSerializer:
    """Tests for SyncLogSerializer."""

    @freeze_time(FROZEN_NOW)
    def test_sync_log_serializer_duration_seconds_computed(self):
        """Verify duration_seconds is calculated from started_at and finished_at."""
        log = SyncLog.objects.create()
        log.finished_at = timezone.now() + timezone.timedelta(seconds=120)
        log.save()

        serializer = SyncLogSerializer(log)

        assert serializer.data['duration_seconds'] == 120.0

    def test_sync_log_serializer_duration_none_when_not_finished(self):
        """Verify duration_seconds is None when finished_at is null."""
        log = SyncLog.objects.create()

        serializer = SyncLogSerializer(log)

        assert serializer.data['duration_seconds'] is None


# ---------------------------------------------------------------------------
# SavedViewSerializer
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSavedViewSerializer:
    """Tests for SavedViewSerializer."""

    def test_saved_view_serializer_create_assigns_user(self, rf, lawyer):
        """Verify create auto-assigns user from request context."""
        request = _build_request(rf, lawyer)
        serializer = SavedViewSerializer(
            data={
                'name': 'Test View',
                'filters': {'department': 'Antioquia'},
            },
            context={'request': request},
        )

        assert serializer.is_valid(), serializer.errors
        view = serializer.save()

        assert view.user == lawyer
        assert view.name == 'Test View'

    def test_saved_view_serializer_filters_json(self, rf, lawyer):
        """Verify filters JSON is correctly serialized in output."""
        filters = {'department': 'Bogotá D.C.', 'min_budget': '100000'}
        view = SavedView.objects.create(
            user=lawyer, name='JSON Test', filters=filters,
        )

        serializer = SavedViewSerializer(view)

        assert serializer.data['filters'] == filters
