"""
Shared constants for fake-data management commands.

All seeder commands reference the same set of special test users.
Centralising them here prevents the email lists from drifting.
"""

SPECIAL_LAWYER_EMAIL = 'core.paginaswebscolombia@gmail.com'

SPECIAL_NON_LAWYER_EMAILS = [
    'carlos18bp@gmail.com',             # client
    'info.montreal.studios@gmail.com',   # basic
    'corporate1@gmail.com',              # corporate_client
    'client1@example.com',              # basic
    'client2@example.com',              # client
    'client3@example.com',              # corporate_client
    'avisos@gymconsultoresjuridicos.com',           # basic (client-created)
    'wilsongv@gymconsultoresjuridicos.com',         # client (client-created)
    'gmconsultoresjuridicos844@gmail.com',          # corporate_client (client-created)
]

# Additional lawyer emails created manually by the client on staging.
EXTRA_LAWYER_EMAILS = [
    'info@gymconsultoresjuridicos.com',
]

# ── September 2026 release: dedicated QA accounts ─────────────────────
# These back the three scenarios create_release_qa_data seeds. They are
# deliberately separate from the generic pools so the QA screens stay
# small enough to read at a glance.
QA_ADMIN_EMAIL = 'admin@example.com'
QA_REASSIGN_SOURCE_EMAIL = 'abogado.reasignar@example.com'
QA_REASSIGN_TARGET_EMAIL = 'abogado.destino@example.com'
QA_TOUR_STALE_EMAIL = 'tour.vencido@example.com'

# The lawyer who reviews and the client who uploads the cuentas de cobro.
# Both are generic pool accounts the QA guide already names.
QA_PAYMENTS_LAWYER_EMAIL = 'lawyer1@example.com'
QA_PAYMENTS_CLIENT_EMAIL = 'client1@example.com'
# Client on the transferable documents of the reassignment scenario.
QA_REASSIGN_CLIENT_EMAIL = 'client2@example.com'

# (email, first_name, last_name, role)
QA_ADMIN_SPEC = (QA_ADMIN_EMAIL, 'Admin', 'QA Staging', 'admin')

# Lawyers whose dataset must stay EXACT. The volumetric seeders exclude
# them, otherwise a second create_fake_data run buries the reassignment
# screen under 20 random minutas and gives the tour account pending
# signatures it must not have.
QA_EXCLUDED_LAWYER_EMAILS = frozenset({
    QA_REASSIGN_SOURCE_EMAIL,
    QA_REASSIGN_TARGET_EMAIL,
    QA_TOUR_STALE_EMAIL,
})

# Full user specs used by create_clients_lawyers to ensure users exist with
# the correct role before any other seeder runs.
SPECIAL_USERS_SPEC = [
    # (email, first_name, last_name, role)
    ('carlos18bp@gmail.com', 'Carlos', 'Cliente Demo', 'client'),
    ('info.montreal.studios@gmail.com', 'Montreal', 'Básico Demo', 'basic'),
    ('corporate1@gmail.com', 'Corporativo', 'Demo', 'corporate_client'),
    ('client1@example.com', 'Usuario', 'Básico Uno', 'basic'),
    ('client2@example.com', 'Usuario', 'Cliente Dos', 'client'),
    ('client3@example.com', 'Usuario', 'Corporativo Tres', 'corporate_client'),
    ('avisos@gymconsultoresjuridicos.com', 'Avisos', 'GYM Consultores', 'basic'),
    ('wilsongv@gymconsultoresjuridicos.com', 'Wilson', 'GV', 'client'),
    ('gmconsultoresjuridicos844@gmail.com', 'GYM', 'Consultores Jurídicos', 'corporate_client'),
    ('info@gymconsultoresjuridicos.com', 'Info', 'GYM Consultores', 'lawyer'),
]

# Emails that delete_fake_data must never delete.
# QA_ADMIN_EMAIL is already safe by role (delete_fake_data only sweeps
# client/lawyer/basic/corporate_client), but it is listed explicitly so the
# protection survives a future widening of that role filter.
PROTECTED_EMAILS = frozenset(
    {SPECIAL_LAWYER_EMAIL}
    | set(SPECIAL_NON_LAWYER_EMAILS)
    | set(EXTRA_LAWYER_EMAILS)
    | {QA_ADMIN_EMAIL}
)

# Emails created manually by the client on staging. The seeder must never
# overwrite their first_name, last_name, or role — only ensure they exist
# and receive fake documents.
CLIENT_OWNED_EMAILS = frozenset([
    'avisos@gymconsultoresjuridicos.com',
    'wilsongv@gymconsultoresjuridicos.com',
    'gmconsultoresjuridicos844@gmail.com',
    'info@gymconsultoresjuridicos.com',
])

# Emails in the generic client{i}@example.com range that are managed by the
# special_users_spec block and must not be touched by the generic client loop.
RESERVED_CLIENT_EMAILS = frozenset(
    e for e in SPECIAL_NON_LAWYER_EMAILS if e.endswith('@example.com')
)
