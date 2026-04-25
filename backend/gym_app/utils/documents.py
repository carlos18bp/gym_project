"""Document HTML utilities shared by dynamic-document views and serializers.

These helpers normalise the TinyMCE output so that variable substitution and
PDF rendering (via xhtml2pdf) work consistently regardless of whether the
user typed content directly or pasted it from Word / Google Docs.
"""

import re
from bs4 import BeautifulSoup

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
        if 'width' not in style:
            style = (style + ';width:100%').strip(';')
        if 'border-collapse' not in style:
            style = (style + ';border-collapse:collapse').strip(';')
        table['style'] = style

    # xhtml2pdf honours align="center" on cells more reliably than CSS.
    for cell in soup.find_all(['td', 'th']):
        style = cell.get('style', '')
        if 'text-align' in style:
            match = re.search(r'text-align\s*:\s*([a-zA-Z]+)', style)
            if match and not cell.get('align'):
                cell['align'] = match.group(1).lower()

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


def get_letterhead_for_document(document, creator, fallback_user=None):
    """Resolve which letterhead image applies to ``document``.

    Once the document is formalized (state in :data:`LETTERHEAD_LOCKED_STATES`)
    the snapshot frozen at formalization is the only valid source — the document
    contents (including the letterhead) must remain inalterable regardless of
    who downloads it. ``fallback_user`` is intentionally ignored in those states.

    For pre-formalization states the original priority applies:
    document-specific → creator's global → ``fallback_user``'s global → ``None``.
    """
    if getattr(document, 'state', None) in LETTERHEAD_LOCKED_STATES:
        snapshot = getattr(document, 'letterhead_image_snapshot', None)
        if snapshot:
            return snapshot
        # No snapshot yet (pre-fix legacy doc): degrade to creator's letterhead
        # without ever using the downloader as a fallback so the contents stay
        # stable across viewers.
        if document.letterhead_image:
            return document.letterhead_image
        if creator and creator.letterhead_image:
            return creator.letterhead_image
        return None
    if document.letterhead_image:
        return document.letterhead_image
    if creator and creator.letterhead_image:
        return creator.letterhead_image
    if fallback_user and fallback_user.letterhead_image:
        return fallback_user.letterhead_image
    return None


def get_letterhead_word_template(document, creator, fallback_user=None):
    """Resolve which Word letterhead template applies to ``document``.

    Mirrors the snapshot/locked-state behaviour of
    :func:`get_letterhead_for_document` for the Word path.
    """
    if getattr(document, 'state', None) in LETTERHEAD_LOCKED_STATES:
        snapshot = getattr(document, 'letterhead_word_template_snapshot', None)
        if snapshot:
            return snapshot
        if getattr(document, 'letterhead_word_template', None):
            return document.letterhead_word_template
        if creator and getattr(creator, 'letterhead_word_template', None):
            return creator.letterhead_word_template
        return None
    if getattr(document, 'letterhead_word_template', None):
        return document.letterhead_word_template
    if creator and getattr(creator, 'letterhead_word_template', None):
        return creator.letterhead_word_template
    if fallback_user and getattr(fallback_user, 'letterhead_word_template', None):
        return fallback_user.letterhead_word_template
    return None


def snapshot_letterhead_on_formalize(document, creator):
    """Freeze the letterhead (image + Word template) on the document at formalization.

    Idempotent: existing snapshots are not overwritten. Called from
    ``formalize_document`` for every signature_type so the contents of the
    formalized document never depend on the viewer or future creator changes.
    """
    from django.core.files.base import ContentFile

    fields_to_save = []

    if not document.letterhead_image_snapshot:
        source_img = document.letterhead_image or (
            creator.letterhead_image if creator and creator.letterhead_image else None
        )
        if source_img:
            try:
                source_img.open('rb')
                try:
                    raw = source_img.read()
                finally:
                    source_img.close()
                base_name = source_img.name.rsplit('/', 1)[-1] if source_img.name else 'letterhead.png'
                document.letterhead_image_snapshot.save(
                    f"snapshot_{document.pk}_{base_name}",
                    ContentFile(raw),
                    save=False,
                )
                fields_to_save.append('letterhead_image_snapshot')
            except (FileNotFoundError, ValueError, IOError):
                # Source file is missing on disk — leave snapshot empty rather
                # than block formalization. The locked-state fallback in
                # get_letterhead_for_document covers this gracefully.
                pass

    if not document.letterhead_word_template_snapshot:
        source_doc = (
            document.letterhead_word_template
            if getattr(document, 'letterhead_word_template', None) else None
        )
        if not source_doc and creator and getattr(creator, 'letterhead_word_template', None):
            source_doc = creator.letterhead_word_template
        if source_doc:
            try:
                source_doc.open('rb')
                try:
                    raw = source_doc.read()
                finally:
                    source_doc.close()
                base_name = source_doc.name.rsplit('/', 1)[-1] if source_doc.name else 'letterhead.docx'
                document.letterhead_word_template_snapshot.save(
                    f"snapshot_{document.pk}_{base_name}",
                    ContentFile(raw),
                    save=False,
                )
                fields_to_save.append('letterhead_word_template_snapshot')
            except (FileNotFoundError, ValueError, IOError):
                pass

    if fields_to_save:
        document.save(update_fields=fields_to_save)
