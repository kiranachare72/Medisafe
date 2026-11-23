from django.urls import path
from appointments.views import appointments_list_create, appointment_detail

urlpatterns = [
    path('appointments', appointments_list_create, name='appointments-list-create'),
    path('appointments/<str:id>', appointment_detail, name='appointment-detail'),
]
