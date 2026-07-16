"""Optimistic-lock 409s, notification email guards and audit PDF variants."""
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status

from gym_app.models import DocumentSignature, DynamicDocument
from gym_app.models.dynamic_document import DocumentVisibilityPermission
from gym_app.views.dynamic_documents import signature_views

User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def creator_lawyer():
    """Creator lawyer."""
    return User.objects.create_user(
        email="formalize.lawyer@test.com",
        password="pw",
        role="lawyer",
        first_name="Forma",
        last_name="Lizador",
    )


@pytest.fixture
@pytest.mark.django_db
def recipient_client():
    """Recipient client."""
    return User.objects.create_user(
        email="formalize.client@test.com",
        password="pw",
        role="client",
        first_name="Reci",
        last_name="Piente",
    )


@pytest.fixture
@pytest.mark.django_db
def completed_document(creator_lawyer):
    """Completed document."""
    return DynamicDocument.objects.create(
        title="Doc Completado",
        content="<p>x</p>",
        state="Completed",
        created_by=creator_lawyer,
    )


def _stale_get_patch(document):
    """Return objects.get returning an in-memory copy with the pre-race state."""
    stale = DynamicDocument.objects.get(pk=document.pk)
    return patch.object(
        signature_views.DynamicDocument.objects, "get", return_value=stale
    )


