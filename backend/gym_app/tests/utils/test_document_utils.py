"""Tests for gym_app.utils.documents module."""
import pytest
from types import SimpleNamespace

from gym_app.utils.documents import (
    normalize_fragmented_variables,
    sanitize_soup_for_pdf,
    sanitize_html_for_pdf,
    get_letterhead_for_document,
    get_letterhead_word_template,
)


# ── normalize_fragmented_variables ────────────────────────────────────────────


class TestNormalizeFragmentedVariables:
    """Tests for reassembling TinyMCE-fragmented {{variable}} markers."""

    def test_returns_none_for_none_input(self):
        assert normalize_fragmented_variables(None) is None

    def test_returns_empty_string_for_empty_input(self):
        assert normalize_fragmented_variables("") == ""

    def test_simple_variable_unchanged(self):
        html = "<p>Hello {{nombre}}</p>"
        assert normalize_fragmented_variables(html) == html

    def test_strips_inline_tags_inside_variable(self):
        html = "<p>{{<span>nombre</span>}}</p>"
        assert "{{nombre}}" in normalize_fragmented_variables(html)

    def test_strips_nested_spans_inside_variable(self):
        html = "{{<span style='color:red'><b>fecha</b></span>}}"
        assert "{{fecha}}" in normalize_fragmented_variables(html)

    def test_strips_nbsp_inside_variable(self):
        html = "{{&nbsp;nombre&nbsp;}}"
        assert "{{nombre}}" in normalize_fragmented_variables(html)

    def test_multiple_variables_cleaned(self):
        html = "<p>{{<span>a</span>}} and {{<b>b</b>}}</p>"
        result = normalize_fragmented_variables(html)
        assert "{{a}}" in result
        assert "{{b}}" in result

    def test_empty_variable_left_unchanged(self):
        html = "<p>{{}}</p>"
        result = normalize_fragmented_variables(html)
        assert "{{}}" in result


# ── sanitize_soup_for_pdf ─────────────────────────────────────────────────────


