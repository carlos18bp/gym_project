"""Tests for SECOP sync service."""
from datetime import date
from decimal import Decimal

import pytest
from unittest.mock import patch, MagicMock

from gym_app.models import SECOPProcess, SyncLog
from gym_app.services.secop_sync_service import SECOPSyncService


class TestParseDecimal:
    """Tests for _parse_decimal static method."""

    def test_parse_decimal_valid_string(self):
        """Verify valid numeric string converts to Decimal."""
        result = SECOPSyncService._parse_decimal('1500000.50')

        assert result == Decimal('1500000.50')

    def test_parse_decimal_with_currency_symbols(self):
        """Verify currency symbols and commas are stripped before parsing."""
        result = SECOPSyncService._parse_decimal('$1,500,000.50')

        assert result == Decimal('1500000.50')

    def test_parse_decimal_invalid_returns_none(self):
        """Verify invalid value returns None."""
        result = SECOPSyncService._parse_decimal('not-a-number')

        assert result is None

    def test_parse_decimal_none_returns_none(self):
        """Verify None input returns None."""
        result = SECOPSyncService._parse_decimal(None)

        assert result is None


class TestParseInt:
    """Tests for _parse_int static method."""

    def test_parse_int_valid(self):
        """Verify valid numeric string converts to int."""
        result = SECOPSyncService._parse_int('365')

        assert result == 365

    def test_parse_int_float_string(self):
        """Verify float string is truncated to int."""
        result = SECOPSyncService._parse_int('90.0')

        assert result == 90

    def test_parse_int_invalid_returns_none(self):
        """Verify invalid value returns None."""
        result = SECOPSyncService._parse_int('abc')

        assert result is None

    def test_parse_int_none_returns_none(self):
        """Verify None input returns None."""
        result = SECOPSyncService._parse_int(None)

        assert result is None


class TestParseDate:
    """Tests for _parse_date static method."""

    def test_parse_date_with_timestamp(self):
        """Verify date extraction from Socrata timestamp format."""
        result = SECOPSyncService._parse_date('2026-03-15T00:00:00.000')

        assert result == date(2026, 3, 15)

    def test_parse_date_plain_date(self):
        """Verify plain date string is parsed to date object."""
        result = SECOPSyncService._parse_date('2026-03-15')

        assert result == date(2026, 3, 15)

    def test_parse_date_empty_returns_none(self):
        """Verify empty string returns None."""
        result = SECOPSyncService._parse_date('')

        assert result is None


class TestParseDatetime:
    """Tests for _parse_datetime static method."""

    def test_parse_datetime_socrata_format(self):
        """Verify Socrata datetime format is parsed correctly."""
        result = SECOPSyncService._parse_datetime('2026-03-15T14:30:00.000')

        assert result is not None
        assert result.year == 2026
        assert result.month == 3
        assert result.day == 15

    def test_parse_datetime_empty_returns_none(self):
        """Verify empty value returns None."""
        result = SECOPSyncService._parse_datetime('')

        assert result is None

    def test_parse_datetime_none_returns_none(self):
        """Verify None value returns None."""
        result = SECOPSyncService._parse_datetime(None)

        assert result is None


class TestTransformRecord:
    """Tests for _transform_record method."""

    def test_transform_record_maps_fields(self):
        """Verify API fields are mapped to model field names."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.123',
            'entidad': 'Test Entity',
            'departamento_entidad': 'Antioquia',
            'precio_base': '5000000',
            'duracion': '90',
            'fecha_de_publicacion_del': '2026-03-01T00:00:00.000',
            'fecha_de_recepcion_de': '2026-04-01T17:00:00.000',
        }

        data = service._transform_record(record)

        assert data['process_id'] == 'CO1.REQ.123'
        assert data['entity_name'] == 'Test Entity'
        assert data['department'] == 'Antioquia'
        assert data['base_price'] == Decimal('5000000')
        assert data['duration_value'] == 90
        assert data['publication_date'] == date(2026, 3, 1)
        assert data['closing_date'] is not None

    def test_transform_record_skips_none_values(self):
        """Verify None API values are excluded from output."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.456',
            'precio_base': None,
        }

        data = service._transform_record(record)

        assert data['process_id'] == 'CO1.REQ.456'
        assert 'base_price' not in data


@pytest.mark.django_db
class TestUpsertProcess:
    """Tests for _upsert_process method."""

    def test_upsert_process_creates_new(self):
        """Verify new process is created from API record."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.NEW1',
            'entidad': 'New Entity',
            'departamento_entidad': 'Bogotá D.C.',
            'extra_unmapped_field': 'extra_value',
        }

        process, created = service._upsert_process(record)

        assert created is True
        assert process.process_id == 'CO1.REQ.NEW1'
        assert process.entity_name == 'New Entity'
        assert process.raw_data == {'extra_unmapped_field': 'extra_value'}

    def test_upsert_process_updates_existing(self):
        """Verify existing process is updated from API record."""
        SECOPProcess.objects.create(
            process_id='CO1.REQ.UPD1',
            entity_name='Old Entity',
        )
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.UPD1',
            'entidad': 'Updated Entity',
        }

        process, created = service._upsert_process(record)

        assert created is False
        assert process.entity_name == 'Updated Entity'

    def test_upsert_process_raises_on_missing_id(self):
        """Verify ValueError when record lacks process ID field."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {'entidad': 'No ID Entity'}

        with pytest.raises(ValueError, match='missing'):
            service._upsert_process(record)
