"""Tests for the admin data reassignment API and archived-user exclusions."""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from gym_app.models import (
    ActivityFeed,
    Case,
    DynamicDocument,
    Notification,
    Process,
    User,
)


@pytest.fixture
def admin_user():
    return User.objects.create_user(email="admin@test.com", password="x", role="admin")


@pytest.fixture
def source_lawyer():
    return User.objects.create_user(
        email="source@test.com", password="x", role="lawyer", is_gym_lawyer=True,
        first_name="Source", last_name="Lawyer",
    )


@pytest.fixture
def target_lawyer():
    return User.objects.create_user(
        email="target@test.com", password="x", role="lawyer", is_gym_lawyer=True,
        first_name="Target", last_name="Lawyer",
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(email="client-r@test.com", password="x", role="client")


@pytest.fixture
def case_type():
    return Case.objects.create(type="Civil")


def make_process(lawyer, case_type, ref="P-1"):
    process = Process.objects.create(
        authority="Corte", plaintiff="A", defendant="B", ref=ref,
        lawyer=lawyer, case=case_type, subcase="x",
    )
    return process


def make_doc(creator, state="Progress", assigned_to=None, title="Doc"):
    return DynamicDocument.objects.create(
        title=title, content="<p>x</p>", state=state,
        created_by=creator, managed_by=creator, assigned_to=assigned_to,
    )


SUMMARY_URL = "/api/admin/reassignment/summary/"
EXECUTE_URL = "/api/admin/reassignment/execute/"


# ── Summary ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_summary_forbidden_for_non_admin(api_client, source_lawyer):
    api_client.force_authenticate(user=source_lawyer)
    response = api_client.get(SUMMARY_URL, {"lawyer_id": source_lawyer.id})
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_summary_404_for_non_lawyer(api_client, admin_user, client_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(SUMMARY_URL, {"lawyer_id": client_user.id})
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_summary_splits_eligible_and_ineligible(api_client, admin_user, source_lawyer, case_type):
    make_process(source_lawyer, case_type)
    make_doc(source_lawyer, state="Progress", title="Eligible")
    make_doc(source_lawyer, state="PendingSignatures", title="Pending")
    make_doc(source_lawyer, state="FullySigned", title="Signed")
    make_doc(source_lawyer, state="Rejected", title="Rejected")
    make_doc(source_lawyer, state="Expired", title="Expired")

    api_client.force_authenticate(user=admin_user)
    response = api_client.get(SUMMARY_URL, {"lawyer_id": source_lawyer.id})

    assert response.status_code == status.HTTP_200_OK
    data = response.data
    assert data["counts"]["processes"] == 1
    assert data["counts"]["eligible_documents"] == 1
    assert data["counts"]["ineligible_documents"] == 4
    reasons = {d["state"]: d["reason"] for d in data["ineligible_documents"]}
    assert reasons["PendingSignatures"] == "En proceso de firma"
    assert reasons["FullySigned"] == "Firmado"
    assert reasons["Rejected"] == "Rechazado"
    assert reasons["Expired"] == "Vencido"


# ── Execute ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_execute_forbidden_for_non_admin(api_client, source_lawyer, target_lawyer):
    api_client.force_authenticate(user=source_lawyer)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
        "process_ids": [], "document_ids": [1],
    }, format="json")
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_execute_same_lawyer_rejected(api_client, admin_user, source_lawyer):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": source_lawyer.id,
        "document_ids": [1],
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_execute_archived_target_rejected(api_client, admin_user, source_lawyer, target_lawyer):
    target_lawyer.archive()
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
        "document_ids": [1],
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "archivado" in response.data["detail"]


@pytest.mark.django_db
def test_execute_empty_selection_rejected(api_client, admin_user, source_lawyer, target_lawyer):
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
        "process_ids": [], "document_ids": [],
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_execute_foreign_process_rejected(api_client, admin_user, source_lawyer, target_lawyer, case_type):
    foreign = make_process(target_lawyer, case_type, ref="FOREIGN")
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
        "process_ids": [foreign.id], "document_ids": [],
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "procesos" in response.data["detail"]


@pytest.mark.django_db
def test_execute_ineligible_document_rejected(api_client, admin_user, source_lawyer, target_lawyer):
    doc = make_doc(source_lawyer, state="FullySigned")
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
        "document_ids": [doc.id],
    }, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert doc.id in response.data["ineligible_ids"]


