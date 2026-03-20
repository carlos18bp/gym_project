"""Tests for SECOP API client service."""
from unittest.mock import MagicMock, patch

import pytest
import requests

from gym_app.services.secop_client import SECOPClient


@pytest.fixture
def client():
    """SECOPClient with default test config."""
    with patch('gym_app.services.secop_client.settings') as mock_settings:
        mock_settings.SECOP_CONFIG = {
            'BASE_URL': 'https://test.datos.gov.co/resource',
            'DATASET_ID': 'test-dataset',
            'APP_TOKEN': 'test-token-123',
            'APP_SECRET': 'test-secret-456',
            'PAGE_SIZE': 10,
            'RETRY_ATTEMPTS': 2,
            'RETRY_DELAY': 0,
        }
        yield SECOPClient()


@pytest.fixture
def client_no_token():
    """SECOPClient without app token."""
    with patch('gym_app.services.secop_client.settings') as mock_settings:
        mock_settings.SECOP_CONFIG = {
            'BASE_URL': 'https://test.datos.gov.co/resource',
            'DATASET_ID': 'test-dataset',
            'APP_TOKEN': '',
            'APP_SECRET': '',
            'PAGE_SIZE': 10,
            'RETRY_ATTEMPTS': 2,
            'RETRY_DELAY': 0,
        }
        yield SECOPClient()


class TestSECOPClientEndpoint:
    """Tests for SECOPClient URL building."""

    def test_endpoint_builds_correct_url(self, client):
        """Verify endpoint combines base_url and dataset_id."""
        assert client.endpoint == 'https://test.datos.gov.co/resource/test-dataset.json'

    def test_headers_contain_accept_json(self, client):
        """Verify headers contain Accept application/json."""
        headers = client._get_headers()

        assert headers['Accept'] == 'application/json'

    def test_auth_returns_tuple_when_credentials_set(self, client):
        """Verify HTTP Basic Auth tuple is returned when credentials are configured."""
        auth = client._get_auth()

        assert auth == ('test-token-123', 'test-secret-456')

    def test_auth_returns_none_when_no_credentials(self, client_no_token):
        """Verify auth returns None when credentials are empty."""
        auth = client_no_token._get_auth()

        assert auth is None


class TestSECOPClientQuery:
    """Tests for query building."""

    def test_build_query_without_date_from(self, client):
        """Verify query includes status filter and pagination."""
        query = client._build_query(offset=0)

        assert "estado_del_procedimiento='Abierto'" in query
        assert '$limit=10' in query
        assert '$offset=0' in query

    def test_build_query_with_date_from(self, client):
        """Verify query adds date filter when date_from is provided."""
        query = client._build_query(offset=20, date_from='2026-03-01')

        assert "fecha_de_ultima_publicaci>='2026-03-01'" in query
        assert '$offset=20' in query


class TestSECOPClientRequest:
    """Tests for HTTP request handling."""

    # quality: disable network_dependency (testing retry logic with mocked requests.get boundary)
    @patch('gym_app.services.secop_client.requests.get')
    def test_make_request_retries_on_failure(self, mock_get, client):
        """Verify request retries on transient failure then succeeds."""
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_get.side_effect = [
            requests.RequestException('Connection timeout'),
            mock_response,
        ]

        result = client._make_request('https://test.url')

        assert result == mock_response
        assert mock_get.call_count == 2
        mock_response.raise_for_status.assert_called_once()

    # quality: disable network_dependency (testing retry exhaustion with mocked requests.get boundary)
    @patch('gym_app.services.secop_client.requests.get')
    def test_make_request_raises_after_all_retries(self, mock_get, client):
        """Verify exception is raised after exhausting all retry attempts."""
        mock_get.side_effect = requests.RequestException('Persistent failure')

        with pytest.raises(requests.RequestException, match='Persistent failure'):
            client._make_request('https://test.url')

        assert mock_get.call_count == 2
        mock_get.assert_called_with('https://test.url', headers=client._get_headers(), auth=client._get_auth(), timeout=30)

    @patch.object(SECOPClient, '_make_request')
    @patch('gym_app.services.secop_client.time.sleep', return_value=None)
    def test_fetch_processes_yields_records_across_pages(self, mock_sleep, mock_request, client):
        """Verify fetch_processes paginates and yields all records."""
        page1_response = MagicMock()
        page1_response.json.return_value = [{'id': i} for i in range(10)]

        page2_response = MagicMock()
        page2_response.json.return_value = [{'id': i} for i in range(10, 13)]

        mock_request.side_effect = [page1_response, page2_response]

        records = list(client.fetch_processes())

        assert len(records) == 13
        assert records[0]['id'] == 0
        assert records[12]['id'] == 12
        assert mock_request.call_count == 2
        mock_sleep.assert_called()

    @patch.object(SECOPClient, '_make_request')
    def test_fetch_processes_empty_first_page_returns_no_records(self, mock_request, client):
        """Verify fetch_processes returns nothing when first page is empty."""
        empty_response = MagicMock()
        empty_response.json.return_value = []
        mock_request.return_value = empty_response

        records = list(client.fetch_processes())

        assert len(records) == 0
        assert mock_request.call_count == 1  # verified

    # quality: disable network_dependency (testing first-attempt success with mocked requests.get boundary)
    @patch('gym_app.services.secop_client.requests.get')
    def test_make_request_succeeds_on_first_attempt(self, mock_get, client):
        """Verify request returns response on first successful attempt."""
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = client._make_request('https://test.url')

        assert result == mock_response
        assert mock_get.call_count == 1  # verified

    @patch.object(SECOPClient, '_make_request')
    def test_fetch_process_by_id_returns_record_when_found(self, mock_request, client):
        """Verify fetch_process_by_id returns first record when API has results."""
        mock_response = MagicMock()
        mock_response.json.return_value = [{'id_del_proceso': 'CO1.REQ.123', 'entidad': 'Test'}]
        mock_request.return_value = mock_response

        result = client.fetch_process_by_id('CO1.REQ.123')

        assert mock_request.call_count == 1
        assert result is not None
        assert result['id_del_proceso'] == 'CO1.REQ.123'

    @patch.object(SECOPClient, '_make_request')
    def test_fetch_process_by_id_returns_none_when_not_found(self, mock_request, client):
        """Verify fetch_process_by_id returns None when API returns empty list."""
        mock_response = MagicMock()
        mock_response.json.return_value = []
        mock_request.return_value = mock_response

        result = client.fetch_process_by_id('CO1.REQ.NONEXISTENT')

        assert mock_request.call_count == 1
        assert result is None
