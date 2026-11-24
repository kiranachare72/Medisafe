from django.urls import path
from appointments.views import appointments_list_create, appointment_detail, nearby_hospitals_view

urlpatterns = [
    path('appointments/nearby-hospitals', nearby_hospitals_view, name='appointments-nearby-hospitals'),
    path('appointments', appointments_list_create, name='appointments-list-create'),
    path('appointments/<str:id>', appointment_detail, name='appointment-detail'),
]
