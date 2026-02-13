"""Tests for uncovered branches in reports.py."""
import pytest
import io
import datetime
import unittest.mock as mock
import pandas as pd
from django.urls import reverse
from django.db import models
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.test import APIClient
from gym_app.models import (
    Process, Case, Stage, User, ActivityFeed,
    DynamicDocument, LegalRequest, LegalRequestType, LegalDiscipline,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin():
    return User.objects.create_user(
        email='adm_rc@e.com', password='p', role='admin',
        first_name='A', last_name='R')


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_rc@e.com', password='p', role='lawyer',
        first_name='L', last_name='R', is_profile_completed=True)


@pytest.fixture
def lawyer2():
    return User.objects.create_user(
        email='law2_rc@e.com', password='p', role='lawyer',
        first_name='L2', last_name='R', is_profile_completed=True)


@pytest.fixture
def client_u():
    return User.objects.create_user(
        email='cli_rc@e.com', password='p', role='client',
        first_name='C', last_name='R', document_type='ID',
        identification='999', is_profile_completed=True)


@pytest.fixture
def ctype():
    return Case.objects.create(type='CivRC')


@pytest.fixture
def dr():
    e = timezone.now().date()
    s = e - datetime.timedelta(days=60)
    return s.strftime('%Y-%m-%d'), e.strftime('%Y-%m-%d')


def _post(c, rt, dr):
    return c.post(
        reverse('generate-excel-report'),
        {'reportType': rt, 'startDate': dr[0], 'endDate': dr[1]},
        format='json')


@pytest.fixture
def procs2(lawyer, lawyer2, client_u, ctype):
    """Two processes by different lawyers."""
    p1 = Process.objects.create(
        authority='A', plaintiff='P', defendant='D', ref='RC1',
        lawyer=lawyer, case=ctype, subcase='S',
        created_at=timezone.now() - datetime.timedelta(days=30))
    p1.clients.add(client_u)
    p1.stages.add(Stage.objects.create(
        status='Init',
        created_at=timezone.now() - datetime.timedelta(days=28)))
    p2 = Process.objects.create(
        authority='B', plaintiff='P', defendant='D', ref='RC2',
        lawyer=lawyer2, case=ctype, subcase='S',
        created_at=timezone.now() - datetime.timedelta(days=20))
    p2.clients.add(client_u)
    p2.stages.add(Stage.objects.create(
        status='Fallo',
        created_at=timezone.now() - datetime.timedelta(days=5)))
    return [p1, p2]


@pytest.fixture
def proc_ns(lawyer, client_u, ctype):
    """Process without stages."""
    p = Process.objects.create(
        authority='X', plaintiff='P', defendant='D', ref='RCNS',
        lawyer=lawyer, case=ctype, subcase='N',
        created_at=timezone.now() - datetime.timedelta(days=10))
    p.clients.add(client_u)
    return p


@pytest.fixture
def lr_data():
    """Legal request data for type_discipline report."""
    rt = LegalRequestType.objects.create(name="ConsRC")
    d1 = LegalDiscipline.objects.create(name="CivRC")
    d2 = LegalDiscipline.objects.create(name="FamRC")
    u1 = User.objects.create_user(
        email='lru1@e.com', password='p',
        first_name='A', last_name='B', role='client')
    u2 = User.objects.create_user(
        email='lru2@e.com', password='p',
        first_name='C', last_name='D', role='client')
    LegalRequest.objects.create(
        user=u1, request_type=rt, discipline=d1,
        description="R1",
        created_at=timezone.now() - datetime.timedelta(days=10))
    LegalRequest.objects.create(
        user=u2, request_type=rt, discipline=d2,
        description="R2",
        created_at=timezone.now() - datetime.timedelta(days=5))
    return {'types': [rt], 'discs': [d1, d2]}


