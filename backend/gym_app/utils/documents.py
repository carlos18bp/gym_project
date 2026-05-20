"""Document HTML utilities shared by dynamic-document views and serializers.

These helpers normalise the TinyMCE output so that variable substitution and
PDF rendering (via xhtml2pdf) work consistently regardless of whether the
user typed content directly or pasted it from Word / Google Docs.
"""

import logging
import re
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Matches ``{{variable}}`` even when TinyMCE fragments it across inline tags,
# newlines, or &nbsp; sequences (common after pasting a table from Word).
_VARIABLE_PATTERN = re.compile(r'\{\{((?:[^}]|\}(?!\}))*)\}\}')
_INLINE_TAG_PATTERN = re.compile(r'<[^>]*>')
_MSO_STYLE_PATTERN = re.compile(r'mso-[^:;"\']*:[^;"\']*;?', re.IGNORECASE)


def normalize_fragmented_variables(html_content):
    """Reassemble ``{{variable}}`` markers that TinyMCE may have split across
    inline HTML tags (e.g. ``<span>{{</span><span>name</span><span>}}</span>``).

    Strips inline tags and ``&nbsp;`` between the opening ``{{`` and closing
    ``}}`` so that later string-based replacement can find them.
    """
    if not html_content:
        return html_content

    def _clean_match(m):
        inner = m.group(1)
        clean = _INLINE_TAG_PATTERN.sub('', inner).replace('&nbsp;', ' ').strip()
        if clean:
            return '{{' + clean + '}}'
        return m.group(0)

    return _VARIABLE_PATTERN.sub(_clean_match, html_content)


def _is_empty_paragraph(paragraph):
    """Return ``True`` when ``<p>`` carries no real content for the reader.

    "Real content" means visible text or embedded media (image, table,
    iframe, svg, video). ``<br>`` tags and ``&nbsp;`` / whitespace are
    considered empty filler that TinyMCE and Word insert when the user
    presses Enter on a blank line — they are responsible for the huge
    vertical gaps the client reported in downloaded PDFs.
    """
    if paragraph.get_text(strip=True):
        return False
    if paragraph.find(['img', 'table', 'iframe', 'video', 'svg', 'object', 'embed']):
        return False
    return True


def _collapse_empty_paragraphs(soup):
    """Collapse runs of consecutive empty ``<p>`` siblings down to one.

    TinyMCE / Word paste output frequently contains long runs of
    ``<p>&nbsp;</p>`` or ``<p><br></p>`` blocks — each one rendered as a
    full line in xhtml2pdf, which produces the multi-line gaps between
    paragraphs reported by the client (R3 — espaciado gigante entre
    párrafos en PDFs descargables).

    We keep AT MOST one empty paragraph per gap so the visual spacing
    matches what the editor shows (one blank line between paragraphs is
    intentional separation; two or more is paste-induced noise).
    """
    for paragraph in list(soup.find_all('p')):
        if not _is_empty_paragraph(paragraph):
            continue
        previous = paragraph.find_previous_sibling()
        if (
            previous is not None
            and previous.name == 'p'
            and _is_empty_paragraph(previous)
        ):
            paragraph.decompose()


