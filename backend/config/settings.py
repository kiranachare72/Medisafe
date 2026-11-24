"""
Django settings for MediSafe Healthcare Management System.
Designed for BSc IT Final-Year Research Project.

NOTE: All healthcare domain models and application data are managed
exclusively via MongoDB Atlas using PyMongo. Django's ORM is NOT used
for application data, fulfilling the PyMongo + MongoDB Atlas requirement.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
dotenv_path = BASE_DIR / '.env'
load_dotenv(dotenv_path)

SECRET_KEY = os.getenv('SECRET_KEY', 'medisafe-super-secret-django-key-bsc-it-2026')
JWT_SECRET = os.getenv('JWT_SECRET', 'medisafe-jwt-secure-secret-token-key-2026')

DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')

allowed_hosts_str = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_str.split(',') if h.strip()]
ALLOWED_HOSTS.extend(['localhost', '127.0.0.1', '*'])

# MongoDB Atlas Configuration
MONGO_URI = os.getenv(
    'MONGO_URI',
    'mongodb+srv://yt:PEWJaOEjqa5Nn0yw@cluster0.kumnajn.mongodb.net/medisafe_db?retryWrites=true&w=majority'
)
DATABASE_NAME = os.getenv('DATABASE_NAME', 'medisafe')

# Application definition
INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    # MediSafe apps
    'accounts',
    'dashboard',
    'medicines',
    'appointments',
    'water_tracker',
    'medical_records',
    'prescriptions',
    'health_assessment',
    'emergency',
    'caregivers',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / '..' / 'frontend'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Django internal database requirement (PyMongo handles ALL MediSafe business data)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'internal_django_cache.sqlite3',
    }
}

# Password validation (if needed by Django internals)
AUTH_PASSWORD_VALIDATORS = []

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / '..' / 'frontend',
]

# Media / Uploaded files (Profile photos, Medical records, Prescriptions)
MEDIA_URL = '/uploads/'
MEDIA_ROOT = BASE_DIR / 'uploads'

# Create upload directories automatically
os.makedirs(MEDIA_ROOT / 'profiles', exist_ok=True)
os.makedirs(MEDIA_ROOT / 'records', exist_ok=True)
os.makedirs(MEDIA_ROOT / 'prescriptions', exist_ok=True)

# CORS settings for frontend communication
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'UNAUTHENTICATED_USER': None,
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Configuration (Console logging by default; SMTP when configured in .env)
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = 'MediSafe System <notifications@medisafe.healthcare>'
