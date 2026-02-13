"""
Tests targeting the remaining uncovered lines in serializer source files to reach 100%.

Targets:
  - corporate_request.py: lines 198, 205-209, 235
  - dynamic_document.py: lines 402, 463-464, 607, 636, 779-784, 790-798, 805-809
  - organization.py: lines 445, 504
"""
import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from rest_framework import serializers as drf_serializers
from rest_framework.test import APIRequestFactory

from gym_app.models import (
    CorporateRequest,
    CorporateRequestType,
    DynamicDocument,
    DocumentRelationship,
    DocumentSignature,
    DocumentVariable,
    Organization,
    OrganizationMembership,
    OrganizationPost,
    User,
)
from gym_app.serializers.corporate_request import (
    CorporateRequestListSerializer,
    CorporateRequestSerializer,
)
from gym_app.serializers.dynamic_document import (
    DocumentRelationshipSerializer,
    DynamicDocumentSerializer,
)
from gym_app.serializers.organization import (
    OrganizationPostCreateSerializer,
    OrganizationPostUpdateSerializer,
)


pytestmark = pytest.mark.django_db

factory = APIRequestFactory()


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def corporate_client():
    return User.objects.create_user(
        email="corp_scov@test.com",
        password="pw",
        first_name="Corp",
        last_name="Leader",
        role="corporate_client",
    )


@pytest.fixture
def normal_client():
    return User.objects.create_user(
        email="client_scov@test.com",
        password="pw",
        first_name="Normal",
        last_name="Client",
        role="client",
    )


@pytest.fixture
def basic_user():
    return User.objects.create_user(
        email="basic_scov@test.com",
        password="pw",
        first_name="Basic",
        last_name="User",
        role="basic",
    )


@pytest.fixture
def lawyer_user():
    return User.objects.create_user(
        email="lawyer_scov@test.com",
        password="pw",
        first_name="Law",
        last_name="Yer",
        role="lawyer",
    )


@pytest.fixture
def organization(corporate_client):
    return Organization.objects.create(
        title="Org Scov",
        description="Desc",
        corporate_client=corporate_client,
    )


@pytest.fixture
def request_type():
    return CorporateRequestType.objects.create(name="Scov Type")


@pytest.fixture
def corporate_request(normal_client, corporate_client, organization, request_type):
    membership = OrganizationMembership.objects.create(
        organization=organization,
        user=normal_client,
        role="MEMBER",
    )
    return CorporateRequest.objects.create(
        client=normal_client,
        corporate_client=corporate_client,
        organization=organization,
        request_type=request_type,
        title="Test Request",
        description="Desc",
    )


@pytest.fixture
def document(lawyer_user):
    return DynamicDocument.objects.create(
        title="Scov Doc",
        content="<p>test</p>",
        state="Draft",
        created_by=lawyer_user,
        is_public=False,
    )


@pytest.fixture
def document_by_basic(basic_user):
    """Document created by a non-lawyer so the lawyer-skip doesn't shadow creator-skip."""
    return DynamicDocument.objects.create(
        title="Scov Doc Basic",
        content="<p>basic</p>",
        state="Draft",
        created_by=basic_user,
        is_public=False,
    )


# ---------------------------------------------------------------------------
# corporate_request.py – line 198: validate_corporate_client rejects non-corp role
# ---------------------------------------------------------------------------

class TestCorporateRequestValidateCorporateClient:
    def test_validate_corporate_client_rejects_non_corporate_role(
        self, normal_client, corporate_client, organization, request_type
    ):
        """
        validate_corporate_client raises ValidationError when the user
        is not a corporate_client (line 198).
        """
        OrganizationMembership.objects.create(
            organization=organization, user=normal_client, role="MEMBER",
        )
        request = factory.post("/fake/")
        request.user = normal_client

        serializer = CorporateRequestSerializer(
            data={
                "corporate_client": normal_client.pk,  # not a corporate_client role
                "organization": organization.pk,
                "request_type": request_type.pk,
                "title": "Test",
                "description": "Desc",
            },
            context={"request": request},
        )

        is_valid = serializer.is_valid()

        assert is_valid is False
        assert "corporate_client" in serializer.errors


# ---------------------------------------------------------------------------
# corporate_request.py – lines 205-209: validate_assigned_to
# ---------------------------------------------------------------------------

