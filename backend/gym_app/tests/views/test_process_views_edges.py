"""
Edge-case tests for process views to close coverage gaps in gym_app/views/process.py.

Targets uncovered lines: 46-47, 67, 75-76, 81-82, 88-89, 115, 120-125,
142-144, 161, 167-169, 185, 192-198, 203-208, 213-217, 225-226, 239-255.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import Process, Case, Stage, CaseFile, RecentProcess

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="lawyer-edge@example.com",
        password="testpassword",
        first_name="Lawyer",
        last_name="Edge",
        role="Lawyer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="client-edge@example.com",
        password="testpassword",
        first_name="Client",
        last_name="Edge",
        role="Client",
    )


@pytest.fixture
def admin_user():
    return User.objects.create_user(
        email="admin-edge@example.com",
        password="testpassword",
        first_name="Admin",
        last_name="Edge",
        role="Admin",
    )


@pytest.fixture
def case_type():
    return Case.objects.create(type="Civil")


@pytest.fixture
def process_with_stages(lawyer, client_user, case_type):
    proc = Process.objects.create(
        authority="Juzgado 1",
        plaintiff="Plaintiff",
        defendant="Defendant",
        ref="REF-001",
        lawyer=lawyer,
        case=case_type,
        progress=50,
    )
    proc.clients.add(client_user)
    stage = Stage.objects.create(status="Initial stage")
    proc.stages.add(stage)
    return proc


# ---------------------------------------------------------------------------
# process_list – exception handler (lines 46-47)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestProcessListEdges:
    def test_process_list_exception_returns_500(self, api_client, client_user):
        """Cover the except block in process_list (lines 46-47)."""
        api_client.force_authenticate(user=client_user)
        url = reverse("process-list")
        with patch(
            "gym_app.views.process.Process.objects"
        ) as mock_qs:
            mock_qs.filter.side_effect = Exception("DB error")
            response = api_client.get(url)
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "DB error" in response.data["detail"]

    def test_process_list_admin_returns_all(self, api_client, admin_user, process_with_stages):
        """Cover the else branch (non-client, non-lawyer role) in process_list."""
        api_client.force_authenticate(user=admin_user)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# create_process – edge cases (lines 67, 75-76, 81-82, 88-89, 115, 120-125, 142-144)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestCreateProcessEdges:
    def _build_main_data(self, **overrides):
        defaults = {
            "clientIds": [],
            "lawyerId": None,
            "caseTypeId": None,
            "authority": "Auth",
            "plaintiff": "P",
            "defendant": "D",
            "ref": "R-1",
            "subcase": "Sub-civil",
            "stages": [],
        }
        defaults.update(overrides)
        return defaults

    def test_create_process_single_client_id_not_list(self, api_client, lawyer, client_user, case_type):
        """Cover line 67: client_ids converted from scalar to list."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=client_user.id,  # scalar, not a list
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_process_invalid_lawyer(self, api_client, lawyer, client_user, case_type):
        """Cover lines 75-76: lawyer DoesNotExist."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=99999,
            caseTypeId=case_type.id,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_process_invalid_case_type(self, api_client, lawyer, client_user, case_type):
        """Cover lines 81-82: case type DoesNotExist."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=lawyer.id,
            caseTypeId=99999,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_create_process_non_numeric_progress(self, api_client, lawyer, client_user, case_type):
        """Cover lines 88-89: progress that can't be cast to int."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
            progress="not-a-number",
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED
        # progress should fall back to 0
        assert response.data["progress"] == 0

    def test_create_process_stage_without_status_skipped(self, api_client, lawyer, client_user, case_type):
        """Cover line 115: stage with empty status is skipped."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
            stages=[{"status": ""}, {"status": "Filed"}],
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED
        proc = Process.objects.get(pk=response.data["id"])
        assert proc.stages.count() == 1

    def test_create_process_stage_with_valid_date(self, api_client, lawyer, client_user, case_type):
        """Cover lines 120-123: stage with valid ISO date."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
            stages=[{"status": "Filed", "date": "2025-06-15"}],
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED
        proc = Process.objects.get(pk=response.data["id"])
        stage = proc.stages.first()
        assert str(stage.date) == "2025-06-15"

    def test_create_process_stage_with_invalid_date_falls_back(self, api_client, lawyer, client_user, case_type):
        """Cover lines 124-125: invalid date falls back to today."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
            stages=[{"status": "Filed", "date": "not-a-date"}],
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_process_unexpected_exception(self, api_client, lawyer, client_user, case_type):
        """Cover lines 142-144: unexpected exception returns 500."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[client_user.id],
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
        )
        with patch("gym_app.views.process.Process.objects.create", side_effect=Exception("unexpected")):
            response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR

    def test_create_process_empty_client_ids(self, api_client, lawyer, case_type):
        """Cover line 71: empty clientIds returns 404."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("create-process")
        main_data = self._build_main_data(
            clientIds=[],
            lawyerId=lawyer.id,
            caseTypeId=case_type.id,
        )
        response = api_client.post(url, {"mainData": json.dumps(main_data)}, format="multipart")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# update_process – edge cases
