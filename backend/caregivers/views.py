"""
MediSafe - Caregiver Invitation & Granular Authorized Access.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/caregivers                    (List caregivers & pending invitations)
- POST   /api/caregivers/invite             (Send invitation with specific permission flags)
- POST   /api/caregivers/accept             (Caregiver accepts invitation using token)
- DELETE /api/caregivers/<id>               (Revoke caregiver access)
- GET    /api/caregivers/patient/<id>       (Caregiver authorized patient view)
"""

import secrets
from datetime import datetime
from bson import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import (
    caregivers_col,
    users_col,
    medicines_col,
    appointments_col,
    water_goals_col,
    water_intakes_col,
    emergency_contacts_col,
    serialize_doc,
    serialize_list
)


@api_view(['GET'])
@jwt_required
def caregivers_list(request):
    """
    GET: Returns all connected caregivers and active invitations issued by the user.
    """
    user_id = request.user_id
    caregivers = list(caregivers_col().find({'user_id': user_id}).sort('created_at', -1))

    return Response({
        'success': True,
        'count': len(caregivers),
        'caregivers': serialize_list(caregivers)
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@jwt_required
@parser_classes([JSONParser])
def invite_caregiver(request):
    """
    POST: Issues a secure token-based invitation to a caregiver with granular permissions.
    """
    user_id = request.user_id
    data = request.data or {}

    email = str(data.get('caregiver_email', '')).strip().lower()
    name = str(data.get('caregiver_name', '')).strip()
    relationship = str(data.get('relationship', 'Family Caregiver')).strip()

    if not email:
        return Response({'success': False, 'message': 'Caregiver email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if email == request.user_data.get('email', '').lower():
        return Response({'success': False, 'message': 'You cannot invite yourself as a caregiver.'}, status=status.HTTP_400_BAD_REQUEST)

    # Granular permissions: Medicines, Appointments, Water, Emergency (Medical records false by default)
    permissions = {
        'medicines': bool(data.get('perm_medicines', True)),
        'appointments': bool(data.get('perm_appointments', True)),
        'water': bool(data.get('perm_water', True)),
        'emergency': bool(data.get('perm_emergency', True)),
        'records': bool(data.get('perm_records', False))  # False by default for privacy
    }

    # Generate secure random token
    invite_token = secrets.token_urlsafe(32)

    new_invite = {
        'user_id': user_id,
        'patient_name': request.user_data.get('name', 'Patient'),
        'patient_email': request.user_data.get('email', ''),
        'caregiver_name': name or email.split('@')[0],
        'caregiver_email': email,
        'relationship': relationship,
        'invitation_token': invite_token,
        'permissions': permissions,
        'status': 'pending',  # 'pending', 'accepted', 'revoked'
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }

    res = caregivers_col().insert_one(new_invite)
    new_invite['_id'] = res.inserted_id

    return Response({
        'success': True,
        'message': f'Invitation generated for {email}.',
        'invitation_token': invite_token,
        'caregiver': serialize_doc(new_invite)
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@jwt_required
@parser_classes([JSONParser])
def accept_caregiver_invitation(request):
    """
    POST: Caregiver accepts an invitation using the unique secure token.
    """
    caregiver_user_id = request.user_id
    caregiver_email = request.user_data.get('email', '').lower()
    data = request.data or {}

    token = str(data.get('token', '')).strip()
    if not token:
        return Response({'success': False, 'message': 'Invitation token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    invite = caregivers_col().find_one({'invitation_token': token, 'status': 'pending'})
    if not invite:
        return Response({'success': False, 'message': 'Invalid, expired, or already accepted invitation token.'}, status=status.HTTP_404_NOT_FOUND)

    # Link caregiver account
    caregivers_col().update_one(
        {'_id': invite['_id']},
        {'$set': {
            'caregiver_user_id': caregiver_user_id,
            'status': 'accepted',
            'accepted_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }}
    )

    return Response({
        'success': True,
        'message': f'You are now connected as a caregiver for {invite.get("patient_name")}.'
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@jwt_required
def revoke_caregiver(request, id):
    """
    DELETE: Revokes caregiver connection or cancels a pending invitation.
    """
    user_id = request.user_id

    try:
        c_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid caregiver ID.'}, status=status.HTTP_400_BAD_REQUEST)

    res = caregivers_col().delete_one({'_id': c_id, 'user_id': user_id})
    if res.deleted_count == 0:
        return Response({'success': False, 'message': 'Caregiver record not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'success': True,
        'message': 'Caregiver access revoked successfully.'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@jwt_required
def caregiver_patient_view(request, id):
    """
    GET: Caregiver view of authorized patient data.
         Strictly enforces backend permissions!
    """
    caregiver_user_id = request.user_id

    try:
        c_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid ID.'}, status=status.HTTP_400_BAD_REQUEST)

    # Verify authorization
    relation = caregivers_col().find_one({
        '_id': c_id,
        'caregiver_user_id': caregiver_user_id,
        'status': 'accepted'
    })

    if not relation:
        return Response({'success': False, 'message': 'Unauthorized. No active caregiver relationship found.'}, status=status.HTTP_403_FORBIDDEN)

    patient_id = relation['user_id']
    perms = relation.get('permissions', {})
    patient = users_col().find_one({'_id': ObjectId(patient_id)})

    patient_data = {
        'patient_name': patient.get('name') if patient else 'Patient',
        'relationship': relation.get('relationship')
    }

    # Medicines authorized?
    if perms.get('medicines'):
        patient_data['medicines'] = serialize_list(medicines_col().find({'user_id': patient_id, 'status': 'active'}))

    # Appointments authorized?
    if perms.get('appointments'):
        patient_data['appointments'] = serialize_list(appointments_col().find({'user_id': patient_id}))

    # Water progress authorized?
    if perms.get('water'):
        goal_doc = water_goals_col().find_one({'user_id': patient_id})
        daily_goal = goal_doc.get('daily_goal', 2500) if goal_doc else 2500
        from datetime import date
        today_intakes = list(water_intakes_col().find({'user_id': patient_id, 'date': date.today().isoformat()}))
        total_water = sum(int(x.get('amount', 0)) for x in today_intakes)
        patient_data['water'] = {
            'daily_goal': daily_goal,
            'today_total': total_water,
            'percentage': min(100, round((total_water / daily_goal) * 100)) if daily_goal > 0 else 0
        }

    # Emergency contacts authorized?
    if perms.get('emergency'):
        patient_data['emergency_contacts'] = serialize_list(emergency_contacts_col().find({'user_id': patient_id}))

    return Response({
        'success': True,
        'patient_data': patient_data
    }, status=status.HTTP_200_OK)
