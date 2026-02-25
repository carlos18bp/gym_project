"""Tests for dynamic_document_permission_decorators module."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from gym_app.models import DocumentVisibilityPermission, DynamicDocument
from gym_app.views.dynamic_documents.permissions import (
    filter_documents_by_visibility,
    require_document_usability,
    require_document_visibility,
    require_document_visibility_by_id,
    require_lawyer_only,
    require_lawyer_or_owner,
    require_lawyer_or_owner_by_id,
)

User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def factory():
    """Create a factory fixture."""
    return APIRequestFactory()


@pytest.fixture
@pytest.mark.django_db
def lawyer_user():
    """Lawyer user."""
    return User.objects.create_user(
        email="lawyer@example.com",
        password="testpassword",
        role="lawyer",
    )


@pytest.fixture
@pytest.mark.django_db
def client_user():
    """Client user."""
    return User.objects.create_user(
        email="client@example.com",
        password="testpassword",
        role="client",
    )


@pytest.fixture
@pytest.mark.django_db
def other_user():
    """Other user."""
    return User.objects.create_user(
        email="other@example.com",
        password="testpassword",
        role="client",
    )


@pytest.mark.django_db
class TestRequireDocumentVisibility:
    """Tests for Require Document Visibility."""

    def test_require_document_visibility_allows_owner(self, factory, client_user):
        """Verify require document visibility allows owner."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        request = factory.get("/")
        request.user = client_user

        @require_document_visibility
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_200_OK

    def test_require_document_visibility_forbidden(self, factory, client_user, other_user):
        """Verify require document visibility forbidden."""
        doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )

        request = factory.get("/")
        request.user = client_user

        @require_document_visibility
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_document_visibility_not_found(self, factory, client_user):
        """Verify require document visibility not found."""
        request = factory.get("/")
        request.user = client_user

        @require_document_visibility
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, 9999)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRequireDocumentVisibilityById:
    """Tests for Require Document Visibility By Id."""

    def test_require_document_visibility_by_id_allows_lawyer(self, factory, lawyer_user, client_user):
        """Verify require document visibility by id allows lawyer."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        request = factory.get("/")
        request.user = lawyer_user

        @require_document_visibility_by_id
        def view(request, document_id):
            return Response({"ok": True}, status=status.HTTP_200_OK)

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_200_OK

    def test_require_document_visibility_by_id_forbidden(self, factory, client_user, other_user):
        """Verify require document visibility by id forbidden."""
        doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )

        request = factory.get("/")
        request.user = client_user

        @require_document_visibility_by_id
        def view(request, document_id):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_document_visibility_by_id_not_found(self, factory, client_user):
        """Verify require document visibility by id not found."""
        request = factory.get("/")
        request.user = client_user

        @require_document_visibility_by_id
        def view(request, document_id):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, 9999)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRequireLawyerOrOwner:
    """Tests for Require Lawyer Or Owner."""

    def test_require_lawyer_or_owner_allows_owner(self, factory, client_user):
        """Verify require lawyer or owner allows owner."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        request = factory.get("/")
        request.user = client_user

        @require_lawyer_or_owner
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_200_OK

    def test_require_lawyer_or_owner_forbidden(self, factory, client_user, other_user):
        """Verify require lawyer or owner forbidden."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
        )

        request = factory.get("/")
        request.user = client_user

        @require_lawyer_or_owner
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_lawyer_or_owner_not_found(self, factory, client_user):
        """Verify require lawyer or owner not found."""
        request = factory.get("/")
        request.user = client_user

        @require_lawyer_or_owner
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, 9999)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRequireLawyerOrOwnerById:
    """Tests for Require Lawyer Or Owner By Id."""

    def test_require_lawyer_or_owner_by_id_allows_lawyer(self, factory, lawyer_user, client_user):
        """Verify require lawyer or owner by id allows lawyer."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        request = factory.get("/")
        request.user = lawyer_user

        @require_lawyer_or_owner_by_id
        def view(request, document_id):
            return Response({"ok": True}, status=status.HTTP_200_OK)

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_200_OK

    def test_require_lawyer_or_owner_by_id_forbidden(self, factory, client_user, other_user):
        """Verify require lawyer or owner by id forbidden."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
        )

        request = factory.get("/")
        request.user = client_user

        @require_lawyer_or_owner_by_id
        def view(request, document_id):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_lawyer_or_owner_by_id_not_found(self, factory, client_user):
        """Verify require lawyer or owner by id not found."""
        request = factory.get("/")
        request.user = client_user

        @require_lawyer_or_owner_by_id
        def view(request, document_id):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, 9999)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRequireDocumentUsability:
    """Tests for Require Document Usability."""

    def test_require_document_usability_missing_permission(self, factory, client_user, other_user):
        """Verify require document usability missing permission."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )

        request = factory.get("/")
        request.user = client_user

        @require_document_usability("public_access")
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_document_usability_insufficient_level(self, factory, client_user, other_user):
        """Verify require document usability insufficient level."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
            is_public=False,
        )
        DocumentVisibilityPermission.objects.create(document=doc, user=client_user, granted_by=other_user)

        request = factory.get("/")
        request.user = client_user

        @require_document_usability("usability")
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_document_usability_invalid_permission_type(self, factory, client_user):
        """Verify require document usability invalid permission type."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        request = factory.get("/")
        request.user = client_user

        @require_document_usability("invalid")
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_require_document_usability_allows_public_access(self, factory, client_user, other_user):
        """Verify require document usability allows public access."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
            is_public=True,
        )

        request = factory.get("/")
        request.user = client_user

        @require_document_usability("public_access")
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)

        response = view(request, doc.id)
        assert response.status_code == status.HTTP_200_OK

    def test_require_document_usability_not_found(self, factory, client_user):
        """Verify require document usability not found."""
        request = factory.get("/")
        request.user = client_user

        @require_document_usability("public_access")
        def view(request, pk):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request, 9999)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestRequireLawyerOnly:
    """Tests for Require Lawyer Only."""

    def test_require_lawyer_only_allows_lawyer(self, factory, lawyer_user):
        """Verify require lawyer only allows lawyer."""
        request = factory.get("/")
        request.user = lawyer_user

        @require_lawyer_only
        def view(request):
            return Response({"ok": True}, status=status.HTTP_200_OK)

        response = view(request)
        assert response.status_code == status.HTTP_200_OK

    def test_require_lawyer_only_forbidden(self, factory, client_user):
        """Verify require lawyer only forbidden."""
        request = factory.get("/")
        request.user = client_user

        @require_lawyer_only
        def view(request):
            return Response({"ok": True}, status=status.HTTP_200_OK)  # pragma: no cover – blocked by decorator

        response = view(request)
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestFilterDocumentsByVisibility:
    """Tests for Filter Documents By Visibility."""

    def test_filter_documents_by_visibility_list(self, factory, client_user, other_user):
        """Verify filter documents by visibility list."""
        visible_doc = DynamicDocument.objects.create(
            title="Visible",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )
        hidden_doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
        )
        public_doc = DynamicDocument.objects.create(
            title="Public",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
            is_public=True,
        )

        request = factory.get("/")
        request.user = client_user

        @filter_documents_by_visibility
        def view(_request):
            return Response([
                {"id": visible_doc.id},
                {"id": hidden_doc.id},
                {"id": public_doc.id},
                {"id": 9999},
            ])

        response = view(request)
        ids = {doc["id"] for doc in response.data}
        assert ids == {visible_doc.id, public_doc.id}

    def test_filter_documents_by_visibility_skips_items_without_id(self, factory, client_user, other_user):
        """Verify filter documents by visibility skips items without id."""
        visible_doc = DynamicDocument.objects.create(
            title="Visible",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )
        DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
        )

        request = factory.get("/")
        request.user = client_user

        @filter_documents_by_visibility
        def view(_request):
            return Response([
                {"id": visible_doc.id},
                {"title": "missing-id"},
                {},
            ])

        response = view(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == [{"id": visible_doc.id}]

    def test_filter_documents_by_visibility_paginated(self, factory, client_user, other_user):
        """Verify filter documents by visibility paginated."""
        visible_doc = DynamicDocument.objects.create(
            title="Visible",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )
        hidden_doc = DynamicDocument.objects.create(
            title="Hidden",
            content="<p>x</p>",
            state="Draft",
            created_by=other_user,
        )

        request = factory.get("/")
        request.user = client_user

        @filter_documents_by_visibility
        def view(_request):
            return Response({"items": [{"id": visible_doc.id}, {"id": hidden_doc.id}], "totalItems": 2, "totalPages": 1})

        response = view(request)
        ids = {doc["id"] for doc in response.data["items"]}
        assert ids == {visible_doc.id}
        assert response.data["totalItems"] == 1
        assert response.data["totalPages"] == 1

    def test_filter_visibility_paginated_shows_signed_docs_for_signer(self, factory, client_user, lawyer_user):
        """Regression: FullySigned documents must be visible to their signers."""
        from gym_app.models.dynamic_document import DocumentSignature

        doc = DynamicDocument.objects.create(
            title="Signed Doc",
            content="<p>signed</p>",
            state="FullySigned",
            created_by=lawyer_user,
            assigned_to=client_user,
        )
        DocumentSignature.objects.create(
            document=doc,
            signer=client_user,
            signed=True,
        )

        request = factory.get("/")
        request.user = client_user

        @filter_documents_by_visibility
        def view(_request):
            return Response({
                "items": [{"id": doc.id}],
                "totalItems": 1,
                "totalPages": 1,
            })

        response = view(request)
        ids = {d["id"] for d in response.data["items"]}
        assert doc.id in ids, "Signer should see their FullySigned document"
        assert response.data["totalItems"] == 1

    def test_filter_documents_by_visibility_passthrough_for_lawyer(self, factory, lawyer_user, client_user):
        """Verify filter documents by visibility passthrough for lawyer."""
        doc = DynamicDocument.objects.create(
            title="Doc",
            content="<p>x</p>",
            state="Draft",
            created_by=client_user,
        )

        request = factory.get("/")
        request.user = lawyer_user

        @filter_documents_by_visibility
        def view(_request):
            return Response([{"id": doc.id}])

        response = view(request)
        assert response.data == [{"id": doc.id}]

    def test_filter_documents_by_visibility_unsupported_shape(self, factory, client_user):
        """Verify filter documents by visibility unsupported shape."""
        request = factory.get("/")
        request.user = client_user

        @filter_documents_by_visibility
        def view(_request):
            return Response({"foo": "bar"})

        response = view(request)
        assert response.data == {"foo": "bar"}
