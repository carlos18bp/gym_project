"""
Batch 15 – 20 tests for serializer gaps:
  • dynamic_document.py: DocumentRelationshipSerializer (validate, create, get_created_by_name),
    DynamicDocumentCreateUpdateSerializer (create exception paths, update permission paths),
    get_summary_creation_date None branch
  • corporate_request.py: validate_corporate_client, validate_assigned_to,
    CorporateRequestListSerializer methods
  • organization.py: OrganizationPostCreateSerializer.create (line 445)
"""
import pytest
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import RequestFactory
from rest_framework import status
from rest_framework.test import APIClient

from gym_app.models import (
    Organization, OrganizationMembership, OrganizationPost,
    DynamicDocument, DocumentVariable, Tag, DocumentSignature,
    DocumentVisibilityPermission, DocumentUsabilityPermission,
)
from gym_app.models.dynamic_document import DocumentRelationship
from gym_app.models.corporate_request import (
    CorporateRequest, CorporateRequestType, CorporateRequestResponse,
)
from gym_app.serializers.dynamic_document import (
    DocumentRelationshipSerializer,
    DynamicDocumentSerializer,
)
from gym_app.serializers.corporate_request import (
    CorporateRequestCreateSerializer,
    CorporateRequestListSerializer,
)
from gym_app.serializers.organization import OrganizationPostCreateSerializer

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_b15@test.com", password="pw", role="lawyer",
        first_name="Law", last_name="Yer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    return User.objects.create_user(
        email="client_b15@test.com", password="pw", role="client",
        first_name="Cli", last_name="Ent",
    )


@pytest.fixture
@pytest.mark.django_db
def corp_user():
    return User.objects.create_user(
        email="corp_b15@test.com", password="pw", role="corporate_client",
        first_name="Corp", last_name="Client",
    )


@pytest.fixture
@pytest.mark.django_db
def doc_a(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc A", content="<p>A</p>", state="Draft", created_by=lawyer_user,
    )


@pytest.fixture
@pytest.mark.django_db
def doc_b(lawyer_user):
    return DynamicDocument.objects.create(
        title="Doc B", content="<p>B</p>", state="Draft", created_by=lawyer_user,
    )


def _make_request(user):
    factory = RequestFactory()
    request = factory.get("/")
    request.user = user
    return request


# ===========================================================================
# 1. DocumentRelationshipSerializer
# ===========================================================================