@pytest.mark.django_db
class TestFormalizeOptimisticLock409:
    """State changed between fetch and update -> 409, no partial writes."""

    def _race(self, api_client, document, payload):
        stale_patch = _stale_get_patch(document)
        DynamicDocument.objects.filter(pk=document.pk).update(state="Draft")
        url = reverse("formalize-document", args=[document.pk])
        with stale_patch:
            return api_client.post(url, payload, format="json")

    def test_informative_conflict_returns_409(
        self, api_client, creator_lawyer, recipient_client, completed_document
    ):
        """Informative conflict returns 409."""
        api_client.force_authenticate(user=creator_lawyer)

        response = self._race(
            api_client,
            completed_document,
            {"signature_type": "informative", "recipients": [recipient_client.pk]},
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        completed_document.refresh_from_db()
        assert completed_document.state == "Draft"

    def test_issuer_only_conflict_returns_409(
        self, api_client, creator_lawyer, recipient_client, completed_document
    ):
        """Issuer only conflict returns 409."""
        api_client.force_authenticate(user=creator_lawyer)

        response = self._race(
            api_client,
            completed_document,
            {"signature_type": "issuer_only", "recipients": [recipient_client.pk]},
        )

        assert response.status_code == status.HTTP_409_CONFLICT

    def test_normal_conflict_returns_409(
        self, api_client, creator_lawyer, recipient_client, completed_document
    ):
        """Normal conflict returns 409."""
        api_client.force_authenticate(user=creator_lawyer)

        response = self._race(
            api_client,
            completed_document,
            {"signature_type": "normal", "signers": [recipient_client.pk]},
        )

        assert response.status_code == status.HTTP_409_CONFLICT

    def test_correct_document_conflict_returns_409(
        self, api_client, creator_lawyer, recipient_client
    ):
        """Correct document conflict returns 409."""
        document = DynamicDocument.objects.create(
            title="Doc Rechazado",
            content="<p>x</p>",
            state="Rejected",
            requires_signature=True,
            created_by=creator_lawyer,
        )
        api_client.force_authenticate(user=creator_lawyer)

        stale_patch = _stale_get_patch(document)
        DynamicDocument.objects.filter(pk=document.pk).update(state="Draft")
        url = reverse("correct-document", args=[document.pk])
        with stale_patch:
            response = api_client.post(url, {"content": "<p>y</p>"}, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT


@pytest.mark.django_db
class TestInformativeNotificationEmailGuard:
    """Notification email failures never block informative formalization."""

    def test_email_failure_is_logged_and_formalization_succeeds(
        self, api_client, creator_lawyer, recipient_client, completed_document
    ):
        """Email failure is logged and formalization succeeds."""
        api_client.force_authenticate(user=creator_lawyer)
        url = reverse("formalize-document", args=[completed_document.pk])

        with patch.object(
            signature_views, "EmailMessage", side_effect=Exception("smtp down")
        ), patch.object(signature_views, "logger") as mock_logger:
            response = api_client.post(
                url,
                {"signature_type": "informative", "recipients": [recipient_client.pk]},
                format="json",
            )

        assert response.status_code == status.HTTP_200_OK
        completed_document.refresh_from_db()
        assert completed_document.state == "FullySigned"
        mock_logger.warning.assert_called()


@pytest.mark.django_db
class TestGrantVisibilityToRecipients:
    """Lawyers are skipped — they can already see every document."""

    def test_skips_lawyer_recipients(
        self, creator_lawyer, recipient_client, completed_document
    ):
        """Skips lawyer recipients."""
        other_lawyer = User.objects.create_user(
            email="grant.lawyer@test.com", password="pw", role="lawyer"
        )

        signature_views._grant_visibility_to_recipients(
            completed_document, [other_lawyer, recipient_client], creator_lawyer
        )

        perms = DocumentVisibilityPermission.objects.filter(
            document=completed_document
        )
        assert perms.count() == 1
        assert perms.first().user == recipient_client


@pytest.mark.django_db
class TestAuditPdfVariants:
    """Audit certificate adapts wording per signature_type."""

    def _formalized_doc(self, creator, recipient, signature_type):
        doc = DynamicDocument.objects.create(
            title=f"Doc {signature_type}",
            content="<p>x</p>",
            state="FullySigned" if signature_type == "informative" else "PendingSignatures",
            requires_signature=True,
            signature_type=signature_type,
            fully_signed=signature_type == "informative",
            created_by=creator,
        )
        DocumentSignature.objects.create(
            document=doc, signer=creator, signed=True
        )
        if signature_type == "informative":
            DocumentSignature.objects.create(
                document=doc, signer=recipient, signed=True
            )
            DocumentVisibilityPermission.objects.create(
                document=doc, user=recipient, granted_by=creator
            )
        return doc

    def test_informative_certificate_renders(
        self, creator_lawyer, recipient_client
    ):
        """Informative certificate renders."""
        doc = self._formalized_doc(creator_lawyer, recipient_client, "informative")
        request = RequestFactory().get("/")

        buffer = signature_views.create_signatures_pdf(doc, request)

        assert buffer.getvalue().startswith(b"%PDF")

    def test_issuer_only_certificate_renders(
        self, creator_lawyer, recipient_client
    ):
        """Issuer only certificate renders."""
        doc = self._formalized_doc(creator_lawyer, recipient_client, "issuer_only")
        request = RequestFactory().get("/")

        buffer = signature_views.create_signatures_pdf(doc, request)

        assert buffer.getvalue().startswith(b"%PDF")


@pytest.mark.django_db
class TestWordExportTableEdgeCases:
    """HTML-to-docx conversion guards: empty tables, ragged rows, th bolding."""

    def test_word_export_handles_degenerate_tables(
        self, api_client, creator_lawyer
    ):
        """Word export handles degenerate tables."""
        content = (
            "<p>Intro</p>"
            "<table></table>"                                  # table without rows
            "<table><tr></tr><tr><td>solo</td></tr></table>"   # row without cells
            "<table>"
            "<tr><th>H1</th></tr>"                             # th header -> bold
            "<tr><td>a</td><td>overflow</td></tr>"             # more cells than cols
            "</table>"
        )
        doc = DynamicDocument.objects.create(
            title="Doc Word Tables",
            content=content,
            state="Completed",
            created_by=creator_lawyer,
        )
        api_client.force_authenticate(user=creator_lawyer)

        response = api_client.get(
            reverse("download_dynamic_document_word", args=[doc.pk])
        )

        assert response.status_code == status.HTTP_200_OK
        body = (
            b"".join(response.streaming_content)
            if getattr(response, "streaming", False)
            else response.content
        )
        assert body[:2] == b"PK"  # docx files are zip containers