@pytest.mark.django_db
class TestReportsCoverage:
    """Tests for uncovered branches in reports.py."""

    def test_lawyer_uid_filter(self, api_client, admin, procs2, dr):
        """Line 212: user_id filters processes_by_lawyer to one lawyer."""
        api_client.force_authenticate(user=admin)
        with mock.patch('gym_app.views.reports.user_id', procs2[0].lawyer.id):
            r = _post(api_client, 'processes_by_lawyer', dr)
        assert r.status_code == 200
        assert r['Content-Type'] == \
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def test_client_uid_filter(self, api_client, admin, client_u, procs2, dr):
        """Line 337: user_id filters processes_by_client to one client."""
        api_client.force_authenticate(user=admin)
        with mock.patch('gym_app.views.reports.user_id', client_u.id):
            r = _post(api_client, 'processes_by_client', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) >= 1

    def test_stages_skips_no_stages(self, api_client, admin, proc_ns, procs2, dr):
        """Line 474: process without stages is skipped in stage report."""
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'process_stages', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        refs = df['Referencia de Proceso'].tolist() if not df.empty else []
        assert 'RCNS' not in refs

    def test_delete_action_format(self, api_client, admin, lawyer, dr):
        """Line 809: delete action type gets red formatting."""
        ActivityFeed.objects.create(
            user=lawyer, action_type='delete', description='Del',
            created_at=timezone.now() - datetime.timedelta(days=2))
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'user_activity', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) >= 1

    def test_workload_uid_filter(self, api_client, admin, procs2, dr):
        """Line 871: user_id filters lawyers_workload to one lawyer."""
        api_client.force_authenticate(user=admin)
        with mock.patch('gym_app.views.reports.user_id', procs2[0].lawyer.id):
            r = _post(api_client, 'lawyers_workload', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) == 1
        assert df.iloc[0]['Email'] == procs2[0].lawyer.email

    @mock.patch('gym_app.views.reports.user_id', None)
    def test_workload_multi_lawyer_chart(self, api_client, admin, procs2, dr):
        """Lines 975-1040: chart generated when 2+ lawyers have data."""
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'lawyers_workload', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) >= 2

    @mock.patch('gym_app.views.reports.models', models)
    def test_docs_state_uid_lawyer(self, api_client, admin, lawyer, dr):
        """Lines 1080-1085: user_id as lawyer in documents_by_state."""
        DynamicDocument.objects.create(
            title="DocRC", state="Draft", created_by=lawyer,
            created_at=timezone.now() - datetime.timedelta(days=5),
            updated_at=timezone.now() - datetime.timedelta(days=3))
        api_client.force_authenticate(user=admin)
        with mock.patch('gym_app.views.reports.user_id', lawyer.id):
            r = _post(api_client, 'documents_by_state', dr)
        assert r.status_code == 200

    @mock.patch('gym_app.views.reports.models', models)
    def test_docs_state_uid_client(self, api_client, admin, client_u, lawyer, dr):
        """Lines 1086-1087: user_id as client in documents_by_state."""
        DynamicDocument.objects.create(
            title="DocRC2", state="Published", created_by=lawyer,
            assigned_to=client_u,
            created_at=timezone.now() - datetime.timedelta(days=5),
            updated_at=timezone.now() - datetime.timedelta(days=3))
        api_client.force_authenticate(user=admin)
        with mock.patch('gym_app.views.reports.user_id', client_u.id):
            r = _post(api_client, 'documents_by_state', dr)
        assert r.status_code == 200

    @mock.patch('gym_app.views.reports.models', models)
    @mock.patch('gym_app.views.reports.user_id', None)
    def test_docs_state_empty(self, api_client, admin, dr):
        """Lines 1242-1247: empty documents returns 'Sin Datos' sheet."""
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'documents_by_state', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert 'Mensaje' in df.columns

    def test_type_discipline_report(self, api_client, admin, lr_data, dr):
        """Lines 1449-1770: full requests_by_type_discipline report."""
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'requests_by_type_discipline', dr)
        assert r.status_code == 200
        assert r['Content-Type'] == \
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def test_type_discipline_empty(self, api_client, admin, dr):
        """Lines 1449+: type_discipline with no data produces empty sheets."""
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'requests_by_type_discipline', dr)
        assert r.status_code == 200

    def test_unauthenticated_returns_401(self, api_client, dr):
        """generate_excel_report requires authentication."""
        r = _post(api_client, 'active_processes', dr)
        assert r.status_code in (401, 403)

    @mock.patch('gym_app.views.reports.user_id', None)
    def test_lawyer_no_procs_skipped(self, api_client, admin, lawyer, lawyer2, client_u, ctype, dr):
        """Line 229: lawyer with no processes in range is skipped."""
        p = Process.objects.create(
            authority='A', plaintiff='P', defendant='D', ref='RC-SKP',
            lawyer=lawyer, case=ctype, subcase='S',
            created_at=timezone.now() - datetime.timedelta(days=10))
        p.clients.add(client_u)
        p.stages.add(Stage.objects.create(
            status='X', created_at=timezone.now() - datetime.timedelta(days=9)))
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'processes_by_lawyer', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) >= 1

    @mock.patch('gym_app.views.reports.user_id', None)
    def test_client_no_procs_skipped(self, api_client, admin, lawyer, client_u, ctype, dr):
        """Line 353: client with no processes in range is skipped."""
        extra_client = User.objects.create_user(
            email='nocli@e.com', password='p', role='client',
            first_name='No', last_name='Procs')
        p = Process.objects.create(
            authority='A', plaintiff='P', defendant='D', ref='RC-SKC',
            lawyer=lawyer, case=ctype, subcase='S',
            created_at=timezone.now() - datetime.timedelta(days=10))
        p.clients.add(client_u)
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'processes_by_client', dr)
        assert r.status_code == 200

    @mock.patch('gym_app.views.reports.user_id', None)
    def test_workload_lawyer_no_procs_skipped(self, api_client, admin, lawyer, lawyer2, client_u, ctype, dr):
        """Line 893: lawyer with 0 processes is skipped in workload."""
        p = Process.objects.create(
            authority='A', plaintiff='P', defendant='D', ref='RC-WK0',
            lawyer=lawyer, case=ctype, subcase='S',
            created_at=timezone.now() - datetime.timedelta(days=10))
        p.clients.add(client_u)
        api_client.force_authenticate(user=admin)
        r = _post(api_client, 'lawyers_workload', dr)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) == 1

    @mock.patch('gym_app.views.reports.models', models)
    def test_docs_state_uid_nonexistent(self, api_client, admin, dr):
        """Lines 1088-1089: non-existent user_id returns 404."""
        api_client.force_authenticate(user=admin)
        with mock.patch('gym_app.views.reports.user_id', 999999):
            r = _post(api_client, 'documents_by_state', dr)
        assert r.status_code == 404

    def test_type_discipline_matrix_zeros_hits_heatmap_bug(self, api_client, admin, dr):
        """Lines 1696+1717: matrix with 2+ types/disciplines covers zero-skip
        formatting (line 1696) then hits pre-existing bug: xlsxwriter does not
        support 'heatmap' chart type (line 1717), causing 500."""
        rt1 = LegalRequestType.objects.create(name="TypeA")
        rt2 = LegalRequestType.objects.create(name="TypeB")
        d1 = LegalDiscipline.objects.create(name="DiscA")
        d2 = LegalDiscipline.objects.create(name="DiscB")
        u = User.objects.create_user(
            email='mxu@e.com', password='p', first_name='M', last_name='X',
            role='client')
        LegalRequest.objects.create(
            user=u, request_type=rt1, discipline=d1, description="A",
            created_at=timezone.now() - datetime.timedelta(days=5))
        LegalRequest.objects.create(
            user=u, request_type=rt2, discipline=d2, description="B",
            created_at=timezone.now() - datetime.timedelta(days=3))
        api_client.force_authenticate(user=admin)
        # Pre-existing bug: workbook.add_chart({'type': 'heatmap'}) returns
        # None in xlsxwriter → AttributeError on chart.add_series (line 1719).
        # This test covers lines 1696 (zero-cell skip) before the crash.
        with pytest.raises(AttributeError, match="add_series"):
            _post(api_client, 'requests_by_type_discipline', dr)

    # --- Lines 1282-1283: null user in received legal requests report ---
    def test_received_legal_requests_null_user(self, api_client, admin, dr):
        """Lines 1282-1283: LegalRequest iteration with user=None falls back
        to empty requester_name and email."""
        from gym_app.views.reports import generate_received_legal_requests_report

        mock_req = mock.MagicMock()
        mock_req.user = None
        mock_req.request_type.name = "ConsRC"
        mock_req.discipline.name = "CivRC"
        mock_req.files.count.return_value = 0
        mock_req.description = "Null user test"
        mock_req.created_at.date.return_value = datetime.date.today()

        with mock.patch(
            'gym_app.views.reports.LegalRequest.objects'
        ) as mock_qs:
            mock_qs.filter.return_value.select_related.return_value \
                .prefetch_related.return_value = [mock_req]

            response = HttpResponse(
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            start = datetime.date.today() - datetime.timedelta(days=30)
            end = datetime.datetime.now()
            generate_received_legal_requests_report(response, start, end)

        # Verify the response was written (has content)
        assert len(response.content) > 0
        # Read the Excel and verify null user produced empty name/email
        # pandas reads empty strings as NaN, so check for that
        df = pd.read_excel(io.BytesIO(response.content))
        val_name = df.iloc[0]['Nombre Solicitante']
        val_email = df.iloc[0]['Email']
        assert pd.isna(val_name) or val_name == "", \
            f"Expected empty/NaN, got {val_name!r}"
        assert pd.isna(val_email) or val_email == "", \
            f"Expected empty/NaN, got {val_email!r}"

    # --- Lines 1741-1742: null user in type-discipline detailed list ---
    def test_type_discipline_null_user_detail(self, api_client, admin, dr):
        """Lines 1741-1742: LegalRequest with user=None in detailed list of
        requests_by_type_discipline report."""
        from gym_app.views.reports import generate_requests_by_type_discipline_report

        mock_req = mock.MagicMock()
        mock_req.user = None
        mock_req.request_type = mock.MagicMock()
        mock_req.request_type.name = "TypeNull"
        mock_req.request_type.pk = 1
        mock_req.discipline = mock.MagicMock()
        mock_req.discipline.name = "DiscNull"
        mock_req.discipline.pk = 1
        mock_req.files.count.return_value = 0
        mock_req.created_at.date.return_value = datetime.date.today()

        rt_mock = mock.MagicMock()
        rt_mock.name = "TypeNull"
        disc_mock = mock.MagicMock()
        disc_mock.name = "DiscNull"

        with mock.patch(
            'gym_app.views.reports.LegalRequest.objects'
        ) as mock_lr, mock.patch(
            'gym_app.views.reports.LegalRequestType.objects'
        ) as mock_rt, mock.patch(
            'gym_app.views.reports.LegalDiscipline.objects'
        ) as mock_ld:
            # Setup queryset chain for LegalRequest
            qs = mock.MagicMock()
            qs.filter.return_value = qs
            qs.select_related.return_value = qs
            qs.count.return_value = 1
            qs.__iter__ = mock.Mock(return_value=iter([mock_req]))
            mock_lr.filter.return_value = qs
            mock_lr.filter.return_value.select_related.return_value = qs

            mock_rt.all.return_value = [rt_mock]
            mock_ld.all.return_value = [disc_mock]

            response = HttpResponse(
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            start = datetime.date.today() - datetime.timedelta(days=30)
            end = datetime.datetime.now()
            generate_requests_by_type_discipline_report(response, start, end)

        assert len(response.content) > 0
