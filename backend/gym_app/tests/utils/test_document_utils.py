"""Tests for gym_app.utils.documents module."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from gym_app.utils.documents import (
    _copy_field_to_snapshot,
    build_letterhead_layer_html,
    ensure_letterhead_snapshot,
    get_letterhead_for_document,
    get_letterhead_word_template,
    normalize_fragmented_variables,
    sanitize_html_for_pdf,
    sanitize_soup_for_pdf,
)

# ── normalize_fragmented_variables ────────────────────────────────────────────


class TestNormalizeFragmentedVariables:
    """Tests for reassembling TinyMCE-fragmented {{variable}} markers."""

    def test_returns_none_for_none_input(self):
        """Returns none for none input."""
        assert normalize_fragmented_variables(None) is None

    def test_returns_empty_string_for_empty_input(self):
        """Returns empty string for empty input."""
        assert normalize_fragmented_variables("") == ""

    def test_simple_variable_unchanged(self):
        """Simple variable unchanged."""
        html = "<p>Hello {{nombre}}</p>"
        assert normalize_fragmented_variables(html) == html

    def test_strips_inline_tags_inside_variable(self):
        """Strips inline tags inside variable."""
        html = "<p>{{<span>nombre</span>}}</p>"
        assert "{{nombre}}" in normalize_fragmented_variables(html)

    def test_strips_nested_spans_inside_variable(self):
        """Strips nested spans inside variable."""
        html = "{{<span style='color:red'><b>fecha</b></span>}}"
        assert "{{fecha}}" in normalize_fragmented_variables(html)

    def test_strips_nbsp_inside_variable(self):
        """Strips nbsp inside variable."""
        html = "{{&nbsp;nombre&nbsp;}}"
        assert "{{nombre}}" in normalize_fragmented_variables(html)

    def test_multiple_variables_cleaned(self):
        """Multiple variables cleaned."""
        html = "<p>{{<span>a</span>}} and {{<b>b</b>}}</p>"
        result = normalize_fragmented_variables(html)
        assert "{{a}}" in result
        assert "{{b}}" in result

    def test_empty_variable_left_unchanged(self):
        """Empty variable left unchanged."""
        html = "<p>{{}}</p>"
        result = normalize_fragmented_variables(html)
        assert "{{}}" in result


# ── sanitize_soup_for_pdf ─────────────────────────────────────────────────────


class TestSanitizeSoupForPdf:
    """Tests for Word markup sanitization for xhtml2pdf."""

    def test_removes_mso_styles(self):
        """Removes mso styles."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p style="mso-line-height-rule:exactly;color:red;">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert 'mso-' not in p.get('style', '')
        assert 'color:red' in p.get('style', '')

    def test_removes_empty_style_after_mso_strip(self):
        """Removes empty style after mso strip."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p style="mso-bidi-font-size:12.0pt;">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert p.get('style') is None

    def test_removes_mso_classes(self):
        """Removes mso classes."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p class="MsoNormal">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert p.get('class') is None

    def test_preserves_non_mso_classes(self):
        """Preserves non mso classes."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p class="MsoNormal custom-class">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert 'custom-class' in p.get('class', [])
        assert 'MsoNormal' not in p.get('class', [])

    def test_adds_width_to_tables_without_width(self):
        """Adds width to tables without width."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<table><tr><td>x</td></tr></table>', 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        table = result.find('table')
        assert 'width:100%' in table.get('style', '')

    def test_preserves_existing_table_width(self):
        """Preserves existing table width."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table style="width:50%"><tr><td>x</td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        table = result.find('table')
        assert 'width:50%' in table.get('style', '')

    def test_promotes_text_align_to_align_attribute(self):
        """Promotes text align to align attribute."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table><tr><td style="text-align: center;">x</td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        td = result.find('td')
        assert td.get('align') == 'center'

    def test_returns_same_soup_object(self):
        """Returns same soup object."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<p>text</p>', 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        assert result is soup

    def test_collapses_run_of_three_nbsp_paragraphs_to_one(self):
        """Collapses run of three nbsp paragraphs to one."""
        from bs4 import BeautifulSoup
        html = (
            '<p>Texto 1</p>'
            '<p>&nbsp;</p>'
            '<p>&nbsp;</p>'
            '<p>&nbsp;</p>'
            '<p>Texto 2</p>'
        )
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraphs = result.find_all('p')
        assert len(paragraphs) == 3
        assert paragraphs[0].get_text(strip=True) == 'Texto 1'
        assert paragraphs[1].get_text(strip=True) == ''
        assert paragraphs[2].get_text(strip=True) == 'Texto 2'

    def test_collapses_run_of_br_only_paragraphs(self):
        """Collapses run of br only paragraphs."""
        from bs4 import BeautifulSoup
        html = (
            '<p>Antes</p>'
            '<p><br></p>'
            '<p><br></p>'
            '<p><br></p>'
            '<p>Despues</p>'
        )
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraphs = result.find_all('p')
        assert len(paragraphs) == 3

    def test_keeps_single_empty_paragraph_between_content(self):
        """Keeps single empty paragraph between content."""
        from bs4 import BeautifulSoup
        html = '<p>Uno</p><p>&nbsp;</p><p>Dos</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraphs = result.find_all('p')
        assert len(paragraphs) == 3

    def test_preserves_paragraph_with_image(self):
        """Preserves paragraph with image."""
        from bs4 import BeautifulSoup
        html = (
            '<p>Texto</p>'
            '<p><img src="logo.png" alt="logo"/></p>'
            '<p><br></p>'
            '<p>Mas texto</p>'
        )
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraphs = result.find_all('p')
        assert len(paragraphs) == 4
        assert paragraphs[1].find('img') is not None

    def test_preserves_paragraphs_with_real_text(self):
        """Preserves paragraphs with real text."""
        from bs4 import BeautifulSoup
        html = '<p>Linea 1</p><p>Linea 2</p><p>Linea 3</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraphs = result.find_all('p')
        assert len(paragraphs) == 3
        assert [p.get_text(strip=True) for p in paragraphs] == [
            'Linea 1', 'Linea 2', 'Linea 3',
        ]

    def test_collapses_run_of_empty_divs_to_one(self):
        """Collapses run of empty divs to one."""
        from bs4 import BeautifulSoup
        html = (
            '<div>Texto 1</div>'
            '<div></div>'
            '<div></div>'
            '<div></div>'
            '<div>Texto 2</div>'
        )
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        divs = result.find_all('div')
        assert len(divs) == 3
        assert divs[0].get_text(strip=True) == 'Texto 1'
        assert divs[1].get_text(strip=True) == ''
        assert divs[2].get_text(strip=True) == 'Texto 2'

    def test_removes_office_op_tags(self):
        """Removes office op tags."""
        from bs4 import BeautifulSoup
        html = '<p>Texto</p><o:p></o:p><o:p></o:p><p>Mas texto</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        assert len(result.find_all('o:p')) == 0
        assert len(result.find_all('p')) == 2

    def test_strips_excessive_inline_margin_from_p(self):
        """Strips excessive inline margin from p."""
        from bs4 import BeautifulSoup
        html = '<p style="margin-top: 60pt;">Texto</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraph = result.find('p')
        assert 'margin' not in (paragraph.get('style') or '')

    def test_keeps_normal_inline_margin_from_p(self):
        """Keeps normal inline margin from p."""
        from bs4 import BeautifulSoup
        html = '<p style="margin-bottom: 6pt;">Texto</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraph = result.find('p')
        assert 'margin-bottom' in paragraph.get('style', '')
        assert '6pt' in paragraph.get('style', '')

    def test_collapses_mixed_p_and_div_empty_blocks(self):
        """Collapses mixed p and div empty blocks."""
        from bs4 import BeautifulSoup
        html = (
            '<p>Uno</p>'
            '<p>&nbsp;</p>'
            '<p>&nbsp;</p>'
            '<div>Dos</div>'
            '<div></div>'
            '<div></div>'
            '<p>Tres</p>'
        )
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        # Each run collapses on its own — <p> siblings only merge with <p>,
        # <div> siblings only with <div>.
        assert len(result.find_all('p')) == 3
        assert len(result.find_all('div')) == 2


class TestNeutralizeCurrentColor:
    """The CSS ``currentColor`` keyword crashes xhtml2pdf/reportlab; the.

    sanitizer must rewrite it to a value reportlab can parse.
    """

    def test_neutralizes_currentcolor_in_table_border(self):
        """Neutralizes currentcolor in table border."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table style="border: medium none currentcolor;">'
            '<tr><td>x</td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        assert 'currentcolor' not in result.find('table').get('style', '').lower()

    def test_neutralizes_mixed_case_currentcolor(self):
        """Neutralizes mixed case currentcolor."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p style="border-color: currentColor;">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        assert 'currentcolor' not in result.find('p').get('style', '').lower()
        assert 'transparent' in result.find('p').get('style', '')

    def test_leaves_normal_color_declaration_untouched(self):
        """Leaves normal color declaration untouched."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<p style="color: #333;">text</p>', 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        assert 'color: #333' in result.find('p').get('style', '')

    def test_pisa_renders_table_with_currentcolor_without_error(self):
        """Pisa renders table with currentcolor without error."""
        from io import BytesIO

        from bs4 import BeautifulSoup
        from xhtml2pdf import pisa

        soup = sanitize_soup_for_pdf(BeautifulSoup(
            '<table style="border: medium none currentcolor;">'
            '<tr><td>celda</td></tr></table>',
            'html.parser',
        ))
        html = f"<!DOCTYPE html><html><body>{str(soup)}</body></html>"
        status = pisa.CreatePDF(html.encode('utf-8'), dest=BytesIO())
        assert status.err == 0