class TestSanitizeSoupForPdf:
    """Tests for Word markup sanitization for xhtml2pdf."""

    def test_removes_mso_styles(self):
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
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p style="mso-bidi-font-size:12.0pt;">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert p.get('style') is None

    def test_removes_mso_classes(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p class="MsoNormal">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        p = result.find('p')
        assert p.get('class') is None

    def test_preserves_non_mso_classes(self):
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
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<table><tr><td>x</td></tr></table>', 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        table = result.find('table')
        assert 'width:100%' in table.get('style', '')

    def test_preserves_existing_table_width(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table style="width:50%"><tr><td>x</td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        table = result.find('table')
        assert 'width:50%' in table.get('style', '')

    def test_promotes_text_align_to_align_attribute(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table><tr><td style="text-align: center;">x</td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        td = result.find('td')
        assert td.get('align') == 'center'

    def test_returns_same_soup_object(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<p>text</p>', 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        assert result is soup

    def test_collapses_run_of_three_nbsp_paragraphs_to_one(self):
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
        from bs4 import BeautifulSoup
        html = '<p>Uno</p><p>&nbsp;</p><p>Dos</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraphs = result.find_all('p')
        assert len(paragraphs) == 3

    def test_preserves_paragraph_with_image(self):
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
        from bs4 import BeautifulSoup
        html = '<p>Texto</p><o:p></o:p><o:p></o:p><p>Mas texto</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        assert len(result.find_all('o:p')) == 0
        assert len(result.find_all('p')) == 2

    def test_strips_excessive_inline_margin_from_p(self):
        from bs4 import BeautifulSoup
        html = '<p style="margin-top: 60pt;">Texto</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraph = result.find('p')
        assert 'margin' not in (paragraph.get('style') or '')

    def test_keeps_normal_inline_margin_from_p(self):
        from bs4 import BeautifulSoup
        html = '<p style="margin-bottom: 6pt;">Texto</p>'
        soup = BeautifulSoup(html, 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        paragraph = result.find('p')
        assert 'margin-bottom' in paragraph.get('style', '')
        assert '6pt' in paragraph.get('style', '')

    def test_collapses_mixed_p_and_div_empty_blocks(self):
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
    """The CSS ``currentColor`` keyword crashes xhtml2pdf/reportlab; the
    sanitizer must rewrite it to a value reportlab can parse."""

    def test_neutralizes_currentcolor_in_table_border(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<table style="border: medium none currentcolor;">'
            '<tr><td>x</td></tr></table>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        assert 'currentcolor' not in result.find('table').get('style', '').lower()

    def test_neutralizes_mixed_case_currentcolor(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p style="border-color: currentColor;">text</p>',
            'html.parser',
        )
        result = sanitize_soup_for_pdf(soup)
        assert 'currentcolor' not in result.find('p').get('style', '').lower()
        assert 'transparent' in result.find('p').get('style', '')

    def test_leaves_normal_color_declaration_untouched(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<p style="color: #333;">text</p>', 'html.parser')
        result = sanitize_soup_for_pdf(soup)
        assert 'color: #333' in result.find('p').get('style', '')

    def test_pisa_renders_table_with_currentcolor_without_error(self):
        from bs4 import BeautifulSoup
        from io import BytesIO
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
        from gym_app.utils.documents import sanitize_soup_for_export, sanitize_soup_for_pdf
        assert sanitize_soup_for_pdf is sanitize_soup_for_export


class TestSanitizeHtmlForPdf:
    """Tests for string-in/string-out wrapper."""

    def test_returns_none_for_none_input(self):
        assert sanitize_html_for_pdf(None) is None

    def test_returns_empty_string_for_empty_input(self):
        assert sanitize_html_for_pdf("") == ""

    def test_strips_mso_from_html_string(self):
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
        doc = self._make_obj(letterhead_image="doc_img.png")
        assert get_letterhead_for_document(doc) == "doc_img.png"

    def test_creator_letterhead_when_document_has_none(self):
        doc = self._make_obj(letterhead_image=None)
        creator = self._make_obj(letterhead_image="creator_img.png")
        assert get_letterhead_for_document(doc, creator) == "creator_img.png"

    def test_fallback_user_letterhead_when_creator_has_none(self):
        doc = self._make_obj(letterhead_image=None)
        fallback = self._make_obj(letterhead_image="fallback_img.png")
        assert get_letterhead_for_document(doc, fallback) == "fallback_img.png"

    def test_returns_none_when_all_empty(self):
        doc = self._make_obj(letterhead_image=None)
        fallback = self._make_obj(letterhead_image=None)
        assert get_letterhead_for_document(doc, fallback) is None

    def test_handles_none_creator(self):
        doc = self._make_obj(letterhead_image=None)
        fallback = self._make_obj(letterhead_image="fallback_img.png")
        assert get_letterhead_for_document(doc, fallback) == "fallback_img.png"

    def test_handles_none_creator_and_none_fallback(self):
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
        doc = SimpleNamespace(letterhead_word_template="doc_tpl.docx")
        assert get_letterhead_word_template(doc) == "doc_tpl.docx"

    def test_creator_template_when_document_has_none(self):
        doc = SimpleNamespace(letterhead_word_template=None)
        creator = SimpleNamespace(letterhead_word_template="creator_tpl.docx")
        assert get_letterhead_word_template(doc, creator) == "creator_tpl.docx"

    def test_fallback_user_template_when_creator_has_none(self):
        doc = SimpleNamespace(letterhead_word_template=None)
        fallback = SimpleNamespace(letterhead_word_template="fallback_tpl.docx")
        assert get_letterhead_word_template(doc, fallback) == "fallback_tpl.docx"

    def test_returns_none_when_all_empty(self):
        doc = SimpleNamespace(letterhead_word_template=None)
        fallback = SimpleNamespace(letterhead_word_template=None)
        assert get_letterhead_word_template(doc, fallback) is None

    def test_handles_object_without_attribute(self):
        doc = SimpleNamespace()  # no letterhead_word_template attr
        creator = SimpleNamespace(letterhead_word_template="creator_tpl.docx")
        assert get_letterhead_word_template(doc, creator) == "creator_tpl.docx"
