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
PROTECTED_EMAILS = frozenset(
    {SPECIAL_LAWYER_EMAIL}
    | set(SPECIAL_NON_LAWYER_EMAILS)
    | set(EXTRA_LAWYER_EMAILS)
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
