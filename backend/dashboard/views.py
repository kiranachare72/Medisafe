"""
MediSafe - Dashboard Views: Aggregates real MongoDB statistics.
Designed for BSc IT Final-Year Research Project.

Endpoint:
- GET /api/dashboard
Returns real-time data calculated from MongoDB collections:
- Medicines (active, today's schedule)
- Medicine logs (taken, missed today)
- Next upcoming appointment
- Water intake and daily goal
- Recent medical records
- Emergency contacts count & preview
"""

from datetime import datetime, date
from bson import ObjectId
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import (
    medicines_col,
    medicine_logs_col,
    appointments_col,
    water_goals_col,
    water_intakes_col,
    medical_records_col,
    emergency_contacts_col,
    serialize_doc,
    serialize_list
)


@api_view(['GET'])
@jwt_required
def get_dashboard_data(request):
    """
    Returns aggregated real healthcare data for the authenticated user.
    """
    user_id = request.user_id
    today_str = date.today().isoformat()  # YYYY-MM-DD format

    # 1. Medicines count (active)
    total_active_medicines = medicines_col().count_documents({
        'user_id': user_id,
        'status': 'active'
    })

    # Today's medicines list for quick view
    active_medicines = list(medicines_col().find({
        'user_id': user_id,
        'status': 'active'
    }).sort('time', 1))

    # 2. Medicine logs for today
    today_logs = list(medicine_logs_col().find({
        'user_id': user_id,
        'scheduled_date': today_str
    }))

    taken_count = sum(1 for log in today_logs if log.get('status') == 'taken')
    missed_count = sum(1 for log in today_logs if log.get('status') == 'missed')

    # 3. Next upcoming appointment (date >= today)
    upcoming_appointments = list(appointments_col().find({
        'user_id': user_id,
        'date': {'$gte': today_str}
    }).sort([('date', 1), ('time', 1)]).limit(1))

    next_appointment = serialize_doc(upcoming_appointments[0]) if upcoming_appointments else None

    # 4. Water tracker: Goal and Today's intake
    water_goal_doc = water_goals_col().find_one({'user_id': user_id})
    daily_goal = water_goal_doc.get('daily_goal', 2500) if water_goal_doc else 2500

    today_intakes = list(water_intakes_col().find({
        'user_id': user_id,
        'date': today_str
    }))
    today_water_intake = sum(int(item.get('amount', 0)) for item in today_intakes)
    water_percentage = min(100, round((today_water_intake / daily_goal) * 100)) if daily_goal > 0 else 0

    # 5. Recent medical records (latest 3)
    recent_records = list(medical_records_col().find({
        'user_id': user_id
    }).sort('upload_date', -1).limit(3))

    # 6. Emergency contacts (list up to 3 for quick view)
    emergency_contacts = list(emergency_contacts_col().find({
        'user_id': user_id
    }).limit(3))

    user_name = request.user_data.get('name', 'User')

    return Response({
        'success': True,
        'data': {
            'user': {
                'id': user_id,
                'name': user_name,
                'email': request.user_data.get('email', ''),
                'profile_photo': request.user_data.get('profile_photo', '')
            },
            'medicines': {
                'total_active': total_active_medicines,
                'today_scheduled': len(active_medicines),
                'taken_today': taken_count,
                'missed_today': missed_count,
                'active_list': serialize_list(active_medicines)
            },
            'appointments': {
                'next_appointment': next_appointment,
                'has_upcoming': next_appointment is not None
            },
            'water': {
                'today_intake': today_water_intake,
                'daily_goal': daily_goal,
                'percentage': water_percentage,
                'logs_count': len(today_intakes)
            },
            'records': {
                'recent': serialize_list(recent_records),
                'total_recent': len(recent_records)
            },
            'emergency': {
                'contacts': serialize_list(emergency_contacts),
                'total_contacts': len(emergency_contacts)
            }
        }
    }, status=status.HTTP_200_OK)
