import logging
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from gym_app.models import SECOPProcess, SyncLog
from gym_app.services.secop_client import SECOPClient

logger = logging.getLogger(__name__)


class SECOPSyncService:
    """
    Service for synchronizing SECOP data to local database.

    Handles the transformation of API data to model instances
    and manages create/update logic.
    """

    # API field name for process ID (used for record lookup)
    API_PROCESS_ID_FIELD = 'id_del_proceso'

    # Mapping from SECOP API field names (Spanish) to model field names (English)
    FIELD_MAPPING = {
        'id_del_proceso':                   'process_id',
        'referencia_del_proceso':           'reference',
        'entidad':                          'entity_name',
        'nit_entidad':                      'entity_nit',
        'departamento_entidad':             'department',
        'ciudad_entidad':                   'city',
        'ordenentidad':                     'entity_level',
        'nombre_del_procedimiento':         'procedure_name',
        'descripci_n_del_procedimiento':    'description',
        'fase':                             'phase',
        'estado_del_procedimiento':         'status',
        'modalidad_de_contratacion':        'procurement_method',
        'justificaci_n_modalidad_de':       'procurement_justification',
        'tipo_de_contrato':                 'contract_type',
        'precio_base':                      'base_price',
        'duracion':                         'duration_value',
        'unidad_de_duracion':               'duration_unit',
        'fecha_de_publicacion_del':         'publication_date',
        'fecha_de_ultima_publicaci':        'last_update_date',
        'fecha_de_recepcion_de':            'closing_date',
        'urlproceso':                       'process_url',
        'c_digo_unspsc':                    'unspsc_code',
    }

    def __init__(self):
        """Initialize service with SECOP client."""
        self.client = SECOPClient()

    def synchronize(self, incremental=True):
        """
        Execute synchronization from SECOP API.

        Args:
            incremental: If True, only fetch records updated since last sync

        Returns:
            dict with sync statistics (processed, created, updated, new_ids)
        """
        date_from = None

        if incremental:
            last_sync = SyncLog.objects.filter(
                status=SyncLog.Status.SUCCESS
            ).first()

            if last_sync:
                # Go back 2 days to catch any delayed updates
                date_from = (
                    last_sync.started_at - timedelta(days=2)
                ).strftime('%Y-%m-%d')

        stats = {
            'processed': 0,
            'created': 0,
            'updated': 0,
            'new_ids': []
        }

        for record in self.client.fetch_processes(date_from=date_from):
            try:
                process, created = self._upsert_process(record)
                stats['processed'] += 1

                if created:
                    stats['created'] += 1
                    stats['new_ids'].append(process.id)
                else:
                    stats['updated'] += 1

            except Exception as e:
                logger.error(f"Error processing SECOP record: {e}")
                continue

        return stats

    def _upsert_process(self, record):
        """
        Create or update a process from API record.

        Args:
            record: Raw record dict from SECOP API

        Returns:
            Tuple of (SECOPProcess instance, created boolean)
        """
        process_id = record.get(self.API_PROCESS_ID_FIELD)
        if not process_id:
            raise ValueError(f"Record missing {self.API_PROCESS_ID_FIELD}")

        # Transform record to model fields
        data = self._transform_record(record)

        # Store raw data for unmapped fields
        data['raw_data'] = {
            k: v for k, v in record.items()
            if k not in self.FIELD_MAPPING
        }

        process, created = SECOPProcess.objects.update_or_create(
            process_id=process_id,
            defaults=data
        )

        return process, created

    def _transform_record(self, record):
        """
        Transform API record to model field values.

        Args:
            record: Raw API record dict

        Returns:
            dict with model field names and cleaned values
        """
        data = {}

        for api_field, model_field in self.FIELD_MAPPING.items():
            value = record.get(api_field)

            if value is None:
                continue

            # Apply field-specific transformations
            if model_field == 'base_price':
                value = self._parse_decimal(value)
            elif model_field == 'duration_value':
                value = self._parse_int(value)
            elif model_field in ('publication_date', 'last_update_date'):
                value = self._parse_date(value)
            elif model_field == 'closing_date':
                value = self._parse_datetime(value)

            data[model_field] = value

        return data

    @staticmethod
    def _parse_decimal(value):
        """Parse decimal value from API."""
        if value is None:
            return None
        try:
            if isinstance(value, str):
                value = value.replace('$', '').replace(',', '').strip()
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _parse_int(value):
        """Parse integer value from API."""
        if value is None:
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_date(value):
        """Parse date string from API (returns date part only)."""
        if not value:
            return None
        # API returns dates like "2023-01-21T00:00:00.000"
        date_str = str(value).split('T')[0] if 'T' in str(value) else str(value)
        parsed = parse_date(date_str)
        return parsed

    @staticmethod
    def _parse_datetime(value):
        """Parse datetime string from API."""
        if not value:
            return None
        try:
            # Handle Socrata date format: "2023-01-21T00:00:00.000" (variable ms precision)
            cleaned = re.sub(r'\.\d+$', '+00:00', str(value))
            result = parse_datetime(cleaned)
            if result is not None:
                return result
            # Fallback: try parsing just the date part
            date_part = str(value).split('T')[0]
            return parse_datetime(f"{date_part}T00:00:00+00:00")
        except (ValueError, TypeError):
            return None
