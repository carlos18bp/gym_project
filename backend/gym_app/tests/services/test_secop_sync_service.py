"""Tests for SECOP sync service."""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time

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

    def test_parse_decimal_numeric_input(self):
        """Verify numeric (non-string) value is converted to Decimal."""
        result = SECOPSyncService._parse_decimal(1500000.50)

        assert result == Decimal('1500000.5')


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

    @pytest.mark.django_db
    def test_upsert_process_raises_on_missing_id(self):
        """Verify ValueError when record lacks process ID field."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {'entidad': 'No ID Entity'}

        with pytest.raises(ValueError, match='missing'):
            service._upsert_process(record)

        assert SECOPProcess.objects.count() == 0


class TestTransformRecordUrlBranch:
    """Tests for _transform_record process_url dict extraction."""

    def test_transform_record_extracts_url_from_dict(self):
        """Verify process_url is extracted from Socrata dict format."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.URL1',
            'urlproceso': {'url': 'https://community.secop.gov.co/123'},
        }

        data = service._transform_record(record)

        assert data['process_url'] == 'https://community.secop.gov.co/123'

    def test_transform_record_handles_string_url(self):
        """Verify plain string URL passes through unchanged."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.URL2',
            'urlproceso': 'https://community.secop.gov.co/456',
        }

        data = service._transform_record(record)

        assert data['process_url'] == 'https://community.secop.gov.co/456'

    def test_transform_record_url_dict_missing_url_key(self):
        """Verify empty string when dict has no 'url' key."""
        service = SECOPSyncService.__new__(SECOPSyncService)
        record = {
            'id_del_proceso': 'CO1.REQ.URL3',
            'urlproceso': {'other': 'value'},
        }

        data = service._transform_record(record)

        assert data['process_url'] == ''


class TestParseDatetimeFallback:
    """Tests for _parse_datetime fallback branches."""

    def test_parse_datetime_date_only_with_T_falls_back(self):
        """Verify fallback parsing for date-only string without ms precision."""
        result = SECOPSyncService._parse_datetime('2026-03-15')

        assert result is not None
        assert result.year == 2026
        assert result.month == 3
        assert result.day == 15

    def test_parse_datetime_invalid_string_returns_none(self):
        """Verify completely invalid string returns None."""
        result = SECOPSyncService._parse_datetime('not-a-date')

        assert result is None

    def test_parse_datetime_triggers_except_block(self):
        """Verify value that causes exception in parsing returns None."""
        result = SECOPSyncService._parse_datetime(object())

        assert result is None


@pytest.mark.django_db
@freeze_time('2026-03-19T20:00:00+00:00')
class TestSynchronize:
    """Tests for SECOPSyncService.synchronize integration."""

    @patch('gym_app.services.secop_sync_service.SECOPClient')
    def test_synchronize_incremental_with_prior_sync_uses_date_from(
        self, MockClient
    ):
        """Verify incremental sync calculates date_from from last successful sync."""
        SyncLog.objects.create(
            status=SyncLog.Status.SUCCESS,
            records_processed=10,
        )
        mock_client = MagicMock()
        mock_client.fetch_processes.return_value = iter([])
        MockClient.return_value = mock_client

        service = SECOPSyncService()
        service.synchronize(incremental=True)

        assert mock_client.fetch_processes.call_count == 1
        call_kwargs = mock_client.fetch_processes.call_args
        assert call_kwargs[1]['date_from'] is not None
        assert '2026-03-17' in call_kwargs[1]['date_from']

    @patch('gym_app.services.secop_sync_service.SECOPClient')
    def test_synchronize_incremental_without_prior_sync_no_date_filter(
        self, MockClient
    ):
        """Verify incremental sync with no prior SyncLog sends date_from=None."""
        mock_client = MagicMock()
        mock_client.fetch_processes.return_value = iter([])
        MockClient.return_value = mock_client

        service = SECOPSyncService()
        service.synchronize(incremental=True)

        assert mock_client.fetch_processes.call_count == 1
        call_kwargs = mock_client.fetch_processes.call_args
        assert call_kwargs[1]['date_from'] is None

    @patch('gym_app.services.secop_sync_service.SECOPClient')
    def test_synchronize_full_ignores_last_sync(self, MockClient):
        """Verify full sync always sends date_from=None."""
        SyncLog.objects.create(
            status=SyncLog.Status.SUCCESS,
            records_processed=5,
        )
        mock_client = MagicMock()
        mock_client.fetch_processes.return_value = iter([])
        MockClient.return_value = mock_client

        service = SECOPSyncService()
        service.synchronize(incremental=False)

        assert mock_client.fetch_processes.call_count == 1
        call_kwargs = mock_client.fetch_processes.call_args
        assert call_kwargs[1]['date_from'] is None

    @patch('gym_app.services.secop_sync_service.SECOPClient')
    def test_synchronize_counts_created_and_updated(self, MockClient):
        """Verify stats dict reflects created/updated counts accurately."""
        SECOPProcess.objects.create(
            process_id='CO1.REQ.EXIST1',
            entity_name='Existing Entity',
        )
        mock_client = MagicMock()
        mock_client.fetch_processes.return_value = iter([
            {'id_del_proceso': 'CO1.REQ.EXIST1', 'entidad': 'Updated'},
            {'id_del_proceso': 'CO1.REQ.NEW1', 'entidad': 'New Entity'},
        ])
        MockClient.return_value = mock_client

        service = SECOPSyncService()
        result = service.synchronize(incremental=False)

        assert mock_client.fetch_processes.call_count == 1
        assert result['processed'] == 2
        assert result['created'] == 1
        assert result['updated'] == 1
        assert len(result['new_ids']) == 1

    @patch('gym_app.services.secop_sync_service.SECOPClient')
    def test_synchronize_continues_on_individual_record_error(self, MockClient):
        """Verify one bad record does not stop sync of remaining records."""
        mock_client = MagicMock()
        mock_client.fetch_processes.return_value = iter([
            {'entidad': 'Missing ID'},
            {'id_del_proceso': 'CO1.REQ.OK1', 'entidad': 'Good Record'},
        ])
        MockClient.return_value = mock_client

        service = SECOPSyncService()
        result = service.synchronize(incremental=False)

        assert mock_client.fetch_processes.call_count == 1
        assert result['processed'] == 1
        assert result['created'] == 1
        assert SECOPProcess.objects.filter(process_id='CO1.REQ.OK1').exists()

    @patch('gym_app.services.secop_sync_service.SECOPClient')
    def test_synchronize_returns_new_ids(self, MockClient):
        """Verify new_ids list contains PKs of newly created processes."""
        mock_client = MagicMock()
        mock_client.fetch_processes.return_value = iter([
            {'id_del_proceso': 'CO1.REQ.IDS1', 'entidad': 'Entity A'},
            {'id_del_proceso': 'CO1.REQ.IDS2', 'entidad': 'Entity B'},
        ])
        MockClient.return_value = mock_client

        service = SECOPSyncService()
        result = service.synchronize(incremental=False)

        assert mock_client.fetch_processes.call_count == 1
        assert len(result['new_ids']) == 2
        for pid in result['new_ids']:
            assert SECOPProcess.objects.filter(pk=pid).exists()
