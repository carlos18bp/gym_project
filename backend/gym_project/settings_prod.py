# Production settings
# Loaded automatically when DJANGO_ENV == 'production'

from decouple import config, Csv

# ---------------------------------------------------------------------------
# DEBUG is always False in production — never from environment
# ---------------------------------------------------------------------------
DEBUG = False

# ---------------------------------------------------------------------------
# Required variables — fail fast if missing or empty
# ---------------------------------------------------------------------------
SECRET_KEY = config('DJANGO_SECRET_KEY')
if not SECRET_KEY or SECRET_KEY.startswith('django-insecure'):
    raise ValueError(
        "DJANGO_SECRET_KEY is required in production and must not be the insecure default"
    )

ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', cast=Csv())
if not ALLOWED_HOSTS:
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
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin-allow-popups'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ---------------------------------------------------------------------------
# CORS / CSRF — set from environment in production
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    o for o in config('CORS_ALLOWED_ORIGINS', default='', cast=Csv()) if o
]
CSRF_TRUSTED_ORIGINS = [
    o for o in config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv()) if o
]
