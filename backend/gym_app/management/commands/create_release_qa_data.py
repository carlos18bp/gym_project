"""Deterministic QA fixtures for the September 2026 release.

The volumetric seeders spread states at random, which is fine for volume but
useless for a scripted QA walkthrough: the reassignment screen never shows all
four "not transferable" reasons at once, and no cuenta de cobro ever lands in
the `rejected` state. This command seeds three exact scenarios instead:

  A. A lean lawyer ready to be reassigned — one document per state, so the four
     red reasons fit on a single screen.
  B. Four fully signed contracts covering every payment-plan situation,
     including the rejected installment that no seeder produced before. This
     is the ONLY place cuentas de cobro are seeded — create_dynamic_documents
     used to attach a plan to whichever two documents sorted first, which made
     the fixture non-deterministic and wrote PDFs that would not open.
  C. A user whose guided tour is 45 days old, so the 30-day re-offer can be
     seen without waiting a month.

It runs LAST in create_fake_data and is both idempotent and *reconciling*:
re-running it restores the scenarios after QA has consumed them (transferred
the documents, archived the lawyer, accepted an installment, finished the tour).

Must be run from `backend/` — it reads media/example_files/.
"""
import random
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from gym_app.models import (
    Case,
    DocumentPaymentRecord,
    DocumentSignature,
    DocumentVariable,
    DocumentVisibilityPermission,
    DynamicDocument,
    Process,
    Stage,
    StageAlert,
    Tag,
    TourProgress,
    User,
)

from ._seeder_constants import (
    QA_PAYMENTS_CLIENT_EMAIL,
    QA_PAYMENTS_LAWYER_EMAIL,
    QA_REASSIGN_CLIENT_EMAIL,
    QA_REASSIGN_SOURCE_EMAIL,
    QA_REASSIGN_TARGET_EMAIL,
    QA_TOUR_STALE_EMAIL,
)

# Real 16 KB PDFs. The previous payment seeding wrote a 31-byte ContentFile,
# which downloads as a corrupt file — the QA guide asks the tester to open it.
EXAMPLE_FILES_DIR = Path(settings.BASE_DIR) / 'media' / 'example_files'
EXAMPLE_PDFS = ['Test_QA_1.pdf', 'Test_QA_2.pdf', 'Test_QA_3.pdf']

REASSIGN_PREFIX = '[QA Reasignación]'
PAYMENTS_PREFIX = '[QA Cuentas de Cobro]'

# A guided tour completed this long ago reports `stale` (STALE_AFTER_DAYS = 30).
TOUR_STALE_DAYS = 45

QA_TAG_NAMES = ['Alto valor', 'Confidencial']

_OBJETO = (
    'Prestación de servicios de asesoría jurídica integral en materia '
    'contractual, incluyendo la representación ante entidades del Estado.'
)

_CONTENT_TEMPLATE = (
    'CONTRATO DE PRESTACIÓN DE SERVICIOS JURÍDICOS\n\n'
    'Entre las partes se acuerda lo siguiente:\n\n'
    'Objeto: {{contract_object}}\n'
    'Valor del contrato: {{contract_value}}\n'
    'Plazo: {{contract_term}}\n'
    'Fecha de fin: {{end_date}}\n'
)

_CONTENT_TEMPLATE_WITH_PAYMENTS = _CONTENT_TEMPLATE + 'Forma de pago: {{payment_installments}}\n'

# ── Scenario A — one document per state ──────────────────────────────────────
# The first four are transferable (ELIGIBLE_DOCUMENT_STATES); the last four are
# the ones admin_reassignment.py blocks, one per INELIGIBLE_STATE_REASONS entry.
REASSIGN_DOCS = [
    ('Minuta en borrador', 'Draft', False),
    ('Minuta publicada', 'Published', False),
    ('Contrato en progreso', 'Progress', True),
    ('Contrato completado', 'Completed', True),
    ('Contrato pendiente de firma', 'PendingSignatures', True),
    ('Contrato firmado', 'FullySigned', True),
    ('Contrato rechazado', 'Rejected', True),
    ('Contrato vencido', 'Expired', True),
]

