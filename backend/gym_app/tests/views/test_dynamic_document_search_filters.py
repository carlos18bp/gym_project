"""Tests for server-side search and filter parameters on list_dynamic_documents."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

from gym_app.models import DocumentVariable, DynamicDocument, Tag

User = get_user_model()

pytestmark = pytest.mark.django_db

URL = reverse("list_dynamic_documents")


@pytest.fixture
def lawyer():
    """Lawyer user (sees all documents via visibility decorator)."""
    return User.objects.create_user(
        email="lawyer_search@test.com",
        password="testpassword",
        first_name="Lawyer",
        last_name="Search",
        role="lawyer",
        is_gym_lawyer=True,
    )


@pytest.fixture
def client_user():
    """Client user used as assigned_to target."""
    return User.objects.create_user(
        email="laura_gamboa@test.com",
        password="testpassword",
        first_name="Laura",
        last_name="Gamboa",
        role="client",
    )


@pytest.fixture
def tag_civil():
    """Tag: Civil."""
    return Tag.objects.create(name="Civil")


@pytest.fixture
def tag_laboral():
    """Tag: Laboral."""
    return Tag.objects.create(name="Laboral")


@pytest.fixture
def docs_for_search(lawyer, client_user, tag_civil, tag_laboral):
    """Create a set of documents that exercise different search paths."""
    # Doc 1 – title matches "Laura", tagged Civil
    doc1 = DynamicDocument.objects.create(
        title="CPS 093-2026 Laura Gamboa_firma",
        content="<p>content</p>",
        state="Draft",
        created_by=lawyer,
        assigned_to=client_user,
    )
    doc1.tags.add(tag_civil)

    # Doc 2 – title does NOT match "Laura" but has a variable value that does
    doc2 = DynamicDocument.objects.create(
        title="Contrato de Servicios",
        content="<p>content</p>",
        state="Published",
        created_by=lawyer,
    )
    DocumentVariable.objects.create(
        document=doc2,
        name_en="counterparty",
        field_type="input",
        summary_field="counterparty",
        value="LAURA MELISSA GAMBOA FERRER",
    )
    doc2.tags.add(tag_laboral)

    # Doc 3 – no match for "Laura" at all
    doc3 = DynamicDocument.objects.create(
        title="Acuerdo de Confidencialidad",
        content="<p>content</p>",
        state="Draft",
        created_by=lawyer,
    )
    doc3.tags.add(tag_civil)

    # Doc 4 – assigned_to user whose first_name is "Laura"
    doc4 = DynamicDocument.objects.create(
        title="Otro Contrato",
        content="<p>content</p>",
        state="Draft",
        created_by=lawyer,
        assigned_to=client_user,
    )

    return doc1, doc2, doc3, doc4


class TestListDocumentsSearchParam:
    """Tests for the ?search= query parameter on list_dynamic_documents."""

    def test_search_by_title_returns_matching_documents(
        self, api_client, lawyer, docs_for_search
    ):
        """Search by title substring returns only documents whose title matches."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"search": "Confidencialidad"})

        assert response.status_code == status.HTTP_200_OK
        titles = [d["title"] for d in response.data["items"]]
        assert titles == ["Acuerdo de Confidencialidad"]
        assert response.data["totalItems"] == 1

    def test_search_by_variable_value_returns_matching_documents(
        self, api_client, lawyer, docs_for_search
    ):
        """Search matches against DocumentVariable.value (e.g. counterparty)."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"search": "GAMBOA FERRER"})

        assert response.status_code == status.HTTP_200_OK
        ids = {d["id"] for d in response.data["items"]}
        doc1, doc2, doc3, doc4 = docs_for_search
        assert doc2.id in ids

    def test_search_by_assigned_user_name_returns_matching_documents(
        self, api_client, lawyer, docs_for_search
    ):
        """Search matches against assigned_to user first/last name."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"search": "Laura"})

        assert response.status_code == status.HTTP_200_OK
        doc1, doc2, doc3, doc4 = docs_for_search
        ids = {d["id"] for d in response.data["items"]}
        # doc1 (title match + assigned), doc2 (variable match), doc4 (assigned match)
        assert doc1.id in ids
        assert doc2.id in ids
        assert doc4.id in ids
        # doc3 has no relation to "Laura"
        assert doc3.id not in ids

    def test_search_empty_string_returns_all_documents(
        self, api_client, lawyer, docs_for_search
    ):
        """Empty search string returns all documents (no filter applied)."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"search": ""})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["totalItems"] == 4

    def test_search_pagination_reflects_filtered_count(
        self, api_client, lawyer, docs_for_search
    ):
        """Pagination metadata reflects the filtered result count, not total."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"search": "Confidencialidad", "limit": 2})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["totalItems"] == 1
        assert response.data["totalPages"] == 1
        assert response.data["currentPage"] == 1


