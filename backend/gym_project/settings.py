import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-6kg(nl718cb!8ltn3m%t2ol-he+0y5=bgsto756*2@ue!vb29s'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = []

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
    # 'django_celery_beat',  # Uncomment after installing: pip install celery redis django-celery-beat
    'gym_app',
]

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

CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

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

# Set TTL to JWT
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
}

ROOT_URLCONF = 'gym_project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'gym_app/templates')],  # Ruta a la carpeta de templates
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

# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
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


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

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

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'misfotoscmbp@gmail.com'
EMAIL_HOST_PASSWORD = 'ikdvsyikywczdnkk'
DEFAULT_FROM_EMAIL = 'G&M Consultores Jurídicos <misfotoscmbp@gmail.com>'

# Google reCAPTCHA configuration
RECAPTCHA_SITE_KEY = os.getenv('RECAPTCHA_SITE_KEY', '6Lc2AHgrAAAAAIflkJJNbK1c5Ts6pmY5uEQrFCZP')
RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY', '6Lc2AHgrAAAAAJzeTQYbL02-PA3TXwS3QSxaTRqV')

# Google OAuth Client ID (used to verify Google ID tokens server-side)
GOOGLE_CLIENT_ID = os.getenv(
    'GOOGLE_CLIENT_ID',
    '931303546385-777cpce87b2ro3lsgvdua25rfqjfgktg.apps.googleusercontent.com',
)

# Wompi Payment Gateway Configuration
WOMPI_ENVIRONMENT = os.getenv('WOMPI_ENVIRONMENT', 'test')

if WOMPI_ENVIRONMENT == 'production':
    WOMPI_PUBLIC_KEY = 'pub_prod_5on0Y7aYooesvUVq6BNkzpH5TYptsxd8'
    WOMPI_PRIVATE_KEY = 'prv_prod_O942ODqcMAJLnw53QlZ8VoZVqv5C7FDB'
    WOMPI_EVENTS_KEY = 'prod_events_vXS2HwhfKN1GV3XlXtO3zj8mpReZWo9K'
    WOMPI_INTEGRITY_KEY = 'prod_integrity_J0dir9BPePkW9jxxtwzVfLYkSMzhD3DG'
else:
    WOMPI_PUBLIC_KEY = 'pub_test_b3LGmVloYasfVNKpZOc5ND0MMyAgQxFG'
    WOMPI_PRIVATE_KEY = 'prv_test_2vFBbzzJKWJNCtDa868RA3ptz1EG1JF7'
    WOMPI_EVENTS_KEY = 'test_events_Pj2i2YxMOfLGXEUSvOIwBSrVeTLZU0GW'
    WOMPI_INTEGRITY_KEY = 'test_integrity_0h9R8sLVKQd3khMyvveBwbS3Cchql6T9'

WOMPI_API_URL = 'https://production.wompi.co/v1' if WOMPI_ENVIRONMENT == 'production' else 'https://sandbox.wompi.co/v1'

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'America/Bogota'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Configuración de Logging
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
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'gym_app': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}
