"""
Edge tests for gym_app/views/reports.py to close coverage gaps.

Targets:
- lawyers_workload with 2+ lawyers → chart creation (lines 975-1040)
- requests_by_type_discipline report (lines 1242-1247, 1282-1283, 1696, 1717-1731, 1741-1742)
- user_activity action type formatting (lines 806-811)
- generate_excel_report no-date path (lines 68-70)
"""
import pytest
import io
import datetime
import unittest.mock as mock
from django.urls import reverse
from django.db import models
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile

from gym_app.models import (
    Process, Case, Stage, User, ActivityFeed, DynamicDocument,
    LegalRequest, LegalRequestType, LegalDiscipline, LegalRequestFiles
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="rep-admin@example.com",
        password="testpassword",
        first_name="Rep",
        last_name="Admin",
        role="admin",
    )


@pytest.fixture
def two_lawyers(db):
    """Create 2 lawyers so chart creation is triggered (len(df) > 1)."""
    l1 = User.objects.create_user(
        email="rep-lawyer1@example.com",
        password="testpassword",
        first_name="Lawyer",
        last_name="One",
        role="lawyer",
    )
    l2 = User.objects.create_user(
        email="rep-lawyer2@example.com",
        password="testpassword",
        first_name="Lawyer",
        last_name="Two",
        role="lawyer",
    )
    return l1, l2


@pytest.fixture
def client_user(db):
    return User.objects.create_user(
        email="rep-client@example.com",
        password="testpassword",
        first_name="Rep",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def processes_two_lawyers(db, two_lawyers, client_user):
    """Create processes for two lawyers so workload chart triggers."""
    l1, l2 = two_lawyers
    case = Case.objects.create(type="Civil-Rep")
    p1 = Process.objects.create(
        authority="Auth1", plaintiff="P1", defendant="D1",
        ref="REP-001", lawyer=l1, case=case, subcase="Sub1",
    )
    p1.clients.add(client_user)
    p2 = Process.objects.create(
        authority="Auth2", plaintiff="P2", defendant="D2",
        ref="REP-002", lawyer=l2, case=case, subcase="Sub2",
    )
    p2.clients.add(client_user)
    # Add a Fallo stage to p2 to mark it completed
    fallo = Stage.objects.create(status="Fallo")
    p2.stages.add(fallo)
    return p1, p2


@pytest.fixture
def legal_request_data(db):  # pragma: no cover – unused fixture
    """Create legal request data for requests_by_type_discipline report."""
    req_type1 = LegalRequestType.objects.create(name="Consulta-Rep")
    req_type2 = LegalRequestType.objects.create(name="Representación-Rep")
    disc1 = LegalDiscipline.objects.create(name="Civil-Rep")
    disc2 = LegalDiscipline.objects.create(name="Penal-Rep")

    user1 = User.objects.create_user(
        email="lr-user1@example.com", password="tp",
        first_name="LR", last_name="User1", role="client",
    )
    user2 = User.objects.create_user(
        email="lr-user2@example.com", password="tp",
        first_name="LR", last_name="User2", role="client",
    )

    r1 = LegalRequest.objects.create(
        user=user1, request_type=req_type1, discipline=disc1,
        description="Consulta sobre derecho civil",
    )
    r2 = LegalRequest.objects.create(
        user=user2, request_type=req_type2, discipline=disc2,
        description="Representación penal",
    )
    r3 = LegalRequest.objects.create(
        user=user1, request_type=req_type1, discipline=disc2,
        description="Consulta penal",
    )
    return [r1, r2, r3]


@pytest.mark.django_db
class TestReportsEdges:
    @mock.patch("gym_app.views.reports.user_id", None)
    def test_lawyers_workload_multi_lawyer_chart(
        self, api_client, admin_user, processes_two_lawyers
    ):
        """Cover lines 973-1040: chart creation with 2+ lawyers."""
        api_client.force_authenticate(user=admin_user)
        url = reverse("generate-excel-report")
        data = {
            "reportType": "lawyers_workload",
            "startDate": (timezone.now().date() - datetime.timedelta(days=60)).strftime("%Y-%m-%d"),
            "endDate": timezone.now().date().strftime("%Y-%m-%d"),
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "application/vnd.openxmlformats" in response["Content-Type"]

    def test_requests_by_type_discipline_report(
        self, api_client, admin_user
    ):
        """Cover requests_by_type_discipline report path (lines 1242+)."""
        # Create minimal data inline to avoid fixture ordering issues
        req_type = LegalRequestType.objects.create(name="Consulta-RTD")
        disc = LegalDiscipline.objects.create(name="Civil-RTD")
        user = User.objects.create_user(
            email="rtd-user@example.com", password="tp",
            first_name="RTD", last_name="User", role="client",
        )
        LegalRequest.objects.create(
            user=user, request_type=req_type, discipline=disc,
            description="Test request",
        )
        api_client.force_authenticate(user=admin_user)
        url = reverse("generate-excel-report")
        data = {
            "reportType": "requests_by_type_discipline",
            "startDate": (timezone.now().date() - datetime.timedelta(days=60)).strftime("%Y-%m-%d"),
            "endDate": timezone.now().date().strftime("%Y-%m-%d"),
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert "application/vnd.openxmlformats" in response["Content-Type"]

    def test_user_activity_delete_and_other_action_format(
        self, api_client, admin_user
    ):
        """Cover lines 806-811: delete and other action type formatting."""
        ActivityFeed.objects.create(
            user=admin_user,
            action_type="delete_process",
            description="Deleted process",
        )
        ActivityFeed.objects.create(
            user=admin_user,
            action_type="view_process",
            description="Viewed process",
        )
        api_client.force_authenticate(user=admin_user)
        url = reverse("generate-excel-report")
        data = {
            "reportType": "user_activity",
            "startDate": (timezone.now().date() - datetime.timedelta(days=60)).strftime("%Y-%m-%d"),
            "endDate": timezone.now().date().strftime("%Y-%m-%d"),
        }
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_report_no_dates_provided(
        self, api_client, admin_user
    ):
        """Cover lines 68-70: no dates provided → use 1900 start and today end."""
        api_client.force_authenticate(user=admin_user)
        url = reverse("generate-excel-report")
        data = {"reportType": "registered_users"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK

    def test_received_legal_requests_no_date(self, api_client, admin_user):
        """Cover received_legal_requests without date filters."""
        req_type = LegalRequestType.objects.create(name="NoDate-Type")
        disc = LegalDiscipline.objects.create(name="NoDate-Disc")
        user = User.objects.create_user(
            email="nodate-user@example.com", password="tp",
            first_name="ND", last_name="User", role="client",
        )
        LegalRequest.objects.create(
            user=user, request_type=req_type, discipline=disc,
            description="No date request",
        )
        api_client.force_authenticate(user=admin_user)
        url = reverse("generate-excel-report")
        data = {"reportType": "received_legal_requests"}
        response = api_client.post(url, data, format="json")
        assert response.status_code == status.HTTP_200_OK
