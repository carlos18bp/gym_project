"""Tests for SECOP models module."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone
from freezegun import freeze_time

from gym_app.models import (
    SECOPProcess, ProcessClassification, SECOPAlert,
    AlertNotification, SyncLog, SavedView, User,
)

FROZEN_NOW = '2026-03-19T20:00:00+00:00'


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
@pytest.mark.django_db
def lawyer():
    """Lawyer user for SECOP tests."""
    return User.objects.create_user(
        email='secop_model_lawyer@test.com',
        password='testpassword',
        first_name='Model',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def second_lawyer():
    """Second lawyer user for uniqueness tests."""
    return User.objects.create_user(
        email='secop_model_lawyer2@test.com',
        password='testpassword',
        first_name='Second',
        last_name='Lawyer',
        role='lawyer',
    )


@pytest.fixture
@pytest.mark.django_db
def secop_process():
    """Open SECOP process with future closing date."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.9900001',
        reference='SA-100-2026-0001',
        entity_name='Ministerio de Transporte',
        department='Bogotá D.C.',
        status='Abierto',
        procurement_method='Licitación pública',
        contract_type='Obra',
        base_price=Decimal('500000000.00'),
        publication_date='2026-03-01',
        closing_date=timezone.make_aware(
            timezone.datetime(2026, 4, 30, 17, 0, 0)
        ),
    )


@pytest.fixture
@pytest.mark.django_db
def closed_process():
    """Closed SECOP process with past closing date."""
    return SECOPProcess.objects.create(
        process_id='CO1.REQ.9900002',
        reference='SA-200-2026-0002',
        entity_name='INVIAS',
        department='Antioquia',
        status='Cerrado',
        closing_date=timezone.make_aware(
            timezone.datetime(2026, 1, 15, 12, 0, 0)
        ),
    )


