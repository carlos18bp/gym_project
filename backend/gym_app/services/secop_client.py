import logging
import time
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class SECOPClient:
    """
    Client for consuming SECOP data from Socrata API (datos.gov.co).

    Handles pagination, rate limiting, and error recovery when
    fetching data from the SECOP II dataset.
    """

    # Default: only fetch processes published within this many days
    DEFAULT_PUBLICATION_LOOKBACK_DAYS = 730  # ~2 years

    # API field names (Spanish - as defined by SECOP/Socrata API)
    class APIFields:
        PROCESS_ID = 'id_del_proceso'
        STATUS = 'estado_del_procedimiento'
        LAST_UPDATE = 'fecha_de_ultima_publicaci'
        PUBLICATION_DATE = 'fecha_de_publicacion_del'
        CLOSING_DATE = 'fecha_de_recepcion_de'

    # API status values (Spanish - as returned by SECOP API)
    class APIValues:
        STATUS_OPEN = 'Abierto'
        STATUS_PUBLISHED = 'Publicado'

    def __init__(self):
        """Initialize client with configuration from settings."""
        config = getattr(settings, 'SECOP_CONFIG', {})
        self.base_url = config.get('BASE_URL', 'https://www.datos.gov.co/resource')
        self.dataset_id = config.get('DATASET_ID', 'bt96-ncis')
        self.app_token = config.get('APP_TOKEN', '')
        self.app_secret = config.get('APP_SECRET', '')
        self.page_size = config.get('PAGE_SIZE', 1000)
        self.retry_attempts = config.get('RETRY_ATTEMPTS', 3)
        self.retry_delay = config.get('RETRY_DELAY', 60)

    @property
    def endpoint(self):
        """Build full API endpoint URL."""
        return f"{self.base_url}/{self.dataset_id}.json"

    def _get_headers(self):
        """Build request headers."""
        return {'Accept': 'application/json'}

    def _get_auth(self):
        """Build HTTP Basic Auth tuple if credentials are configured."""
        if self.app_token and self.app_secret:
            return (self.app_token, self.app_secret)
        return None

    def _build_query(self, offset=0, date_from=None):
        """
        Build SoQL query string for API request.

        Args:
            offset: Pagination offset
            date_from: Optional date filter (ISO format YYYY-MM-DD)

        Returns:
            str: SoQL query string
        """
        where_clauses = [
            f"{self.APIFields.STATUS}='{self.APIValues.STATUS_PUBLISHED}'",
        ]

        if date_from:
            where_clauses.append(
                f"{self.APIFields.LAST_UPDATE}>='{date_from}'"
            )

        # Always enforce a publication date floor to exclude stale records
        pub_floor = (
            timezone.now() - timedelta(days=self.DEFAULT_PUBLICATION_LOOKBACK_DAYS)
        ).strftime('%Y-%m-%d')
        where_clauses.append(
            f"{self.APIFields.PUBLICATION_DATE}>='{pub_floor}'"
        )

        where = " AND ".join(where_clauses)

        query = (
            f"$where={where}"
            f"&$order={self.APIFields.PUBLICATION_DATE} DESC"
            f"&$limit={self.page_size}"
            f"&$offset={offset}"
        )

        return query

    def _make_request(self, url):
        """
        Make HTTP request with retry logic and exponential backoff.

        Args:
            url: Full URL to request

        Returns:
            requests.Response

        Raises:
            requests.RequestException: If all retries fail
        """
        for attempt in range(self.retry_attempts):
            try:
                response = requests.get(
                    url,
                    headers=self._get_headers(),
                    auth=self._get_auth(),
                    timeout=30
                )
                response.raise_for_status()
                return response

            except requests.RequestException as e:
                logger.warning(
                    f"SECOP API request failed (attempt {attempt + 1}/"
                    f"{self.retry_attempts}): {e}"
                )
                if attempt < self.retry_attempts - 1:
                    sleep_time = self.retry_delay * (attempt + 1)
                    time.sleep(sleep_time)
                else:
                    raise

    def fetch_processes(self, date_from=None):
        """
        Fetch processes from SECOP API with pagination.

        Yields individual process records, handling pagination
        automatically.

        Args:
            date_from: Optional ISO date string to fetch only recent updates

        Yields:
            dict: Process data from API
        """
        offset = 0
        total_fetched = 0

        while True:
            query = self._build_query(offset=offset, date_from=date_from)
            url = f"{self.endpoint}?{query}"

            logger.debug(f"Fetching SECOP data: offset={offset}")

            response = self._make_request(url)
            records = response.json()

            if not records:
                logger.info(
                    f"SECOP fetch complete. Total records: {total_fetched}"
                )
                break

            for record in records:
                yield record
                total_fetched += 1

            if len(records) < self.page_size:
                logger.info(
                    f"SECOP fetch complete (last page). "
                    f"Total records: {total_fetched}"
                )
                break

            offset += self.page_size

            # Small delay to be respectful to the API
            time.sleep(0.5)

    def fetch_process_by_id(self, process_id):
        """
        Fetch a single process by its ID.

        Args:
            process_id: SECOP process ID string

        Returns:
            dict or None: Process data dict or None if not found
        """
        query = f"$where={self.APIFields.PROCESS_ID}='{process_id}'"
        url = f"{self.endpoint}?{query}"

        response = self._make_request(url)
        records = response.json()

        return records[0] if records else None
