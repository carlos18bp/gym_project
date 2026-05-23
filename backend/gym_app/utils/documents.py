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

# Block-level tags that may show up empty (``<p>&nbsp;</p>``, ``<div></div>``)
# in TinyMCE output. ``<o:p>`` is the Office XML namespace tag that survives
# Word paste; it is always purely decorative and is dropped unconditionally.
_EMPTY_COLLAPSIBLE_BLOCK_TAGS = ('p', 'div')
_OFFICE_NAMESPACED_TAGS = ('o:p',)

# Threshold above which an inline ``margin-*: Xpt`` declaration is considered
# paste-from-Word noise and stripped. Word frequently injects margins of
# 30–100 pt that override the global PDF stylesheet and produce huge gaps
# between paragraphs even after empty <p> blocks are collapsed. Values at or
# below this threshold are preserved (intentional spacing such as 6–12 pt
# between sections is honoured).
_EXCESSIVE_MARGIN_PT_THRESHOLD = 15.0
_INLINE_MARGIN_PT_PATTERN = re.compile(
    r'^\s*margin(?:-top|-bottom|-block-start|-block-end)?\s*:\s*([\d.]+)\s*pt\s*$',
    re.IGNORECASE,
)


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


def _is_empty_block(node):
    """Return ``True`` when a block-level node carries no real reader content.

    "Real content" means visible text or embedded media (image, table,
    iframe, svg, video). ``<br>`` tags and ``&nbsp;`` / whitespace are
    considered empty filler that TinyMCE and Word insert when the user
    presses Enter on a blank line — they are responsible for the huge
    vertical gaps the client reported in downloaded PDFs.

    Used for ``<p>`` and ``<div>``; both are emitted by TinyMCE / Word as
    spacing artifacts, so the same predicate applies to both.
    """
    if node.get_text(strip=True):
        return False
    if node.find(['img', 'table', 'iframe', 'video', 'svg', 'object', 'embed']):
        return False
    return True


def _drop_office_namespace_tags(soup):
    """Remove ``<o:p>`` and friends — pure paste-from-Word artifacts.

    These Office XML namespace tags survive when content is pasted from Word
    into TinyMCE and have no rendering meaning. Each one becomes a blank
    line in xhtml2pdf, so we drop them unconditionally before collapse.
    """
    for tag_name in _OFFICE_NAMESPACED_TAGS:
        for element in list(soup.find_all(tag_name)):
            element.decompose()


def _collapse_empty_blocks(soup):
    """Collapse runs of consecutive empty ``<p>`` / ``<div>`` siblings to one.

    TinyMCE / Word paste output frequently contains long runs of
    ``<p>&nbsp;</p>``, ``<p><br></p>`` or ``<div></div>`` blocks — each one
    rendered as a full line in xhtml2pdf, which produces the multi-line
    gaps between paragraphs reported by the client (R3 — espaciado gigante
    entre párrafos en PDFs descargables).

    We keep AT MOST one empty block per gap so the visual spacing matches
    what the editor shows (one blank line between paragraphs is intentional
    separation; two or more is paste-induced noise). The previous sibling
    check uses the same tag (``<p>`` followed by ``<p>``, ``<div>`` followed
    by ``<div>``) to avoid mixing semantics across tag types.
    """
    for node in list(soup.find_all(_EMPTY_COLLAPSIBLE_BLOCK_TAGS)):
        if not _is_empty_block(node):
            continue
        previous = node.find_previous_sibling()
        if (
            previous is not None
            and previous.name == node.name
            and _is_empty_block(previous)
        ):
            node.decompose()


def _strip_excessive_inline_margins(soup):
    """Strip ``margin-*: Xpt`` declarations above the threshold from blocks.

    Word inline-styles paragraphs with margins of 30–100 pt that override
    the global PDF stylesheet (``p { margin: 0 0 6pt 0 }``). xhtml2pdf
    honours inline ``style=`` over ``<style>`` rules, so the global rule
    alone cannot fix the visible gap. This helper walks every ``<p>`` and
    ``<div>`` that has a ``style`` attribute, splits it into its individual
    declarations, and drops any ``margin*`` rule expressed in points whose
    value exceeds :data:`_EXCESSIVE_MARGIN_PT_THRESHOLD`. Values at or below
    the threshold are preserved so deliberate spacing stays intact.
    """
    for node in soup.find_all(_EMPTY_COLLAPSIBLE_BLOCK_TAGS, style=True):
        declarations = [d for d in node['style'].split(';') if d.strip()]
        kept = []
        for declaration in declarations:
            match = _INLINE_MARGIN_PT_PATTERN.match(declaration)
            if match:
                try:
                    value = float(match.group(1))
                except ValueError:
                    kept.append(declaration)
                    continue
                if value > _EXCESSIVE_MARGIN_PT_THRESHOLD:
                    # Drop this declaration — paste-from-Word noise.
                    continue
            kept.append(declaration)
        if kept:
            node['style'] = ';'.join(d.strip() for d in kept)
        else:
            del node['style']


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
    * drops ``<o:p>`` Office-namespace artefacts (always paste-from-Word)
    * strips inline ``margin-*: Xpt`` declarations above
      :data:`_EXCESSIVE_MARGIN_PT_THRESHOLD` so paste-from-Word margins
      don't override the global PDF stylesheet
    * collapses runs of consecutive empty ``<p>`` / ``<div>`` blocks to a
      single one so paste-from-Word artefacts don't blow up the PDF's
      vertical rhythm

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

    # Drop pure Word artefacts FIRST so the collapse step doesn't have to
    # reason about <o:p> blocks (each one would otherwise be treated as an
    # extra empty paragraph).
    _drop_office_namespace_tags(soup)

    # Strip excessive inline margin-* declarations BEFORE collapse so the
    # global PDF stylesheet can reclaim control of the vertical rhythm. We
    # only strip values above the threshold; deliberate spacing survives.
    _strip_excessive_inline_margins(soup)

    # Collapse consecutive empty <p> / <div> runs LAST so any cleanup
    # performed above (Mso classes, margin strip, <o:p> removal) is taken
    # into account before the empty-block decision.
    _collapse_empty_blocks(soup)

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
