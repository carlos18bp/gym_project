"""Batch 23 – 20 tests: reports.py dispatch + report generators + serializer gaps."""
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework.request import Request
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from gym_app.models import (
    Process, Case, Stage, DynamicDocument, DocumentVariable,
    DocumentSignature, LegalRequest, LegalRequestType, LegalDiscipline,
)
from gym_app.models.dynamic_document import DocumentRelationship
from gym_app.serializers.dynamic_document import (
    DocumentVariableSerializer,
    DynamicDocumentSerializer,
    DocumentSignatureSerializer,
)

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="law_b23@t.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="cli_b23@t.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
def case_obj():
    return Case.objects.create(type="Civil")


@pytest.fixture
def process_obj(lawyer, client_user, case_obj):
    p = Process.objects.create(
        ref="REF-001", case=case_obj, lawyer=lawyer,
        subcase="Sub", authority="Auth", plaintiff="P", defendant="D",
    )
    p.clients.add(client_user)
    Stage.objects.create(process=p, status="Etapa1")
    return p


# ===========================================================================
# reports.py – generate_excel_report dispatch
# ===========================================================================

class TestReportsDispatch:
    def test_missing_report_type(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {}, format="json")
        assert resp.status_code == 400
        assert "reportType" in str(resp.data)

    def test_invalid_report_type(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "nonexistent"}, format="json")
        assert resp.status_code == 400

    def test_invalid_date_format(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "active_processes", "startDate": "bad", "endDate": "bad"}, format="json")
        assert resp.status_code == 400

    def test_only_start_date(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "active_processes", "startDate": "2025-01-01"}, format="json")
        assert resp.status_code == 400

    def test_active_processes_report(self, api, lawyer, process_obj):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "active_processes", "startDate": "2020-01-01", "endDate": "2030-12-31"}, format="json")
        assert resp.status_code == 200
        assert "spreadsheetml" in resp["Content-Type"]

    def test_processes_by_lawyer_report(self, api, lawyer, process_obj):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "processes_by_lawyer", "startDate": "2020-01-01", "endDate": "2030-12-31"}, format="json")
        assert resp.status_code == 200

    def test_processes_by_client_report(self, api, lawyer, process_obj):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "processes_by_client", "startDate": "2020-01-01", "endDate": "2030-12-31"}, format="json")
        assert resp.status_code == 200

    def test_process_stages_report(self, api, lawyer, process_obj):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "process_stages", "startDate": "2020-01-01", "endDate": "2030-12-31"}, format="json")
        assert resp.status_code == 200

    def test_registered_users_report(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "registered_users"}, format="json")
        assert resp.status_code == 200

    def test_user_activity_report(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "user_activity"}, format="json")
        assert resp.status_code == 200

    def test_lawyers_workload_report(self, api, lawyer, process_obj):
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "lawyers_workload"}, format="json")
        assert resp.status_code == 200

    def test_documents_by_state_report(self, api, lawyer):
        DynamicDocument.objects.create(title="D1", content="<p>x</p>", state="Draft", created_by=lawyer)
        api.force_authenticate(user=lawyer)
        url = reverse("generate-excel-report")
        resp = api.post(url, {"reportType": "documents_by_state"}, format="json")
        assert resp.status_code == 200


# ===========================================================================
# serializers/dynamic_document.py – validation + summary fields
# ===========================================================================

class TestDocumentVariableSerializerValidation:
    def test_invalid_number_value(self):
        data = {"name_en": "v1", "name_es": "v1", "field_type": "number", "value": "abc"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()
        assert "value" in s.errors

    def test_invalid_date_value(self):
        data = {"name_en": "v1", "name_es": "v1", "field_type": "date", "value": "not-a-date"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()

    def test_invalid_email_value(self):
        data = {"name_en": "v1", "name_es": "v1", "field_type": "email", "value": "notanemail"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()

    def test_select_requires_options(self):
        data = {"name_en": "v1", "name_es": "v1", "field_type": "select", "value": "a"}
        s = DocumentVariableSerializer(data=data)
        assert not s.is_valid()
        assert "select_options" in s.errors


class TestDynamicDocumentSerializerSummaryFields:
    def _make_request(self, user):
        factory = RequestFactory()
        req = factory.get("/")
        req.user = user
        drf_req = Request(req)
        drf_req.user = user
        return drf_req

    def test_summary_counterparty_from_assigned(self, lawyer):
        doc = DynamicDocument.objects.create(
            title="D", content="<p>x</p>", state="Draft",
            created_by=lawyer, assigned_to=lawyer,
        )
        req = self._make_request(lawyer)
        s = DynamicDocumentSerializer(doc, context={"request": req})
        assert s.data["summary_counterparty"] is not None

    def test_summary_subscription_date_fallback(self, lawyer):
        doc = DynamicDocument.objects.create(
            title="D2", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        req = self._make_request(lawyer)
        s = DynamicDocumentSerializer(doc, context={"request": req})
        assert s.data["summary_subscription_date"] is not None

    def test_relationships_count_no_request(self, lawyer):
        doc = DynamicDocument.objects.create(
            title="D3", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        s = DynamicDocumentSerializer(doc, context={})
        assert s.data["relationships_count"] == 0

    def test_can_edit_view_only(self, client_user, lawyer):
        doc = DynamicDocument.objects.create(
            title="D4", content="<p>x</p>", state="Draft",
            created_by=lawyer, is_public=False,
        )
        req = self._make_request(client_user)
        s = DynamicDocumentSerializer(doc, context={"request": req})
        assert s.data["can_edit"] is False
        assert s.data["can_delete"] is False
