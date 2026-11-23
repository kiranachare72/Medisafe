"""
MediSafe - Authentication Utilities: Password Hashing & JWT Validation.
Designed for BSc IT Final-Year Research Project.

Uses bcrypt for secure one-way salted password hashing.
Uses PyJWT for stateless JSON Web Token issuance and verification.
Provides @jwt_required decorator to secure DRF API endpoints.
"""

from functools import wraps
from datetime import datetime, timedelta
import jwt
import bcrypt
from bson import ObjectId
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from common.db import users_col, serialize_doc

# JWT configuration
JWT_SECRET = getattr(settings, 'JWT_SECRET', 'medisafe-jwt-secure-secret-token-key-2026')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7


def hash_password(plain_password: str) -> str:
    """Hashes a plaintext password with a random bcrypt salt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
    return hashed_bytes.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def generate_jwt_token(user_id: str, email: str) -> str:
    """Generates a signed JWT access token for an authenticated user."""
    payload = {
        'user_id': str(user_id),
        'email': email.lower().strip(),
        'exp': datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS),
        'iat': datetime.utcnow(),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    # PyJWT 2.x returns a string
    return token if isinstance(token, str) else token.decode('utf-8')


def decode_jwt_token(token: str):
    """
    Decodes and validates a JWT token.
    Returns payload dict if valid, or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'Token has expired. Please log in again.'}
    except jwt.InvalidTokenError:
        return {'error': 'Invalid authentication token.'}
    except Exception as e:
        return {'error': f'Authentication error: {str(e)}'}


def sanitize_user(user_doc):
    """
    Removes sensitive password hash and formats user document for API responses.
    """
    if not user_doc:
        return None
    data = serialize_doc(user_doc)
    data.pop('password', None)
    return data


def jwt_required(view_func):
    """
    Decorator for DRF API views that enforces JWT authentication.
    Extracts Bearer token from the 'Authorization' header.
    Validates token and binds `request.user_id` and `request.user_data`.
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        # Extract Authorization header
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            return Response({
                'success': False,
                'message': 'Authorization header is missing. Access denied.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return Response({
                'success': False,
                'message': 'Invalid token format. Format must be "Bearer <token>".'
            }, status=status.HTTP_401_UNAUTHORIZED)

        raw_token = parts[1]
        decoded = decode_jwt_token(raw_token)

        if not decoded or 'error' in decoded:
            err_msg = decoded.get('error', 'Invalid or expired token.') if decoded else 'Invalid token.'
            return Response({
                'success': False,
                'message': err_msg
            }, status=status.HTTP_401_UNAUTHORIZED)

        user_id_str = decoded.get('user_id')
        if not user_id_str:
            return Response({
                'success': False,
                'message': 'Token missing user identity.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        try:
            user = users_col().find_one({'_id': ObjectId(user_id_str)})
            if not user:
                return Response({
                    'success': False,
                    'message': 'User associated with this token does not exist.'
                }, status=status.HTTP_401_UNAUTHORIZED)

            # Attach authenticated user info to request
            request.user_id = str(user['_id'])
            request.user_data = user

        except Exception as e:
            return Response({
                'success': False,
                'message': f'Authentication failed: {str(e)}'
            }, status=status.HTTP_401_UNAUTHORIZED)

        return view_func(request, *args, **kwargs)

    return wrapped_view