REASSIGN_PROCESSES = [
    ('QA-REASIGN-P1', 'Comercializadora Andina S.A.S.', 'Distribuidora del Norte Ltda.',
     'Juicio Ejecutivo Mercantil', 25),
    ('QA-REASIGN-P2', 'Inversiones Bolívar S.A.', 'Constructora Milenio S.A.S.',
     'Juicio Ordinario Civil', 50),
    ('QA-REASIGN-P3', 'María Fernanda Ríos', 'Transportes Unidos S.A.',
     'Juicio Laboral', 75),
    ('QA-REASIGN-P4', 'Alimentos del Valle S.A.S.', 'Dirección de Impuestos y Aduanas',
     'Juicio de Nulidad y Restablecimiento', 100),
]

_REJECTION_REASON = (
    'El valor cargado no corresponde al pactado en la cláusula quinta del '
    'contrato. Por favor ajusta el monto y vuelve a cargar la cuenta de cobro.'
)

# (title, installments, [(installment_number, status, amount, notes)])
PAYMENT_SCENARIOS = [
    (
        'Contrato con pago único',
        1,
        [],
    ),
    (
        'Contrato con dos cuotas aceptadas',
        2,
        [
            (1, DocumentPaymentRecord.STATUS_ACCEPTED, 1_500_000, None),
            (2, DocumentPaymentRecord.STATUS_ACCEPTED, 2_500_000, None),
        ],
    ),
    (
        'Contrato con cuota en revisión',
        3,
        [
            (1, DocumentPaymentRecord.STATUS_ACCEPTED, 1_000_000, None),
            (2, DocumentPaymentRecord.STATUS_UPLOADED, 1_000_000,
             'Cuenta correspondiente a la segunda cuota.'),
        ],
    ),
    (
        'Contrato con cuota rechazada',
        3,
        [
            (1, DocumentPaymentRecord.STATUS_ACCEPTED, 900_000, None),
            (2, DocumentPaymentRecord.STATUS_REJECTED, 3_000_000, None),
        ],
    ),
]


