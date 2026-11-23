"""
MediSafe - Emergency Contacts & SOS Assistance.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/emergency-contacts          (List emergency contacts)
- POST   /api/emergency-contacts          (Add new emergency contact)
- PUT    /api/emergency-contacts/<id>     (Update contact)
- DELETE /api/emergency-contacts/<id>     (Delete contact)
"""

from datetime import datetime
from bson import ObjectId
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import emergency_contacts_col, serialize_doc, serialize_list


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([JSONParser])
def emergency_contacts_list_create(request):
    """
    GET:  Returns all emergency contacts for user.
    POST: Adds new contact (name, relationship, phone).
    """
    user_id = request.user_id

    if request.method == 'GET':
        contacts = list(emergency_contacts_col().find({'user_id': user_id}).sort('created_at', -1))
        return Response({
            'success': True,
            'count': len(contacts),
            'contacts': serialize_list(contacts)
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data or {}
        name = str(data.get('name', '')).strip()
        relationship = str(data.get('relationship', 'Family')).strip()
        phone = str(data.get('phone', '')).strip()

        if not name or not phone:
            return Response({
                'success': False,
                'message': 'Contact Name and Phone Number are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        new_contact = {
            'user_id': user_id,
            'name': name,
            'relationship': relationship,
            'phone': phone,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        res = emergency_contacts_col().insert_one(new_contact)
        new_contact['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': f'Emergency contact "{name}" added successfully.',
            'contact': serialize_doc(new_contact)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'DELETE'])
@jwt_required
@parser_classes([JSONParser])
def emergency_contact_detail(request, id):
    """
    GET:    Get single emergency contact.
    PUT:    Update contact.
    DELETE: Delete contact.
    """
    user_id = request.user_id

    try:
        c_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid contact ID.'}, status=status.HTTP_400_BAD_REQUEST)

    contact = emergency_contacts_col().find_one({'_id': c_id, 'user_id': user_id})
    if not contact:
        return Response({'success': False, 'message': 'Emergency contact not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'success': True, 'contact': serialize_doc(contact)}, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        data = request.data or {}
        update_fields = {'updated_at': datetime.utcnow()}

        if 'name' in data and str(data['name']).strip():
            update_fields['name'] = str(data['name']).strip()
        if 'relationship' in data:
            update_fields['relationship'] = str(data['relationship']).strip()
        if 'phone' in data and str(data['phone']).strip():
            update_fields['phone'] = str(data['phone']).strip()

        emergency_contacts_col().update_one({'_id': c_id, 'user_id': user_id}, {'$set': update_fields})
        updated = emergency_contacts_col().find_one({'_id': c_id})

        return Response({
            'success': True,
            'message': 'Emergency contact updated successfully.',
            'contact': serialize_doc(updated)
        }, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        emergency_contacts_col().delete_one({'_id': c_id, 'user_id': user_id})
        return Response({
            'success': True,
            'message': 'Emergency contact deleted successfully.'
        }, status=status.HTTP_200_OK)
