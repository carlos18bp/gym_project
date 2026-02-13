"""Batch 35 – 20 tests: serializers coverage – subscription, user, legal_update, process, organization, dynamic_document."""
import datetime
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from rest_framework.request import Request

from gym_app.models import (
    Subscription, PaymentHistory, Process, Case, Stage,
    LegalUpdate, Organization, OrganizationInvitation,
    OrganizationMembership, OrganizationPost,
)
from gym_app.models.user import ActivityFeed, UserSignature
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature
from gym_app.serializers.subscription import SubscriptionSerializer, PaymentHistorySerializer
from gym_app.serializers.user import UserSerializer, UserSignatureSerializer, ActivityFeedSerializer
from gym_app.serializers.legal_update import LegalUpdateSerializer
from gym_app.serializers.organization import (
    OrganizationSerializer, OrganizationInvitationSerializer,
    OrganizationMembershipSerializer,
)

User = get_user_model()
pytestmark = pytest.mark.django_db


def _drf_request():
    rf = RequestFactory()
    return Request(rf.get("/fake/"))


@pytest.fixture
def law():
    return User.objects.create_user(email="law35@t.com", password="pw", role="lawyer", first_name="Law", last_name="Yer")

@pytest.fixture
def cli():
    return User.objects.create_user(email="cli35@t.com", password="pw", role="client", first_name="Cli", last_name="Ent")

@pytest.fixture
def corp():
    return User.objects.create_user(email="corp35@t.com", password="pw", role="corporate_client", first_name="Co", last_name="Rp")


# -- SubscriptionSerializer --
class TestSubscriptionSerializer:
    def test_serializes_fields(self, law):
        sub = Subscription.objects.create(
            user=law, plan_type="cliente", status="active",
            amount=Decimal("50000"), next_billing_date=datetime.date.today(),
        )
        data = SubscriptionSerializer(sub).data
        assert data["user_email"] == "law35@t.com"
        assert data["plan_type"] == "cliente"
        assert data["status"] == "active"
        assert "id" in data

    def test_user_name_full(self, law):
        sub = Subscription.objects.create(
            user=law, plan_type="basico", status="active",
            amount=Decimal("0"), next_billing_date=datetime.date.today(),
        )
        data = SubscriptionSerializer(sub).data
        assert data["user_name"] == "Law Yer"

    def test_user_name_fallback_no_names(self):
        u = User.objects.create_user(email="noname@t.com", password="pw", role="client", first_name="", last_name="")
        sub = Subscription.objects.create(
            user=u, plan_type="basico", status="active",
            amount=Decimal("0"), next_billing_date=datetime.date.today(),
        )
        data = SubscriptionSerializer(sub).data
        # When first/last are empty strings, strip() yields "" which is falsy → email
        assert data["user_name"] == "noname@t.com"


# -- PaymentHistorySerializer --
class TestPaymentHistorySerializer:
    def test_serializes_payment(self, law):
        sub = Subscription.objects.create(
            user=law, plan_type="cliente", status="active",
            amount=Decimal("50000"), next_billing_date=datetime.date.today(),
        )
        ph = PaymentHistory.objects.create(
            subscription=sub, amount=Decimal("50000"),
            status="approved", reference="REF-1",
        )
        data = PaymentHistorySerializer(ph).data
        assert data["status"] == "approved"
        assert data["reference"] == "REF-1"
        assert "payment_date" in data


# -- UserSerializer --
class TestUserSerializer:
    def test_serializes_user(self, law):
        data = UserSerializer(law).data
        assert data["email"] == "law35@t.com"
        assert "password" not in data  # write_only

    def test_password_write_only(self, cli):
        data = UserSerializer(cli).data
        assert "password" not in data


# -- UserSignatureSerializer --
class TestUserSignatureSerializer:
    def test_without_request(self, law):
        sig = UserSignature.objects.create(user=law, signature_image="sig.png")
        data = UserSignatureSerializer(sig).data
        assert data["user"] == law.id

    def test_with_request(self, law):
        sig = UserSignature.objects.create(user=law, signature_image="sig.png")
        request = _drf_request()
        data = UserSignatureSerializer(sig, context={"request": request}).data
        assert data["user"] == law.id


# -- ActivityFeedSerializer --
class TestActivityFeedSerializer:
    def test_serializes_activity(self, law):
        act = ActivityFeed.objects.create(user=law, action_type="login", description="Logged in")
        data = ActivityFeedSerializer(act).data
        assert data["action_type"] == "login"
        assert "time_ago" in data
        assert "action_display" in data