@pytest.mark.django_db
def test_execute_happy_path(api_client, admin_user, source_lawyer, target_lawyer, client_user, case_type):
    process = make_process(source_lawyer, case_type)
    personal_doc = make_doc(source_lawyer, state="Progress", assigned_to=source_lawyer, title="Personal")
    client_doc = make_doc(source_lawyer, state="Completed", assigned_to=client_user, title="Client")

    api_client.force_authenticate(user=admin_user)
    response = api_client.post(EXECUTE_URL, {
        "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
        "process_ids": [process.id], "document_ids": [personal_doc.id, client_doc.id],
        "archive_source": True,
    }, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["transferred_processes"] == 1
    assert response.data["transferred_documents"] == 2
    assert response.data["source_archived"] is True

    process.refresh_from_db()
    personal_doc.refresh_from_db()
    client_doc.refresh_from_db()
    source_lawyer.refresh_from_db()

    assert process.lawyer == target_lawyer
    # managed_by moves; created_by is preserved (audit)
    assert personal_doc.managed_by == target_lawyer
    assert personal_doc.created_by == source_lawyer
    assert client_doc.managed_by == target_lawyer
    # personal doc's assigned_to (was source) follows the transfer
    assert personal_doc.assigned_to == target_lawyer
    # client-assigned doc keeps its client
    assert client_doc.assigned_to == client_user
    # source archived
    assert source_lawyer.is_archived is True
    # activity records for both lawyers
    assert ActivityFeed.objects.filter(user=source_lawyer, description__icontains="transferidos").exists()
    assert ActivityFeed.objects.filter(user=target_lawyer, description__icontains="recibidos").exists()


@pytest.mark.django_db
def test_execute_atomicity_rolls_back(api_client, admin_user, source_lawyer, target_lawyer, case_type):
    process = make_process(source_lawyer, case_type)
    api_client.force_authenticate(user=admin_user)

    with patch(
        "gym_app.views.admin_reassignment.ActivityFeed.objects.create",
        side_effect=Exception("boom"),
    ):
        with pytest.raises(Exception):
            api_client.post(EXECUTE_URL, {
                "source_lawyer_id": source_lawyer.id, "target_lawyer_id": target_lawyer.id,
                "process_ids": [process.id], "document_ids": [],
            }, format="json")

    process.refresh_from_db()
    assert process.lawyer == source_lawyer  # unchanged — rolled back


# ── Archive / Unarchive ─────────────────────────────────────────────

@pytest.mark.django_db
def test_archive_forbidden_for_non_admin(api_client, source_lawyer, target_lawyer):
    api_client.force_authenticate(user=source_lawyer)
    url = reverse("archive-lawyer", args=[target_lawyer.id])
    assert api_client.post(url, {}).status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_archive_self_rejected(api_client, admin_user):
    # An admin who is also a lawyer cannot archive themselves
    admin_lawyer = User.objects.create_user(
        email="adminlawyer@test.com", password="x", role="admin",
    )
    # role must be lawyer for _get_lawyer; make a lawyer-admin edge
    admin_lawyer.role = "lawyer"
    admin_lawyer.is_staff = True
    admin_lawyer.save()
    api_client.force_authenticate(user=admin_lawyer)
    url = reverse("archive-lawyer", args=[admin_lawyer.id])
    response = api_client.post(url, {})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_archive_and_unarchive_flow(api_client, admin_user, source_lawyer):
    api_client.force_authenticate(user=admin_user)

    archive_url = reverse("archive-lawyer", args=[source_lawyer.id])
    r1 = api_client.post(archive_url, {})
    assert r1.status_code == status.HTTP_200_OK
    assert r1.data["is_archived"] is True

    # double archive rejected
    assert api_client.post(archive_url, {}).status_code == status.HTTP_400_BAD_REQUEST

    unarchive_url = reverse("unarchive-lawyer", args=[source_lawyer.id])
    r2 = api_client.post(unarchive_url, {})
    assert r2.status_code == status.HTTP_200_OK
    assert r2.data["is_archived"] is False

    # double unarchive rejected
    assert api_client.post(unarchive_url, {}).status_code == status.HTTP_400_BAD_REQUEST


# ── Notification exclusions ─────────────────────────────────────────

@pytest.mark.django_db
def test_create_notification_skips_archived(source_lawyer):
    from gym_app.services.notification_service import create_notification

    source_lawyer.archive()
    result = create_notification(source_lawyer, "T", "M")
    assert result is None
    assert Notification.objects.filter(user=source_lawyer).count() == 0


@pytest.mark.django_db
def test_build_process_recipients_excludes_archived(source_lawyer, client_user, case_type):
    from gym_app.services.notification_service import build_process_recipients

    process = make_process(source_lawyer, case_type)
    process.clients.add(client_user)
    client_user.archive()

    recipients = build_process_recipients(process)
    assert source_lawyer in recipients
    assert client_user not in recipients

    source_lawyer.archive()
    assert build_process_recipients(process) == []
