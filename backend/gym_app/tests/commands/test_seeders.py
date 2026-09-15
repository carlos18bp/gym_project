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
    DocumentPaymentRecord,
    DynamicDocument,
    IntranetProfile,
    LegalUpdate,
    Organization,
    OrganizationMembership,
    PaymentHistory,
    Process,
    Service,
    ServiceField,
    ServiceRequest,
    Subscription,
    TourProgress,
    User,
)
from gym_app.views.admin_reassignment import (
    ELIGIBLE_DOCUMENT_STATES,
    INELIGIBLE_STATE_REASONS,
)
from gym_app.views.dynamic_documents.permissions import apply_visibility_filter

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


# ── Release QA data ──────────────────────────────────────────────────────────

@pytest.fixture
def qa_base_users():
    """Provide the pool accounts create_release_qa_data anchors its scenarios to."""
    return {
        "lawyer": User.objects.create_user(
            email="lawyer1@example.com", password="x", role="lawyer"
        ),
        "payments_client": User.objects.create_user(
            email="client1@example.com", password="x", role="basic"
        ),
        "reassign_client": User.objects.create_user(
            email="client2@example.com", password="x", role="client"
        ),
    }


def test_create_release_qa_data_seeds_admin_without_django_admin_access(media_tmp):
    """Platform admin is seeded with role only, never Django staff powers."""
    call_command("create_clients_lawyers")

    admin = User.objects.get(email="admin@example.com")
    assert admin.role == "admin"
    assert admin.is_staff is False
    assert admin.is_superuser is False


def test_reassignment_source_covers_all_four_ineligible_reasons(qa_base_users, media_tmp):
    """The source lawyer carries one document per blocked state."""
    call_command("create_release_qa_data")

    blocked = DynamicDocument.objects.filter(
        managed_by__email="abogado.reasignar@example.com"
    ).exclude(state__in=ELIGIBLE_DOCUMENT_STATES)

    assert set(blocked.values_list("state", flat=True)) == set(INELIGIBLE_STATE_REASONS)


def test_reassignment_source_covers_all_four_eligible_states(qa_base_users, media_tmp):
    """The source lawyer carries one transferable document per eligible state."""
    call_command("create_release_qa_data")

    transferable = DynamicDocument.objects.filter(
        managed_by__email="abogado.reasignar@example.com",
        state__in=ELIGIBLE_DOCUMENT_STATES,
    )

    assert set(transferable.values_list("state", flat=True)) == set(ELIGIBLE_DOCUMENT_STATES)


def test_reassignment_source_keeps_the_screen_small(qa_base_users, media_tmp):
    """The whole scenario fits on one screen: 8 documents, 4 processes."""
    call_command("create_release_qa_data")

    source = User.objects.get(email="abogado.reasignar@example.com")
    assert DynamicDocument.objects.filter(managed_by=source).count() == 8
    assert Process.objects.filter(lawyer=source).count() == 4


def test_reassignment_target_starts_empty(qa_base_users, media_tmp):
    """The target lawyer has nothing, so a transfer is trivially verifiable."""
    call_command("create_release_qa_data")

    target = User.objects.get(email="abogado.destino@example.com")
    assert DynamicDocument.objects.filter(managed_by=target).count() == 0


def test_payment_records_cover_every_status(qa_base_users, media_tmp):
    """Every DocumentPaymentRecord status is represented, rejected included."""
    call_command("create_release_qa_data")

    assert set(DocumentPaymentRecord.objects.values_list("status", flat=True)) == {
        DocumentPaymentRecord.STATUS_UPLOADED,
        DocumentPaymentRecord.STATUS_ACCEPTED,
        DocumentPaymentRecord.STATUS_REJECTED,
    }


def test_payment_rejection_carries_a_reason(qa_base_users, media_tmp):
    """A rejected installment always explains itself to the client."""
    call_command("create_release_qa_data")

    rejected = DocumentPaymentRecord.objects.get(status=DocumentPaymentRecord.STATUS_REJECTED)
    assert "no corresponde al pactado" in rejected.rejection_reason


def test_payment_documents_all_expose_a_progress(qa_base_users, media_tmp):
    """No scenario is mute: get_payment_progress() drives the whole submodule."""
    call_command("create_release_qa_data")

    docs = DynamicDocument.objects.filter(title__startswith="[QA Cuentas de Cobro]")
    assert docs.count() == 4
    assert all(doc.get_payment_progress() is not None for doc in docs)