class TestListDocumentsTagFilter:
    """Tests for the ?tag_id= query parameter."""

    def test_filter_by_tag_returns_only_tagged_documents(
        self, api_client, lawyer, docs_for_search, tag_civil
    ):
        """Filtering by tag_id returns only documents with that tag."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"tag_id": tag_civil.id})

        assert response.status_code == status.HTTP_200_OK
        doc1, doc2, doc3, doc4 = docs_for_search
        ids = {d["id"] for d in response.data["items"]}
        assert doc1.id in ids
        assert doc3.id in ids
        assert doc2.id not in ids

    def test_filter_by_tag_combined_with_search(
        self, api_client, lawyer, docs_for_search, tag_civil
    ):
        """Combining search + tag_id narrows results to intersection."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(
            URL, {"search": "Laura", "tag_id": tag_civil.id}
        )

        assert response.status_code == status.HTTP_200_OK
        doc1, doc2, doc3, doc4 = docs_for_search
        ids = {d["id"] for d in response.data["items"]}
        # Only doc1 matches both "Laura" AND tag_civil
        assert doc1.id in ids
        assert doc2.id not in ids  # Laura match but tag_laboral
        assert doc3.id not in ids  # tag_civil but no Laura match


class TestListDocumentsSortParam:
    """Tests for the ?sort_by= query parameter."""

    def test_sort_by_name_asc(self, api_client, lawyer, docs_for_search):
        """sort_by=name-asc returns documents ordered by title ascending."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"sort_by": "name-asc"})

        assert response.status_code == status.HTTP_200_OK
        titles = [d["title"] for d in response.data["items"]]
        assert titles == sorted(titles)

    def test_sort_by_name_desc(self, api_client, lawyer, docs_for_search):
        """sort_by=name-desc returns documents ordered by title descending."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"sort_by": "name-desc"})

        assert response.status_code == status.HTTP_200_OK
        titles = [d["title"] for d in response.data["items"]]
        assert titles == sorted(titles, reverse=True)


