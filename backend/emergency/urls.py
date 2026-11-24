from django.urls import path
from emergency.views import emergency_contacts_list_create, emergency_contact_detail, dispatch_emergency_alert

urlpatterns = [
    path('emergency/dispatch-alert', dispatch_emergency_alert, name='emergency-dispatch-alert'),
    path('emergency-contacts', emergency_contacts_list_create, name='emergency-contacts-list-create'),
    path('emergency-contacts/<str:id>', emergency_contact_detail, name='emergency-contact-detail'),
]
