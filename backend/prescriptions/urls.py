from django.urls import path
from prescriptions.views import scan_prescription, confirm_prescription_medicine, prescriptions_history

urlpatterns = [
    path('prescriptions/scan', scan_prescription, name='prescription-scan'),
    path('prescriptions/confirm', confirm_prescription_medicine, name='prescription-confirm'),
    path('prescriptions', prescriptions_history, name='prescriptions-history'),
]
