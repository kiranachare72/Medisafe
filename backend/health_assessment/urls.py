from django.urls import path
from health_assessment.views import health_assessment_view

urlpatterns = [
    path('health-assessment', health_assessment_view, name='health-assessment'),
]