# -- LegalUpdateSerializer --
class TestLegalUpdateSerializer:
    def test_serializes_update(self):
        lu = LegalUpdate.objects.create(title="News", content="Body", is_active=True)
        data = LegalUpdateSerializer(lu).data
        assert data["title"] == "News"
        assert data["image_url"] is None

    def test_image_url_no_request(self):
        lu = LegalUpdate.objects.create(title="N2", content="B", is_active=True)
        data = LegalUpdateSerializer(lu).data
        assert data["image_url"] is None


# -- OrganizationSerializer --
class TestOrganizationSerializer:
    def test_serializes_org(self, corp):
        org = Organization.objects.create(title="Org35", corporate_client=corp)
        request = _drf_request()
        data = OrganizationSerializer(org, context={"request": request}).data
        assert data["title"] == "Org35"
        assert "id" in data

    def test_serializes_invitation(self, corp, cli):
        org = Organization.objects.create(title="InvOrg35", corporate_client=corp)
        inv = OrganizationInvitation.objects.create(organization=org, invited_user=cli, invited_by=corp)
        request = _drf_request()
        data = OrganizationInvitationSerializer(inv, context={"request": request}).data
        assert data["status"] == "PENDING"

    def test_serializes_membership(self, corp, cli):
        org = Organization.objects.create(title="MemOrg35", corporate_client=corp)
        mem = OrganizationMembership.objects.create(organization=org, user=cli, role="MEMBER")
        request = _drf_request()
        data = OrganizationMembershipSerializer(mem, context={"request": request}).data
        assert data["role"] == "MEMBER"


# -- Model __str__ edge coverage --
class TestModelStrEdges:
    def test_subscription_str(self, law):
        sub = Subscription.objects.create(
            user=law, plan_type="cliente", status="active",
            amount=Decimal("50000"), next_billing_date=datetime.date.today(),
        )
        s = str(sub)
        assert "law35@t.com" in s
        assert "Cliente" in s

    def test_payment_history_str(self, law):
        sub = Subscription.objects.create(
            user=law, plan_type="cliente", status="active",
            amount=Decimal("50000"), next_billing_date=datetime.date.today(),
        )
        ph = PaymentHistory.objects.create(
            subscription=sub, amount=Decimal("50000"),
            status="approved", reference="REF-STR",
        )
        s = str(ph)
        assert "law35@t.com" in s
        assert "approved" in s


# -- Process serializer --
class TestProcessSerializer:
    def test_serializes_process(self, law):
        from gym_app.serializers.process import ProcessSerializer
        c = Case.objects.create(type="Civil")
        p = Process.objects.create(ref="P35", case=c, lawyer=law)
        request = _drf_request()
        data = ProcessSerializer(p, context={"request": request}).data
        assert data["ref"] == "P35"

    def test_case_type_in_process(self, law):
        from gym_app.serializers.process import ProcessSerializer
        c = Case.objects.create(type="Penal")
        p = Process.objects.create(ref="P35b", case=c, lawyer=law)
        request = _drf_request()
        data = ProcessSerializer(p, context={"request": request}).data
        assert "case" in data


# -- LegalRequest serializer --
class TestLegalRequestSerializer:
    def test_serializes_legal_request(self, cli):
        from gym_app.models import LegalRequestType, LegalDiscipline, LegalRequest
        from gym_app.serializers import LegalRequestSerializer
        rt = LegalRequestType.objects.create(name="T35")
        di = LegalDiscipline.objects.create(name="D35")
        lr = LegalRequest.objects.create(user=cli, request_type=rt, discipline=di, description="Desc")
        request = _drf_request()
        data = LegalRequestSerializer(lr, context={"request": request}).data
        assert data["description"] == "Desc"
        assert "request_number" in data


# -- DynamicDocument serializer --
class TestDynamicDocumentSerializer:
    def test_serializes_document(self, law):
        from gym_app.serializers.dynamic_document import DynamicDocumentSerializer
        doc = DynamicDocument.objects.create(title="Doc35", content="<p>x</p>", state="Draft", created_by=law)
        request = _drf_request()
        request.user = law
        data = DynamicDocumentSerializer(doc, context={"request": request}).data
        assert data["title"] == "Doc35"
        assert data["state"] == "Draft"
