from django.urls import path
from emergency.views import emergency_contacts_list_create, emergency_contact_detail

urlpatterns = [
    path('emergency-contacts', emergency_contacts_list_create, name='emergency-contacts-list-create'),
    path('emergency-contacts/<str:id>', emergency_contact_detail, name='emergency-contact-detail'),
]