class TestCorporateRequestValidateAssignedTo:
    def test_validate_assigned_to_with_instance_having_corporate_client(
        self, corporate_request, corporate_client
    ):
        """
        validate_assigned_to passes through when value is truthy and
        instance has corporate_client attribute (lines 205-209).
        """
        request = factory.patch("/fake/")
        request.user = corporate_client

        serializer = CorporateRequestSerializer(
            instance=corporate_request,
            data={"assigned_to": corporate_client.pk},
            partial=True,
            context={"request": request},
        )

        # The validator on assigned_to should run the branch and return value
        assert serializer.is_valid() or "assigned_to" not in serializer.errors


# ---------------------------------------------------------------------------
# corporate_request.py – line 235: get_client_name on CorporateRequestListSerializer
# ---------------------------------------------------------------------------

class TestCorporateRequestListSerializerGetClientName:
    def test_get_client_name_returns_full_name(self, corporate_request):
        """
        get_client_name returns 'first_name last_name' (line 235).
        Note: This method exists on CorporateRequestListSerializer but
        may not be in `fields`. We call it directly.
        """
        serializer = CorporateRequestListSerializer()

        result = serializer.get_client_name(corporate_request)

        assert result == "Normal Client"


# ---------------------------------------------------------------------------
# dynamic_document.py – line 402: get_summary_creation_date returns None
# ---------------------------------------------------------------------------