# ---------------------------------------------------------------------------
# SECOPProcess tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSECOPProcess:
    """Tests for SECOPProcess model."""

    def test_create_process_with_required_fields(self):
        """Verify process creation with minimum required fields."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.1000001',
            entity_name='Test Entity',
        )

        assert process.pk is not None
        assert process.process_id == 'CO1.REQ.1000001'
        assert process.entity_name == 'Test Entity'

    def test_process_id_unique_constraint(self, secop_process):
        """Verify IntegrityError on duplicate process_id."""
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                SECOPProcess.objects.create(
                    process_id=secop_process.process_id,
                    entity_name='Duplicate Entity',
                )
        assert SECOPProcess.objects.filter(process_id=secop_process.process_id).count() == 1

    def test_str_representation(self, secop_process):
        """Verify __str__ contains reference and truncated entity name."""
        result = str(secop_process)

        assert secop_process.reference in result
        assert 'Ministerio de Transporte' in result

    @freeze_time(FROZEN_NOW)
    def test_is_open_returns_true_for_open_status_future_closing(self, secop_process):
        """Verify is_open is True when status is Abierto and closing is future."""
        assert secop_process.is_open is True

    @freeze_time(FROZEN_NOW)
    def test_is_open_returns_false_for_closed_status(self):
        """Verify is_open is False when status is Cerrado regardless of date."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.CLOSED1',
            entity_name='Closed Entity',
            status='Cerrado',
            closing_date=timezone.now() + timedelta(days=30),
        )

        assert process.is_open is False

    @freeze_time(FROZEN_NOW)
    def test_is_open_returns_false_for_past_closing_date(self):
        """Verify is_open is False when closing date has passed."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.PAST1',
            entity_name='Past Entity',
            status='Abierto',
            closing_date=timezone.now() - timedelta(days=5),
        )

        assert process.is_open is False

    def test_is_open_returns_true_when_no_closing_date(self):
        """Verify is_open is True when closing_date is None and status is open."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.NODATE1',
            entity_name='No Date Entity',
            status='Abierto',
            closing_date=None,
        )

        assert process.is_open is True

    @freeze_time(FROZEN_NOW)
    def test_days_remaining_future_closing(self):
        """Verify days_remaining returns positive integer for future deadline."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.FUTURE1',
            entity_name='Future Entity',
            closing_date=timezone.now() + timedelta(days=15),
        )

        assert process.days_remaining == 15

    @freeze_time(FROZEN_NOW)
    def test_days_remaining_past_closing_returns_zero(self):
        """Verify days_remaining returns 0 for past deadline."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.PAST2',
            entity_name='Past Entity',
            closing_date=timezone.now() - timedelta(days=5),
        )

        assert process.days_remaining == 0

    def test_days_remaining_none_when_no_closing_date(self):
        """Verify days_remaining returns None when closing_date is not set."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.NODATE2',
            entity_name='No Date Entity',
            closing_date=None,
        )

        assert process.days_remaining is None

    def test_blank_fields_saved_as_empty_string(self):
        """Verify blank-allowed CharField fields default to empty string."""
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.BLANK1',
            entity_name='Blank Entity',
        )

        assert process.reference == ''
        assert process.department == ''
        assert process.city == ''
        assert process.procurement_method == ''

    def test_raw_data_json_field_stores_dict(self):
        """Verify JSONField stores and retrieves a dict correctly."""
        raw = {'extra_field': 'value', 'number': 42}
        process = SECOPProcess.objects.create(
            process_id='CO1.REQ.JSON1',
            entity_name='JSON Entity',
            raw_data=raw,
        )

        process.refresh_from_db()
        assert process.raw_data == raw
        assert process.raw_data['extra_field'] == 'value'


# ---------------------------------------------------------------------------
# ProcessClassification tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProcessClassification:
    """Tests for ProcessClassification model."""

    def test_create_classification_with_valid_data(self, secop_process, lawyer):
        """Verify classification creation with valid FK references."""
        classification = ProcessClassification.objects.create(
            process=secop_process,
            user=lawyer,
            status=ProcessClassification.Status.INTERESTING,
            notes='Test notes',
        )

        assert classification.pk is not None
        assert classification.process == secop_process
        assert classification.user == lawyer

    def test_unique_together_process_user(self, secop_process, lawyer):
        """Verify unique_together constraint on (process, user)."""
        ProcessClassification.objects.create(
            process=secop_process,
            user=lawyer,
        )

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                ProcessClassification.objects.create(
                    process=secop_process,
                    user=lawyer,
                    status=ProcessClassification.Status.DISCARDED,
                )
        assert ProcessClassification.objects.filter(process=secop_process, user=lawyer).count() == 1

    @pytest.mark.parametrize('status_value', [
        ProcessClassification.Status.INTERESTING,
        ProcessClassification.Status.UNDER_REVIEW,
        ProcessClassification.Status.DISCARDED,
        ProcessClassification.Status.APPLIED,
    ])
    def test_status_choices_valid(self, secop_process, lawyer, status_value):
        """Verify all status choices can be saved."""
        classification = ProcessClassification.objects.create(
            process=secop_process,
            user=lawyer,
            status=status_value,
        )

        classification.refresh_from_db()
        assert classification.status == status_value

    def test_default_status_is_interesting(self, secop_process, lawyer):
        """Verify default status is INTERESTING."""
        classification = ProcessClassification.objects.create(
            process=secop_process,
            user=lawyer,
        )

        assert classification.status == ProcessClassification.Status.INTERESTING

    def test_str_representation(self, secop_process, lawyer):
        """Verify __str__ contains reference, status, and user."""
        classification = ProcessClassification.objects.create(
            process=secop_process,
            user=lawyer,
            status=ProcessClassification.Status.UNDER_REVIEW,
        )

        result = str(classification)
        assert 'UNDER_REVIEW' in result


# ---------------------------------------------------------------------------
# SECOPAlert tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSECOPAlert:
    """Tests for SECOPAlert model."""

    def test_create_alert_with_valid_data(self, lawyer):
        """Verify alert creation with valid data."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Test Alert',
            keywords='consultoría, asesoría',
            departments='Antioquia, Bogotá D.C.',
        )

        assert alert.pk is not None
        assert alert.is_active is True
        assert alert.frequency == SECOPAlert.Frequency.DAILY

    def test_evaluate_process_matches_keywords(self, lawyer, secop_process):
        """Verify evaluate_process returns True when keywords match."""
        secop_process.description = 'Consultoría para diseño de acueducto'
        secop_process.save()

        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Keyword Alert',
            keywords='consultoría, diseño',
        )

        assert alert.evaluate_process(secop_process) is True

    def test_evaluate_process_no_match_keywords(self, lawyer, secop_process):
        """Verify evaluate_process returns False when no keywords match."""
        secop_process.description = 'Obra civil para mejoramiento vial'
        secop_process.save()

        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='No Match Alert',
            keywords='software, tecnología',
        )

        assert alert.evaluate_process(secop_process) is False

    def test_evaluate_process_matches_budget_range(self, lawyer, secop_process):
        """Verify evaluate_process returns True when budget is in range."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Budget Alert',
            min_budget=Decimal('100000000'),
            max_budget=Decimal('1000000000'),
        )

        assert alert.evaluate_process(secop_process) is True

    def test_evaluate_process_fails_budget_below_min(self, lawyer, secop_process):
        """Verify evaluate_process returns False when budget is below min."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='High Budget Alert',
            min_budget=Decimal('999000000000'),
        )

        assert alert.evaluate_process(secop_process) is False

    def test_evaluate_process_matches_department(self, lawyer, secop_process):
        """Verify evaluate_process returns True when department matches."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Dept Alert',
            departments='Bogotá D.C., Antioquia',
        )

        assert alert.evaluate_process(secop_process) is True

    def test_evaluate_process_empty_criteria_matches_all(self, lawyer, secop_process):
        """Verify evaluate_process returns True when no criteria are set."""
        alert = SECOPAlert.objects.create(
            user=lawyer,
            name='Empty Alert',
        )

        assert alert.evaluate_process(secop_process) is True


# ---------------------------------------------------------------------------
# AlertNotification, SyncLog, SavedView tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAlertNotification:
    """Tests for AlertNotification model."""

    def test_alert_notification_unique_together(self, lawyer, secop_process):
        """Verify unique_together constraint on (alert, process)."""
        alert = SECOPAlert.objects.create(user=lawyer, name='Notif Alert')
        AlertNotification.objects.create(alert=alert, process=secop_process)

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                AlertNotification.objects.create(alert=alert, process=secop_process)
        assert AlertNotification.objects.filter(alert=alert, process=secop_process).count() == 1


@pytest.mark.django_db
class TestSyncLog:
    """Tests for SyncLog model."""

    def test_sync_log_default_status_in_progress(self):
        """Verify default status is IN_PROGRESS."""
        log = SyncLog.objects.create()

        assert log.status == SyncLog.Status.IN_PROGRESS

    def test_sync_log_ordering_by_started_at_desc(self):
        """Verify ordering is -started_at (most recent first)."""
        log1 = SyncLog.objects.create()
        log2 = SyncLog.objects.create()

        logs = list(SyncLog.objects.all())
        assert logs[0].pk == log2.pk
        assert logs[1].pk == log1.pk

    def test_sync_log_str_contains_date_and_status(self):
        """Verify __str__ contains formatted date and status."""
        log = SyncLog.objects.create()

        result = str(log)
        assert 'IN_PROGRESS' in result


@pytest.mark.django_db
class TestSavedView:
    """Tests for SavedView model."""

    def test_saved_view_unique_together_user_name(self, lawyer):
        """Verify unique_together constraint on (user, name)."""
        SavedView.objects.create(
            user=lawyer,
            name='My View',
            filters={'department': 'Antioquia'},
        )

        with pytest.raises(IntegrityError):
            SavedView.objects.create(
                user=lawyer,
                name='My View',
                filters={'department': 'Bogotá D.C.'},
            )

    def test_saved_view_filters_json_roundtrip(self, lawyer):
        """Verify JSONField stores and retrieves filter dict correctly."""
        filters = {
            'department': 'Antioquia',
            'min_budget': '100000000',
            'status': 'Abierto',
        }
        view = SavedView.objects.create(
            user=lawyer,
            name='Roundtrip View',
            filters=filters,
        )

        view.refresh_from_db()
        assert view.filters == filters
        assert view.filters['department'] == 'Antioquia'
