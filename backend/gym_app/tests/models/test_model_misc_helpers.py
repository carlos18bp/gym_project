import os
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.utils import timezone

from gym_app.models.user import User, user_letterhead_image_path, user_letterhead_template_path
import gym_app.models.user as user_module
from gym_app.models.organization import (
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    OrganizationPost,
    organization_profile_image_path,
    organization_cover_image_path,
)
from gym_app.models.legal_request import (
    LegalRequest,
    LegalRequestType,
    LegalDiscipline,
    LegalRequestFiles,
    LegalRequestResponse,
)
from gym_app.models.corporate_request import (
    CorporateRequest,
    CorporateRequestType,
    CorporateRequestFiles,
)
from gym_app.models.subscription import Subscription, PaymentHistory
from gym_app.models.intranet_gym import IntranetProfile
from gym_app.models.process import Case, Process, RecentProcess


pytestmark = pytest.mark.django_db


@pytest.fixture
def user_factory():
    def create_user(email, role="client", is_gym_lawyer=False):
        return User.objects.create_user(
            email=email,
            password="testpassword",
            role=role,
            is_gym_lawyer=is_gym_lawyer,
        )

    return create_user


@pytest.fixture
def fixed_uuid(monkeypatch):
    class DummyUUID:
        hex = "abc123"

    monkeypatch.setattr(user_module.uuid, "uuid4", lambda: DummyUUID())
    return "abc123"


def test_organization_profile_image_path_uses_instance_id_and_ext():
    class DummyOrganization:
        id = 5

    path = organization_profile_image_path(DummyOrganization(), "logo.PNG")

    assert path == os.path.join(
        "organization_images/profiles/",
        "organization_5_profile.PNG",
    )


def test_organization_cover_image_path_uses_instance_id_and_ext():
    class DummyOrganization:
        id = 12

    path = organization_cover_image_path(DummyOrganization(), "cover.jpg")

    assert path == os.path.join(
        "organization_images/covers/",
        "organization_12_cover.jpg",
    )


def test_user_letterhead_image_path_uses_uuid_and_lowercase_ext(fixed_uuid):
    class DummyUser:
        id = 7

    path = user_letterhead_image_path(DummyUser(), "Header.PNG")

    assert path == os.path.join(
        "user_letterheads",
        "7",
        f"user_letterhead_{fixed_uuid}.png",
    )


def test_user_letterhead_template_path_uses_uuid_and_lowercase_ext(fixed_uuid):
    class DummyUser:
        id = 9

    path = user_letterhead_template_path(DummyUser(), "Template.DOCX")

    assert path == os.path.join(
        "user_letterhead_templates",
        "9",
        f"user_letterhead_template_{fixed_uuid}.docx",
    )


def test_legal_request_auto_generates_request_number(user_factory):
    user = user_factory("requester@example.com")
    request_type = LegalRequestType.objects.create(name="Consultation")
    discipline = LegalDiscipline.objects.create(name="Corporate Law")

    request = LegalRequest.objects.create(
        user=user,
        request_type=request_type,
        discipline=discipline,
        description="Need advice",
    )

    year = timezone.now().year
    assert request.request_number is not None
    assert request.request_number.startswith(f"SOL-{year}-")


def test_legal_request_request_number_increments_sequence(user_factory):
    user = user_factory("sequence@example.com")
    request_type = LegalRequestType.objects.create(name="Review")
    discipline = LegalDiscipline.objects.create(name="Tax")

    first = LegalRequest.objects.create(
        user=user,
        request_type=request_type,
        discipline=discipline,
        description="First",
    )
    second = LegalRequest.objects.create(
        user=user,
        request_type=request_type,
        discipline=discipline,
        description="Second",
    )

    seq_first = int(first.request_number.split("-")[-1])
    seq_second = int(second.request_number.split("-")[-1])

    assert seq_second == seq_first + 1


def test_legal_request_response_str_includes_request_number_and_user_type(user_factory):
    user = user_factory("lawyer@example.com", role="lawyer")
    request_type = LegalRequestType.objects.create(name="Contract")
    discipline = LegalDiscipline.objects.create(name="Civil")
    request = LegalRequest.objects.create(
        user=user,
        request_type=request_type,
        discipline=discipline,
        description="Need contract review",
    )

    response = LegalRequestResponse.objects.create(
        legal_request=request,
        response_text="Respuesta",
        user=user,
        user_type="lawyer",
    )

    assert str(response) == f"{request.request_number} - lawyer response"