class TestSanitizeSoupForExportAlias:
    """The sanitizer is shared by the PDF and Word export paths."""

    def test_pdf_name_is_alias_of_export_name(self):
        """Pdf name is alias of export name."""
        from gym_app.utils.documents import (
            sanitize_soup_for_export,
            sanitize_soup_for_pdf,
        )
        assert sanitize_soup_for_pdf is sanitize_soup_for_export


class TestBuildPdfStylesheet:
    """The WeasyPrint stylesheet mirrors the editor content_style so the PDF is.

    WYSIWYG with the on-screen editor.
    """

    _FONT_PATHS = {
        "Carlito-Regular": "/fonts/Carlito-Regular.ttf",
        "Carlito-Bold": "/fonts/Carlito-Bold.ttf",
        "Carlito-Italic": "/fonts/Carlito-Italic.ttf",
        "Carlito-BoldItalic": "/fonts/Carlito-BoldItalic.ttf",
    }

    def test_paragraph_spacing_mirrors_editor_without_important(self):
        """Paragraph spacing mirrors editor without important."""
        from gym_app.utils.documents import build_pdf_stylesheet
        css = build_pdf_stylesheet(self._FONT_PATHS)
        # Editor parity: margin has NO !important so inline margins win (tight spacing).
        assert 'p, div { margin: 0 0 6pt 0; line-height: 1.35; }' in css
        assert 'margin-bottom: 6pt !important' not in css

    def test_contains_editor_table_rules(self):
        """Contains editor table rules."""
        from gym_app.utils.documents import build_pdf_stylesheet
        css = build_pdf_stylesheet(self._FONT_PATHS)
        assert 'table { border-collapse: collapse; margin: 0 0 6pt 0; }' in css
        assert 'table-layout: fixed' not in css  # dropped (xhtml2pdf-only workaround)

    def test_embeds_font_paths_as_file_urls(self):
        """Embeds font paths as file urls."""
        from gym_app.utils.documents import build_pdf_stylesheet
        css = build_pdf_stylesheet(self._FONT_PATHS)
        assert "file:///fonts/Carlito-Regular.ttf" in css

    def test_injects_body_top_padding(self):
        """Injects body top padding."""
        from gym_app.utils.documents import build_pdf_stylesheet
        assert 'padding-top: 1cm' in build_pdf_stylesheet(self._FONT_PATHS, top_padding="1cm")
        assert 'padding-top' not in build_pdf_stylesheet(self._FONT_PATHS, top_padding=None)


