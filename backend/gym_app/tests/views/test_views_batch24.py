"""Batch 24 – reports + serializer gaps."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.request import Request
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from gym_app.models import (
    DynamicDocument, DocumentVariable, DocumentSignature,
    LegalRequest, LegalRequestType, LegalDiscipline,
)
from gym_app.models.dynamic_document import DocumentRelationship
from gym_app.serializers.dynamic_document import (
    DynamicDocumentSerializer, DocumentRelationshipSerializer,
    DocumentSignatureSerializer, TagSerializer, DocumentFolderSerializer,
)

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def lawyer():
    return User.objects.create_user(email="l24@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="c24@t.com", password="pw", role="client", first_name="C", last_name="E")

def _req(user):
    r = RequestFactory().post("/")
    r.user = user
    d = Request(r)
    d.user = user
    return d

class TestReports24:
    @pytest.fixture(autouse=True)
    def _s(self, cli):
        rt = LegalRequestType.objects.create(name="Q")
        di = LegalDiscipline.objects.create(name="C")
        LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="D")

    def test_received(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        r = api.post(reverse("generate-excel-report"), {"reportType": "received_legal_requests"}, format="json")
        assert r.status_code == 200

    def test_by_type(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        r = api.post(reverse("generate-excel-report"), {"reportType": "requests_by_type_discipline"}, format="json")
        assert r.status_code == 200

    def test_received_dates(self, api, lawyer):
        api.force_authenticate(user=lawyer)
        r = api.post(reverse("generate-excel-report"), {"reportType": "received_legal_requests", "startDate": "2020-01-01", "endDate": "2030-12-31"}, format="json")
        assert r.status_code == 200

class TestSerCreate:
    def test_firma_suffix(self, lawyer):
        s = DynamicDocumentSerializer(data={"title": "C", "content": "<p>x</p>", "state": "PendingSignatures", "requires_signature": True}, context={"request": _req(lawyer)})
        assert s.is_valid(), s.errors
        assert s.save().title.endswith("_firma")

    def test_no_firma(self, lawyer):
        s = DynamicDocumentSerializer(data={"title": "N", "content": "<p>x</p>", "state": "Draft"}, context={"request": _req(lawyer)})
        assert s.is_valid(), s.errors
        assert not s.save().title.endswith("_firma")

    def test_with_vars(self, lawyer):
        s = DynamicDocumentSerializer(data={"title": "V", "content": "<p>x</p>", "state": "Draft", "variables": [{"name_en": "n", "name_es": "n", "field_type": "input", "value": "v"}]}, context={"request": _req(lawyer)})
        assert s.is_valid(), s.errors
        assert s.save().variables.count() == 1

    def test_update_rm_rels(self, lawyer):
        d1 = DynamicDocument.objects.create(title="D1", content="<p>x</p>", state="Completed", created_by=lawyer)
        d2 = DynamicDocument.objects.create(title="D2", content="<p>y</p>", state="Completed", created_by=lawyer)
        DocumentRelationship.objects.create(source_document=d1, target_document=d2, created_by=lawyer)
        s = DynamicDocumentSerializer(d1, data={"state": "Progress"}, partial=True, context={"request": _req(lawyer)})
        assert s.is_valid(), s.errors
        s.save()
        assert DocumentRelationship.objects.filter(source_document=d1).count() == 0

class TestRelSer:
    def test_self_invalid(self, lawyer):
        d = DynamicDocument.objects.create(title="S", content="<p>x</p>", state="Draft", created_by=lawyer)
        assert not DocumentRelationshipSerializer(data={"source_document": d.pk, "target_document": d.pk}).is_valid()

    def test_valid(self, lawyer):
        d1 = DynamicDocument.objects.create(title="A", content="<p>x</p>", state="Draft", created_by=lawyer)
        d2 = DynamicDocument.objects.create(title="B", content="<p>y</p>", state="Draft", created_by=lawyer)
        s = DocumentRelationshipSerializer(data={"source_document": d1.pk, "target_document": d2.pk}, context={"request": _req(lawyer)})
        assert s.is_valid(), s.errors
        assert s.save().created_by == lawyer

class TestSigSer:
    def test_name(self, lawyer, cli):
        d = DynamicDocument.objects.create(title="D", content="<p>x</p>", state="PendingSignatures", created_by=lawyer, requires_signature=True)
        sig = DocumentSignature.objects.create(document=d, signer=cli)
        assert DocumentSignatureSerializer(sig).data["signer_name"] == "C E"

    def test_no_name(self, lawyer):
        u = User.objects.create_user(email="nn@t.com", password="pw", role="client")
        d = DynamicDocument.objects.create(title="D2", content="<p>x</p>", state="PendingSignatures", created_by=lawyer, requires_signature=True)
        sig = DocumentSignature.objects.create(document=d, signer=u)
        assert DocumentSignatureSerializer(sig).data["signer_name"] == "nn@t.com"

class TestTagFolder:
    def test_tag(self, lawyer):
        s = TagSerializer(data={"name": "T", "color_id": 1}, context={"request": _req(lawyer)})
        assert s.is_valid(), s.errors
        assert s.save().created_by == lawyer

    def test_folder(self, cli):
        s = DocumentFolderSerializer(data={"name": "F", "color_id": 2}, context={"request": _req(cli)})
        assert s.is_valid(), s.errors
        assert s.save().owner == cli

class TestSummaryEdge:
    def test_counterparty_signer(self, lawyer, cli):
        d = DynamicDocument.objects.create(title="S", content="<p>x</p>", state="PendingSignatures", created_by=lawyer, requires_signature=True)
        DocumentSignature.objects.create(document=d, signer=cli)
        r = RequestFactory().get("/"); r.user = lawyer; dr = Request(r); dr.user = lawyer
        assert DynamicDocumentSerializer(d, context={"request": dr}).data["summary_counterparty"] == "C E"

    def test_currency(self, lawyer):
        d = DynamicDocument.objects.create(title="V", content="<p>x</p>", state="Draft", created_by=lawyer)
        DocumentVariable.objects.create(document=d, name_en="a", name_es="a", field_type="number", value="1000", summary_field="value", currency="USD")
        r = RequestFactory().get("/"); r.user = lawyer; dr = Request(r); dr.user = lawyer
        s = DynamicDocumentSerializer(d, context={"request": dr})
        assert s.data["summary_value"] == "1000"
        assert s.data["summary_value_currency"] == "USD"

    def test_owner_can_edit(self, lawyer):
        d = DynamicDocument.objects.create(title="O", content="<p>x</p>", state="Draft", created_by=lawyer)
        r = RequestFactory().get("/"); r.user = lawyer; dr = Request(r); dr.user = lawyer
        assert DynamicDocumentSerializer(d, context={"request": dr}).data["can_edit"] is True

    def test_completed_total_signatures(self, lawyer, cli):
        d = DynamicDocument.objects.create(title="Sig", content="<p>x</p>", state="PendingSignatures", created_by=lawyer, requires_signature=True)
        DocumentSignature.objects.create(document=d, signer=cli, signed=True)
        DocumentSignature.objects.create(document=d, signer=lawyer)
        r = RequestFactory().get("/"); r.user = lawyer; dr = Request(r); dr.user = lawyer
        s = DynamicDocumentSerializer(d, context={"request": dr})
        assert s.data["completed_signatures"] == 1
        assert s.data["total_signatures"] == 2

    def test_no_signature_counts_zero(self, lawyer):
        d = DynamicDocument.objects.create(title="NoSig", content="<p>x</p>", state="Draft", created_by=lawyer, requires_signature=False)
        r = RequestFactory().get("/"); r.user = lawyer; dr = Request(r); dr.user = lawyer
        s = DynamicDocumentSerializer(d, context={"request": dr})
        assert s.data["completed_signatures"] == 0
        assert s.data["total_signatures"] == 0

    def test_permission_level_no_request(self, lawyer):
        d = DynamicDocument.objects.create(title="NR", content="<p>x</p>", state="Draft", created_by=lawyer)
        s = DynamicDocumentSerializer(d, context={})
        assert s.data["user_permission_level"] is None

    def test_can_view_no_request(self, lawyer):
        d = DynamicDocument.objects.create(title="NR2", content="<p>x</p>", state="Draft", created_by=lawyer)
        s = DynamicDocumentSerializer(d, context={})
        assert s.data["can_view"] is False