def test_legal_request_file_delete_removes_physical_file():
    test_file = SimpleUploadedFile(
        "legal_request.pdf",
        b"PDF content",
        content_type="application/pdf",
    )
    file_obj = LegalRequestFiles.objects.create(file=test_file)
    file_path = file_obj.file.path

    assert os.path.exists(file_path)

    file_obj.delete()

    assert not os.path.exists(file_path)


def test_corporate_request_file_str_returns_basename():
    test_file = SimpleUploadedFile(
        "corp_request.pdf",
        b"PDF content",
        content_type="application/pdf",
    )
    file_obj = CorporateRequestFiles.objects.create(file=test_file)

    assert str(file_obj) == os.path.basename(file_obj.file.name)


def test_corporate_request_str_includes_request_number_title_and_emails(user_factory):
    corporate_client = user_factory("corp@example.com", role="corporate_client")
    client = user_factory("client@example.com", role="client")
    organization = Organization.objects.create(
        title="Org",
        description="Desc",
        corporate_client=corporate_client,
    )
    OrganizationMembership.objects.create(
        organization=organization,
        user=client,
        role="MEMBER",
    )
    request_type = CorporateRequestType.objects.create(name="Consulta")

    request = CorporateRequest.objects.create(
        client=client,
        organization=organization,
        corporate_client=None,
        request_type=request_type,
        title="Solicitud",
        description="Descripcion",
        priority="MEDIUM",
    )

    expected = (
        f"{request.request_number} - {request.title} "
        f"({client.email} \u2192 {organization.corporate_client.email})"
    )
    assert str(request) == expected


def test_organization_str_includes_title_and_leader_email(user_factory):
    corporate_client = user_factory("leader@example.com", role="corporate_client")
    organization = Organization.objects.create(
        title="Org Title",
        description="Org description",
        corporate_client=corporate_client,
    )

    assert str(organization) == f"Org Title (Leader: {corporate_client.email})"


def test_organization_invitation_str_includes_org_user_status(user_factory):
    corporate_client = user_factory("corp@example.com", role="corporate_client")
    invited_user = user_factory("invited@example.com", role="client")
    organization = Organization.objects.create(
        title="Org Title",
        description="Org description",
        corporate_client=corporate_client,
    )

    invitation = OrganizationInvitation.objects.create(
        organization=organization,
        invited_user=invited_user,
        invited_by=corporate_client,
        status="PENDING",
        expires_at=timezone.now() + timedelta(days=10),
    )

    assert str(invitation) == (
        f"{organization.title} \u2192 {invited_user.email} (PENDING)"
    )


def test_organization_invitation_unique_together_enforced(user_factory):
    corporate_client = user_factory("corp@example.com", role="corporate_client")
    invited_user = user_factory("dup@example.com", role="client")
    organization = Organization.objects.create(
        title="Org",
        description="Org description",
        corporate_client=corporate_client,
    )

    OrganizationInvitation.objects.create(
        organization=organization,
        invited_user=invited_user,
        invited_by=corporate_client,
        status="ACCEPTED",
        expires_at=timezone.now() + timedelta(days=10),
    )

    with pytest.raises(IntegrityError) as exc_info:
        with transaction.atomic():
            OrganizationInvitation.objects.create(
                organization=organization,
                invited_user=invited_user,
                invited_by=corporate_client,
                status="ACCEPTED",
                expires_at=timezone.now() + timedelta(days=10),
            )
    assert exc_info.value is not None
    assert OrganizationInvitation.objects.filter(organization=organization, invited_user=invited_user).count() == 1


def test_organization_membership_ordering_by_joined_at(user_factory):
    corporate_client = user_factory("corp@example.com", role="corporate_client")
    member_a = user_factory("membera@example.com", role="client")
    member_b = user_factory("memberb@example.com", role="client")
    organization = Organization.objects.create(
        title="Org",
        description="Org description",
        corporate_client=corporate_client,
    )

    older_membership = OrganizationMembership.objects.create(
        organization=organization,
        user=member_a,
        role="MEMBER",
    )
    newer_membership = OrganizationMembership.objects.create(
        organization=organization,
        user=member_b,
        role="MEMBER",
    )

    older_time = timezone.now() - timedelta(days=1)
    newer_time = timezone.now()
    OrganizationMembership.objects.filter(pk=older_membership.pk).update(
        joined_at=older_time
    )
    OrganizationMembership.objects.filter(pk=newer_membership.pk).update(
        joined_at=newer_time
    )

    memberships = list(OrganizationMembership.objects.all())

    assert memberships[0].id == newer_membership.id
    assert memberships[1].id == older_membership.id


