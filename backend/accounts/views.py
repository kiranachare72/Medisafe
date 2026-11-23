"""
MediSafe - Accounts Views: Authentication & User Profile.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- GET  /api/profile
- PUT  /api/profile
- POST /api/profile/photo
"""

import os
import re
import time
import uuid
from datetime import datetime
from bson import ObjectId
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from common.db import users_col, water_goals_col, serialize_doc
from common.auth import (
    hash_password,
    verify_password,
    generate_jwt_token,
    jwt_required,
    sanitize_user
)

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')


@api_view(['POST'])
@parser_classes([JSONParser])
def register_user(request):
    """
    Registers a new user into MongoDB 'users' collection.
    Validates required fields, email format, and password confirmation.
    Hashes password using bcrypt.
    """
    data = request.data or {}
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    phone = str(data.get('phone', '')).strip()
    password = str(data.get('password', ''))
    confirm_password = str(data.get('confirm_password', ''))

    # Validation
    if not name or not email or not phone or not password or not confirm_password:
        return Response({
            'success': False,
            'message': 'Please fill all required fields.'
        }, status=status.HTTP_400_BAD_REQUEST)

    if not EMAIL_REGEX.match(email):
        return Response({
            'success': False,
            'message': 'Please provide a valid email address.'
        }, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 6:
        return Response({
            'success': False,
            'message': 'Password must be at least 6 characters long.'
        }, status=status.HTTP_400_BAD_REQUEST)

    if password != confirm_password:
        return Response({
            'success': False,
            'message': 'Passwords do not match.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check for existing email
    col = users_col()
    existing = col.find_one({'email': email})
    if existing:
        return Response({
            'success': False,
            'message': 'An account with this email address already exists.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Hash password securely
    hashed_pw = hash_password(password)

    new_user = {
        'name': name,
        'email': email,
        'phone': phone,
        'password': hashed_pw,
        'age': None,
        'gender': '',
        'blood_group': '',
        'height': None,
        'weight': None,
        'profile_photo': '',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }

    insert_result = col.insert_one(new_user)
    user_id = str(insert_result.inserted_id)
    new_user['_id'] = insert_result.inserted_id

    # Create default water goal (2500 ml) for the new user
    water_goals_col().update_one(
        {'user_id': user_id},
        {'$setOnInsert': {
            'user_id': user_id,
            'daily_goal': 2500,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }},
        upsert=True
    )

    # Generate JWT access token
    token = generate_jwt_token(user_id, email)

    return Response({
        'success': True,
        'message': 'Registration successful. Welcome to MediSafe!',
        'token': token,
        'user': sanitize_user(new_user)
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@parser_classes([JSONParser])
def login_user(request):
    """
    Authenticates a user via email and password.
    Returns a JWT access token upon successful verification.
    """
    data = request.data or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not email or not password:
        return Response({
            'success': False,
            'message': 'Please provide both email and password.'
        }, status=status.HTTP_400_BAD_REQUEST)

    col = users_col()
    user = col.find_one({'email': email})

    if not user:
        return Response({
            'success': False,
            'message': 'Invalid email or password.'
        }, status=status.HTTP_401_UNAUTHORIZED)

    # Verify bcrypt password
    if not verify_password(password, user.get('password', '')):
        return Response({
            'success': False,
            'message': 'Invalid email or password.'
        }, status=status.HTTP_401_UNAUTHORIZED)

    user_id = str(user['_id'])
    token = generate_jwt_token(user_id, user['email'])

    return Response({
        'success': True,
        'message': 'Login successful.',
        'token': token,
        'user': sanitize_user(user)
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def logout_user(request):
    """
    Logs out the user. With stateless JWT, client deletes stored token.
    """
    return Response({
        'success': True,
        'message': 'Logged out successfully.'
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@jwt_required
def get_current_user(request):
    """
    Returns the currently authenticated user's profile details.
    """
    return Response({
        'success': True,
        'user': sanitize_user(request.user_data)
    }, status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@jwt_required
@parser_classes([JSONParser])
def profile_view_or_update(request):
    """
    GET: Retrieves the user's complete health profile.
    PUT: Updates editable profile fields (name, phone, age, gender, blood group, height, weight).
    """
    user_id = request.user_id
    col = users_col()

    if request.method == 'GET':
        user = col.find_one({'_id': ObjectId(user_id)})
        if not user:
            return Response({'success': False, 'message': 'User profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'success': True,
            'profile': sanitize_user(user)
        }, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        data = request.data or {}
        update_fields = {'updated_at': datetime.utcnow()}

        if 'name' in data and str(data['name']).strip():
            update_fields['name'] = str(data['name']).strip()
        if 'phone' in data:
            update_fields['phone'] = str(data['phone']).strip()
        if 'gender' in data:
            update_fields['gender'] = str(data['gender']).strip()
        if 'blood_group' in data:
            update_fields['blood_group'] = str(data['blood_group']).strip().upper()

        # Numeric fields: Age, Height, Weight
        if 'age' in data:
            try:
                update_fields['age'] = int(data['age']) if data['age'] not in (None, '') else None
            except (ValueError, TypeError):
                return Response({'success': False, 'message': 'Age must be a valid integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if 'height' in data:
            try:
                update_fields['height'] = float(data['height']) if data['height'] not in (None, '') else None
            except (ValueError, TypeError):
                return Response({'success': False, 'message': 'Height must be a valid number (in cm).'}, status=status.HTTP_400_BAD_REQUEST)

        if 'weight' in data:
            try:
                update_fields['weight'] = float(data['weight']) if data['weight'] not in (None, '') else None
            except (ValueError, TypeError):
                return Response({'success': False, 'message': 'Weight must be a valid number (in kg).'}, status=status.HTTP_400_BAD_REQUEST)

        col.update_one({'_id': ObjectId(user_id)}, {'$set': update_fields})
        updated_user = col.find_one({'_id': ObjectId(user_id)})

        return Response({
            'success': True,
            'message': 'Profile updated successfully.',
            'profile': sanitize_user(updated_user)
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@jwt_required
@parser_classes([MultiPartParser, FormParser])
def upload_profile_photo(request):
    """
    Handles profile photo upload.
    Validates file format (.jpg, .jpeg, .png, .webp) and size (< 5MB).
    Saves file to backend/uploads/profiles/ with a unique randomized name.
    Updates profile_photo in MongoDB.
    """
    user_id = request.user_id
    if 'photo' not in request.FILES:
        return Response({
            'success': False,
            'message': 'No photo file provided in request.'
        }, status=status.HTTP_400_BAD_REQUEST)

    photo_file = request.FILES['photo']
    if not photo_file.name:
        return Response({
            'success': False,
            'message': 'Empty filename.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Size limit (5 MB)
    if photo_file.size > 5 * 1024 * 1024:
        return Response({
            'success': False,
            'message': 'Image file exceeds maximum allowed size of 5 MB.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Extension validation
    ext = os.path.splitext(photo_file.name)[1].lower()
    allowed_exts = ['.jpg', '.jpeg', '.png', '.webp']
    if ext not in allowed_exts:
        return Response({
            'success': False,
            'message': f'Invalid file format. Allowed formats: {", ".join(allowed_exts)}'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Generate safe random filename
    unique_filename = f"profile_{user_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    upload_dir = os.path.join(settings.MEDIA_ROOT, 'profiles')
    os.makedirs(upload_dir, exist_ok=True)
    destination_path = os.path.join(upload_dir, unique_filename)

    # Write file safely
    try:
        with open(destination_path, 'wb+') as destination:
            for chunk in photo_file.chunks():
                destination.write(chunk)
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Failed to write profile image: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    photo_url = f"/uploads/profiles/{unique_filename}"

    # Update in MongoDB
    users_col().update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'profile_photo': photo_url,
            'updated_at': datetime.utcnow()
        }}
    )

    return Response({
        'success': True,
        'message': 'Profile photo uploaded successfully.',
        'profile_photo': photo_url
    }, status=status.HTTP_200_OK)
