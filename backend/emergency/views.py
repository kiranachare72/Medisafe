"""
MediSafe - Emergency Contacts & SOS Assistance.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/emergency-contacts          (List emergency contacts)
- POST   /api/emergency-contacts          (Add new emergency contact)
- PUT    /api/emergency-contacts/<id>     (Update contact)
- DELETE /api/emergency-contacts/<id>     (Delete contact)
"""

import re
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


import urllib.parse
from common.db import get_collection

@api_view(['POST'])
@jwt_required
@parser_classes([JSONParser])
def dispatch_emergency_alert(request):
    """
    POST: Dispatches instant emergency SOS alert.
    - Generates emergency alert notifications with GPS coordinates.
    - Creates 1-click WhatsApp and SMS alerts for each saved family contact.
    - Generates nearby emergency hospital links.
    - Persists incident log in MongoDB.
    """
    user_id = request.user_id
    user_name = request.user_data.get('name', 'Patient')
    user_phone = request.user_data.get('phone', '')
    user_email = request.user_data.get('email', '')

    data = request.data or {}
    lat = data.get('lat')
    lng = data.get('lng')
    notes = str(data.get('notes', 'I need immediate medical assistance!')).strip()

    if lat and lng:
        maps_link = f"https://www.google.com/maps?q={lat},{lng}"
        hospital_search_url = f"https://www.google.com/maps/search/emergency+hospital+near+me/@{lat},{lng},14z"
    else:
        maps_link = "https://www.google.com/maps"
        hospital_search_url = "https://www.google.com/maps/search/emergency+hospital+near+me"

    # Fetch family emergency contacts
    contacts = list(emergency_contacts_col().find({'user_id': user_id}))

    dispatched_family = []
    for c in contacts:
        raw_phone = re.sub(r'[^0-9+]', '', c.get('phone', ''))
        # Prepare emergency message text
        alert_msg = (
            f"🚨 EMERGENCY SOS ALERT from {user_name}!\n"
            f"I need urgent medical help!\n"
            f"Note: {notes}\n"
            f"Current Location: {maps_link}\n"
            f"Time: {datetime.utcnow().strftime('%H:%M UTC, %d %b %Y')}"
        )
        encoded_msg = urllib.parse.quote(alert_msg)

        # International format for WhatsApp
        wa_phone = raw_phone.lstrip('+')
        if len(wa_phone) == 10 and not wa_phone.startswith('91'):
            wa_phone = f"91{wa_phone}"

        dispatched_family.append({
            'contact_id': str(c['_id']),
            'name': c.get('name'),
            'relationship': c.get('relationship'),
            'phone': c.get('phone'),
            'whatsapp_url': f"https://api.whatsapp.com/send?phone={wa_phone}&text={encoded_msg}",
            'sms_url': f"sms:{raw_phone}?body={encoded_msg}"
        })

    # Send emergency email notification
    email_sent = False
    if user_email:
        subject = f"🚨 URGENT: Emergency SOS Triggered for {user_name}!"
        body = f"""EMERGENCY ALERT BROADCAST
------------------------------------------------
Patient Name: {user_name}
Registered Phone: {user_phone}
Incident Time: {datetime.utcnow().isoformat()}

LOCATION DETAILS:
Google Maps Link: {maps_link}
Nearest Emergency Hospitals: {hospital_search_url}

EMERGENCY CONTACTS ALERTED: {len(dispatched_family)} contact(s)
{', '.join([c['name'] + ' (' + c['phone'] + ')' for c in dispatched_family]) if dispatched_family else 'None configured'}

MESSAGE:
{notes}

Please contact the patient or nearest emergency medical services immediately!
"""
        try:
            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=body,
                from_email='sos@medisafe.healthcare',
                recipient_list=[user_email],
                fail_silently=True
            )
            email_sent = True
        except Exception as e:
            print(f"[SOS Email Notice] {e}")

    # Record event in MongoDB 'emergency_events'
    try:
        get_collection('emergency_events').insert_one({
            'user_id': user_id,
            'user_name': user_name,
            'lat': lat,
            'lng': lng,
            'maps_link': maps_link,
            'notes': notes,
            'contacts_alerted': len(dispatched_family),
            'email_sent': email_sent,
            'timestamp': datetime.utcnow()
        })
    except Exception:
        pass

    return Response({
        'success': True,
        'message': f'SOS broadcast ready! Location captured, {len(dispatched_family)} family alerts prepared, and nearby hospitals identified.',
        'location': {
            'lat': lat,
            'lng': lng,
            'maps_link': maps_link,
            'hospital_search_url': hospital_search_url
        },
        'family_alerts': dispatched_family,
        'nearby_hospital_url': hospital_search_url,
        'email_sent': email_sent
    }, status=status.HTTP_200_OK)

