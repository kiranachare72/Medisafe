from django.urls import path
from medical_records.views import (
    records_list_or_upload,
    download_record,
    delete_record,
    record_ai_analysis
)

urlpatterns = [
    path('records', records_list_or_upload, name='records-list-upload'),
    path('records/<str:id>/ai-analysis', record_ai_analysis, name='record-ai-analysis'),
    path('records/<str:id>/download', download_record, name='record-download'),
    path('records/<str:id>', delete_record, name='record-delete'),
]
