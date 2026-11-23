"""
MediSafe - Medicines Management & Compliance Logs.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/medicines            (List all active/inactive medicines)
- POST   /api/medicines            (Add a new medicine)
- GET    /api/medicines/<id>       (Get single medicine details)
- PUT    /api/medicines/<id>       (Update medicine)
- DELETE /api/medicines/<id>       (Delete medicine)
- GET    /api/medicine-logs        (List intake compliance logs, with date filter)
- POST   /api/medicine-logs        (Mark dose as 'taken' or 'missed')
- PUT    /api/medicine-logs/<id>   (Update a log entry)
"""

from datetime import datetime, date
from bson import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import (
    medicines_col,
    medicine_logs_col,
    serialize_doc,
    serialize_list
)


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([JSONParser])
def medicines_list_create(request):
    """
    GET:  Returns all medicines belonging to the authenticated user.
    POST: Creates a new medicine entry.
    """
    user_id = request.user_id

    if request.method == 'GET':
        status_filter = request.GET.get('status')
        query = {'user_id': user_id}
        if status_filter:
            query['status'] = status_filter

        meds = list(medicines_col().find(query).sort('created_at', -1))
        return Response({
            'success': True,
            'count': len(meds),
            'medicines': serialize_list(meds)
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data or {}
        name = str(data.get('name', '')).strip()
        dosage = str(data.get('dosage', '')).strip()
        time_val = str(data.get('time', '')).strip()

        if not name:
            return Response({
                'success': False,
                'message': 'Medicine name is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        new_med = {
            'user_id': user_id,
            'name': name,
            'type': str(data.get('type', 'Tablet')).strip(),
            'dosage': dosage or '1 unit',
            'frequency': str(data.get('frequency', 'Once Daily')).strip(),
            'time': time_val or '08:00',
            'start_date': str(data.get('start_date', date.today().isoformat())),
            'end_date': str(data.get('end_date', '')) if data.get('end_date') else None,
            'instructions': str(data.get('instructions', 'After food')).strip(),
            'notes': str(data.get('notes', '')).strip(),
            'status': str(data.get('status', 'active')).strip().lower(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        res = medicines_col().insert_one(new_med)
        new_med['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': f'Medicine "{name}" added successfully.',
            'medicine': serialize_doc(new_med)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@jwt_required
@parser_classes([JSONParser])
def medicine_detail(request, id):
    """
    GET:    Retrieve single medicine details.
    PUT:    Update existing medicine.
    DELETE: Delete medicine.
    """
    user_id = request.user_id

    try:
        med_id = ObjectId(id)
    except Exception:
        return Response({
            'success': False,
            'message': 'Invalid medicine ID format.'
        }, status=status.HTTP_400_BAD_REQUEST)

    med = medicines_col().find_one({'_id': med_id, 'user_id': user_id})
    if not med:
        return Response({
            'success': False,
            'message': 'Medicine not found.'
        }, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({
            'success': True,
            'medicine': serialize_doc(med)
        }, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        data = request.data or {}
        update_fields = {'updated_at': datetime.utcnow()}

        for field in ['name', 'type', 'dosage', 'frequency', 'time', 'start_date', 'end_date', 'instructions', 'notes', 'status']:
            if field in data:
                val = data[field]
                update_fields[field] = str(val).strip() if val is not None else None

        medicines_col().update_one({'_id': med_id, 'user_id': user_id}, {'$set': update_fields})
        updated = medicines_col().find_one({'_id': med_id})

        return Response({
            'success': True,
            'message': 'Medicine updated successfully.',
            'medicine': serialize_doc(updated)
        }, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        medicines_col().delete_one({'_id': med_id, 'user_id': user_id})
        # Optionally remove associated logs
        medicine_logs_col().delete_many({'medicine_id': str(med_id), 'user_id': user_id})

        return Response({
            'success': True,
            'message': 'Medicine deleted successfully.'
        }, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([JSONParser])
def medicine_logs_view(request):
    """
    GET:  Returns medicine intake compliance history. Can filter by date (YYYY-MM-DD).
    POST: Marks a dose as 'taken' or 'missed'. Prevents duplicate logs for the same dose on the same date.
    """
    user_id = request.user_id

    if request.method == 'GET':
        target_date = request.GET.get('date')
        query = {'user_id': user_id}
        if target_date:
            query['scheduled_date'] = target_date

        logs = list(medicine_logs_col().find(query).sort([('scheduled_date', -1), ('scheduled_time', -1)]))
        return Response({
            'success': True,
            'count': len(logs),
            'logs': serialize_list(logs)
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data or {}
        medicine_id = str(data.get('medicine_id', '')).strip()
        status_val = str(data.get('status', 'taken')).strip().lower()
        scheduled_date = str(data.get('scheduled_date', date.today().isoformat())).strip()
        scheduled_time = str(data.get('scheduled_time', '')).strip()

        if not medicine_id:
            return Response({
                'success': False,
                'message': 'Medicine ID is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if status_val not in ['taken', 'missed']:
            return Response({
                'success': False,
                'message': 'Status must be either "taken" or "missed".'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Look up medicine details for snapshot
        try:
            med_obj_id = ObjectId(medicine_id)
        except Exception:
            return Response({'success': False, 'message': 'Invalid medicine ID.'}, status=status.HTTP_400_BAD_REQUEST)

        med = medicines_col().find_one({'_id': med_obj_id, 'user_id': user_id})
        if not med:
            return Response({'success': False, 'message': 'Medicine not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not scheduled_time:
            scheduled_time = med.get('time', '08:00')

        # Check for duplicate log on the same scheduled date and time
        existing_log = medicine_logs_col().find_one({
            'user_id': user_id,
            'medicine_id': medicine_id,
            'scheduled_date': scheduled_date,
            'scheduled_time': scheduled_time
        })

        if existing_log:
            # Update the existing log instead of creating a conflicting duplicate
            medicine_logs_col().update_one(
                {'_id': existing_log['_id']},
                {'$set': {
                    'status': status_val,
                    'actual_action_time': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }}
            )
            updated_log = medicine_logs_col().find_one({'_id': existing_log['_id']})
            return Response({
                'success': True,
                'message': f'Medication log updated to "{status_val}".',
                'log': serialize_doc(updated_log)
            }, status=status.HTTP_200_OK)

        # Create new log document
        new_log = {
            'user_id': user_id,
            'medicine_id': medicine_id,
            'medicine_name': med.get('name', 'Unknown'),
            'dosage': med.get('dosage', ''),
            'scheduled_date': scheduled_date,
            'scheduled_time': scheduled_time,
            'status': status_val,
            'actual_action_time': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }

        res = medicine_logs_col().insert_one(new_log)
        new_log['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': f'Medication marked as {status_val} successfully.',
            'log': serialize_doc(new_log)
        }, status=status.HTTP_201_CREATED)


@api_view(['PUT'])
@jwt_required
@parser_classes([JSONParser])
def medicine_log_detail(request, id):
    """
    PUT: Update status of a specific medicine log entry.
    """
    user_id = request.user_id
    try:
        log_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid log ID.'}, status=status.HTTP_400_BAD_REQUEST)

    data = request.data or {}
    new_status = str(data.get('status', '')).strip().lower()
    if new_status not in ['taken', 'missed']:
        return Response({'success': False, 'message': 'Status must be "taken" or "missed".'}, status=status.HTTP_400_BAD_REQUEST)

    medicine_logs_col().update_one(
        {'_id': log_id, 'user_id': user_id},
        {'$set': {
            'status': new_status,
            'actual_action_time': datetime.utcnow()
        }}
    )
    updated = medicine_logs_col().find_one({'_id': log_id})
    if not updated:
        return Response({'success': False, 'message': 'Log entry not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'success': True,
        'message': f'Log updated to {new_status}.',
        'log': serialize_doc(updated)
    }, status=status.HTTP_200_OK)
