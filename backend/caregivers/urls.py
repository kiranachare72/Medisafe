from django.urls import path, re_path
from caregivers.views import (
    caregivers_list,
    invite_caregiver,
    accept_caregiver_invitation,
    revoke_caregiver,
    caregiver_patient_view
)

urlpatterns = [
    re_path(r'^caregivers/?$', caregivers_list, name='caregivers-list'),
    re_path(r'^caregivers/invite/?$', invite_caregiver, name='caregiver-invite'),
    re_path(r'^caregivers/accept/?$', accept_caregiver_invitation, name='caregiver-accept'),
    re_path(r'^caregivers/(?P<id>[a-f0-9]{24})/?$', revoke_caregiver, name='caregiver-revoke'),
    re_path(r'^caregivers/patient/(?P<id>[a-f0-9]{24})/?$', caregiver_patient_view, name='caregiver-patient-view'),
]
