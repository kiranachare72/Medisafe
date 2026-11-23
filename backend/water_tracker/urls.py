from django.urls import path
from water_tracker.views import water_summary_or_log, update_water_goal, delete_water_entry

urlpatterns = [
    path('water', water_summary_or_log, name='water-summary-log'),
    path('water/goal', update_water_goal, name='water-goal-update'),
    path('water/<str:id>', delete_water_entry, name='water-entry-delete'),
]