def sanitize_soup_for_pdf(soup):
    """Mutate ``soup`` in place so xhtml2pdf renders tables with correct format.

    xhtml2pdf ignores ``mso-*`` styles, stumbles on Word-inserted class names,
    and loses cell alignment when it is only expressed via inline ``style``.
    This pass:

    * removes ``mso-*`` CSS declarations from inline ``style`` attributes
    * drops ``class`` attributes that start with ``Mso`` (MsoNormal, etc.)
    * promotes ``text-align`` from ``<td>/<th>`` inline styles to the legacy
      ``align`` attribute, which xhtml2pdf honours reliably
    * ensures ``<table>`` has sensible defaults (full width, collapsed borders)
    * collapses runs of consecutive empty ``<p>`` blocks to a single one so
      paste-from-Word artefacts don't blow up the PDF's vertical rhythm

    Returns the same ``soup`` so callers can chain.
    """
    for element in soup.find_all(style=True):
        cleaned = _MSO_STYLE_PATTERN.sub('', element['style']).strip()
        if cleaned:
            element['style'] = cleaned
        else:
            del element['style']

    for element in soup.find_all(class_=True):
        remaining = [c for c in element.get('class', []) if not c.startswith('Mso')]
        if remaining:
            element['class'] = remaining
        else:
            del element['class']

    for table in soup.find_all('table'):
        style = table.get('style', '')
        has_explicit_width = (
            'width' in style
            or table.get('width')
            or any(
                col.get('width') or 'width' in (col.get('style') or '')
                for col in table.find_all('col')
            )
        )
        if not has_explicit_width:
            style = (style + ';width:100%;table-layout:fixed').strip(';')
        if 'border-collapse' not in style:
            style = (style + ';border-collapse:collapse').strip(';')
        if style:
            table['style'] = style

    # xhtml2pdf honours align="center" on cells more reliably than CSS.
    for cell in soup.find_all(['td', 'th']):
        style = cell.get('style', '')
        if 'text-align' in style:
            match = re.search(r'text-align\s*:\s*([a-zA-Z]+)', style)
            if match and not cell.get('align'):
                cell['align'] = match.group(1).lower()

    # xhtml2pdf inherits cell alignment to inner blocks only via the legacy
    # align attribute, so promote text-align from <p>/<div> inside cells too.
    for block in soup.select('td p, td div, th p, th div'):
        style = block.get('style', '')
        if 'text-align' in style and not block.get('align'):
            match = re.search(r'text-align\s*:\s*([a-zA-Z]+)', style)
            if match:
                block['align'] = match.group(1).lower()

    # Collapse consecutive empty <p> runs LAST so any cleanup performed
    # above (e.g. stripping MsoNormal classes that left a paragraph with
    # only &nbsp; inside) is taken into account before the decision.
    _collapse_empty_paragraphs(soup)

    return soup


def sanitize_html_for_pdf(html_content):
    """String-in/string-out wrapper around :func:`sanitize_soup_for_pdf`.

    Prefer :func:`sanitize_soup_for_pdf` when the caller will also parse the
    HTML, so the document is only parsed once.
    """
    if not html_content:
        return html_content
    return str(sanitize_soup_for_pdf(BeautifulSoup(html_content, 'html.parser')))


LETTERHEAD_LOCKED_STATES = ('PendingSignatures', 'FullySigned', 'Rejected', 'Expired')


def _resolve_issuer(document):
    """Return the user whose letterhead represents the document's emisor.

    Priority: ``document.formalized_by`` (the user who clicked "Formalizar")
    falls back to ``document.created_by`` for documents predating the
    ``formalized_by`` field. The caller decides what to do when both are None.
    """
    return getattr(document, 'formalized_by', None) or getattr(document, 'created_by', None)


def get_letterhead_for_document(document, fallback_user=None):
    """Resolve which letterhead image applies to ``document``.

    Once the document is formalized (state in :data:`LETTERHEAD_LOCKED_STATES`)
    the snapshot frozen at formalization is the only valid source — the document
    contents (including the letterhead) must remain inalterable regardless of
    who downloads it. ``fallback_user`` is intentionally ignored in those states.

    Pre-formalization priority: doc-specific → formalized_by → created_by →
    ``fallback_user`` → ``None``.
    """
    issuer = _resolve_issuer(document)
    if getattr(document, 'state', None) in LETTERHEAD_LOCKED_STATES:
        snapshot = getattr(document, 'letterhead_image_snapshot', None)
        if snapshot:
            return snapshot
        # Snapshot empty (legacy or formalize-time failure): keep the result
        # deterministic across downloaders by walking the issuer chain. Never
        # use the downloader as a fallback here.
        if document.letterhead_image:
            return document.letterhead_image
        if issuer and issuer.letterhead_image:
            return issuer.letterhead_image
        return None
    if document.letterhead_image:
        return document.letterhead_image
    if issuer and issuer.letterhead_image:
        return issuer.letterhead_image
    if fallback_user and fallback_user.letterhead_image:
        return fallback_user.letterhead_image
    return None