# (lines 161, 167-169, 185, 192-198, 203-208, 213-217, 225-226, 239-255)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
class TestUpdateProcessEdges:
    def test_update_process_json_body_directly(self, api_client, lawyer, process_with_stages):
        """Cover line 161: request.data is dict without 'mainData' key."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {"plaintiff": "New Plaintiff", "authorityEmail": "auth@example.com"}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        assert process_with_stages.plaintiff == "New Plaintiff"
        assert process_with_stages.authority_email == "auth@example.com"

    def test_update_process_invalid_json_maindata_fallback(self, api_client, lawyer, process_with_stages):
        """Cover lines 167-169: mainData is not valid JSON, fallback to request.data."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        response = api_client.put(url, {"mainData": "not-json{{"}, format="multipart")
        assert response.status_code == status.HTTP_200_OK

    def test_update_process_progress_non_numeric(self, api_client, lawyer, process_with_stages):
        """Cover lines 192-198: progress update with non-numeric value."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {"progress": "abc"}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        # Falls back to process.progress or 0
        assert process_with_stages.progress in (50, 0)

    def test_update_process_progress_clamped(self, api_client, lawyer, process_with_stages):
        """Cover line 197: progress clamped to 0-100."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {"progress": 150}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        assert process_with_stages.progress == 100

    def test_update_process_client_ids_scalar(self, api_client, lawyer, process_with_stages, client_user):
        """Cover lines 203-208: clientIds as scalar, not list."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {"clientIds": client_user.id}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_update_process_invalid_lawyer_id(self, api_client, lawyer, process_with_stages):
        """Cover lines 213-217: lawyerId that doesn't exist (DoesNotExist caught)."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {"lawyerId": 99999}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        # Lawyer should remain unchanged
        assert process_with_stages.lawyer == lawyer

    def test_update_process_invalid_case_type_id(self, api_client, lawyer, process_with_stages, case_type):
        """Cover lines 225-226: caseTypeId that doesn't exist."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {"caseTypeId": 99999}
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        assert process_with_stages.case == case_type

    def test_update_process_replaces_stages(self, api_client, lawyer, process_with_stages):
        """Cover lines 239-255: stage replacement with valid/invalid dates."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        data = {
            "stages": [
                {"status": "New stage", "date": "2025-03-01"},
                {"status": ""},  # empty status → skipped
                {"status": "Another stage", "date": "bad-date"},  # invalid date → today
                {"status": "No date stage"},  # no date → today
            ]
        }
        response = api_client.put(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        # 3 stages (one skipped due to empty status)
        assert process_with_stages.stages.count() == 3
        dates = list(process_with_stages.stages.values_list("date", flat=True))
        from datetime import date
        assert date(2025, 3, 1) in dates

    def test_update_process_with_maindata_multipart(self, api_client, lawyer, process_with_stages):
        """Cover lines 163-166: mainData as valid JSON string in multipart."""
        api_client.force_authenticate(user=lawyer)
        url = reverse("update-process", kwargs={"pk": process_with_stages.pk})
        main_data = json.dumps({"defendant": "Updated Defendant"})
        response = api_client.put(url, {"mainData": main_data}, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        process_with_stages.refresh_from_db()
        assert process_with_stages.defendant == "Updated Defendant"
