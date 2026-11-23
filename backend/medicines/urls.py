from django.urls import path
from medicines.views import (
    medicines_list_create,
    medicine_detail,
    medicine_logs_view,
    medicine_log_detail
)

urlpatterns = [
    path('medicines', medicines_list_create, name='medicines-list-create'),
    path('medicines/<str:id>', medicine_detail, name='medicine-detail'),
    path('medicine-logs', medicine_logs_view, name='medicine-logs'),
    path('medicine-logs/<str:id>', medicine_log_detail, name='medicine-log-detail'),
]
