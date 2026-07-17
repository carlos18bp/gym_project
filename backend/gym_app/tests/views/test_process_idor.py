"""IDOR regression tests for process views.

Covers:
- update_process: clients listed on a process cannot edit it; only gym staff can.
- update_case_file: only the assigned lawyer, listed clients, or gym staff can upload.
- process_list: basic/corporate_client roles cannot list other users' processes.
"""
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status

from gym_app.models import Process, User


@pytest.fixture
def other_client(db):
    """Other client."""
    return User.objects.create_user(
        email="other_client@idor.test",
        password="testpassword",
        role="client",
    )


@pytest.fixture
def victim_lawyer(db):
    """Victim lawyer."""
    return User.objects.create_user(
        email="victim_lawyer@idor.test",
        password="testpassword",
        role="lawyer",
        is_gym_lawyer=True,
    )


@pytest.fixture
def victim_process(victim_lawyer, case_type, client_user):
    """Victim process."""
    process = Process.objects.create(
        authority="Court",
        plaintiff="P",
        defendant="D",
        ref="VICTIM-001",
        lawyer=victim_lawyer,
        case=case_type,
    )
    process.clients.add(client_user)
    return process


@pytest.mark.django_db
class TestUpdateProcessIDOR:
    """update_process must reject anyone who is not gym staff."""

    def test_unrelated_client_cannot_update_process(
        self, api_client, other_client, victim_process
    ):
        """Unrelated client cannot update process."""
        api_client.force_authenticate(user=other_client)
        url = reverse("update-process", args=[victim_process.pk])
        response = api_client.put(
            url,
            data={"plaintiff": "ATTACKER"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        victim_process.refresh_from_db()
        assert victim_process.plaintiff == "P"

    def test_listed_client_cannot_update_process(
        self, api_client, client_user, victim_process
    ):
        """Even a client listed on the process cannot edit it — read-only access."""
        api_client.force_authenticate(user=client_user)
        url = reverse("update-process", args=[victim_process.pk])
        response = api_client.put(
            url,
            data={"plaintiff": "ATTACKER"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        victim_process.refresh_from_db()
        assert victim_process.plaintiff == "P"

    def test_basic_user_cannot_update_process(
        self, api_client, basic_user, victim_process
    ):
        """Basic user cannot update process."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("update-process", args=[victim_process.pk])
        response = api_client.put(
            url,
            data={"plaintiff": "ATTACKER"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_gym_lawyer_can_update_process(
        self, api_client, lawyer_user, victim_process
    ):
        """A gym lawyer (is_gym_lawyer=True) can update any process."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("update-process", args=[victim_process.pk])
        payload = {
            "mainData": json.dumps(
                {
                    "plaintiff": "Updated by gym lawyer",
                    "stages": [],
                }
            )
        }
        response = api_client.put(url, data=payload)
        assert response.status_code == status.HTTP_200_OK
        victim_process.refresh_from_db()
        assert victim_process.plaintiff == "Updated by gym lawyer"


@pytest.mark.django_db
class TestUpdateCaseFileIDOR:
    """update_case_file must verify ownership/membership."""

    def _upload(self, api_client, process_id):
        url = reverse("update-file")
        return api_client.post(
            url,
            data={
                "processId": process_id,
                "file": SimpleUploadedFile(
                    "evidence.pdf", b"fake-pdf-bytes", content_type="application/pdf"
                ),
            },
            format="multipart",
        )

    def test_unrelated_client_cannot_upload_to_others_process(
        self, api_client, other_client, victim_process
    ):
        """Unrelated client cannot upload to others process."""
        api_client.force_authenticate(user=other_client)
        response = self._upload(api_client, victim_process.pk)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert victim_process.case_files.count() == 0

    def test_basic_user_cannot_upload(self, api_client, basic_user, victim_process):
        """Basic user cannot upload."""
        api_client.force_authenticate(user=basic_user)
        response = self._upload(api_client, victim_process.pk)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_listed_client_can_upload(
        self, api_client, client_user, victim_process
    ):
        """Listed client can upload."""
        api_client.force_authenticate(user=client_user)
        response = self._upload(api_client, victim_process.pk)
        assert response.status_code == status.HTTP_201_CREATED
        assert victim_process.case_files.count() == 1

    def test_gym_lawyer_can_upload(self, api_client, lawyer_user, victim_process):
        """Gym lawyer can upload."""
        api_client.force_authenticate(user=lawyer_user)
        response = self._upload(api_client, victim_process.pk)
        assert response.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestProcessListIDOR:
    """process_list must not leak other users' processes to non-staff roles."""

    def test_basic_user_sees_no_processes(
        self, api_client, basic_user, victim_process
    ):
        """Basic user sees no processes."""
        api_client.force_authenticate(user=basic_user)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_corporate_client_sees_no_processes(
        self, api_client, corporate_user, victim_process
    ):
        """Corporate client sees no processes."""
        api_client.force_authenticate(user=corporate_user)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_unrelated_client_does_not_see_others_processes(
        self, api_client, other_client, victim_process
    ):
        """Unrelated client does not see others processes."""
        api_client.force_authenticate(user=other_client)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        refs = [p["ref"] for p in response.data]
        assert "VICTIM-001" not in refs

    def test_listed_client_sees_own_process(
        self, api_client, client_user, victim_process
    ):
        """Listed client sees own process."""
        api_client.force_authenticate(user=client_user)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        refs = [p["ref"] for p in response.data]
        assert "VICTIM-001" in refs

    def test_gym_lawyer_sees_all_processes(
        self, api_client, lawyer_user, victim_process
    ):
        """Gym lawyer sees all processes."""
        api_client.force_authenticate(user=lawyer_user)
        url = reverse("process-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        refs = [p["ref"] for p in response.data]
        assert "VICTIM-001" in refs