@pytest.mark.edge
def test_single_installment_document_has_nothing_uploaded_yet(qa_base_users, media_tmp):
    """The 'pago único' scenario starts empty, with slot 1 ready to receive."""
    call_command("create_release_qa_data")

    doc = DynamicDocument.objects.get(title="[QA Cuentas de Cobro] Contrato con pago único")
    progress = doc.get_payment_progress()

    assert progress["total_installments"] == 1
    assert progress["next_uploadable"] == 1


@pytest.mark.edge
def test_installment_under_review_blocks_the_next_upload(qa_base_users, media_tmp):
    """A slot awaiting review freezes the sequence until the lawyer decides."""
    call_command("create_release_qa_data")

    doc = DynamicDocument.objects.get(title="[QA Cuentas de Cobro] Contrato con cuota en revisión")
    progress = doc.get_payment_progress()

    assert progress["in_review"] is True
    assert progress["next_uploadable"] is None


@pytest.mark.edge
def test_accepted_total_ignores_amounts_still_under_review(qa_base_users, media_tmp):
    """Only accepted installments add up, which is what the UI totals."""
    call_command("create_release_qa_data")

    doc = DynamicDocument.objects.get(title="[QA Cuentas de Cobro] Contrato con cuota en revisión")

    assert doc.get_payment_progress()["total_amount_accepted"] == 1_000_000


def test_rejected_installment_reopens_its_own_slot(qa_base_users, media_tmp):
    """A rejection sends the client back to the same installment, not the next."""
    call_command("create_release_qa_data")

    doc = DynamicDocument.objects.get(title="[QA Cuentas de Cobro] Contrato con cuota rechazada")

    assert doc.get_payment_progress()["next_uploadable"] == 2


def test_payment_documents_are_visible_to_the_assigned_client(qa_base_users, media_tmp):
    """Expose the payment contracts to the client they are assigned to.

    assigned_to alone grants no visibility: apply_visibility_filter matches on
    created_by, signatures__signer, is_public or visibility_permissions__user.
    Without the signature and the explicit permission the seeder adds, the
    client sees nothing at all.
    """
    call_command("create_release_qa_data")

    client = User.objects.get(email="client1@example.com")
    visible = apply_visibility_filter(DynamicDocument.objects.all(), client)

    assert visible.filter(title__startswith="[QA Cuentas de Cobro]").count() == 4


def test_payment_files_are_openable_pdfs(qa_base_users, media_tmp):
    """The QA guide asks the tester to download and read the file."""
    call_command("create_release_qa_data")

    for record in DocumentPaymentRecord.objects.all():
        assert record.file.size > 1000


def test_tour_progress_is_stale(qa_base_users, media_tmp):
    """The dedicated account triggers the 30-day re-offer without waiting."""
    call_command("create_release_qa_data")

    progress = TourProgress.objects.get(user__email="tour.vencido@example.com")
    assert progress.is_stale is True


def test_tour_account_has_no_pending_signatures(qa_base_users, media_tmp):
    """Zero pending signatures is what keeps the tour at exactly 10 steps."""
    call_command("create_release_qa_data")

    tour_user = User.objects.get(email="tour.vencido@example.com")
    assert tour_user.pending_signatures.filter(signed=False).count() == 0


def test_create_release_qa_data_is_idempotent(qa_base_users, media_tmp):
    """Create release qa data is idempotent."""
    call_command("create_release_qa_data")
    first = (
        DynamicDocument.objects.count(),
        DocumentPaymentRecord.objects.count(),
        Process.objects.count(),
    )

    call_command("create_release_qa_data")

    assert (
        DynamicDocument.objects.count(),
        DocumentPaymentRecord.objects.count(),
        Process.objects.count(),
    ) == first


def test_rerun_unarchives_a_source_lawyer_qa_archived(qa_base_users, media_tmp):
    """Archiving the source is part of the walkthrough; a re-run restores it."""
    call_command("create_release_qa_data")
    source = User.objects.get(email="abogado.reasignar@example.com")
    source.archive()

    call_command("create_release_qa_data")

    source.refresh_from_db()
    assert source.is_archived is False


def test_rerun_restores_documents_qa_transferred_away(qa_base_users, media_tmp):
    """After a real reassignment the fixture is spent; a re-run rebuilds it."""
    call_command("create_release_qa_data")
    source = User.objects.get(email="abogado.reasignar@example.com")
    target = User.objects.get(email="abogado.destino@example.com")
    DynamicDocument.objects.filter(managed_by=source).update(managed_by=target)

    call_command("create_release_qa_data")

    assert DynamicDocument.objects.filter(managed_by=source).count() == 8
