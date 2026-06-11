"""Repair dynamic-document contents whose ``{{tokens}}`` no longer match any
DocumentVariable of the same document.

Documents copy content + variables from their source template at creation
time. If the template content carried a token typo (real incident: the
content said ``{{Numero_ contrato}}`` — stray space — while the variable list
said ``Numero_contrato``), every document created from that template version
inherits the mismatch. Consequences of an orphan token:

* the client editor's integrity guard counts more ``{{tokens}}`` than
  protected spans and reverts every keystroke — clients cannot edit text;
* the token is never substituted in PDF/Word exports.

For each document, this command finds orphan tokens and, when a variable of
the same document matches the token once internal whitespace is ignored,
rewrites the token in ``content`` to the variable's exact ``name_en``.
Tokens without such a safe match are only reported, never guessed.

Usage::

    python manage.py repair_orphan_variable_tokens                  # dry-run (default)
    python manage.py repair_orphan_variable_tokens --apply          # write changes
    python manage.py repair_orphan_variable_tokens --assigned-to user@example.com
    python manage.py repair_orphan_variable_tokens --ids 594 595
"""

import re

from django.core.management.base import BaseCommand

from gym_app.models.dynamic_document import DynamicDocument
from gym_app.utils.documents import normalize_fragmented_variables

# Same fragmented-token pattern used by gym_app.utils.documents.
TOKEN_PATTERN = re.compile(r'\{\{((?:[^}]|\}(?!\}))*)\}\}')
INLINE_TAG_PATTERN = re.compile(r'<[^>]*>')


def _clean_token(raw):
    """Normalize a raw ``{{...}}`` inner match to its logical token name."""
    return INLINE_TAG_PATTERN.sub('', raw).replace('&nbsp;', ' ').strip()


def _squash(name):
    """Collapse all whitespace — the fuzzy key used to match orphan tokens."""
    return re.sub(r'\s+', '', name)


class Command(BaseCommand):
    help = (
        "Rewrite orphan {{tokens}} in document contents to the matching "
        "DocumentVariable name (whitespace-insensitive match). Dry-run by default."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Write the repaired contents. Without it, only report.',
        )
        parser.add_argument(
            '--assigned-to',
            help='Limit to documents assigned to this user email.',
        )
        parser.add_argument(
            '--ids',
            nargs='+',
            type=int,
            help='Limit to these document ids.',
        )

    def handle(self, *args, **options):
        qs = DynamicDocument.objects.all().prefetch_related('variables')
        if options.get('assigned_to'):
            qs = qs.filter(assigned_to__email__iexact=options['assigned_to'])
        if options.get('ids'):
            qs = qs.filter(id__in=options['ids'])

        apply_changes = options['apply']
        repaired_docs = 0
        unmatched_docs = 0

        for doc in qs.order_by('id').iterator(chunk_size=100):
            content = doc.content or ''
            if '{{' not in content:
                continue

            names = [v.name_en for v in doc.variables.all() if v.name_en]
            name_set = set(names)
            # First variable wins on squashed-name collisions (none expected).
            squashed_names = {}
            for name in names:
                squashed_names.setdefault(_squash(name), name)

            replacements = {}
            unmatched = set()
            for match in TOKEN_PATTERN.finditer(content):
                token = _clean_token(match.group(1))
                if not token or token in name_set:
                    continue
                target = squashed_names.get(_squash(token))
                if target:
                    replacements[token] = target
                else:
                    unmatched.add(token)

            if not replacements and not unmatched:
                continue

            label = f"doc id={doc.id} state={doc.state} title={doc.title!r}"
            if replacements:
                repaired_docs += 1
                # Reassemble fragmented tokens first so the rewrite below
                # matches them regardless of inline tags / &nbsp; noise.
                new_content = normalize_fragmented_variables(content)
                for token, target in replacements.items():
                    pattern = re.compile(r'\{\{\s*' + re.escape(token) + r'\s*\}\}')
                    new_content = pattern.sub('{{' + target + '}}', new_content)
                detail = ', '.join(f'{{{{{t}}}}} -> {{{{{r}}}}}' for t, r in sorted(replacements.items()))
                if apply_changes:
                    doc.content = new_content
                    doc.save(update_fields=['content', 'updated_at'])
                    self.stdout.write(self.style.SUCCESS(f"REPAIRED {label}: {detail}"))
                else:
                    self.stdout.write(self.style.WARNING(f"[dry-run] would repair {label}: {detail}"))
            if unmatched:
                unmatched_docs += 1
                self.stdout.write(self.style.NOTICE(
                    f"UNMATCHED {label}: no variable matches token(s) {sorted(unmatched)} — left as-is"
                ))

        mode = 'applied' if apply_changes else 'dry-run'
        self.stdout.write(self.style.SUCCESS(
            f"Done ({mode}): {repaired_docs} document(s) repaired, "
            f"{unmatched_docs} document(s) with unmatched tokens."
        ))