class TestRenderHtmlToPdf:
    """WeasyPrint render smoke test."""

    def test_renders_simple_html_to_pdf_bytes(self):
        """Renders simple html to pdf bytes."""
        from gym_app.utils.documents import render_html_to_pdf
        pdf = render_html_to_pdf(
            "<html><body><p>Hola</p><table><tr><td>c</td></tr></table></body></html>",
            base_url=".",
        )
        assert isinstance(pdf, (bytes, bytearray))
        assert pdf[:5] == b"%PDF-"


class TestBuildLetterheadLayerHtml:
    """The letterhead becomes a fixed full-page layer (WeasyPrint)."""

    def test_returns_empty_when_no_letterhead(self):
        """Returns empty when no letterhead."""
        from gym_app.utils.documents import build_letterhead_layer_html
        assert build_letterhead_layer_html(None) == ""


class TestSanitizeHtmlForPdf:
    """Tests for string-in/string-out wrapper."""

    def test_returns_none_for_none_input(self):
        """Returns none for none input."""
        assert sanitize_html_for_pdf(None) is None

    def test_returns_empty_string_for_empty_input(self):
        """Returns empty string for empty input."""
        assert sanitize_html_for_pdf("") == ""

    def test_strips_mso_from_html_string(self):
        """Strips mso from html string."""
        html = '<p style="mso-bidi-font-size:12.0pt;color:blue;">text</p>'
        result = sanitize_html_for_pdf(html)
        assert 'mso-' not in result
        assert 'color:blue' in result


