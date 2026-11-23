"""
MediSafe - Hydration Tracking & Daily Goal Management.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/water          (Get today's water summary, entries, and progress)
- POST   /api/water          (Log a new water intake entry)
- PUT    /api/water/goal     (Set/update custom daily water goal in ml)
- DELETE /api/water/<id>     (Delete incorrect intake entry)
"""

from datetime import datetime, date, timedelta
from bson import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import water_goals_col, water_intakes_col, serialize_doc, serialize_list


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([JSONParser])
def water_summary_or_log(request):
    """
    GET:  Returns today's water progress, goal, and log entries.
    POST: Logs a new water intake amount (e.g., 250ml, 500ml).
    """
    user_id = request.user_id
    today_str = date.today().isoformat()

    if request.method == 'GET':
        goal_doc = water_goals_col().find_one({'user_id': user_id})
        daily_goal = int(goal_doc.get('daily_goal', 2500)) if goal_doc else 2500

        # Today's entries
        today_entries = list(water_intakes_col().find({
            'user_id': user_id,
            'date': today_str
        }).sort('created_at', -1))

        today_total = sum(int(entry.get('amount', 0)) for entry in today_entries)
        percentage = min(100, round((today_total / daily_goal) * 100)) if daily_goal > 0 else 0

        # Recent 7-day history aggregation
        history_map = {}
        for i in range(7):
            past_d = (date.today() - timedelta(days=i)).isoformat()
            history_map[past_d] = 0

        week_entries = list(water_intakes_col().find({
            'user_id': user_id,
            'date': {'$gte': (date.today() - timedelta(days=6)).isoformat()}
        }))
        for entry in week_entries:
            d_key = entry.get('date', '')
            if d_key in history_map:
                history_map[d_key] += int(entry.get('amount', 0))

        history_list = [{'date': d, 'amount': history_map[d]} for d in sorted(history_map.keys())]

        return Response({
            'success': True,
            'data': {
                'today_total': today_total,
                'daily_goal': daily_goal,
                'percentage': percentage,
                'today_entries': serialize_list(today_entries),
                'history': history_list
            }
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data or {}
        try:
            amount = int(data.get('amount', 0))
        except (ValueError, TypeError):
            return Response({'success': False, 'message': 'Amount must be a positive integer in ml.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'success': False, 'message': 'Water amount must be greater than 0 ml.'}, status=status.HTTP_400_BAD_REQUEST)

        time_val = str(data.get('time', datetime.now().strftime('%H:%M'))).strip()
        date_val = str(data.get('date', today_str)).strip()

        new_entry = {
            'user_id': user_id,
            'amount': amount,
            'date': date_val,
            'time': time_val,
            'created_at': datetime.utcnow()
        }

        res = water_intakes_col().insert_one(new_entry)
        new_entry['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': f'Logged {amount} ml of water.',
            'entry': serialize_doc(new_entry)
        }, status=status.HTTP_201_CREATED)


@api_view(['PUT'])
@jwt_required
@parser_classes([JSONParser])
def update_water_goal(request):
    """
    PUT: Sets custom daily hydration goal (in ml).
    """
    user_id = request.user_id
    data = request.data or {}

    try:
        daily_goal = int(data.get('daily_goal', 0))
    except (ValueError, TypeError):
        return Response({'success': False, 'message': 'Daily goal must be a valid number.'}, status=status.HTTP_400_BAD_REQUEST)

    if daily_goal < 500 or daily_goal > 10000:
        return Response({
            'success': False,
            'message': 'Daily water goal should be between 500 ml and 10,000 ml.'
        }, status=status.HTTP_400_BAD_REQUEST)

    water_goals_col().update_one(
        {'user_id': user_id},
        {'$set': {
            'daily_goal': daily_goal,
            'updated_at': datetime.utcnow()
        }},
        upsert=True
    )

    return Response({
        'success': True,
        'message': f'Daily water goal updated to {daily_goal} ml.',
        'daily_goal': daily_goal
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@jwt_required
def delete_water_entry(request, id):
    """
    DELETE: Removes an erroneous water intake entry.
    """
    user_id = request.user_id
    try:
        entry_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid entry ID.'}, status=status.HTTP_400_BAD_REQUEST)

    res = water_intakes_col().delete_one({'_id': entry_id, 'user_id': user_id})
    if res.deleted_count == 0:
        return Response({'success': False, 'message': 'Water entry not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'success': True,
        'message': 'Water intake entry deleted.'
    }, status=status.HTTP_200_OK)
