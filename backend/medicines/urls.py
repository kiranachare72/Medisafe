from django.urls import path
from medicines.views import (
    medicines_list_create,
    medicine_detail,
    medicine_logs_view,
    medicine_log_detail,
    ai_scan_medicine,
    ai_compare_medicines,
    get_medicine_knowledge_base
)

urlpatterns = [
    path('medicines/ai-scan', ai_scan_medicine, name='medicines-ai-scan'),
    path('medicines/ai-compare', ai_compare_medicines, name='medicines-ai-compare'),
    path('medicines/knowledge-base', get_medicine_knowledge_base, name='medicines-kb'),
    path('medicines', medicines_list_create, name='medicines-list-create'),
    path('medicines/<str:id>', medicine_detail, name='medicine-detail'),
    path('medicine-logs', medicine_logs_view, name='medicine-logs'),
    path('medicine-logs/<str:id>', medicine_log_detail, name='medicine-log-detail'),
]