# ── get_letterhead_for_document ───────────────────────────────────────────────


class TestGetLetterheadForDocument:
    """Tests for letterhead image resolution priority chain."""

    def _make_obj(self, letterhead_image=None):
        return SimpleNamespace(letterhead_image=letterhead_image)

    def test_document_letterhead_takes_priority(self):
        """Document letterhead takes priority."""
        doc = self._make_obj(letterhead_image="doc_img.png")
        assert get_letterhead_for_document(doc) == "doc_img.png"

    def test_creator_letterhead_when_document_has_none(self):
        """Creator letterhead when document has none."""
        doc = self._make_obj(letterhead_image=None)
        creator = self._make_obj(letterhead_image="creator_img.png")
        assert get_letterhead_for_document(doc, creator) == "creator_img.png"

    def test_fallback_user_letterhead_when_creator_has_none(self):
        """Fallback user letterhead when creator has none."""
        doc = self._make_obj(letterhead_image=None)
        fallback = self._make_obj(letterhead_image="fallback_img.png")
        assert get_letterhead_for_document(doc, fallback) == "fallback_img.png"

    def test_returns_none_when_all_empty(self):
        """Returns none when all empty."""
        doc = self._make_obj(letterhead_image=None)
        fallback = self._make_obj(letterhead_image=None)
        assert get_letterhead_for_document(doc, fallback) is None

    def test_handles_none_creator(self):
        """Handles none creator."""
        doc = self._make_obj(letterhead_image=None)
        fallback = self._make_obj(letterhead_image="fallback_img.png")
        assert get_letterhead_for_document(doc, fallback) == "fallback_img.png"

    def test_handles_none_creator_and_none_fallback(self):
        """Handles none creator and none fallback."""
        doc = self._make_obj(letterhead_image=None)
        assert get_letterhead_for_document(doc) is None


# ── get_letterhead_word_template ──────────────────────────────────────────────


