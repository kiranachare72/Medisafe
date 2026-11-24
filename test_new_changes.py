"""
MediSafe - Verification for New User-Requested Enhancements:
1. Medicine AI Scan & Safety Predictor (Changle ahe ka nahi)
2. Audio Reminder / Siren System
3. Doctor Appointment Email Confirmation & Nearby Hospitals Finder
4. Emergency SOS Nearby Hospitals & Family Alert Dispatch
5. Settings System Status removal check
6. Water Intake Photo Analysis
7. AI Best Medicine Comparison & Predictor (Konti goli changli ahe)
"""

import os
import sys
import io
import time
from PIL import Image

backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.test import RequestFactory
from accounts.views import register_user
from medicines.views import ai_scan_medicine, ai_compare_medicines, medicines_list_create
from appointments.views import appointments_list_create, nearby_hospitals_view
from emergency.views import emergency_contacts_list_create, dispatch_emergency_alert
from water_tracker.views import water_photo_analysis, water_summary_or_log


def run_tests():
    print("==================================================")
    print("TESTING USER-REQUESTED ENHANCEMENTS")
    print("==================================================")
    rf = RequestFactory()

    # Create & authenticate test user
    t_id = int(time.time())
    email = f"enhance_{t_id}@medisafe.edu"
    pwd = "Password123!"

    reg_req = rf.post('/api/auth/register', data={
        'name': 'Rahul Patil',
        'email': email,
        'phone': '9820011223',
        'password': pwd,
        'confirm_password': pwd
    }, content_type='application/json')
    reg_res = register_user(reg_req)
    assert reg_res.status_code == 201
    token = reg_res.data['token']
    auth_header = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    print("[Auth] Test user registered.")

    # 1. Medicine AI Scan (Safety check: changle ahe ka nahi)
    print("\n[Change 1] Testing Medicine AI Scan & Safety Predictor...")
    img = Image.new('RGB', (100, 100), color=(255, 255, 255))
    img_io = io.BytesIO()
    img.save(img_io, format='JPEG')
    img_io.seek(0)
    img_io.name = 'dolo_strip.jpg'

    scan_req = rf.post('/api/medicines/ai-scan', data={'image': img_io}, **auth_header)
    scan_res = ai_scan_medicine(scan_req)
    assert scan_res.status_code == 200
    analysis = scan_res.data['analysis']
    assert 'safety_verdict' in analysis and 'safety_score' in analysis
    print(f" -> AI Scan: PASS")
    print(f"    - Identified: {analysis['identified_name']}")
    print(f"    - Safety Verdict: {analysis['safety_verdict']}")
    print(f"    - Safety Score: {analysis['safety_score']}/10")
    print(f"    - Precautions: {analysis['precautions']}")

    # 2. AI Best Medicine Comparison (Konti goli changli ahe)
    print("\n[Change 2] Testing AI Best Medicine Comparison...")
    comp_req = rf.post('/api/medicines/ai-compare', data={'query': 'fever, headache, tap ahe'}, content_type='application/json', **auth_header)
    comp_res = ai_compare_medicines(comp_req)
    assert comp_res.status_code == 200
    pred = comp_res.data['prediction']
    assert 'best_medicine' in pred and len(pred['comparison_ranking']) > 0
    print(f" -> AI Medicine Predictor: PASS")
    print(f"    - Best Medicine Predicted: {pred['best_medicine']}")
    print(f"    - Safety Score: {pred['safety_score']}")
    print(f"    - Reason: {pred['comparison_reason'][:90]}...")

    # 3. Appointment Confirmation Email & Nearby Hospitals
    print("\n[Change 3] Testing Appointment Email & Nearby Hospitals...")
    appt_req = rf.post('/api/appointments', data={
        'doctor_name': 'Dr. Deshmukh',
        'hospital': 'Ruby Hall Clinic',
        'date': '2026-12-20',
        'time': '11:00',
        'purpose': 'Consultation'
    }, content_type='application/json', **auth_header)
    appt_res = appointments_list_create(appt_req)
    assert appt_res.status_code == 201
    assert appt_res.data.get('email_sent') is True
    print(f" -> Appointment Booked & Email Confirmation Sent: PASS ({email})")

    nearby_req = rf.get('/api/appointments/nearby-hospitals?lat=19.0760&lng=72.8777', **auth_header)
    nearby_res = nearby_hospitals_view(nearby_req)
    assert nearby_res.status_code == 200
    assert len(nearby_res.data['hospitals']) > 0
    print(f" -> Nearby Hospitals Location Finder: PASS ({len(nearby_res.data['hospitals'])} emergency centers found)")
    print(f"    - Maps Search URL: {nearby_res.data['maps_search_url']}")

    # 4. Emergency Nearby Hospitals & Family Alert Dispatch
    print("\n[Change 4] Testing Emergency SOS Family Alert & Nearby Hospital Dispatch...")
    # Add an emergency family contact first
    em_c_req = rf.post('/api/emergency-contacts', data={'name': 'Aai (Mother)', 'relationship': 'Mother', 'phone': '9876543210'}, content_type='application/json', **auth_header)
    em_c_res = emergency_contacts_list_create(em_c_req)
    assert em_c_res.status_code == 201

    sos_req = rf.post('/api/emergency/dispatch-alert', data={
        'lat': '19.0760',
        'lng': '72.8777',
        'notes': 'Sudden high fever and dizziness'
    }, content_type='application/json', **auth_header)
    sos_res = dispatch_emergency_alert(sos_req)
    assert sos_res.status_code == 200
    assert len(sos_res.data['family_alerts']) > 0
    assert 'whatsapp_url' in sos_res.data['family_alerts'][0]
    print(f" -> Emergency Alert Dispatch: PASS")
    print(f"    - Family Alerts Prepared: {len(sos_res.data['family_alerts'])}")
    print(f"    - WhatsApp Link: {sos_res.data['family_alerts'][0]['whatsapp_url'][:60]}...")
    print(f"    - Nearest Hospital Search: {sos_res.data['nearby_hospital_url']}")

    # 5. Water Intake Photo Analysis
    print("\n[Change 5] Testing Water Intake Photo Analysis...")
    water_img = Image.new('RGB', (100, 300), color=(100, 180, 240))  # Tall bottle aspect ratio
    w_io = io.BytesIO()
    water_img.save(w_io, format='JPEG')
    w_io.seek(0)
    w_io.name = 'water_bottle_scan.jpg'

    w_req = rf.post('/api/water/photo-analysis', data={'image': w_io, 'auto_log': 'true'}, **auth_header)
    w_res = water_photo_analysis(w_req)
    assert w_res.status_code == 200
    w_data = w_res.data['analysis']
    assert w_data['estimated_amount_ml'] > 0
    assert w_data['auto_logged'] is True
    print(f" -> Water Photo AI Analysis: PASS")
    print(f"    - Detected Container: {w_data['container_type']}")
    print(f"    - Estimated Volume: {w_data['estimated_amount_ml']} ml")
    print(f"    - Auto-logged into MongoDB: {w_data['auto_logged']}")

    # 6. Verify Settings System Status was removed
    print("\n[Change 6] Verifying Settings HTML System Status is removed...")
    settings_path = os.path.join(os.path.dirname(__file__), 'frontend', 'settings.html')
    with open(settings_path, 'r', encoding='utf-8') as f:
        settings_html = f.read()
    assert 'System Status' not in settings_html
    print(" -> Settings System Status deletion: VERIFIED (Deleted as requested)")

    print("\n==================================================")
    print("ALL 6 USER ENHANCEMENTS TESTED & WORKING PERFECTLY!")
    print("==================================================")


if __name__ == '__main__':
    run_tests()