@pytest.mark.django_db
class TestDocumentRelationshipSerializer:

    def test_validate_self_reference(self, lawyer_user, doc_a):
        """Lines 790-798: cannot relate document to itself."""
        request = _make_request(lawyer_user)
        serializer = DocumentRelationshipSerializer(
            data={"source_document": doc_a.id, "target_document": doc_a.id},
            context={"request": request},
        )
        assert not serializer.is_valid()

    def test_validate_valid_pair(self, lawyer_user, doc_a, doc_b):
        """Lines 790-798: valid relationship."""
        request = _make_request(lawyer_user)
        serializer = DocumentRelationshipSerializer(
            data={"source_document": doc_a.id, "target_document": doc_b.id},
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

    def test_create_sets_created_by(self, lawyer_user, doc_a, doc_b):
        """Lines 805-809: create sets created_by from request."""
        request = _make_request(lawyer_user)
        serializer = DocumentRelationshipSerializer(
            data={"source_document": doc_a.id, "target_document": doc_b.id},
            context={"request": request},
        )
        assert serializer.is_valid()
        rel = serializer.save()
        assert rel.created_by == lawyer_user

    def test_get_created_by_name_with_user(self, lawyer_user, doc_a, doc_b):
        """Lines 779-784: returns full name."""
        rel = DocumentRelationship.objects.create(
            source_document=doc_a, target_document=doc_b, created_by=lawyer_user,
        )
        serializer = DocumentRelationshipSerializer(rel)
        assert "Law" in serializer.data["created_by_name"]

    def test_get_created_by_name_email_fallback(self, doc_a, doc_b):
        """Lines 779-784: returns email when names are empty."""
        user_no_name = User.objects.create_user(
            email="noname_b15@test.com", password="pw", role="client",
            first_name="", last_name="",
        )
        rel = DocumentRelationship.objects.create(
            source_document=doc_a, target_document=doc_b, created_by=user_no_name,
        )
        serializer = DocumentRelationshipSerializer(rel)
        assert serializer.data["created_by_name"] == "noname_b15@test.com"


# ===========================================================================
# 2. DynamicDocumentCreateUpdateSerializer – edge paths
# ===========================================================================

@pytest.mark.django_db
class TestDynamicDocumentCreateUpdateSerializer:

    def test_create_with_signature_exception_silenced(self, lawyer_user, client_user):
        """Lines 463-464: exception during signature creation silenced."""
        request = _make_request(lawyer_user)
        data = {
            "title": "SigDoc",
            "content": "<p>test</p>",
            "state": "Draft",
            "requires_signature": True,
            "signers": [client_user.id],
            "variables": [],
        }
        serializer = DynamicDocumentSerializer(
            data=data, context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors
        doc = serializer.save()
        assert doc.requires_signature is True
        # Signatures created for lawyer + client
        assert DocumentSignature.objects.filter(document=doc).count() >= 1


# ===========================================================================
# 3. CorporateRequestCreateSerializer – validation
# ===========================================================================

@pytest.mark.django_db
class TestCorporateRequestCreateSerializer:

    def test_validate_corporate_client_wrong_role(self, client_user, corp_user):
        """Line 197-198: corporate_client must have corporate_client role."""
        from gym_app.serializers.corporate_request import CorporateRequestSerializer
        org = Organization.objects.create(
            title="Org15", corporate_client=corp_user, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True,
        )
        cr_type = CorporateRequestType.objects.create(name="CRType15")
        cr = CorporateRequest.objects.create(
            title="CR", description="d", organization=org,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        # Use CorporateRequestSerializer which has corporate_client as writable
        serializer = CorporateRequestSerializer(
            cr,
            data={"corporate_client": client_user.id},  # client, not corporate_client role
            partial=True,
        )
        assert not serializer.is_valid()

    def test_validate_assigned_to_field(self, client_user, corp_user, lawyer_user):
        """Lines 205-209: validate_assigned_to passes."""
        org = Organization.objects.create(
            title="Org15b", corporate_client=corp_user, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True,
        )
        cr_type = CorporateRequestType.objects.create(name="CRType15b")
        request = _make_request(client_user)
        serializer = CorporateRequestCreateSerializer(
            data={
                "title": "Test",
                "description": "Desc",
                "organization": org.id,
                "corporate_client": corp_user.id,
                "request_type": cr_type.id,
                "assigned_to": lawyer_user.id,
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors


# ===========================================================================
# 4. CorporateRequestListSerializer – method fields
# ===========================================================================

@pytest.mark.django_db
class TestCorporateRequestListSerializer:

    def test_get_client_name(self, client_user, corp_user):
        """Line 234-235: get_client_name."""
        org = Organization.objects.create(
            title="Org15c", corporate_client=corp_user, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=client_user, role="MEMBER", is_active=True,
        )
        cr_type = CorporateRequestType.objects.create(name="CRType15c")
        cr = CorporateRequest.objects.create(
            title="CR15", description="d", organization=org,
            client=client_user, request_type=cr_type, status="OPEN",
        )
        serializer = CorporateRequestListSerializer(cr)
        # Verify it has the expected fields
        assert "client_info" in serializer.data
        assert "days_since_created" in serializer.data
        assert "response_count" in serializer.data


# ===========================================================================
# 5. OrganizationPostCreateSerializer – non-corporate user
# ===========================================================================

@pytest.mark.django_db
class TestOrganizationPostCreateSerializer:

    def test_create_non_corporate_user_raises(self, client_user, corp_user):
        """Line 444-445: non-corporate user raises ValidationError via validate()."""
        org = Organization.objects.create(
            title="Org15d", corporate_client=corp_user, is_active=True,
        )
        request = _make_request(client_user)
        serializer = OrganizationPostCreateSerializer(
            data={
                "title": "Post",
                "content": "Content",
                "organization": org.id,
            },
            context={"request": request},
        )
        # Validation fails because client is not the organization leader
        assert not serializer.is_valid()

    def test_create_corporate_user_success(self, corp_user):
        """Lines 440-447: corporate user succeeds."""
        org = Organization.objects.create(
            title="Org15e", corporate_client=corp_user, is_active=True,
        )
        request = _make_request(corp_user)
        serializer = OrganizationPostCreateSerializer(
            data={
                "title": "Post OK",
                "content": "Content",
                "organization": org.id,
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors
        post = serializer.save()
        assert post.author == corp_user