class TestListDocumentsDateFilter:
    """Tests for the ?date_from= / ?date_to= query parameters."""

    def test_date_from_filters_by_created_at_fallback(
        self, api_client, lawyer
    ):
        """date_from filters documents using created_at when no subscription_date variable exists."""
        api_client.force_authenticate(user=lawyer)

        doc_old = DynamicDocument.objects.create(
            title="Old Doc", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        # Force a past created_at
        DynamicDocument.objects.filter(pk=doc_old.pk).update(
            created_at="2020-01-01T00:00:00Z"
        )

        doc_new = DynamicDocument.objects.create(
            title="New Doc", content="<p>x</p>", state="Draft", created_by=lawyer,
        )

        response = api_client.get(URL, {"date_from": "2025-01-01"})

        assert response.status_code == status.HTTP_200_OK
        ids = {d["id"] for d in response.data["items"]}
        assert doc_new.id in ids
        assert doc_old.id not in ids

    def test_date_to_filters_by_created_at_fallback(
        self, api_client, lawyer
    ):
        """date_to excludes documents created after the given date."""
        api_client.force_authenticate(user=lawyer)

        doc_old = DynamicDocument.objects.create(
            title="Old Doc", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        DynamicDocument.objects.filter(pk=doc_old.pk).update(
            created_at="2020-06-15T00:00:00Z"
        )

        doc_new = DynamicDocument.objects.create(
            title="New Doc", content="<p>x</p>", state="Draft", created_by=lawyer,
        )

        response = api_client.get(URL, {"date_to": "2021-01-01"})

        assert response.status_code == status.HTTP_200_OK
        ids = {d["id"] for d in response.data["items"]}
        assert doc_old.id in ids
        assert doc_new.id not in ids

    def test_date_range_combined(self, api_client, lawyer):
        """Combined date_from + date_to narrows results to the date window."""
        api_client.force_authenticate(user=lawyer)

        doc_before = DynamicDocument.objects.create(
            title="Before", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        DynamicDocument.objects.filter(pk=doc_before.pk).update(
            created_at="2019-01-01T00:00:00Z"
        )

        doc_in_range = DynamicDocument.objects.create(
            title="In Range", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        DynamicDocument.objects.filter(pk=doc_in_range.pk).update(
            created_at="2022-06-15T00:00:00Z"
        )

        doc_after = DynamicDocument.objects.create(
            title="After", content="<p>x</p>", state="Draft", created_by=lawyer,
        )

        response = api_client.get(URL, {"date_from": "2022-01-01", "date_to": "2023-01-01"})

        assert response.status_code == status.HTTP_200_OK
        ids = {d["id"] for d in response.data["items"]}
        assert doc_in_range.id in ids
        assert doc_before.id not in ids
        assert doc_after.id not in ids

    def test_date_filter_uses_subscription_date_variable(self, api_client, lawyer):
        """date_from prefers the subscription_date variable over created_at."""
        api_client.force_authenticate(user=lawyer)

        doc = DynamicDocument.objects.create(
            title="With Sub Date", content="<p>x</p>", state="Draft", created_by=lawyer,
        )
        # Document created recently but has subscription_date in the past
        DocumentVariable.objects.create(
            document=doc,
            name_en="sub_date",
            field_type="date",
            summary_field="subscription_date",
            value="2019-03-15",
        )

        # Filter for recent dates — doc has subscription_date in 2019, should be excluded
        response = api_client.get(URL, {"date_from": "2024-01-01"})

        assert response.status_code == status.HTTP_200_OK
        ids = {d["id"] for d in response.data["items"]}
        assert doc.id not in ids


class TestListDocumentsSearchEdgeCases:
    """Edge case tests for search and filter parameters."""

    def test_search_no_results_returns_empty_items(self, api_client, lawyer, docs_for_search):
        """Search with no matching term returns empty items list."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"search": "ZZZZNONEXISTENT"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["items"] == []
        assert response.data["totalItems"] == 0
        # Django Paginator returns num_pages=1 even for empty querysets
        assert response.data["totalPages"] == 1

    def test_search_is_case_insensitive(self, api_client, lawyer, docs_for_search):
        """Search is case-insensitive (icontains)."""
        api_client.force_authenticate(user=lawyer)

        response_lower = api_client.get(URL, {"search": "laura"})
        response_upper = api_client.get(URL, {"search": "LAURA"})

        assert response_lower.status_code == status.HTTP_200_OK
        assert response_upper.status_code == status.HTTP_200_OK

        ids_lower = {d["id"] for d in response_lower.data["items"]}
        ids_upper = {d["id"] for d in response_upper.data["items"]}
        assert ids_lower == ids_upper
        assert len(ids_lower) > 0

    def test_invalid_tag_id_returns_all_documents(self, api_client, lawyer, docs_for_search):
        """Non-numeric tag_id is silently ignored, returns all documents."""
        api_client.force_authenticate(user=lawyer)
        response = api_client.get(URL, {"tag_id": "abc"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["totalItems"] == 4

    def test_search_with_pagination_page_2(self, api_client, lawyer):
        """Search results spanning multiple pages return correct page 2."""
        api_client.force_authenticate(user=lawyer)

        # Create 5 docs matching "Contrato"
        for i in range(5):
            DynamicDocument.objects.create(
                title=f"Contrato {i}",
                content="<p>x</p>",
                state="Draft",
                created_by=lawyer,
            )
        # Create 2 docs NOT matching
        for i in range(2):
            DynamicDocument.objects.create(
                title=f"Acuerdo {i}",
                content="<p>x</p>",
                state="Draft",
                created_by=lawyer,
            )

        response = api_client.get(URL, {"search": "Contrato", "limit": 3, "page": 2})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["totalItems"] == 5
        assert response.data["totalPages"] == 2
        assert response.data["currentPage"] == 2
        assert len(response.data["items"]) == 2
        # All returned items should match the search
        for item in response.data["items"]:
            assert "Contrato" in item["title"]
