"""
Tests targeting the last 4 uncovered lines in model source files to reach 100% coverage.

Targets:
  - dynamic_document.py: currency formatting outputs expected format
  - legal_request.py line 121: __str__ when user is None
  - organization.py line 214: accept() raises when invitation cannot be responded
  - organization.py line 241: reject() raises when invitation cannot be responded
"""
import pytest
from datetime import timedelta
from unittest.mock import patch
from django.core.exceptions import ValidationError
from django.utils import timezone

from gym_app.models import DynamicDocument, DocumentVariable
from gym_app.models.legal_request import (
    LegalRequest,
    LegalRequestType,
    LegalDiscipline,
)
from gym_app.models.organization import (
    Organization,
    OrganizationInvitation,
)
from gym_app.models.user import User


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_cov100@test.com",
        password="pw",
        role="lawyer",
        first_name="Law",
        last_name="Yer",
    )


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email="basic_cov100@test.com",
        password="pw",
        role="basic",
        first_name="Basic",
        last_name="User",
    )


@pytest.fixture
def corporate_client():
    return User.objects.create_user(
        email="corp_cov100@test.com",
        password="pw",
        role="corporate_client",
        first_name="Corp",
        last_name="Leader",
    )


@pytest.fixture
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Coverage Doc",
        content="<p>test</p>",
        state="Draft",
        created_by=lawyer_user,
    )


@pytest.fixture
def organization(corporate_client):
    return Organization.objects.create(
        title="Org Cov100",
        description="Desc",
        corporate_client=corporate_client,
    )


# ---------------------------------------------------------------------------
# dynamic_document.py – currency formatting behavior
# ---------------------------------------------------------------------------

class TestDocumentVariableCurrencyFormatting:
    def test_get_formatted_value_whole_number_cop(self, document):
        """
        Whole-number COP values are formatted with thousands separators
        and two decimal places.
        """
        var = DocumentVariable.objects.create(
            document=document,
            name_en="amount",
            field_type="input",
            value="1000000",
            summary_field="value",
            currency="COP",
        )

        result = var.get_formatted_value()

        assert result == "COP $ 1.000.000.00"
        assert "," not in result


# ---------------------------------------------------------------------------
# legal_request.py – line 121: __str__ when self.user is None
# ---------------------------------------------------------------------------

class TestLegalRequestStrWithoutUser:
    def test_str_returns_request_number_only_when_user_is_none(self):
        """
        LegalRequest.__str__() should return just the request_number
        when the user field is None (line 121).

        The user FK is NOT NULL at DB level, so we temporarily replace
        the FK descriptor with None to simulate the branch.
        """
        req_type = LegalRequestType.objects.create(name="Cov100 Type")
        discipline = LegalDiscipline.objects.create(name="Cov100 Disc")
        temp_user = User.objects.create_user(
            email="temp_lr_cov100@test.com", password="pw"
        )
        lr = LegalRequest.objects.create(
            user=temp_user,
            request_type=req_type,
            discipline=discipline,
            description="Test",
        )

        # Temporarily replace the FK descriptor so self.user returns None
        with patch.object(LegalRequest, "user", new=None):
            result = str(lr)

        assert result == lr.request_number


# ---------------------------------------------------------------------------
# organization.py – line 214: accept() on non-respondable invitation
# ---------------------------------------------------------------------------

class TestOrganizationInvitationAcceptReject:
    def test_accept_raises_when_invitation_already_accepted(
        self, organization, corporate_client, basic_user
    ):
        """
        Calling accept() on an already-accepted invitation raises
        ValidationError (line 214).
        """
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_client,
            status="ACCEPTED",
            expires_at=timezone.now() + timedelta(days=30),
        )

        with pytest.raises(ValidationError, match="no puede ser aceptada"):
            invitation.accept()

    def test_reject_raises_when_invitation_expired(
        self, organization, corporate_client, basic_user
    ):
        """
        Calling reject() on an expired invitation raises
        ValidationError (line 241).
        """
        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            invited_user=basic_user,
            invited_by=corporate_client,
            status="PENDING",
            expires_at=timezone.now() - timedelta(days=1),
        )

        with pytest.raises(ValidationError, match="no puede ser rechazada"):
            invitation.reject()
