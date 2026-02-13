"""Batch 33 – 20 tests: legal_request & corporate_request view edges."""
import json
import pytest
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import (
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles,
    LegalRequestResponse, Organization, OrganizationMembership,
)
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType, CorporateRequestResponse,
)

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law33@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli33@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
def corp():
    return User.objects.create_user(email="corp33@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Rp")

@pytest.fixture
def lr_deps():
    rt = LegalRequestType.objects.create(name="TestType33")
    di = LegalDiscipline.objects.create(name="TestDisc33")
    return rt, di


# -- create_legal_request edges --
class TestCreateLegalRequest:
    def test_missing_main_data(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("create-legal-request"), {}, format="multipart")
        assert resp.status_code == 400

    def test_invalid_json(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("create-legal-request"), {"mainData": "{bad json"}, format="multipart")
        assert resp.status_code == 400

    def test_missing_required_fields(self, api, cli):
        api.force_authenticate(user=cli)
        data = json.dumps({"requestTypeId": 1})
        resp = api.post(reverse("create-legal-request"), {"mainData": data}, format="multipart")
        assert resp.status_code == 400

    def test_request_type_not_found(self, api, cli, lr_deps):
        api.force_authenticate(user=cli)
        data = json.dumps({"requestTypeId": 999999, "disciplineId": lr_deps[1].id, "description": "D"})
        resp = api.post(reverse("create-legal-request"), {"mainData": data}, format="multipart")
        assert resp.status_code == 404

    def test_discipline_not_found(self, api, cli, lr_deps):
        api.force_authenticate(user=cli)
        data = json.dumps({"requestTypeId": lr_deps[0].id, "disciplineId": 999999, "description": "D"})
        resp = api.post(reverse("create-legal-request"), {"mainData": data}, format="multipart")
        assert resp.status_code == 404

    def test_create_success(self, api, cli, lr_deps):
        api.force_authenticate(user=cli)
        data = json.dumps({"requestTypeId": lr_deps[0].id, "disciplineId": lr_deps[1].id, "description": "Help me"})
        resp = api.post(reverse("create-legal-request"), {"mainData": data}, format="multipart")
        assert resp.status_code == 201
        assert LegalRequest.objects.filter(user=cli).exists()


# -- upload_legal_request_file edges --
class TestUploadLegalRequestFile:
    def test_no_request_id(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("upload-legal-request-file"), {}, format="multipart")
        assert resp.status_code == 400

    def test_request_not_found(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("upload-legal-request-file"), {"legalRequestId": 999999}, format="multipart")
        assert resp.status_code == 404

    def test_no_files_provided(self, api, cli, lr_deps):
        api.force_authenticate(user=cli)
        lr = LegalRequest.objects.create(user=cli, request_type=lr_deps[0], discipline=lr_deps[1], description="D")
        resp = api.post(reverse("upload-legal-request-file"), {"legalRequestId": lr.id}, format="multipart")
        assert resp.status_code == 400


# -- send_confirmation_email edges --
class TestSendConfirmationEmail:
    def test_no_request_id(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("send-confirmation-email"), {}, format="json")
        assert resp.status_code == 400

    def test_request_not_found(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("send-confirmation-email"), {"legal_request_id": 999999}, format="json")
        assert resp.status_code == 404


# -- add_files_to_legal_request edges --
class TestAddFilesToLegalRequest:
    def test_not_owner_forbidden(self, api, cli, law, lr_deps):
        lr = LegalRequest.objects.create(user=cli, request_type=lr_deps[0], discipline=lr_deps[1], description="D")
        api.force_authenticate(user=law)
        f = SimpleUploadedFile("t.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        resp = api.post(reverse("add-files-to-legal-request", args=[lr.id]), {"files": [f]})
        assert resp.status_code == 403

    def test_no_files(self, api, cli, lr_deps):
        lr = LegalRequest.objects.create(user=cli, request_type=lr_deps[0], discipline=lr_deps[1], description="D")
        api.force_authenticate(user=cli)
        resp = api.post(reverse("add-files-to-legal-request", args=[lr.id]), {})
        assert resp.status_code == 400


# -- corporate_request role decorators --
class TestCorporateRequestRoles:
    def test_client_endpoint_blocks_lawyer(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("client-get-my-organizations"))
        assert resp.status_code == 403

    def test_corporate_endpoint_blocks_client(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.get(reverse("corporate-get-received-requests"))
        assert resp.status_code == 403

    def test_client_get_request_types(self, api, cli):
        CorporateRequestType.objects.create(name="CT33")
        api.force_authenticate(user=cli)
        resp = api.get(reverse("client-get-request-types"))
        assert resp.status_code == 200
        assert resp.data["total_count"] >= 1

    def test_client_get_my_orgs_empty(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.get(reverse("client-get-my-organizations"))
        assert resp.status_code == 200
        assert resp.data["total_count"] == 0

    def test_client_get_my_orgs_with_membership(self, api, cli, corp):
        org = Organization.objects.create(title="Org33", corporate_client=corp)
        OrganizationMembership.objects.create(organization=org, user=cli, role="MEMBER", is_active=True)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("client-get-my-organizations"))
        assert resp.status_code == 200
        assert resp.data["total_count"] == 1
        assert resp.data["organizations"][0]["title"] == "Org33"

    def test_corporate_dashboard_stats(self, api, corp):
        api.force_authenticate(user=corp)
        resp = api.get(reverse("corporate-get-dashboard-stats"))
        assert resp.status_code == 200

    def test_corporate_received_requests_empty(self, api, corp):
        api.force_authenticate(user=corp)
        resp = api.get(reverse("corporate-get-received-requests"))
        assert resp.status_code == 200
