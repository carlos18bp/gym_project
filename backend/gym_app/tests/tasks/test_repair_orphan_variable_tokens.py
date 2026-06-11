"""Tests for the repair_orphan_variable_tokens management command."""
from io import StringIO

import pytest
from django.core.management import call_command

from gym_app.models.dynamic_document import DocumentVariable, DynamicDocument


def _make_document(owner, content, variable_names, title="RepairTestDoc"):
    """Create a document with one input variable per name in variable_names."""
    doc = DynamicDocument.objects.create(
        title=title,
        content=content,
        state="Completed",
        created_by=owner,
    )
    for name in variable_names:
        DocumentVariable.objects.create(
            document=doc,
            name_en=name,
            name_es=name,
            field_type="input",
            value="filled",
        )
    return doc


@pytest.mark.django_db
class TestRepairOrphanVariableTokens:
    def test_dry_run_does_not_modify_content(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Contrato {{Numero_ contrato}} firmado.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], stdout=out)

        doc.refresh_from_db()
        assert doc.content == "<p>Contrato {{Numero_ contrato}} firmado.</p>"

    def test_dry_run_reports_the_pending_rewrite(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Contrato {{Numero_ contrato}} firmado.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], stdout=out)

        assert "{{Numero_ contrato}} -> {{Numero_contrato}}" in out.getvalue()

    def test_apply_rewrites_whitespace_mismatched_token(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Contrato {{Numero_ contrato}} firmado.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], apply=True, stdout=out)

        doc.refresh_from_db()
        assert doc.content == "<p>Contrato {{Numero_contrato}} firmado.</p>"

    def test_apply_preserves_tokens_that_already_match_a_variable(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>{{Numero_ contrato}} de {{Nombre_contratista}}.</p>",
            ["Numero_contrato", "Nombre_contratista"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], apply=True, stdout=out)

        doc.refresh_from_db()
        assert "{{Nombre_contratista}}" in doc.content

    def test_apply_rewrites_fragmented_token(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Contrato {{<span>Numero_</span>&nbsp;contrato}} firmado.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], apply=True, stdout=out)

        doc.refresh_from_db()
        assert "{{Numero_contrato}}" in doc.content

    def test_token_without_safe_match_is_left_untouched(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Valor: {{Valor_total}}.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], apply=True, stdout=out)

        doc.refresh_from_db()
        assert "{{Valor_total}}" in doc.content

    def test_token_without_safe_match_is_reported_as_unmatched(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Valor: {{Valor_total}}.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], apply=True, stdout=out)

        assert "UNMATCHED" in out.getvalue()

    def test_consistent_document_is_not_reported(self, lawyer_user):
        doc = _make_document(
            lawyer_user,
            "<p>Contrato {{Numero_contrato}}.</p>",
            ["Numero_contrato"],
        )

        out = StringIO()
        call_command("repair_orphan_variable_tokens", ids=[doc.id], stdout=out)

        assert "0 document(s) repaired" in out.getvalue()