class TestGetLetterheadWordTemplate:
    """Tests for Word template resolution priority chain."""

    def _make_obj(self, template=None):
        obj = SimpleNamespace()
        if template is not None:
            obj.letterhead_word_template = template
        return obj

    def test_document_template_takes_priority(self):
        """Document template takes priority."""
        doc = SimpleNamespace(letterhead_word_template="doc_tpl.docx")
        assert get_letterhead_word_template(doc) == "doc_tpl.docx"

    def test_creator_template_when_document_has_none(self):
        """Creator template when document has none."""
        doc = SimpleNamespace(letterhead_word_template=None)
        creator = SimpleNamespace(letterhead_word_template="creator_tpl.docx")
        assert get_letterhead_word_template(doc, creator) == "creator_tpl.docx"

    def test_fallback_user_template_when_creator_has_none(self):
        """Fallback user template when creator has none."""
        doc = SimpleNamespace(letterhead_word_template=None)
        fallback = SimpleNamespace(letterhead_word_template="fallback_tpl.docx")
        assert get_letterhead_word_template(doc, fallback) == "fallback_tpl.docx"

    def test_returns_none_when_all_empty(self):
        """Returns none when all empty."""
        doc = SimpleNamespace(letterhead_word_template=None)
        fallback = SimpleNamespace(letterhead_word_template=None)
        assert get_letterhead_word_template(doc, fallback) is None

    def test_handles_object_without_attribute(self):
        """Handles object without attribute."""
        doc = SimpleNamespace()  # no letterhead_word_template attr
        creator = SimpleNamespace(letterhead_word_template="creator_tpl.docx")
        assert get_letterhead_word_template(doc, creator) == "creator_tpl.docx"


# ── letterhead layer / snapshot edge cases (coverage batch 2026-07-16) ──


class _RaisingPathField:
    """FileField stand-in whose .path raises like an unsaved field does."""

    def __bool__(self):
        return True

    @property
    def path(self):
        raise ValueError("The file has no path")


class TestBuildLetterheadLayerHtmlEdgeCases:
    """Failure branches of build_letterhead_layer_html."""

    def test_returns_empty_when_path_raises(self):
        """Returns empty when path raises."""
        assert build_letterhead_layer_html(_RaisingPathField()) == ""

    def test_returns_empty_when_file_missing_on_disk(self):
        """Returns empty when file missing on disk."""
        field = SimpleNamespace(path="/nonexistent/letterhead.png")
        assert build_letterhead_layer_html(field) == ""

    def test_returns_empty_when_file_unreadable(self, tmp_path):
        """Returns empty when file unreadable."""
        img = tmp_path / "lh.png"
        img.write_bytes(b"png-bytes")
        field = SimpleNamespace(path=str(img))

        with patch("builtins.open", side_effect=OSError("permission denied")):
            assert build_letterhead_layer_html(field) == ""

    def test_embeds_existing_file_as_base64_layer(self, tmp_path):
        """Embeds existing file as base64 layer."""
        img = tmp_path / "lh.png"
        img.write_bytes(b"png-bytes")
        field = SimpleNamespace(path=str(img))

        html = build_letterhead_layer_html(field)

        assert '<div class="letterhead-layer">' in html
        assert "data:image/png;base64," in html


