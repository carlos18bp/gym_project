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
]

# Emails that delete_fake_data must never delete.
PROTECTED_EMAILS = frozenset(
    {SPECIAL_LAWYER_EMAIL} | set(SPECIAL_NON_LAWYER_EMAILS)
)

# Emails in the generic client{i}@example.com range that are managed by the
# special_users_spec block and must not be touched by the generic client loop.
RESERVED_CLIENT_EMAILS = frozenset(
    e for e in SPECIAL_NON_LAWYER_EMAILS if e.endswith('@example.com')
)