def test_organization_post_ordering_pinned_then_created(user_factory):
    corporate_client = user_factory("corp@example.com", role="corporate_client")
    organization = Organization.objects.create(
        title="Org",
        description="Org description",
        corporate_client=corporate_client,
    )

    pinned_old = OrganizationPost.objects.create(
        title="Pinned Old",
        content="Content",
        organization=organization,
        author=corporate_client,
        is_pinned=True,
    )
    pinned_new = OrganizationPost.objects.create(
        title="Pinned New",
        content="Content",
        organization=organization,
        author=corporate_client,
        is_pinned=True,
    )
    unpinned_new = OrganizationPost.objects.create(
        title="Unpinned",
        content="Content",
        organization=organization,
        author=corporate_client,
        is_pinned=False,
    )

    older_time = timezone.now() - timedelta(days=2)
    newer_time = timezone.now() - timedelta(days=1)
    newest_time = timezone.now()
    OrganizationPost.objects.filter(pk=pinned_old.pk).update(created_at=older_time)
    OrganizationPost.objects.filter(pk=pinned_new.pk).update(created_at=newer_time)
    OrganizationPost.objects.filter(pk=unpinned_new.pk).update(created_at=newest_time)

    posts = list(OrganizationPost.objects.all())

    assert posts[0].id == pinned_new.id
    assert posts[1].id == pinned_old.id
    assert posts[2].id == unpinned_new.id


def test_subscription_ordering_by_created_at_desc(user_factory):
    user = user_factory("subscriber@example.com", role="client")

    older = Subscription.objects.create(
        user=user,
        plan_type="basico",
        status="active",
        next_billing_date=timezone.now().date(),
        amount=Decimal("10000.00"),
    )
    newer = Subscription.objects.create(
        user=user,
        plan_type="cliente",
        status="active",
        next_billing_date=timezone.now().date(),
        amount=Decimal("20000.00"),
    )

    older_time = timezone.now() - timedelta(days=2)
    newer_time = timezone.now() - timedelta(days=1)
    Subscription.objects.filter(pk=older.pk).update(created_at=older_time)
    Subscription.objects.filter(pk=newer.pk).update(created_at=newer_time)

    subscriptions = list(Subscription.objects.all())

    assert subscriptions[0].id == newer.id
    assert subscriptions[1].id == older.id


def test_payment_history_ordering_by_payment_date_desc(user_factory):
    user = user_factory("payer@example.com", role="client")
    subscription = Subscription.objects.create(
        user=user,
        plan_type="basico",
        status="active",
        next_billing_date=timezone.now().date(),
        amount=Decimal("10000.00"),
    )

    older = PaymentHistory.objects.create(
        subscription=subscription,
        amount=Decimal("10000.00"),
        status="approved",
        reference="REF-OLD",
    )
    newer = PaymentHistory.objects.create(
        subscription=subscription,
        amount=Decimal("10000.00"),
        status="approved",
        reference="REF-NEW",
    )

    older_time = timezone.now() - timedelta(days=2)
    newer_time = timezone.now() - timedelta(days=1)
    PaymentHistory.objects.filter(pk=older.pk).update(payment_date=older_time)
    PaymentHistory.objects.filter(pk=newer.pk).update(payment_date=newer_time)

    payments = list(PaymentHistory.objects.all())

    assert payments[0].id == newer.id
    assert payments[1].id == older.id


def test_intranet_profile_str_constant():
    profile = IntranetProfile.objects.create()

    assert str(profile) == "Intranet Profile"


def test_intranet_profile_updated_at_changes_on_save():
    profile = IntranetProfile.objects.create()

    past_time = timezone.now() - timedelta(days=1)
    IntranetProfile.objects.filter(pk=profile.pk).update(updated_at=past_time)

    profile.refresh_from_db()
    profile.save()
    profile.refresh_from_db()

    assert profile.updated_at > past_time


def test_recent_process_str_includes_process_ref(user_factory):
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    case = Case.objects.create(type="Civil")
    process = Process.objects.create(
        authority="Court",
        plaintiff="A",
        defendant="B",
        ref="CASE-123",
        lawyer=lawyer,
        case=case,
        subcase="Subcase",
    )

    recent = RecentProcess.objects.create(user=lawyer, process=process)

    assert process.ref in str(recent)