class TestGetLetterheadForDocumentLockedStates:
    """Snapshot chain for formalized documents (image field)."""

    def test_snapshot_wins_in_locked_state(self):
        """Snapshot wins in locked state."""
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot="snap.png",
            letterhead_image="doc.png",
        )
        assert get_letterhead_for_document(doc) == "snap.png"

    def test_document_image_when_snapshot_empty(self):
        """Document image when snapshot empty."""
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot=None,
            letterhead_image="doc.png",
        )
        assert get_letterhead_for_document(doc) == "doc.png"

    def test_issuer_image_when_document_has_none(self):
        """Issuer image when document has none."""
        issuer = SimpleNamespace(letterhead_image="issuer.png")
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot=None,
            letterhead_image=None,
            formalized_by=issuer,
        )
        assert get_letterhead_for_document(doc) == "issuer.png"

    def test_created_by_image_when_formalizer_missing(self):
        """Created by image when formalizer missing."""
        creator = SimpleNamespace(letterhead_image="creator.png")
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot=None,
            letterhead_image=None,
            formalized_by=None,
            created_by=creator,
        )
        assert get_letterhead_for_document(doc) == "creator.png"

    def test_locked_state_ignores_fallback_user(self):
        """Locked state ignores fallback user."""
        fallback = SimpleNamespace(letterhead_image="fallback.png")
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot=None,
            letterhead_image=None,
            formalized_by=None,
            created_by=None,
        )
        assert get_letterhead_for_document(doc, fallback_user=fallback) is None


class TestGetLetterheadWordTemplateLockedStates:
    """Snapshot chain for formalized documents (Word template field)."""

    def test_snapshot_wins_in_locked_state(self):
        """Snapshot wins in locked state."""
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_word_template_snapshot="snap.docx",
            letterhead_word_template="doc.docx",
        )
        assert get_letterhead_word_template(doc) == "snap.docx"

    def test_document_template_when_snapshot_empty(self):
        """Document template when snapshot empty."""
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_word_template_snapshot=None,
            letterhead_word_template="doc.docx",
        )
        assert get_letterhead_word_template(doc) == "doc.docx"

    def test_issuer_template_when_document_has_none(self):
        """Issuer template when document has none."""
        issuer = SimpleNamespace(letterhead_word_template="issuer.docx")
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_word_template_snapshot=None,
            letterhead_word_template=None,
            formalized_by=issuer,
        )
        assert get_letterhead_word_template(doc) == "issuer.docx"

    def test_locked_state_ignores_fallback_user(self):
        """Locked state ignores fallback user."""
        fallback = SimpleNamespace(letterhead_word_template="fallback.docx")
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_word_template_snapshot=None,
            letterhead_word_template=None,
            formalized_by=None,
            created_by=None,
        )
        assert get_letterhead_word_template(doc, fallback_user=fallback) is None


class TestCopyFieldToSnapshot:
    """Failure and naming branches of _copy_field_to_snapshot."""

    def test_returns_false_for_empty_source(self):
        """Returns false for empty source."""
        assert _copy_field_to_snapshot(None, MagicMock(), 1, "png") is False

    def test_returns_false_when_source_unreadable(self):
        """Returns false when source unreadable."""
        source = MagicMock()
        source.open.side_effect = FileNotFoundError("gone")
        source.name = "letterheads/a.png"

        assert _copy_field_to_snapshot(source, MagicMock(), 1, "png") is False

    def test_returns_false_when_target_save_fails(self):
        """Returns false when target save fails."""
        source = MagicMock()
        source.read.return_value = b"bytes"
        source.name = "letterheads/a.png"
        target = MagicMock()
        target.save.side_effect = ValueError("no file backend")

        assert _copy_field_to_snapshot(source, target, 7, "png") is False

    def test_copies_bytes_using_snapshot_name(self):
        """Copies bytes using snapshot name."""
        source = MagicMock()
        source.read.return_value = b"bytes"
        source.name = "letterheads/mi logo.png"
        target = MagicMock()

        assert _copy_field_to_snapshot(source, target, 7, "png") is True
        assert target.save.call_args[0][0] == "snapshot_7_mi logo.png"

    def test_defaults_base_name_when_source_has_no_name(self):
        """Defaults base name when source has no name."""
        source = MagicMock()
        source.read.return_value = b"bytes"
        source.name = ""
        target = MagicMock()

        assert _copy_field_to_snapshot(source, target, 7, "docx") is True
        assert target.save.call_args[0][0] == "snapshot_7_letterhead.docx"


