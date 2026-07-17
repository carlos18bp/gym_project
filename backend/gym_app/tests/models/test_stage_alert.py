"""Tests for the StageAlert model."""
import pytest

from gym_app.models import Stage, StageAlert


@pytest.fixture
def stage():
    """Create a stage for alert tests."""
    return Stage.objects.create(status='Audiencia')


@pytest.mark.django_db
class TestStageAlertDefaults:
    """Default field values for StageAlert."""

    def test_is_active_defaults_to_true(self, stage):
        """Is active defaults to true."""
        alert = StageAlert.objects.create(stage=stage)
        assert alert.is_active is True

    def test_notify_clients_defaults_to_true(self, stage):
        """Notify clients defaults to true."""
        alert = StageAlert.objects.create(stage=stage)
        assert alert.notify_clients is True

    def test_notified_3_days_defaults_to_false(self, stage):
        """Notified 3 days defaults to false."""
        alert = StageAlert.objects.create(stage=stage)
        assert alert.notified_3_days is False

    def test_notified_1_day_defaults_to_false(self, stage):
        """Notified 1 day defaults to false."""
        alert = StageAlert.objects.create(stage=stage)
        assert alert.notified_1_day is False

    def test_description_defaults_to_empty_string(self, stage):
        """Description defaults to empty string."""
        alert = StageAlert.objects.create(stage=stage)
        assert alert.description == ''


@pytest.mark.django_db
class TestStageAlertRelation:
    """Relationship between StageAlert and Stage."""

    def test_related_name_alert_accessor(self, stage):
        """Related name alert accessor."""
        alert = StageAlert.objects.create(stage=stage)
        assert stage.alert == alert

    def test_cascade_delete_when_stage_is_deleted(self, stage):
        """Cascade delete when stage is deleted."""
        StageAlert.objects.create(stage=stage)
        stage_id = stage.id
        stage.delete()
        assert not StageAlert.objects.filter(stage_id=stage_id).exists()

    # quality: disable no_assertions (pytest.raises IS the assertion — verifies IntegrityError is raised)
    def test_cannot_create_two_alerts_for_same_stage(self, stage):
        """Cannot create two alerts for same stage."""
        from django.db import IntegrityError
        StageAlert.objects.create(stage=stage)
        with pytest.raises(IntegrityError):
            StageAlert.objects.create(stage=stage)


@pytest.mark.django_db
def test_str_includes_stage_id_and_active_flag():
    """Str includes stage id and active flag."""
    stage = Stage.objects.create(status='Sentencia')
    alert = StageAlert.objects.create(stage=stage, is_active=False)
    rendered = str(alert)
    assert str(stage.id) in rendered
    assert 'False' in rendered