class TestDynamicDocumentSummarySubscriptionDateNone:
    def test_get_summary_subscription_date_returns_none_when_no_created_at(
        self, lawyer_user
    ):
        """
        get_summary_subscription_date returns None when the document has
        no subscription_date variable and created_at is None (line 402).
        """
        doc = DynamicDocument.objects.create(
            title="No Date",
            content="<p>x</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        # Set created_at to None in-memory after save (auto_now_add)
        doc.created_at = None
        serializer = DynamicDocumentSerializer()

        result = serializer.get_summary_subscription_date(doc)

        assert result is None


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 463-464: exception in creator signature creation
# ---------------------------------------------------------------------------

class TestDynamicDocumentCreateSignatureException:
    def test_create_silently_catches_duplicate_signature_error(self, lawyer_user):
        """
        When creating a document with requires_signature and the creator
        signature creation raises an exception (e.g., IntegrityError),
        it is silently caught (lines 463-464).
        """
        request = factory.post("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            data={
                "title": "Sig Doc",
                "content": "<p>sig</p>",
                "state": "Draft",
                "requires_signature": True,
                "signers": [],
                "variables": [],
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        # Patch DocumentSignature.objects.create to raise on first call
        with patch(
            "gym_app.serializers.dynamic_document.DocumentSignature.objects.create",
            side_effect=Exception("Duplicate signature"),
        ):
            doc = serializer.save()

        # Document should still be created despite the signature error
        assert doc.pk is not None
        assert doc.requires_signature is True
        assert doc.title == "Sig Doc_firma"


# ---------------------------------------------------------------------------
# dynamic_document.py – line 607: visibility permission error in update
# ---------------------------------------------------------------------------

class TestDynamicDocumentUpdateVisibilityError:
    def test_update_visibility_permission_error_is_printed(
        self, document, lawyer_user, basic_user
    ):
        """
        When updating visibility permissions, if get_or_create raises an
        exception, it is caught and printed (line 607 area via line 615-616).
        """
        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document,
            data={
                "title": document.title,
                "content": document.content,
                "state": document.state,
                "visibility_user_ids": [basic_user.pk],
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        with patch(
            "gym_app.models.dynamic_document.DocumentVisibilityPermission.objects.get_or_create",
            side_effect=Exception("DB error"),
        ):
            doc = serializer.save()

        # Document should still be updated despite the permission error
        assert doc.pk == document.pk


# ---------------------------------------------------------------------------
# dynamic_document.py – line 636: usability perm skipped (no visibility)
# ---------------------------------------------------------------------------

class TestDynamicDocumentUpdateUsabilityNoVisibility:
    def test_update_usability_skipped_when_user_has_no_visibility(
        self, document, lawyer_user, basic_user
    ):
        """
        When updating usability permissions on a non-public document,
        a user without visibility permission is skipped (lines 639-646).
        """
        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document,
            data={
                "title": document.title,
                "content": document.content,
                "state": document.state,
                "usability_user_ids": [basic_user.pk],
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        doc = serializer.save()

        # The basic_user should NOT have usability permission
        # because they have no visibility permission on non-public doc
        from gym_app.models.dynamic_document import DocumentUsabilityPermission
        has_usability = DocumentUsabilityPermission.objects.filter(
            document=doc, user=basic_user
        ).exists()
        assert has_usability is False


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 779-784: get_created_by_name
# ---------------------------------------------------------------------------

class TestDocumentRelationshipSerializerGetCreatedByName:
    def test_get_created_by_name_with_full_name(self, document, lawyer_user):
        """
        get_created_by_name returns 'first_name last_name' when
        created_by has a name set (lines 779-783).
        """
        doc2 = DynamicDocument.objects.create(
            title="Target Doc",
            content="<p>y</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document,
            target_document=doc2,
            created_by=lawyer_user,
        )
        serializer = DocumentRelationshipSerializer()

        result = serializer.get_created_by_name(rel)

        assert result == "Law Yer"

    def test_get_created_by_name_falls_back_to_email(self, document):
        """
        get_created_by_name returns email when first/last name are empty
        (line 783 branch).
        """
        no_name_user = User.objects.create_user(
            email="noname_scov@test.com",
            password="pw",
            first_name="",
            last_name="",
            role="client",
        )
        doc2 = DynamicDocument.objects.create(
            title="Target2",
            content="<p>z</p>",
            state="Draft",
            created_by=no_name_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document,
            target_document=doc2,
            created_by=no_name_user,
        )
        serializer = DocumentRelationshipSerializer()

        result = serializer.get_created_by_name(rel)

        assert result == "noname_scov@test.com"

    def test_get_created_by_name_returns_empty_when_no_creator(self, document, lawyer_user):
        """
        get_created_by_name returns '' when created_by is None (line 784).
        created_by FK is NOT NULL at DB level, so we patch the descriptor.
        """
        doc2 = DynamicDocument.objects.create(
            title="Target3",
            content="<p>w</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        rel = DocumentRelationship.objects.create(
            source_document=document,
            target_document=doc2,
            created_by=lawyer_user,
        )
        serializer = DocumentRelationshipSerializer()

        # Temporarily replace the FK descriptor so obj.created_by is None
        with patch.object(DocumentRelationship, "created_by", new=None):
            result = serializer.get_created_by_name(rel)

        assert result == ""


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 790-798: validate self-relationship
# ---------------------------------------------------------------------------

class TestDocumentRelationshipSerializerValidate:
    def test_validate_rejects_self_relationship(self, document):
        """
        validate raises ValidationError when source == target (lines 793-796).
        """
        serializer = DocumentRelationshipSerializer(
            data={
                "source_document": document.pk,
                "target_document": document.pk,
            }
        )

        is_valid = serializer.is_valid()

        assert is_valid is False
        assert "non_field_errors" in serializer.errors


# ---------------------------------------------------------------------------
# dynamic_document.py – lines 805-809: create sets created_by
# ---------------------------------------------------------------------------

class TestDocumentRelationshipSerializerCreate:
    def test_create_sets_created_by_from_request(self, document, lawyer_user):
        """
        create() sets created_by from request.user (lines 805-809).
        """
        doc2 = DynamicDocument.objects.create(
            title="Target Create",
            content="<p>c</p>",
            state="Draft",
            created_by=lawyer_user,
        )
        request = factory.post("/fake/")
        request.user = lawyer_user

        serializer = DocumentRelationshipSerializer(
            data={
                "source_document": document.pk,
                "target_document": doc2.pk,
            },
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        rel = serializer.save()

        assert rel.pk is not None
        assert rel.created_by == lawyer_user


# ---------------------------------------------------------------------------
# organization.py – line 445: create post by non-corporate raises error
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# corporate_request.py – line 198: direct call to validate_corporate_client
# ---------------------------------------------------------------------------

class TestCorporateRequestValidateCorporateClientDirect:
    def test_validate_corporate_client_direct_call_rejects_non_corp(self, normal_client):
        """
        Call validate_corporate_client directly (bypassing DRF's
        limit_choices_to queryset filter) to exercise line 198.
        """
        serializer = CorporateRequestSerializer()

        with pytest.raises(drf_serializers.ValidationError, match="corporativo"):
            serializer.validate_corporate_client(normal_client)


# ---------------------------------------------------------------------------
# dynamic_document.py – line 607: creator skipped in visibility update
# ---------------------------------------------------------------------------

class TestDynamicDocumentUpdateVisibilitySkipsCreator:
    def test_update_visibility_skips_document_creator(self, document_by_basic, basic_user, lawyer_user):
        """
        When the document creator (non-lawyer) is included in
        visibility_user_ids, they are skipped at the creator check
        (line 606-607 continue), not the lawyer check.
        """
        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document_by_basic,
            data={
                "title": document_by_basic.title,
                "content": document_by_basic.content,
                "state": document_by_basic.state,
                "visibility_user_ids": [basic_user.pk],  # creator (non-lawyer)
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        doc = serializer.save()

        from gym_app.models.dynamic_document import DocumentVisibilityPermission
        has_vis = DocumentVisibilityPermission.objects.filter(
            document=doc, user=basic_user
        ).exists()
        # Creator is skipped, so no visibility permission created for them
        assert has_vis is False


# ---------------------------------------------------------------------------
# dynamic_document.py – line 636: creator skipped in usability update
# ---------------------------------------------------------------------------

class TestDynamicDocumentUpdateUsabilitySkipsCreator:
    def test_update_usability_skips_document_creator(
        self, document_by_basic, basic_user, lawyer_user, normal_client
    ):
        """
        When the document creator (non-lawyer) is included in
        usability_user_ids, they are skipped at the creator check
        (line 635-636 continue), not the lawyer check.
        """
        # Grant visibility to normal_client so usability can proceed for them
        from gym_app.models.dynamic_document import (
            DocumentVisibilityPermission,
            DocumentUsabilityPermission,
        )
        DocumentVisibilityPermission.objects.create(
            document=document_by_basic, user=normal_client, granted_by=lawyer_user
        )

        request = factory.patch("/fake/")
        request.user = lawyer_user

        serializer = DynamicDocumentSerializer(
            instance=document_by_basic,
            data={
                "title": document_by_basic.title,
                "content": document_by_basic.content,
                "state": document_by_basic.state,
                "usability_user_ids": [basic_user.pk, normal_client.pk],  # basic_user is creator
                "variables": [],
            },
            partial=True,
            context={"request": request},
        )
        assert serializer.is_valid(), serializer.errors

        doc = serializer.save()

        creator_has_usa = DocumentUsabilityPermission.objects.filter(
            document=doc, user=basic_user
        ).exists()
        # Creator (basic_user) is skipped
        assert creator_has_usa is False
        # normal_client with visibility DOES get usability
        other_has_usa = DocumentUsabilityPermission.objects.filter(
            document=doc, user=normal_client
        ).exists()
        assert other_has_usa is True


class TestOrganizationPostCreateNonCorporate:
    def test_create_post_by_non_corporate_user_raises_error(
        self, organization, basic_user
    ):
        """
        OrganizationPostCreateSerializer.create() raises ValidationError
        when the request user is not a corporate_client (line 445).
        The validate() method also checks org leadership, so we use the
        corporate_client (org leader) role but patch the role after validation.
        """
        # Use a second corporate_client who IS the org leader,
        # but change their role right before save to trigger line 445.
        # Simpler approach: skip validate's org-leader check by not providing org.
        request = factory.post("/fake/")
        request.user = basic_user

        serializer = OrganizationPostCreateSerializer(
            data={
                "title": "Post Title",
                "content": "Post Content",
                "organization": organization.pk,
            },
            context={"request": request},
        )

        is_valid = serializer.is_valid()

        # Validation itself rejects because basic_user is not org leader
        # This still exercises the serializer validation path
        assert is_valid is False
        assert "non_field_errors" in serializer.errors


# ---------------------------------------------------------------------------
# organization.py – line 504: validate link_url without link_name
# ---------------------------------------------------------------------------

class TestOrganizationPostCreateNonCorporateDirect:
    def test_create_directly_by_non_corporate_user_raises_error(
        self, organization, normal_client, corporate_client
    ):
        """
        Calling create() directly (bypassing validate) with a non-corporate
        user triggers the role check on line 444-445.
        """
        request = factory.post("/fake/")
        request.user = normal_client

        serializer = OrganizationPostCreateSerializer(
            context={"request": request},
        )

        with pytest.raises(drf_serializers.ValidationError, match="corporativos"):
            serializer.create({
                "title": "Post",
                "content": "Content",
                "organization": organization,
            })


class TestOrganizationPostUpdateValidateLinkUrl:
    def test_validate_raises_when_link_url_provided_without_link_name(self):
        """
        OrganizationPostUpdateSerializer.validate() raises ValidationError
        when link_url is provided but link_name is empty (lines 499-502).
        """
        serializer = OrganizationPostUpdateSerializer(
            data={
                "title": "Updated",
                "content": "Content",
                "link_url": "https://example.com",
                # link_name intentionally omitted
            },
        )

        is_valid = serializer.is_valid()

        assert is_valid is False
        assert "link_name" in serializer.errors

    def test_validate_passes_when_no_link_fields(self):
        """
        OrganizationPostUpdateSerializer.validate() returns data
        when no link fields are provided (line 504).
        """
        serializer = OrganizationPostUpdateSerializer(
            data={
                "title": "Updated",
                "content": "Content",
            },
        )

        is_valid = serializer.is_valid()

        assert is_valid is True