class TestEnsureLetterheadSnapshot:
    """Lazy snapshot guards at download time."""

    def test_skips_documents_not_in_locked_state(self):
        """Skips documents not in locked state."""
        doc = SimpleNamespace(state="Draft")
        with patch(
            "gym_app.utils.documents.snapshot_letterhead_on_formalize"
        ) as mock_snapshot:
            ensure_letterhead_snapshot(doc)
        assert mock_snapshot.call_count == 0

    def test_skips_documents_with_both_snapshots(self):
        """Skips documents with both snapshots."""
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot="snap.png",
            letterhead_word_template_snapshot="snap.docx",
        )
        with patch(
            "gym_app.utils.documents.snapshot_letterhead_on_formalize"
        ) as mock_snapshot:
            ensure_letterhead_snapshot(doc)
        assert mock_snapshot.call_count == 0

    def test_backfills_missing_snapshot_with_resolved_issuer(self):
        """Backfills missing snapshot with resolved issuer."""
        issuer = SimpleNamespace(letterhead_image="issuer.png")
        doc = SimpleNamespace(
            state="FullySigned",
            letterhead_image_snapshot=None,
            letterhead_word_template_snapshot="snap.docx",
            formalized_by=issuer,
        )
        with patch(
            "gym_app.utils.documents.snapshot_letterhead_on_formalize"
        ) as mock_snapshot:
            ensure_letterhead_snapshot(doc)
        assert mock_snapshot.call_count == 1
        assert mock_snapshot.call_args.args == (doc, issuer)


class TestSanitizeSoupMarginAndCellAlignment:
    """Remaining margin/alignment branches of sanitize_soup_for_pdf."""

    def test_keeps_margin_declaration_when_value_is_not_a_number(self):
        """Keeps margin declaration when value is not a number."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p style="margin-top:1.2.3pt;color:red;">text</p>', 'html.parser'
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert 'margin-top:1.2.3pt' in p.get('style', '')

    def test_promotes_text_align_from_paragraph_inside_cell(self):
        """Promotes text align from paragraph inside cell."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table><tr><td><p style="text-align: right;">x</p></td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('td').find('p')
        assert p.get('align') == 'right'


class TestLetterheadIssuerFallbacksPreFormalization:
    """Issuer chain for drafts + word-template snapshot source resolution."""

    def test_draft_uses_issuer_image_when_document_has_none(self):
        """Draft uses issuer image when document has none."""
        issuer = SimpleNamespace(letterhead_image="issuer.png")
        doc = SimpleNamespace(
            state="Draft", letterhead_image=None, formalized_by=issuer
        )
        assert get_letterhead_for_document(doc) == "issuer.png"

    def test_draft_uses_issuer_word_template_when_document_has_none(self):
        """Draft uses issuer word template when document has none."""
        issuer = SimpleNamespace(letterhead_word_template="issuer.docx")
        doc = SimpleNamespace(
            state="Draft", letterhead_word_template=None, formalized_by=issuer
        )
        assert get_letterhead_word_template(doc) == "issuer.docx"

    def test_formalize_snapshots_word_template_from_issuer(self):
        """Formalize snapshots word template from issuer."""
        from gym_app.utils.documents import snapshot_letterhead_on_formalize

        issuer = SimpleNamespace(
            letterhead_image=None, letterhead_word_template="issuer.docx"
        )
        doc = SimpleNamespace(
            pk=9,
            state="PendingSignatures",
            letterhead_image=None,
            letterhead_image_snapshot=None,
            letterhead_word_template=None,
            letterhead_word_template_snapshot=None,
            save=MagicMock(),
        )

        with patch(
            "gym_app.utils.documents._copy_field_to_snapshot", return_value=True
        ) as mock_copy:
            snapshot_letterhead_on_formalize(doc, issuer)

        word_call = mock_copy.call_args_list[1]
        assert word_call[0][0] == "issuer.docx"
        doc.save.assert_called_once_with(
            update_fields=["letterhead_image_snapshot", "letterhead_word_template_snapshot"]
        )
