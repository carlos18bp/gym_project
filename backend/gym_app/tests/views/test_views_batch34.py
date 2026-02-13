"""Batch 34 – 20 tests: organization views, subscription views, intranet views edges."""
import pytest
from unittest.mock import patch, MagicMock
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models import (
    Organization, OrganizationInvitation, OrganizationMembership,
    OrganizationPost, Subscription,
)
from decimal import Decimal
import datetime

User = get_user_model()
pytestmark = pytest.mark.django_db

@pytest.fixture
def api():
    return APIClient()

@pytest.fixture
def law():
    return User.objects.create_user(email="law34@t.com", password="pw", role="lawyer", first_name="L", last_name="W")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli34@t.com", password="pw", role="client", first_name="C", last_name="E")

@pytest.fixture
def corp():
    return User.objects.create_user(email="corp34@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Rp")


# -- Organization views --
class TestOrganizationViews:
    def test_create_org_non_corporate_forbidden(self, api, cli):
        api.force_authenticate(user=cli)
        resp = api.post(reverse("create-organization"), {"title": "O", "description": "D"}, format="json")
        assert resp.status_code == 403

    def test_create_org_success(self, api, corp):
        api.force_authenticate(user=corp)
        resp = api.post(reverse("create-organization"), {"title": "NewOrg", "description": "Desc"}, format="json")
        assert resp.status_code == 201
        assert Organization.objects.filter(title="NewOrg").exists()

    def test_get_my_orgs(self, api, corp):
        Organization.objects.create(title="MyOrg", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-my-organizations"))
        assert resp.status_code == 200

    def test_get_org_detail(self, api, corp):
        org = Organization.objects.create(title="Det", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-organization-detail", args=[org.id]))
        assert resp.status_code == 200

    def test_delete_org(self, api, corp):
        org = Organization.objects.create(title="DelOrg", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.delete(reverse("delete-organization", args=[org.id]))
        assert resp.status_code in (200, 204)
        assert not Organization.objects.filter(id=org.id).exists()

    def test_send_invitation(self, api, corp, cli):
        org = Organization.objects.create(title="InvOrg", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.post(
            reverse("send-organization-invitation", args=[org.id]),
            {"invited_user_email": cli.email}, format="json",
        )
        assert resp.status_code == 201
        assert OrganizationInvitation.objects.filter(organization=org, invited_user=cli).exists()

    def test_get_invitations(self, api, corp, cli):
        org = Organization.objects.create(title="GI", corporate_client=corp)
        OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-organization-invitations", args=[org.id]))
        assert resp.status_code == 200

    def test_get_my_invitations(self, api, corp, cli):
        org = Organization.objects.create(title="MI", corporate_client=corp)
        OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=cli)
        resp = api.get(reverse("get-my-invitations"))
        assert resp.status_code == 200

    def test_respond_accept_invitation(self, api, corp, cli):
        org = Organization.objects.create(title="RA", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("respond-to-invitation", args=[inv.id]), {"action": "accept"}, format="json")
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.status == "ACCEPTED"
        assert OrganizationMembership.objects.filter(organization=org, user=cli, is_active=True).exists()

    def test_respond_reject_invitation(self, api, corp, cli):
        org = Organization.objects.create(title="RR", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("respond-to-invitation", args=[inv.id]), {"action": "reject"}, format="json")
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.status == "REJECTED"

    def test_get_org_stats(self, api, corp):
        Organization.objects.create(title="S1", corporate_client=corp)
        api.force_authenticate(user=corp)
        resp = api.get(reverse("get-organization-stats"))
        assert resp.status_code == 200

    def test_leave_organization(self, api, corp, cli):
        org = Organization.objects.create(title="LV", corporate_client=corp)
        OrganizationMembership.objects.create(organization=org, user=cli, role="MEMBER", is_active=True)
        api.force_authenticate(user=cli)
        resp = api.post(reverse("leave-organization", args=[org.id]))
        assert resp.status_code == 200
        assert not OrganizationMembership.objects.filter(organization=org, user=cli, is_active=True).exists()


# -- Subscription views --
class TestSubscriptionViews:
    def test_get_wompi_config(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-wompi-config"))
        assert resp.status_code == 200

    def test_get_current_no_subscription(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-current"))
        assert resp.status_code in (200, 404)

    def test_get_current_with_subscription(self, api, law):
        Subscription.objects.create(
            user=law, plan_type="cliente", status="active",
            amount=Decimal("50000"), next_billing_date=datetime.date.today(),
        )
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-current"))
        assert resp.status_code == 200

    def test_cancel_no_subscription(self, api, law):
        api.force_authenticate(user=law)
        resp = api.patch(reverse("subscription-cancel"))
        assert resp.status_code in (400, 404)

    def test_get_payment_history_empty(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("subscription-payments"))
        assert resp.status_code == 200


# -- Intranet views --
class TestIntranetViews:
    def test_list_legal_intranet_documents(self, api, law):
        api.force_authenticate(user=law)
        resp = api.get(reverse("list-legal-intranet-documents"))
        assert resp.status_code == 200

    def test_create_report_request(self, api, law):
        api.force_authenticate(user=law)
        resp = api.post(
            reverse("create-report-request"),
            {"title": "Report", "content": "Body"},
            format="json",
        )
        assert resp.status_code in (200, 201, 400)

    def test_list_intranet_unauthenticated(self, api):
        resp = api.get(reverse("list-legal-intranet-documents"))
        assert resp.status_code in (401, 403)
