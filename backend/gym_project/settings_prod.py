# Production settings
# Loaded automatically when DJANGO_ENV == 'production'

import os

# ---------------------------------------------------------------------------
# DEBUG is always False in production — never from environment
# ---------------------------------------------------------------------------
DEBUG = False

# ---------------------------------------------------------------------------
# Required variables — fail fast if missing
# ---------------------------------------------------------------------------
if not os.getenv('DJANGO_SECRET_KEY'):
    raise ValueError("DJANGO_SECRET_KEY is required in production")

if not os.getenv('DJANGO_ALLOWED_HOSTS'):
    raise ValueError("DJANGO_ALLOWED_HOSTS is required in production")

# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# ---------------------------------------------------------------------------
# CORS / CSRF — set from environment in production
# ---------------------------------------------------------------------------
from decouple import config, Csv  # noqa: E402

CORS_ALLOWED_ORIGINS = [
    o for o in config('CORS_ALLOWED_ORIGINS', default='', cast=Csv()) if o
]
CSRF_TRUSTED_ORIGINS = [
    o for o in config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv()) if o
]
