"""
MediSafe - Appointments Management.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/appointments          (List upcoming & past doctor appointments)
- POST   /api/appointments          (Create new appointment)
- PUT    /api/appointments/<id>     (Update appointment)
- DELETE /api/appointments/<id>     (Delete appointment)
"""

from datetime import datetime, date
from bson import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import appointments_col, serialize_doc, serialize_list


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([JSONParser])
def appointments_list_create(request):
    """
    GET:  Returns all appointments for user, sorted by date.
    POST: Adds a new doctor appointment.
    """
    user_id = request.user_id

    if request.method == 'GET':
        today_str = date.today().isoformat()
        appointments = list(appointments_col().find({'user_id': user_id}).sort([('date', 1), ('time', 1)]))

        upcoming = []
        past = []

        for appt in appointments:
            serialized = serialize_doc(appt)
            if appt.get('date', '') >= today_str:
                serialized['is_upcoming'] = True
                upcoming.append(serialized)
            else:
                serialized['is_upcoming'] = False
                past.append(serialized)

        return Response({
            'success': True,
            'count': len(appointments),
            'upcoming': upcoming,
            'past': past,
            'all': serialize_list(appointments)
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data or {}
        doctor_name = str(data.get('doctor_name', '')).strip()
        appt_date = str(data.get('date', '')).strip()
        appt_time = str(data.get('time', '')).strip()

        if not doctor_name or not appt_date or not appt_time:
            return Response({
                'success': False,
                'message': 'Doctor Name, Date, and Time are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        new_appt = {
            'user_id': user_id,
            'doctor_name': doctor_name,
            'hospital': str(data.get('hospital', '')).strip(),
            'date': appt_date,
            'time': appt_time,
            'purpose': str(data.get('purpose', 'General Checkup')).strip(),
            'notes': str(data.get('notes', '')).strip(),
            'reminder_status': bool(data.get('reminder_status', True)),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        res = appointments_col().insert_one(new_appt)
        new_appt['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': f'Appointment with Dr. {doctor_name} scheduled successfully.',
            'appointment': serialize_doc(new_appt)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@jwt_required
@parser_classes([JSONParser])
def appointment_detail(request, id):
    """
    GET:    Retrieve single appointment.
    PUT:    Update appointment.
    DELETE: Cancel / Delete appointment.
    """
    user_id = request.user_id

    try:
        appt_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid appointment ID.'}, status=status.HTTP_400_BAD_REQUEST)

    appt = appointments_col().find_one({'_id': appt_id, 'user_id': user_id})
    if not appt:
        return Response({'success': False, 'message': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'success': True, 'appointment': serialize_doc(appt)}, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        data = request.data or {}
        update_fields = {'updated_at': datetime.utcnow()}

        for field in ['doctor_name', 'hospital', 'date', 'time', 'purpose', 'notes']:
            if field in data:
                update_fields[field] = str(data[field]).strip()

        if 'reminder_status' in data:
            update_fields['reminder_status'] = bool(data['reminder_status'])

        appointments_col().update_one({'_id': appt_id, 'user_id': user_id}, {'$set': update_fields})
        updated = appointments_col().find_one({'_id': appt_id})

        return Response({
            'success': True,
            'message': 'Appointment updated successfully.',
            'appointment': serialize_doc(updated)
        }, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        appointments_col().delete_one({'_id': appt_id, 'user_id': user_id})
        return Response({
            'success': True,
            'message': 'Appointment cancelled and deleted successfully.'
        }, status=status.HTTP_200_OK)
