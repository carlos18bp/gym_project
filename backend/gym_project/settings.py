import os
from datetime import timedelta
from pathlib import Path

from decouple import config, Csv
from huey import RedisHuey

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Environment detection
# ---------------------------------------------------------------------------
DJANGO_ENV = config('DJANGO_ENV', default='development')
IS_PRODUCTION = DJANGO_ENV == 'production'

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = config(
    'DJANGO_SECRET_KEY',
    default='django-insecure-6kg(nl718cb!8ltn3m%t2ol-he+0y5=bgsto756*2@ue!vb29s',
)

ALLOWED_HOSTS = [
    h for h in config('DJANGO_ALLOWED_HOSTS', default='', cast=Csv()) if h
]

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'huey.contrib.djhuey',
    'dbbackup',
    'gym_app',
]

# Conditionally add Silk (dev/profiling only)
ENABLE_SILK = config('ENABLE_SILK', default=False, cast=bool)
if ENABLE_SILK:
    INSTALLED_APPS.append('silk')

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Conditionally add Silk middleware
if ENABLE_SILK:
    MIDDLEWARE.insert(1, 'silk.middleware.SilkyMiddleware')

"""
Authentication methods used, JWT (JSON Web Token) Authentication: JWT is an 
open standard that defines a compact and secure way to transmit information 
between parties as a JSON object.
"""
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}

AUTH_USER_MODEL = 'gym_app.User'

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
}

ROOT_URLCONF = 'gym_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'gym_app/templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'gym_project.wsgi.application'

# ---------------------------------------------------------------------------
# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases
# ---------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': config('DB_NAME', default=str(BASE_DIR / 'db.sqlite3')),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
    }
}

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# ---------------------------------------------------------------------------
# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/
# ---------------------------------------------------------------------------

STATIC_URL = '/static/'

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config(
    'DEFAULT_FROM_EMAIL',
    default='G&M Consultores Jurídicos <noreply@example.com>',
)

# ---------------------------------------------------------------------------
# Google reCAPTCHA configuration
# ---------------------------------------------------------------------------
RECAPTCHA_SITE_KEY = config('RECAPTCHA_SITE_KEY', default='')
RECAPTCHA_SECRET_KEY = config('RECAPTCHA_SECRET_KEY', default='')

# Google OAuth Client ID (used to verify Google ID tokens server-side)
GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', default='')

# ---------------------------------------------------------------------------
# Wompi Payment Gateway Configuration
# ---------------------------------------------------------------------------
WOMPI_ENVIRONMENT = config('WOMPI_ENVIRONMENT', default='test')

WOMPI_PUBLIC_KEY = config('WOMPI_PUBLIC_KEY', default='')
WOMPI_PRIVATE_KEY = config('WOMPI_PRIVATE_KEY', default='')
WOMPI_EVENTS_KEY = config('WOMPI_EVENTS_KEY', default='')
WOMPI_INTEGRITY_KEY = config('WOMPI_INTEGRITY_KEY', default='')

WOMPI_API_URL = (
    'https://production.wompi.co/v1'
    if WOMPI_ENVIRONMENT == 'production'
    else 'https://sandbox.wompi.co/v1'
)

# ---------------------------------------------------------------------------
# Huey task queue
# ---------------------------------------------------------------------------
HUEY = RedisHuey(
    name='gym_project',
    url=config('REDIS_URL', default='redis://localhost:6379/1'),
    immediate=not IS_PRODUCTION,
)

# ---------------------------------------------------------------------------
# Backups (django-dbbackup)
# ---------------------------------------------------------------------------
DBBACKUP_STORAGE = 'django.core.files.storage.FileSystemStorage'
DBBACKUP_STORAGE_OPTIONS = {
    'location': config('BACKUP_STORAGE_PATH', default='/var/backups/gym_project'),
}
DBBACKUP_FILENAME_TEMPLATE = '{datetime}.sql'
DBBACKUP_MEDIA_FILENAME_TEMPLATE = '{datetime}.tar'
DBBACKUP_COMPRESS = True
DBBACKUP_CLEANUP_KEEP = 5
DBBACKUP_CLEANUP_KEEP_MEDIA = 5

# ---------------------------------------------------------------------------
# Silk profiling configuration (only active when ENABLE_SILK=true)
# ---------------------------------------------------------------------------
if ENABLE_SILK:
    SILKY_ANALYZE_QUERIES = True

    SILKY_AUTHENTICATION = True
    SILKY_AUTHORISATION = True

    def silk_permissions(user):
        return user.is_staff

    SILKY_PERMISSIONS = silk_permissions

    SILKY_MAX_RECORDED_REQUESTS = 10000
    SILKY_MAX_RECORDED_REQUESTS_CHECK_PERCENT = 10

    SILKY_IGNORE_PATHS = [
        '/admin/',
        '/static/',
        '/media/',
        '/silk/',
    ]

    SILKY_MAX_REQUEST_BODY_SIZE = 1024
    SILKY_MAX_RESPONSE_BODY_SIZE = 1024

# Alert thresholds (used by weekly report task)
SLOW_QUERY_THRESHOLD_MS = 500
N_PLUS_ONE_THRESHOLD = 10

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL = config('DJANGO_LOG_LEVEL', default='INFO')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
        'custom': {
            'format': '[{asctime}] {levelname} {module}: {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'custom',
        },
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'debug.log'),
            'formatter': 'custom',
        },
        'backup_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'backups.log'),
            'formatter': 'custom',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': LOG_LEVEL,
            'propagate': True,
        },
        'gym_app': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'backups': {
            'handlers': ['backup_file', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ---------------------------------------------------------------------------
# Load environment-specific settings
# ---------------------------------------------------------------------------
if IS_PRODUCTION:
    from .settings_prod import *  # noqa: F401, F403
else:
    from .settings_dev import *  # noqa: F401, F403
