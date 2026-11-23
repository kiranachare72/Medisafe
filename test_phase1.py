"""
MediSafe - Phase 1 Comprehensive Verification Test Suite
Tests:
1. MongoDB Atlas connectivity via PyMongo
2. Registration endpoint (validation, bcrypt hashing, duplicate checks)
3. Login endpoint (invalid credentials, valid credentials, JWT issuance)
4. Protected API endpoints with JWT verification
5. User Profile retrieval and update (MongoDB persistence check)
6. Profile photo upload (file handling, storage, MongoDB update)
7. Dashboard endpoint (real-time data aggregation, empty states)
"""

import os
import sys
import io
import time
from datetime import datetime
from PIL import Image

# Setup Django environment
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.test import RequestFactory
from accounts.views import (
    register_user,
    login_user,
    get_current_user,
    profile_view_or_update,
    upload_profile_photo
)
from dashboard.views import get_dashboard_data
from common.db import get_database, users_col, water_goals_col
from bson import ObjectId


def run_tests():
    print("==================================================")
    print("RUNNING MEDISAFE PHASE 1 VERIFICATION TESTS")
    print("==================================================")
    rf = RequestFactory()

    # 1. MongoDB Connection Test
    print("\n[Test 1] Testing MongoDB Atlas Connection via PyMongo...")
    db = get_database()
    assert db is not None, "Failed: Could not connect to MongoDB Atlas."
    ping_res = db.command('ping')
    print(f" -> MongoDB Atlas Ping OK: {ping_res}")
    print(f" -> Active Database: {db.name}")

    # Generate unique test user email
    test_timestamp = int(time.time())
    test_email = f"bsc_student_{test_timestamp}@medisafe.edu"
    test_password = "SecurePassword123!"

    # 2. Registration Tests
    print("\n[Test 2] Testing User Registration...")
    
    # 2a. Missing fields validation
    req_missing = rf.post('/api/auth/register', data={'email': test_email}, content_type='application/json')
    res_missing = register_user(req_missing)
    assert res_missing.status_code == 400, f"Expected 400 for missing fields, got {res_missing.status_code}"
    print(f" -> Missing fields validation: PASS (Status {res_missing.status_code}, '{res_missing.data['message']}')")

    # 2b. Password mismatch validation
    req_mismatch = rf.post('/api/auth/register', data={
        'name': 'Test Student',
        'email': test_email,
        'phone': '9876543210',
        'password': test_password,
        'confirm_password': 'DifferentPassword'
    }, content_type='application/json')
    res_mismatch = register_user(req_mismatch)
    assert res_mismatch.status_code == 400, f"Expected 400 for password mismatch, got {res_mismatch.status_code}"
    print(f" -> Password mismatch validation: PASS (Status {res_mismatch.status_code}, '{res_mismatch.data['message']}')")

    # 2c. Successful registration
    req_valid = rf.post('/api/auth/register', data={
        'name': 'BSc IT Researcher',
        'email': test_email,
        'phone': '+91 9123456789',
        'password': test_password,
        'confirm_password': test_password
    }, content_type='application/json')
    res_valid = register_user(req_valid)
    assert res_valid.status_code == 201, f"Expected 201, got {res_valid.status_code}"
    assert 'token' in res_valid.data, "JWT token missing from response"
    token = res_valid.data['token']
    user_id = res_valid.data['user']['id']
    print(f" -> User Registration: PASS (User ID: {user_id}, Token generated)")

    # Verify MongoDB persistence & bcrypt hashing
    mongo_user = users_col().find_one({'_id': ObjectId(user_id)})
    assert mongo_user is not None, "User not found in MongoDB users collection!"
    assert mongo_user['password'] != test_password, "Plain-text password stored! Must be hashed."
    assert mongo_user['password'].startswith('$2b$'), "Password is not a valid bcrypt hash!"
    print(" -> MongoDB Atlas Persistence & Bcrypt Hash: VERIFIED")

    # Verify default water goal was created
    w_goal = water_goals_col().find_one({'user_id': user_id})
    assert w_goal is not None and w_goal['daily_goal'] == 2500, "Default water goal not initialized in MongoDB!"
    print(" -> Default Water Goal Initialized: VERIFIED (2500 ml)")

    # 2d. Duplicate email check
    res_dup = register_user(req_valid)
    assert res_dup.status_code == 400, f"Expected 400 for duplicate email, got {res_dup.status_code}"
    print(f" -> Duplicate email prevention: PASS (Status {res_dup.status_code}, '{res_dup.data['message']}')")

    # 3. Login Tests
    print("\n[Test 3] Testing User Login...")
    # 3a. Incorrect password
    req_bad_pw = rf.post('/api/auth/login', data={'email': test_email, 'password': 'WrongPassword!'}, content_type='application/json')
    res_bad_pw = login_user(req_bad_pw)
    assert res_bad_pw.status_code == 401, f"Expected 401 for bad password, got {res_bad_pw.status_code}"
    print(f" -> Bad password rejection: PASS (Status {res_bad_pw.status_code}, '{res_bad_pw.data['message']}')")

    # 3b. Valid login
    req_login = rf.post('/api/auth/login', data={'email': test_email, 'password': test_password}, content_type='application/json')
    res_login = login_user(req_login)
    assert res_login.status_code == 200, f"Expected 200 for valid login, got {res_login.status_code}"
    assert 'token' in res_login.data, "Token missing in login response"
    login_token = res_login.data['token']
    print(f" -> Valid User Login: PASS (JWT Token issued)")

    # 4. Protected Endpoints & JWT Verification
    print("\n[Test 4] Testing JWT Protected Endpoints...")
    # 4a. Request without token
    req_unauth = rf.get('/api/auth/me')
    res_unauth = get_current_user(req_unauth)
    assert res_unauth.status_code == 401, f"Expected 401 without token, got {res_unauth.status_code}"
    print(f" -> Unauthorized access block: PASS (Status {res_unauth.status_code})")

    # 4b. Request with valid token
    req_auth = rf.get('/api/auth/me', HTTP_AUTHORIZATION=f'Bearer {login_token}')
    res_auth = get_current_user(req_auth)
    assert res_auth.status_code == 200, f"Expected 200 with valid token, got {res_auth.status_code}"
    assert res_auth.data['user']['email'] == test_email, "Returned user email does not match"
    print(f" -> Authorized /api/auth/me: PASS (User: {res_auth.data['user']['name']})")

    # 5. Profile Update Test
    print("\n[Test 5] Testing Profile GET and PUT...")
    # 5a. Profile GET
    req_prof_get = rf.get('/api/profile', HTTP_AUTHORIZATION=f'Bearer {login_token}')
    res_prof_get = profile_view_or_update(req_prof_get)
    assert res_prof_get.status_code == 200
    print(f" -> Profile GET: PASS")

    # 5b. Profile PUT
    update_data = {
        'name': 'BSc IT Researcher (Updated)',
        'phone': '+91 9988776655',
        'age': 23,
        'gender': 'Female',
        'blood_group': 'B+',
        'height': 165.0,
        'weight': 58.5
    }
    req_prof_put = rf.put('/api/profile', data=update_data, content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {login_token}')
    res_prof_put = profile_view_or_update(req_prof_put)
    assert res_prof_put.status_code == 200, f"Expected 200 for profile update, got {res_prof_put.status_code}"
    updated_p = res_prof_put.data['profile']
    assert updated_p['age'] == 23 and updated_p['blood_group'] == 'B+', "Profile data mismatch in response"

    # Verify directly in MongoDB Atlas
    check_mongo = users_col().find_one({'_id': ObjectId(user_id)})
    assert check_mongo['age'] == 23 and check_mongo['blood_group'] == 'B+' and check_mongo['height'] == 165.0
    print(f" -> Profile PUT: PASS & Verified in MongoDB Atlas")

    # 6. Profile Photo Upload Test
    print("\n[Test 6] Testing Profile Photo Upload...")
    # Generate test image in memory
    img = Image.new('RGB', (100, 100), color=(30, 86, 160))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_byte_arr.seek(0)
    img_byte_arr.name = 'avatar.jpg'

    req_photo = rf.post('/api/profile/photo', data={'photo': img_byte_arr}, HTTP_AUTHORIZATION=f'Bearer {login_token}')
    res_photo = upload_profile_photo(req_photo)
    assert res_photo.status_code == 200, f"Expected 200 for photo upload, got {res_photo.status_code}"
    photo_url = res_photo.data['profile_photo']
    print(f" -> Profile Photo Upload: PASS (Photo URL: {photo_url})")

    # Verify MongoDB record updated with photo URL
    check_photo_mongo = users_col().find_one({'_id': ObjectId(user_id)})
    assert check_photo_mongo['profile_photo'] == photo_url, "MongoDB not updated with profile_photo URL"
    print(" -> MongoDB Profile Photo Path: VERIFIED")

    # 7. Dashboard API Test
    print("\n[Test 7] Testing Dashboard Data Aggregation...")
    req_dash = rf.get('/api/dashboard', HTTP_AUTHORIZATION=f'Bearer {login_token}')
    res_dash = get_dashboard_data(req_dash)
    assert res_dash.status_code == 200, f"Expected 200 for dashboard, got {res_dash.status_code}"
    d = res_dash.data['data']

    assert 'medicines' in d and 'total_active' in d['medicines']
    assert 'water' in d and d['water']['daily_goal'] == 2500
    assert 'appointments' in d
    assert 'records' in d
    assert 'emergency' in d
    print(f" -> Dashboard Aggregation: PASS")
    print(f"    - User: {d['user']['name']}")
    print(f"    - Total Active Medicines: {d['medicines']['total_active']}")
    print(f"    - Today's Taken Medicines: {d['medicines']['taken_today']}")
    print(f"    - Daily Water Goal: {d['water']['daily_goal']} ml")
    print(f"    - Next Appointment: {d['appointments']['next_appointment']}")

    print("\n==================================================")
    print("ALL PHASE 1 TESTS PASSED SUCCESSFULLY! (7/7)")
    print("==================================================")


if __name__ == '__main__':
    run_tests()
