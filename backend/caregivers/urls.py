from django.urls import path
from caregivers.views import (
    caregivers_list,
    invite_caregiver,
    accept_caregiver_invitation,
    revoke_caregiver,
    caregiver_patient_view
)

urlpatterns = [
    path('caregivers', caregivers_list, name='caregivers-list'),
    path('caregivers/invite', invite_caregiver, name='caregiver-invite'),
    path('caregivers/accept', accept_caregiver_invitation, name='caregiver-accept'),
    path('caregivers/<str:id>', revoke_caregiver, name='caregiver-revoke'),
    path('caregivers/patient/<str:id>', caregiver_patient_view, name='caregiver-patient-view'),
]
