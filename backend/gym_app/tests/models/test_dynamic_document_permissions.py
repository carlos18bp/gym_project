import pytest
from django.core.exceptions import ValidationError

from gym_app.models import (
    DynamicDocument,
    DocumentSignature,
    DocumentUsabilityPermission,
    DocumentVisibilityPermission,
)
from gym_app.models.user import User


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
def document_factory():
    def create_document(created_by, **kwargs):
        return DynamicDocument.objects.create(
            title=kwargs.pop("title", "Doc"),
            content=kwargs.pop("content", "<p>x</p>"),
            state=kwargs.pop("state", "Draft"),
            created_by=created_by,
            assigned_to=kwargs.pop("assigned_to", None),
            is_public=kwargs.pop("is_public", False),
        )

    return create_document


def test_can_view_lawyer_has_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    document = document_factory(created_by=creator)

    assert document.can_view(lawyer) is True


def test_can_view_creator_and_signer(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    signer = user_factory("signer@example.com")
    document = document_factory(created_by=creator)
    DocumentSignature.objects.create(document=document, signer=signer)

    assert document.can_view(creator) is True
    assert document.can_view(signer) is True


def test_can_view_public_visibility_and_no_permission(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    public_user = user_factory("public@example.com")
    visibility_user = user_factory("viewer@example.com")
    no_access_user = user_factory("noaccess@example.com")

    public_doc = document_factory(created_by=creator, is_public=True)
    visibility_doc = document_factory(created_by=creator)
    DocumentVisibilityPermission.objects.create(
        document=visibility_doc,
        user=visibility_user,
        granted_by=creator,
    )
    private_doc = document_factory(created_by=creator)

    assert public_doc.can_view(public_user) is True
    assert visibility_doc.can_view(visibility_user) is True
    assert private_doc.can_view(no_access_user) is False


def test_can_use_lawyer_has_access(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    document = document_factory(created_by=creator)

    assert document.can_use(lawyer) is True


def test_can_use_creator_and_assigned_user(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    assigned_user = user_factory("assigned@example.com")
    document = document_factory(created_by=creator, assigned_to=assigned_user)

    assert document.can_use(creator) is True
    assert document.can_use(assigned_user) is True


def test_can_use_public_usability_permission_and_no_permission(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    public_user = user_factory("public@example.com")
    usability_user = user_factory("usability@example.com")
    no_access_user = user_factory("noaccess@example.com")

    public_doc = document_factory(created_by=creator, is_public=True)
    usability_doc = document_factory(created_by=creator)
    DocumentVisibilityPermission.objects.create(
        document=usability_doc,
        user=usability_user,
        granted_by=creator,
    )
    DocumentUsabilityPermission.objects.create(
        document=usability_doc,
        user=usability_user,
        granted_by=creator,
    )
    private_doc = document_factory(created_by=creator)

    assert public_doc.can_use(public_user) is True
    assert usability_doc.can_use(usability_user) is True
    assert private_doc.can_use(no_access_user) is False


def test_get_user_permission_level_lawyer_and_owner(user_factory, document_factory):
    owner = user_factory("owner@example.com")
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    document = document_factory(created_by=owner)

    assert document.get_user_permission_level(lawyer) == "lawyer"
    assert document.get_user_permission_level(owner) == "owner"


def test_get_user_permission_level_assigned_and_published_template(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    assigned_user = user_factory("assigned@example.com")
    template_user = user_factory("template@example.com")

    assigned_doc = document_factory(created_by=creator, assigned_to=assigned_user)
    template_doc = document_factory(created_by=creator, state="Published", assigned_to=None)

    assert assigned_doc.get_user_permission_level(assigned_user) == "usability"
    assert template_doc.get_user_permission_level(template_user) == "usability"


def test_get_user_permission_level_usability_and_view_only_permissions(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    usability_user = user_factory("usability@example.com")
    view_user = user_factory("viewer@example.com")
    document = document_factory(created_by=creator)

    DocumentVisibilityPermission.objects.create(
        document=document,
        user=usability_user,
        granted_by=creator,
    )
    DocumentUsabilityPermission.objects.create(
        document=document,
        user=usability_user,
        granted_by=creator,
    )
    DocumentVisibilityPermission.objects.create(
        document=document,
        user=view_user,
        granted_by=creator,
    )

    assert document.get_user_permission_level(usability_user) == "usability"
    assert document.get_user_permission_level(view_user) == "view_only"


def test_get_user_permission_level_public_access_and_none(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    public_user = user_factory("public@example.com")
    no_access_user = user_factory("noaccess@example.com")

    public_doc = document_factory(created_by=creator, is_public=True)
    private_doc = document_factory(created_by=creator)

    assert public_doc.get_user_permission_level(public_user) == "public_access"
    assert private_doc.get_user_permission_level(no_access_user) is None


def test_get_user_permission_level_visibility_precedes_public(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    viewer = user_factory("viewer@example.com")
    document = document_factory(created_by=creator, is_public=True)
    DocumentVisibilityPermission.objects.create(
        document=document,
        user=viewer,
        granted_by=creator,
    )

    assert document.get_user_permission_level(viewer) == "view_only"


def test_get_user_permission_level_usability_precedes_public(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    usability_user = user_factory("usability@example.com")
    document = document_factory(created_by=creator, is_public=True)
    DocumentVisibilityPermission.objects.create(
        document=document,
        user=usability_user,
        granted_by=creator,
    )
    DocumentUsabilityPermission.objects.create(
        document=document,
        user=usability_user,
        granted_by=creator,
    )

    assert document.get_user_permission_level(usability_user) == "usability"


###############################################################################
# can_view_prefetched – mirrors the can_view tests above but exercises the
# prefetch-aware code path that iterates .all() instead of .filter().exists().
###############################################################################


def test_can_view_prefetched_lawyer_has_access(user_factory, document_factory):
    creator = user_factory("creator_pf1@example.com")
    lawyer = user_factory("lawyer_pf1@example.com", role="lawyer")
    document = document_factory(created_by=creator)

    assert document.can_view_prefetched(lawyer) is True


def test_can_view_prefetched_creator_and_signer(user_factory, document_factory):
    creator = user_factory("creator_pf2@example.com")
    signer = user_factory("signer_pf2@example.com")
    document = document_factory(created_by=creator)
    DocumentSignature.objects.create(document=document, signer=signer)

    # Refetch with prefetch to exercise the prefetched path
    doc = DynamicDocument.objects.prefetch_related(
        "signatures", "visibility_permissions"
    ).get(pk=document.pk)

    assert doc.can_view_prefetched(creator) is True
    assert doc.can_view_prefetched(signer) is True


def test_can_view_prefetched_public_visibility_and_no_permission(user_factory, document_factory):
    creator = user_factory("creator_pf3@example.com")
    public_user = user_factory("public_pf3@example.com")
    visibility_user = user_factory("viewer_pf3@example.com")
    no_access_user = user_factory("noaccess_pf3@example.com")

    public_doc = document_factory(created_by=creator, is_public=True)
    visibility_doc = document_factory(created_by=creator)
    DocumentVisibilityPermission.objects.create(
        document=visibility_doc,
        user=visibility_user,
        granted_by=creator,
    )
    private_doc = document_factory(created_by=creator)

    # Prefetch for all three
    public_doc = DynamicDocument.objects.prefetch_related(
        "signatures", "visibility_permissions"
    ).get(pk=public_doc.pk)
    visibility_doc = DynamicDocument.objects.prefetch_related(
        "signatures", "visibility_permissions"
    ).get(pk=visibility_doc.pk)
    private_doc = DynamicDocument.objects.prefetch_related(
        "signatures", "visibility_permissions"
    ).get(pk=private_doc.pk)

    assert public_doc.can_view_prefetched(public_user) is True
    assert visibility_doc.can_view_prefetched(visibility_user) is True
    assert private_doc.can_view_prefetched(no_access_user) is False


def test_can_view_prefetched_matches_can_view(user_factory, document_factory):
    """can_view_prefetched must return the same result as can_view for every scenario."""
    creator = user_factory("creator_pf4@example.com")
    lawyer = user_factory("lawyer_pf4@example.com", role="lawyer")
    signer = user_factory("signer_pf4@example.com")
    viewer = user_factory("viewer_pf4@example.com")
    stranger = user_factory("stranger_pf4@example.com")

    doc = document_factory(created_by=creator)
    DocumentSignature.objects.create(document=doc, signer=signer)
    DocumentVisibilityPermission.objects.create(
        document=doc, user=viewer, granted_by=creator,
    )

    prefetched = DynamicDocument.objects.prefetch_related(
        "signatures", "visibility_permissions"
    ).select_related("created_by").get(pk=doc.pk)

    for user in (creator, lawyer, signer, viewer, stranger):
        assert prefetched.can_view_prefetched(user) == doc.can_view(user), (
            f"Mismatch for {user.email}"
        )


def test_document_usability_permission_clean_requires_visibility_raises(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    client = user_factory("client@example.com")
    document = document_factory(created_by=creator)
    permission = DocumentUsabilityPermission(
        document=document,
        user=client,
        granted_by=creator,
    )

    with pytest.raises(ValidationError, match="visibility permission"):
        permission.save()


def test_document_usability_permission_clean_allows_lawyer_without_visibility(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    lawyer = user_factory("lawyer@example.com", role="lawyer")
    document = document_factory(created_by=creator)

    permission = DocumentUsabilityPermission.objects.create(
        document=document,
        user=lawyer,
        granted_by=creator,
    )

    assert permission.id is not None


def test_document_usability_permission_clean_allows_with_visibility(user_factory, document_factory):
    creator = user_factory("creator@example.com")
    client = user_factory("client@example.com")
    document = document_factory(created_by=creator)
    DocumentVisibilityPermission.objects.create(
        document=document,
        user=client,
        granted_by=creator,
    )

    permission = DocumentUsabilityPermission.objects.create(
        document=document,
        user=client,
        granted_by=creator,
    )

    assert permission.id is not None
