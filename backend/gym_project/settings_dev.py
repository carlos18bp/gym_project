# Development settings
# Loaded automatically when DJANGO_ENV != 'production'

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '*']

# Console email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# CORS / CSRF — relaxed for local development
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
