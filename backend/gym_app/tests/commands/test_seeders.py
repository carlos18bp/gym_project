"""Integration tests for the fake-data seeder management commands.

These commands populate staging with coherent fake data. The tests assert the
three checklist guarantees per new domain: (a) coverage of every choice/status,
(b) representative edge cases, and (c) idempotency (re-running never duplicates).
File-writing seeders redirect MEDIA_ROOT to a tmp dir so nothing leaks into the
real media/ tree.
"""
import pytest
from django.core.management import call_command

from gym_app.models import (
    CorporateRequest,
    IntranetProfile,
    LegalUpdate,
    Organization,
    OrganizationMembership,
    PaymentHistory,
    Service,
    ServiceField,
    ServiceRequest,
    Subscription,
    User,
)

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture
def media_tmp(settings, tmp_path):
    """Redirect file writes to a throwaway MEDIA_ROOT."""
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.fixture
def role_users():
    """One user per role so the seeders find role-appropriate targets."""
    return {
        "basic": User.objects.create_user(email="seed_basic@test.com", password="x", role="basic"),
        "client": User.objects.create_user(email="seed_client@test.com", password="x", role="client"),
        "corporate": User.objects.create_user(email="seed_corp@test.com", password="x", role="corporate_client"),
        "lawyer": User.objects.create_user(email="seed_lawyer@test.com", password="x", role="lawyer"),
    }


@pytest.fixture
def org_with_member(role_users):
    """Organization with a leader and one active client member (corporate clean() prereq)."""
    org = Organization.objects.create(
        title="SeedOrg", description="d", corporate_client=role_users["corporate"], is_active=True
    )
    OrganizationMembership.objects.create(organization=org, user=role_users["corporate"], role="LEADER")
    OrganizationMembership.objects.create(
        organization=org, user=role_users["client"], role="MEMBER", is_active=True
    )
    return org


# ── Subscriptions ────────────────────────────────────────────────────────────

def test_create_subscriptions_covers_all_plan_and_status_combos(role_users):
    """Create subscriptions covers all plan and status combos."""
    call_command("create_subscriptions")

    assert set(Subscription.objects.values_list("plan_type", flat=True)) == {"basico", "cliente", "corporativo"}
    assert set(Subscription.objects.values_list("status", flat=True)) == {"active", "cancelled", "expired"}
    assert Subscription.objects.count() == 9


def test_create_subscriptions_seeds_declined_and_error_payments(role_users):
    """Create subscriptions seeds declined and error payments."""
    call_command("create_subscriptions")

    statuses = set(PaymentHistory.objects.values_list("status", flat=True))
    assert {"declined", "error"} <= statuses


def test_create_subscriptions_error_payment_carries_message(role_users):
    """Create subscriptions error payment carries message."""
    call_command("create_subscriptions")

    assert PaymentHistory.objects.filter(status="error", error_message__isnull=False).exists()


def test_create_subscriptions_is_idempotent(role_users):
    """Create subscriptions is idempotent."""
    call_command("create_subscriptions")
    first = Subscription.objects.count()

    call_command("create_subscriptions")

    assert Subscription.objects.count() == first


# ── Services / trámites ──────────────────────────────────────────────────────

def test_create_services_covers_all_eight_field_types(role_users, media_tmp):
    """Create services covers all eight field types."""
    call_command("create_services")

    assert set(ServiceField.objects.values_list("field_type", flat=True)) == {
        "input", "text_area", "number", "date", "email", "select_single", "select_multiple", "file",
    }


def test_create_services_requests_span_all_six_statuses(role_users, media_tmp):
    """Create services requests span all six statuses."""
    call_command("create_services")

    assert set(ServiceRequest.objects.values_list("status", flat=True)) == {
        "DRAFT", "OPEN", "IN_STUDY", "IN_PROGRESS", "ANSWERED", "FINALIZED",
    }


def test_create_services_marks_one_service_soft_deleted(role_users, media_tmp):
    """Create services marks one service soft deleted."""
    call_command("create_services")

    assert Service.objects.filter(is_deleted=True).exists()


@pytest.mark.edge
def test_create_services_draft_requests_have_no_tracking_number(role_users, media_tmp):
    """Create services draft requests have no tracking number."""
    call_command("create_services")

    drafts = ServiceRequest.objects.filter(status="DRAFT")
    assert drafts.exists()
    assert all(r.tracking_number is None for r in drafts)


def test_create_services_submitted_requests_have_tracking_number(role_users, media_tmp):
    """Create services submitted requests have tracking number."""
    call_command("create_services")

    submitted = ServiceRequest.objects.exclude(status="DRAFT")
    assert submitted.exists()
    assert all(r.tracking_number for r in submitted)


def test_create_services_is_idempotent(role_users, media_tmp):
    """Create services is idempotent."""
    call_command("create_services")
    first = ServiceRequest.objects.count()

    call_command("create_services")

    assert ServiceRequest.objects.count() == first


# ── Corporate requests ───────────────────────────────────────────────────────

def test_create_corporate_requests_span_all_five_statuses(role_users, org_with_member, media_tmp):
    """Create corporate requests span all five statuses."""
    call_command("create_corporate_requests")

    assert set(CorporateRequest.objects.values_list("status", flat=True)) == {
        "PENDING", "IN_REVIEW", "RESPONDED", "RESOLVED", "CLOSED",
    }


def test_create_corporate_requests_pass_business_rule_validation(role_users, org_with_member, media_tmp):
    """Create corporate requests pass business rule validation."""
    call_command("create_corporate_requests")

    assert CorporateRequest.objects.exists()
    for corporate_request in CorporateRequest.objects.all():
        corporate_request.full_clean()  # clean(): client active member + corporate_client is leader


def test_create_corporate_requests_generate_request_numbers(role_users, org_with_member, media_tmp):
    """Create corporate requests generate request numbers."""
    call_command("create_corporate_requests")

    assert all(
        cr.request_number and cr.request_number.startswith("CORP-")
        for cr in CorporateRequest.objects.all()
    )


def test_create_corporate_requests_is_idempotent(role_users, org_with_member, media_tmp):
    """Create corporate requests is idempotent."""
    call_command("create_corporate_requests")
    first = CorporateRequest.objects.count()

    call_command("create_corporate_requests")

    assert CorporateRequest.objects.count() == first


# ── Intranet content ─────────────────────────────────────────────────────────

def test_create_intranet_content_keeps_profile_a_singleton(media_tmp):
    """Create intranet content keeps profile a singleton."""
    call_command("create_intranet_content")
    call_command("create_intranet_content")

    assert IntranetProfile.objects.count() == 1


def test_create_intranet_content_seeds_active_and_inactive_updates(media_tmp):
    """Create intranet content seeds active and inactive updates."""
    call_command("create_intranet_content")

    assert LegalUpdate.objects.filter(is_active=True).exists()
    assert LegalUpdate.objects.filter(is_active=False).exists()
