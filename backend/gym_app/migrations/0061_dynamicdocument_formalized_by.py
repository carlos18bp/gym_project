"""Add ``formalized_by`` and re-snapshot legacy letterheads.

The previous attempt at freezing the letterhead (migration 0060) used
``document.created_by`` as the snapshot source. In practice ``created_by`` is
often the lawyer who built the template — not the user who actually clicked
"Formalizar" — so legacy formalized documents either ended up with the wrong
issuer or, more commonly, with no snapshot at all because the lawyer had no
letterhead configured.

This migration:

1. Adds ``formalized_by`` (FK to User, nullable) to persist the actual
   formalizer going forward.
2. Backfills ``formalized_by`` for documents already in locked states using a
   conservative heuristic: the first signed ``DocumentSignature`` ordered by
   ``signed_at`` (which corresponds to the emisor in both ``issuer_only`` and
   ``normal`` flows). Falls back to ``assigned_to`` and finally ``created_by``.
3. Re-runs the snapshot for any locked document whose
   ``letterhead_image_snapshot`` is empty but whose resolved ``formalized_by``
   has a letterhead — this fixes documents like #3979 in production where the
   lawyer had no letterhead but the actual emisor did.
"""

from django.conf import settings
from django.db import migrations, models


LOCKED_STATES = ('PendingSignatures', 'FullySigned', 'Rejected', 'Expired')


def backfill_formalized_by_and_snapshots(apps, schema_editor):
    from django.core.files.base import ContentFile

    DynamicDocument = apps.get_model('gym_app', 'DynamicDocument')
    DocumentSignature = apps.get_model('gym_app', 'DocumentSignature')

    locked_qs = DynamicDocument.objects.filter(state__in=LOCKED_STATES)
    for document in locked_qs.iterator():
        # 1) Resolve formalized_by if missing.
        if document.formalized_by_id is None:
            first_sig = (
                DocumentSignature.objects
                .filter(document=document, signed=True)
                .exclude(signer__isnull=True)
                .order_by('signed_at', 'id')
                .first()
            )
            issuer_id = None
            if first_sig and first_sig.signer_id:
                issuer_id = first_sig.signer_id
            elif document.assigned_to_id:
                issuer_id = document.assigned_to_id
            elif document.created_by_id:
                issuer_id = document.created_by_id

            if issuer_id is not None:
                document.formalized_by_id = issuer_id
                document.save(update_fields=['formalized_by'])

        # 2) If snapshot is empty but the resolved issuer has a letterhead,
        #    snapshot now. Idempotent and silent on failure.
        if document.letterhead_image_snapshot:
            continue

        issuer = None
        if document.formalized_by_id:
            User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
            issuer = User.objects.filter(pk=document.formalized_by_id).first()

        source_img = document.letterhead_image or (
            issuer.letterhead_image if issuer and getattr(issuer, 'letterhead_image', None) else None
        )
        if not source_img:
            continue

        try:
            source_img.open('rb')
            try:
                raw = source_img.read()
            finally:
                source_img.close()
        except (FileNotFoundError, ValueError, IOError):
            continue

        base_name = source_img.name.rsplit('/', 1)[-1] if source_img.name else 'letterhead.png'
        try:
            document.letterhead_image_snapshot.save(
                f"snapshot_{document.pk}_{base_name}",
                ContentFile(raw),
                save=False,
            )
            document.save(update_fields=['letterhead_image_snapshot'])
        except (ValueError, IOError):
            continue


def noop_reverse(apps, schema_editor):
    """Reversal drops the column via the AddField reverse — non-destructive."""
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('gym_app', '0060_add_letterhead_snapshot'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='dynamicdocument',
            name='formalized_by',
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    'Usuario que oprimió "Formalizar". Es el emisor real cuyo membrete '
                    'se congela en el snapshot del documento. Puede diferir de created_by '
                    'cuando un abogado armó el template y otro usuario lo formalizó.'
                ),
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='formalized_documents',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(backfill_formalized_by_and_snapshots, noop_reverse),
    ]
