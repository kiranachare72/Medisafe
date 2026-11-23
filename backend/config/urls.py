"""
URL configuration for MediSafe project.
Handles all REST API routing, media uploads, and serves frontend web client.
"""

import os
from datetime import datetime
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.static import serve

FRONTEND_DIR = os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend'))

def health_check(request):
    """Simple API health check endpoint."""
    return JsonResponse({
        'status': 'online',
        'application': 'MediSafe - Healthcare Management System',
        'framework': 'Django 6.x + Django REST Framework + PyMongo',
        'database': 'MongoDB Atlas',
        'timestamp': datetime.utcnow().isoformat()
    })

def serve_root(request):
    """Serves the frontend landing page."""
    return serve(request, 'index.html', document_root=FRONTEND_DIR)

urlpatterns = [
    # Health check
    path('api/health', health_check, name='api-health'),

    # Domain REST APIs
    path('api/', include('accounts.urls')),
    path('api/', include('dashboard.urls')),
    path('api/', include('medicines.urls')),
    path('api/', include('appointments.urls')),
    path('api/', include('water_tracker.urls')),
    path('api/', include('medical_records.urls')),
    path('api/', include('emergency.urls')),
    path('api/', include('health_assessment.urls')),
    path('api/', include('prescriptions.urls')),
    path('api/', include('caregivers.urls')),
]

# Serve media uploads during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Frontend client fallback routing
urlpatterns += [
    path('', serve_root, name='root-landing'),
    re_path(r'^(?P<path>.*)$', serve, {'document_root': FRONTEND_DIR}),
]