def get_letterhead_word_template(document, fallback_user=None):
    """Resolve which Word letterhead template applies to ``document``.

    Mirrors the snapshot/locked-state behaviour of
    :func:`get_letterhead_for_document` for the Word path.
    """
    issuer = _resolve_issuer(document)
    if getattr(document, 'state', None) in LETTERHEAD_LOCKED_STATES:
        snapshot = getattr(document, 'letterhead_word_template_snapshot', None)
        if snapshot:
            return snapshot
        if getattr(document, 'letterhead_word_template', None):
            return document.letterhead_word_template
        if issuer and getattr(issuer, 'letterhead_word_template', None):
            return issuer.letterhead_word_template
        return None
    if getattr(document, 'letterhead_word_template', None):
        return document.letterhead_word_template
    if issuer and getattr(issuer, 'letterhead_word_template', None):
        return issuer.letterhead_word_template
    if fallback_user and getattr(fallback_user, 'letterhead_word_template', None):
        return fallback_user.letterhead_word_template
    return None


def _copy_field_to_snapshot(source_field, target_field, document_pk, default_ext):
    """Copy a FileField/ImageField's bytes into another field of the same model.

    Returns True if the snapshot field was populated. Failures are logged and
    swallowed so they never block the calling flow (formalization or download).
    """
    from django.core.files.base import ContentFile

    if not source_field:
        return False
    try:
        source_field.open('rb')
        try:
            raw = source_field.read()
        finally:
            source_field.close()
    except (FileNotFoundError, ValueError, IOError) as exc:
        logger.warning(
            "Letterhead snapshot: source file unreadable for doc_id=%s name=%s: %s",
            document_pk, getattr(source_field, 'name', None), exc,
        )
        return False

    base_name = source_field.name.rsplit('/', 1)[-1] if source_field.name else f'letterhead.{default_ext}'
    try:
        target_field.save(
            f"snapshot_{document_pk}_{base_name}",
            ContentFile(raw),
            save=False,
        )
    except (ValueError, IOError) as exc:
        logger.warning(
            "Letterhead snapshot: failed to write snapshot for doc_id=%s: %s",
            document_pk, exc,
        )
        return False
    return True


def snapshot_letterhead_on_formalize(document, formalizer):
    """Freeze the letterhead (image + Word template) on the document at formalization.

    Idempotent: existing snapshots are not overwritten. ``formalizer`` is the
    user who clicked "Formalizar" — their letterhead is what gets frozen.
    Falls back to ``document.created_by`` for legacy callers.
    """
    fields_to_save = []
    issuer = formalizer or _resolve_issuer(document)

    if not document.letterhead_image_snapshot:
        source_img = document.letterhead_image or (
            issuer.letterhead_image if issuer and issuer.letterhead_image else None
        )
        if _copy_field_to_snapshot(source_img, document.letterhead_image_snapshot, document.pk, 'png'):
            fields_to_save.append('letterhead_image_snapshot')

    if not document.letterhead_word_template_snapshot:
        source_doc = (
            document.letterhead_word_template
            if getattr(document, 'letterhead_word_template', None) else None
        )
        if not source_doc and issuer and getattr(issuer, 'letterhead_word_template', None):
            source_doc = issuer.letterhead_word_template
        if _copy_field_to_snapshot(
            source_doc, document.letterhead_word_template_snapshot, document.pk, 'docx',
        ):
            fields_to_save.append('letterhead_word_template_snapshot')

    if fields_to_save:
        document.save(update_fields=fields_to_save)
        logger.info(
            "Letterhead snapshot saved for doc_id=%s fields=%s formalizer_id=%s",
            document.pk, fields_to_save, getattr(formalizer, 'pk', None),
        )


def ensure_letterhead_snapshot(document):
    """Defensive lazy snapshot: backfill missing snapshots at download time.

    Called from download endpoints. If the document is in a locked state and
    its snapshot fields are empty, attempt the snapshot now using the
    persisted ``formalized_by`` (or ``created_by`` as legacy fallback). This
    catches documents that slipped through the formalization snapshot for any
    reason (legacy data, prior code path, transient failure).
    """
    if getattr(document, 'state', None) not in LETTERHEAD_LOCKED_STATES:
        return
    if document.letterhead_image_snapshot and document.letterhead_word_template_snapshot:
        return
    snapshot_letterhead_on_formalize(document, _resolve_issuer(document))
