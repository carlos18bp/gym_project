"""Tests for the user_related, signer_signed, and unassigned query params on list_dynamic_documents."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature

User = get_user_model()
pytestmark = pytest.mark.django_db

URL = "list_dynamic_documents"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="law_ur@test.com", password="pw", role="lawyer", first_name="L", last_name="W"
    )


@pytest.fixture
def client_user():
    return User.objects.create_user(
        email="cli_ur@test.com", password="pw", role="client", first_name="C", last_name="L"
    )


@pytest.fixture
def other_client():
    return User.objects.create_user(
        email="other_ur@test.com", password="pw", role="client", first_name="O", last_name="C"
    )


# ---------------------------------------------------------------------------
# user_related tests
# ---------------------------------------------------------------------------

class TestUserRelatedFilter:
    def test_user_related_returns_created_docs(self, api, lawyer, client_user, other_client):
        """Documents created by the requesting user are returned with user_related=true."""
        my_doc = DynamicDocument.objects.create(
            title="MyDoc", content="<p>x</p>", state="Draft", created_by=client_user
        )
        other_doc = DynamicDocument.objects.create(
            title="OtherDoc", content="<p>x</p>", state="Draft", created_by=other_client
        )
        api.force_authenticate(user=client_user)
        resp = api.get(reverse(URL), {"user_related": "true"})
        assert resp.status_code == 200
        ids = {d["id"] for d in resp.data["items"]}
        assert my_doc.id in ids
        assert other_doc.id not in ids

    def test_user_related_returns_signer_docs(self, api, lawyer, client_user):
        """Documents where the user is a signer are returned with user_related=true."""
        doc = DynamicDocument.objects.create(
            title="SignerDoc", content="<p>x</p>", state="PendingSignatures", created_by=lawyer
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, signed=False)
        api.force_authenticate(user=client_user)
        resp = api.get(reverse(URL), {"user_related": "true"})
        assert resp.status_code == 200
        ids = {d["id"] for d in resp.data["items"]}
        assert doc.id in ids

    def test_user_related_with_state_filter(self, api, lawyer, client_user):
        """Combining state and user_related filters works correctly."""
        signed_doc = DynamicDocument.objects.create(
            title="Signed", content="<p>x</p>", state="FullySigned", created_by=lawyer
        )
        DocumentSignature.objects.create(document=signed_doc, signer=client_user, signed=True)

        draft_doc = DynamicDocument.objects.create(
            title="Draft", content="<p>x</p>", state="Draft", created_by=client_user
        )

        api.force_authenticate(user=client_user)
        resp = api.get(reverse(URL), {"state": "FullySigned", "user_related": "true"})
        assert resp.status_code == 200
        ids = {d["id"] for d in resp.data["items"]}
        assert signed_doc.id in ids
        assert draft_doc.id not in ids

    def test_user_related_distinct_no_duplicates(self, api, lawyer, client_user):
        """A document where user is both creator AND signer appears only once."""
        doc = DynamicDocument.objects.create(
            title="BothRoles", content="<p>x</p>", state="FullySigned", created_by=client_user
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, signed=True)
        api.force_authenticate(user=client_user)
        resp = api.get(reverse(URL), {"user_related": "true"})
        assert resp.status_code == 200
        ids = [d["id"] for d in resp.data["items"]]
        assert ids.count(doc.id) == 1

    def test_user_related_false_by_default(self, api, lawyer, client_user, other_client):
        """Without user_related, a lawyer sees all documents (no regression)."""
        DynamicDocument.objects.create(
            title="D1", content="<p>x</p>", state="Draft", created_by=lawyer
        )
        DynamicDocument.objects.create(
            title="D2", content="<p>x</p>", state="Draft", created_by=other_client
        )
        api.force_authenticate(user=lawyer)
        resp = api.get(reverse(URL))
        assert resp.status_code == 200
        assert resp.data["totalItems"] == 2


# ---------------------------------------------------------------------------
# signer_signed tests
# ---------------------------------------------------------------------------

class TestSignerSignedFilter:
    def test_signer_signed_excludes_unsigned(self, api, lawyer, client_user):
        """With signer_signed=true, docs where user has signed=False are excluded (unless creator)."""
        doc = DynamicDocument.objects.create(
            title="UnsignedDoc", content="<p>x</p>", state="FullySigned", created_by=lawyer
        )
        DocumentSignature.objects.create(document=doc, signer=client_user, signed=False)
        api.force_authenticate(user=client_user)

        # Without signer_signed: document IS returned (user is a signer)
        resp = api.get(reverse(URL), {"user_related": "true"})
        ids_without = {d["id"] for d in resp.data["items"]}
        assert doc.id in ids_without

        # With signer_signed=true: document is NOT returned (signed=False, not creator)
        resp = api.get(reverse(URL), {"user_related": "true", "signer_signed": "true"})
        ids_with = {d["id"] for d in resp.data["items"]}
        assert doc.id not in ids_with

    def test_signer_signed_includes_creator(self, api, lawyer, client_user):
        """Creator always appears even with signer_signed=true (creator is not a signer here)."""
        doc = DynamicDocument.objects.create(
            title="CreatorDoc", content="<p>x</p>", state="FullySigned", created_by=client_user
        )
        api.force_authenticate(user=client_user)
        resp = api.get(reverse(URL), {"user_related": "true", "signer_signed": "true"})
        assert resp.status_code == 200
        ids = {d["id"] for d in resp.data["items"]}
        assert doc.id in ids


# ---------------------------------------------------------------------------
# unassigned tests
# ---------------------------------------------------------------------------

class TestUnassignedFilter:
    def test_unassigned_filter(self, api, lawyer, client_user):
        """unassigned=true returns only docs with assigned_to IS NULL."""
        template = DynamicDocument.objects.create(
            title="Template", content="<p>x</p>", state="Published", created_by=lawyer,
            assigned_to=None
        )
        assigned = DynamicDocument.objects.create(
            title="Assigned", content="<p>x</p>", state="Published", created_by=lawyer,
            assigned_to=client_user
        )
        api.force_authenticate(user=lawyer)
        resp = api.get(reverse(URL), {"unassigned": "true"})
        assert resp.status_code == 200
        ids = {d["id"] for d in resp.data["items"]}
        assert template.id in ids
        assert assigned.id not in ids

    def test_unassigned_with_state(self, api, lawyer, client_user):
        """Combining states=Published with unassigned=true returns only Published templates."""
        template = DynamicDocument.objects.create(
            title="PubTemplate", content="<p>x</p>", state="Published", created_by=lawyer,
            assigned_to=None
        )
        draft_unassigned = DynamicDocument.objects.create(
            title="DraftUnassigned", content="<p>x</p>", state="Draft", created_by=lawyer,
            assigned_to=None
        )
        pub_assigned = DynamicDocument.objects.create(
            title="PubAssigned", content="<p>x</p>", state="Published", created_by=lawyer,
            assigned_to=client_user
        )
        api.force_authenticate(user=lawyer)
        resp = api.get(reverse(URL), {"states": "Published", "unassigned": "true"})
        assert resp.status_code == 200
        ids = {d["id"] for d in resp.data["items"]}
        assert template.id in ids
        assert draft_unassigned.id not in ids
        assert pub_assigned.id not in ids