class Command(BaseCommand):
    help = 'Seed the deterministic QA scenarios for the September 2026 release'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-passwords',
            action='store_true',
            default=False,
            help='Reset passwords to "password" for the QA accounts',
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _ensure_user(self, email, first_name, last_name, role, reset_passwords):
        """Create the account if missing and reconcile the invariants QA needs.

        Reconciling matters more than creating: QA archives the source lawyer as
        part of the walkthrough, and a second run has to bring them back.
        """
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'first_name': first_name, 'last_name': last_name, 'role': role},
        )
        if created or reset_passwords:
            user.set_password('password')
            user.save()
        user.role = role
        user.is_active = True
        user.is_archived = False
        user.is_profile_completed = True
        user.save(update_fields=['role', 'is_active', 'is_archived', 'is_profile_completed'])
        return user, created

    def _ensure_document(self, title, created_by, state, assigned_to=None, **flags):
        """Idempotent on (created_by, title).

        The key is stable because created_by is the audit trail and never
        changes — not even when an admin reassigns the document.
        """
        doc, created = DynamicDocument.objects.get_or_create(
            created_by=created_by,
            title=title,
            defaults={'content': flags.get('content', _CONTENT_TEMPLATE), 'state': state},
        )
        doc.state = state
        doc.assigned_to = assigned_to
        # managed_by is what an admin reassignment migrates; the ORM does not
        # default it (that lives in the serializer), so set it explicitly and
        # reset it on every run.
        doc.managed_by = created_by
        doc.content = flags.get('content', _CONTENT_TEMPLATE)
        doc.requires_signature = flags.get('requires_signature', False)
        doc.fully_signed = flags.get('fully_signed', False)
        doc.is_public = flags.get('is_public', False)
        doc.signature_due_date = flags.get('signature_due_date')
        doc.save()
        return doc, created

    def _ensure_variables(self, doc, installments=None):
        """Seed the four core variables every document must carry, plus the
        payment plan when the scenario declares one."""
        specs = [
            ('contract_object', 'Objeto del contrato', 'Objeto principal del documento',
             'text_area', _OBJETO, 'object', None),
            ('contract_value', 'Valor del contrato', 'Valor pactado',
             'number', str(random.randint(5_000_000, 40_000_000)), 'value', 'COP'),
            ('contract_term', 'Plazo', 'Plazo de ejecución',
             'input', f'{random.randint(3, 24)} meses', 'term', None),
            ('end_date', 'Fecha de fin', 'Fecha de finalización',
             'date', (timezone.now().date() + timedelta(days=180)).isoformat(), 'end_date', None),
        ]
        if installments is not None:
            specs.append((
                'payment_installments', 'Forma de pago',
                'Número de cuotas pactadas en el contrato',
                'number', str(installments), 'payment_installments', None,
            ))
        for name_en, name_es, tooltip, field_type, value, summary_field, currency in specs:
            DocumentVariable.objects.update_or_create(
                document=doc,
                name_en=name_en,
                defaults={
                    'name_es': name_es,
                    'tooltip': tooltip,
                    'field_type': field_type,
                    'value': value,
                    'summary_field': summary_field,
                    'currency': currency,
                },
            )

    def _ensure_tags(self, doc):
        tags = [Tag.objects.get_or_create(name=name)[0] for name in QA_TAG_NAMES]
        doc.tags.set(tags)

    def _ensure_signature(self, doc, signer, signed, rejected=False, comment=None):
        signature, _ = DocumentSignature.objects.update_or_create(
            document=doc,
            signer=signer,
            defaults={
                'signed': signed,
                'signed_at': timezone.now() - timedelta(days=5) if signed else None,
                'rejected': rejected,
                'rejected_at': timezone.now() - timedelta(days=3) if rejected else None,
                'rejection_comment': comment,
                'ip_address': '192.168.1.42' if signed or rejected else None,
            },
        )
        return signature

    def _ensure_visibility(self, doc, user, granted_by):
        """Grant explicit visibility to a client-side user.

        Required, not optional: apply_visibility_filter matches on created_by,
        signatures__signer, is_public or visibility_permissions__user —
        `assigned_to` is NOT in that list, so without this the client simply
        does not see the document.
        """
        DocumentVisibilityPermission.objects.get_or_create(
            document=doc,
            user=user,
            defaults={'granted_by': granted_by},
        )

    def _ensure_payment_record(self, doc, number, status, amount, notes, uploaded_by, index):
        """Idempotent on (document, installment_number).

        On re-runs only the scalar fields are reconciled — the FileField is left
        alone so repeated runs do not pile up PDFs in media/.
        """
        record = DocumentPaymentRecord.objects.filter(
            document=doc, installment_number=number
        ).first()
        rejection_reason = _REJECTION_REASON if status == DocumentPaymentRecord.STATUS_REJECTED else None

        if record is None:
            source = EXAMPLE_FILES_DIR / EXAMPLE_PDFS[index % len(EXAMPLE_PDFS)]
            record = DocumentPaymentRecord(
                document=doc,
                installment_number=number,
                original_name=f'cuenta_cobro_{number}.pdf',
                amount=amount,
                notes=notes,
                status=status,
                rejection_reason=rejection_reason,
                uploaded_by=uploaded_by,
                uploaded_at=timezone.now() - timedelta(days=10 - number),
            )
            with open(source, 'rb') as handle:
                record.file.save(f'cuenta_cobro_{number}.pdf', File(handle), save=False)
            record.save()
            return record, True

        record.status = status
        record.amount = amount
        record.notes = notes
        record.rejection_reason = rejection_reason
        record.uploaded_by = uploaded_by
        record.save(update_fields=['status', 'amount', 'notes', 'rejection_reason', 'uploaded_by'])
        return record, False

    # ── Entry point ──────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        reset_passwords = options.get('reset_passwords', False)

        if not EXAMPLE_FILES_DIR.is_dir():
            self.stdout.write(self.style.ERROR(
                f'No existe {EXAMPLE_FILES_DIR}. Ejecutá el comando desde backend/.'
            ))
            return

        payments_lawyer = User.objects.filter(email=QA_PAYMENTS_LAWYER_EMAIL).first()
        payments_client = User.objects.filter(email=QA_PAYMENTS_CLIENT_EMAIL).first()
        reassign_client = User.objects.filter(email=QA_REASSIGN_CLIENT_EMAIL).first()
        missing = [
            email for email, user in (
                (QA_PAYMENTS_LAWYER_EMAIL, payments_lawyer),
                (QA_PAYMENTS_CLIENT_EMAIL, payments_client),
                (QA_REASSIGN_CLIENT_EMAIL, reassign_client),
            ) if user is None
        ]
        if missing:
            self.stdout.write(self.style.ERROR(
                f'Faltan usuarios base ({", ".join(missing)}). '
                'Corré create_clients_lawyers primero.'
            ))
            return

        with transaction.atomic():
            source, target = self._seed_reassignment_scenario(reassign_client, reset_passwords)
            self._seed_payment_scenarios(payments_lawyer, payments_client)
            tour_user = self._seed_stale_tour(reset_passwords)

        self.stdout.write(self.style.SUCCESS('\n── Escenarios QA — release septiembre 2026 ──'))
        self.stdout.write('  Admin:           admin@example.com / password (create_clients_lawyers)')
        self.stdout.write(
            f'  Reasignación:    {source.email} → {len(REASSIGN_PROCESSES)} procesos, '
            f'4 transferibles, 4 no transferibles'
        )
        self.stdout.write(f'                   destino: {target.email} (sin datos previos)')
        self.stdout.write(
            f'  Cuentas cobro:   {payments_lawyer.email} revisa / {payments_client.email} sube '
            f'→ {len(PAYMENT_SCENARIOS)} contratos'
        )
        self.stdout.write(f'  Tour vencido:    {tour_user.email} (completado hace {TOUR_STALE_DAYS} días)')
        self.stdout.write('  Password de todas las cuentas: password\n')

    # ── Scenario A ───────────────────────────────────────────────────────────

    def _seed_reassignment_scenario(self, client, reset_passwords):
        source, _ = self._ensure_user(
            QA_REASSIGN_SOURCE_EMAIL, 'Ricardo', 'Reasignable', 'lawyer', reset_passwords
        )
        target, _ = self._ensure_user(
            QA_REASSIGN_TARGET_EMAIL, 'Diana', 'Destino', 'lawyer', reset_passwords
        )

        for ref, plaintiff, defendant, case_type, progress in REASSIGN_PROCESSES:
            case, _ = Case.objects.get_or_create(type=case_type)
            process, created = Process.objects.get_or_create(
                ref=ref,
                defaults={
                    'authority': 'Juzgado Civil del Circuito de Bogotá',
                    'authority_email': 'notificaciones@juzgado.example.com',
                    'plaintiff': plaintiff,
                    'defendant': defendant,
                    'case': case,
                    'subcase': 'Escenario QA de reasignación',
                    'lawyer': source,
                    'progress': progress,
                },
            )
            # Reconcile: QA transfers these to another lawyer during the test.
            if process.lawyer_id != source.id:
                process.lawyer = source
                process.save(update_fields=['lawyer'])
            process.clients.add(client)

            if created:
                stages = [
                    Stage.objects.create(
                        status=status,
                        date=timezone.now().date() - timedelta(days=days),
                    )
                    for status, days in (('Presentación de Demanda', 90), ('Admisión', 45))
                ]
                process.stages.add(*stages)
                for stage in stages:
                    StageAlert.objects.create(stage=stage)

        for label, state, assign in REASSIGN_DOCS:
            title = f'{REASSIGN_PREFIX} {label}'
            flags = {
                'is_public': state == 'Published',
                'requires_signature': state in (
                    'PendingSignatures', 'FullySigned', 'Rejected', 'Expired'
                ),
                'fully_signed': state == 'FullySigned',
            }
            if state == 'Expired':
                flags['signature_due_date'] = timezone.now().date() - timedelta(days=15)

            doc, _ = self._ensure_document(
                title, source, state,
                assigned_to=client if assign else None,
                **flags,
            )
            self._ensure_variables(doc)
            self._ensure_tags(doc)

            if assign:
                self._ensure_visibility(doc, client, source)

            if state == 'PendingSignatures':
                self._ensure_signature(doc, client, signed=False)
            elif state == 'FullySigned':
                self._ensure_signature(doc, source, signed=True)
                self._ensure_signature(doc, client, signed=True)
            elif state == 'Rejected':
                self._ensure_signature(
                    doc, client, signed=False, rejected=True,
                    comment='La cláusula de exclusividad no fue acordada por las partes.',
                )
            elif state == 'Expired':
                self._ensure_signature(doc, client, signed=False)

        self.stdout.write(self.style.SUCCESS(
            f'✓ Reasignación: {source.email} con {len(REASSIGN_PROCESSES)} procesos '
            f'y {len(REASSIGN_DOCS)} documentos (4 transferibles + 4 bloqueados)'
        ))
        return source, target

    # ── Scenario B ───────────────────────────────────────────────────────────

    def _seed_payment_scenarios(self, lawyer, client):
        seeded_records = 0
        for index, (label, installments, records) in enumerate(PAYMENT_SCENARIOS):
            title = f'{PAYMENTS_PREFIX} {label}'
            doc, _ = self._ensure_document(
                title, lawyer, 'FullySigned',
                assigned_to=client,
                requires_signature=True,
                fully_signed=True,
                content=_CONTENT_TEMPLATE_WITH_PAYMENTS,
            )
            self._ensure_variables(doc, installments=installments)
            self._ensure_tags(doc)
            # Both are required for the client to see the document at all, and
            # for it to show up in the "Dcs. Formalizados" tab the guide names.
            self._ensure_signature(doc, lawyer, signed=True)
            self._ensure_signature(doc, client, signed=True)
            self._ensure_visibility(doc, client, lawyer)

            for number, status, amount, notes in records:
                _, created = self._ensure_payment_record(
                    doc, number, status, amount, notes, client, index + number
                )
                seeded_records += int(created)

        self.stdout.write(self.style.SUCCESS(
            f'✓ Cuentas de cobro: {len(PAYMENT_SCENARIOS)} contratos firmados '
            f'({seeded_records} registros nuevos)'
        ))

    # ── Scenario C ───────────────────────────────────────────────────────────

    def _seed_stale_tour(self, reset_passwords):
        """Age one account's tour so the 30-day re-offer is testable today.

        A dedicated lawyer, not one of the payment accounts: the tour lives on
        the same Archivos Jurídicos dashboard, so a stale flag on lawyer1 would
        pop the re-offer modal over the cuentas de cobro scenario. Created last
        and excluded from the volumetric seeders, this account also has zero
        pending signatures — which is what makes the tour show exactly the 10
        steps the QA guide enumerates, with no extra step.
        """
        user, _ = self._ensure_user(
            QA_TOUR_STALE_EMAIL, 'Tomás', 'Tour Vencido', 'lawyer', reset_passwords
        )
        # update_or_create, not get_or_create: completing or skipping the tour
        # stamps completed_at with now(), so a re-run has to re-age it.
        TourProgress.objects.update_or_create(
            user=user,
            module_name='dynamic_documents',
            defaults={'completed_at': timezone.now() - timedelta(days=TOUR_STALE_DAYS)},
        )
        self.stdout.write(self.style.SUCCESS(
            f'✓ Tour vencido: {user.email} (hace {TOUR_STALE_DAYS} días → status stale)'
        ))
        return user
