import requests
import json
import io
import time

BASE_URL = "http://127.0.0.1:8000/api"

# 1. Register fresh test user
email = f"report_test_{int(time.time())}@medisafe.edu"
reg_res = requests.post(f"{BASE_URL}/auth/register", json={
    "name": "Demo User",
    "email": email,
    "phone": "9876543210",
    "password": "Password@123",
    "confirm_password": "Password@123"
})
assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
token = reg_res.json().get('token')
headers = {"Authorization": f"Bearer {token}"}

print(f"Authenticated as {email}. Testing Medical Records AI Points...")

# Test 1: Blood Document Upload
blood_file = io.BytesIO(b"Sample Blood CBC Report: Hemoglobin 14.5, WBC 7100, Platelets 270000. All normal.")
blood_file.name = "blood_report.pdf"

res_blood = requests.post(
    f"{BASE_URL}/records",
    headers=headers,
    data={"file_type": "Complete Blood Count (CBC) / Blood Test", "description": "Routine Annual Blood Checkup"},
    files={"file": ("blood_report.pdf", blood_file, "application/pdf")}
)
print("Blood Report Upload Status:", res_blood.status_code)
blood_data = res_blood.json()
assert res_blood.status_code == 201
assert blood_data['success'] is True
ai_b = blood_data['ai_analysis']
print("Blood Status Verdict:", ai_b['status_verdict'])
print("Blood Health Score:", ai_b['health_score'])
print("Blood Points Count:", len(ai_b.get('points', [])))
for pt in ai_b.get('points', []):
    print(" - Blood Point:", pt)
assert len(ai_b.get('points', [])) >= 4
assert "ACHA HAI" in ai_b['status_verdict']
assert 'report_contents' in ai_b
assert 'scanned_text' in ai_b and len(ai_b['scanned_text']) > 20
assert 'kya_hua_tha' in ai_b and len(ai_b['kya_hua_tha']) > 15
print("Blood Kya Hua Tha:", ai_b['kya_hua_tha'])
print("Blood Scanned Text Length:", len(ai_b['scanned_text']))
print("Blood Detected Report Title:", ai_b['report_contents']['title'])
print("Blood Detected Items Count:", len(ai_b['report_contents']['detected_items']))
assert len(ai_b['report_contents']['detected_items']) >= 3
for itm in ai_b['report_contents']['detected_items']:
    print(f"   [Report Me Kya Hai]: {itm['icon']} {itm['label']} -> {itm['detail']}")

assert 'prescription_of_report' in ai_b
rx_b = ai_b['prescription_of_report']
assert len(rx_b['medicines']) >= 1
print("Blood Prescribed Medicines Count:", len(rx_b['medicines']))
for med in rx_b['medicines']:
    print(f"   [Rx Medicine]: 💊 {med['name']} - {med['dosage']} ({med['frequency']}) - {med['timing']} -> {med['purpose']}")
print("Blood Doctor Advice:", rx_b['doctor_advice'])

# Test 2: X-Ray / Radiology Scan Upload
xray_file = io.BytesIO(b"Chest X-Ray PA View. Lung fields clear. Cardiac silhouette normal. No fractures detected.")
xray_file.name = "chest_xray.png"

res_xray = requests.post(
    f"{BASE_URL}/records",
    headers=headers,
    data={"file_type": "Radiology (Chest X-Ray / CT / MRI)", "description": "Chest X-Ray Routine Scan"},
    files={"file": ("chest_xray.png", xray_file, "image/png")}
)
print("\nX-Ray Upload Status:", res_xray.status_code)
xray_data = res_xray.json()
assert res_xray.status_code == 201
ai_x = xray_data['ai_analysis']
print("X-Ray Status Verdict:", ai_x['status_verdict'])
print("X-Ray Health Score:", ai_x['health_score'])
print("X-Ray Points Count:", len(ai_x.get('points', [])))
for pt in ai_x.get('points', []):
    print(" - X-Ray Point:", pt)
assert len(ai_x.get('points', [])) >= 4
assert "ACHA HAI" in ai_x['status_verdict']
assert 'report_contents' in ai_x
assert 'scanned_text' in ai_x and len(ai_x['scanned_text']) > 20
assert 'kya_hua_tha' in ai_x and len(ai_x['kya_hua_tha']) > 15
print("X-Ray Kya Hua Tha:", ai_x['kya_hua_tha'])
print("X-Ray Scanned Text Length:", len(ai_x['scanned_text']))
print("X-Ray Detected Report Title:", ai_x['report_contents']['title'])
for itm in ai_x['report_contents']['detected_items']:
    print(f"   [Report Me Kya Hai]: {itm['icon']} {itm['label']} -> {itm['detail']}")
assert 'prescription_of_report' in ai_x
rx_x = ai_x['prescription_of_report']
assert len(rx_x['medicines']) >= 1
print("X-Ray Prescribed Medicines Count:", len(rx_x['medicines']))
for med in rx_x['medicines']:
    print(f"   [Rx Medicine]: 💊 {med['name']} - {med['dosage']} ({med['frequency']}) - {med['timing']}")

# Test 3: Medical Document / Prescription Upload
doc_file = io.BytesIO(b"Doctor Prescription: Take Dolo 650 once if fever. Take Pan 40 before breakfast.")
doc_file.name = "doctor_prescription.pdf"

res_doc = requests.post(
    f"{BASE_URL}/records",
    headers=headers,
    data={"file_type": "Doctor Prescription & Clinical Notes", "description": "General Physician Consultation"},
    files={"file": ("doctor_prescription.pdf", doc_file, "application/pdf")}
)
print("\nPrescription Upload Status:", res_doc.status_code)
doc_data = res_doc.json()
assert res_doc.status_code == 201
ai_d = doc_data['ai_analysis']
print("Doc Status Verdict:", ai_d['status_verdict'])
print("Doc Health Score:", ai_d['health_score'])
print("Doc Points Count:", len(ai_d.get('points', [])))
for pt in ai_d.get('points', []):
    print(" - Doc Point:", pt)
assert len(ai_d.get('points', [])) >= 3
assert "ACHA HAI" in ai_d['status_verdict']
assert 'report_contents' in ai_d
assert 'scanned_text' in ai_d and len(ai_d['scanned_text']) > 20
assert 'kya_hua_tha' in ai_d and len(ai_d['kya_hua_tha']) > 15
print("Prescription Kya Hua Tha:", ai_d['kya_hua_tha'])
print("Prescription Scanned Text Length:", len(ai_d['scanned_text']))
print("Prescription Detected Report Title:", ai_d['report_contents']['title'])
for itm in ai_d['report_contents']['detected_items']:
    print(f"   [Report Me Kya Hai]: {itm['icon']} {itm['label']} -> {itm['detail']}")
assert 'prescription_of_report' in ai_d
rx_d = ai_d['prescription_of_report']
assert len(rx_d['medicines']) >= 1
print("Doc Prescribed Medicines Count:", len(rx_d['medicines']))
for med in rx_d['medicines']:
    print(f"   [Rx Medicine]: 💊 {med['name']} - {med['dosage']} ({med['frequency']}) - {med['timing']}")

# Test 4: Retrieve AI analysis by record ID
record_id = doc_data['record']['id']
res_get = requests.get(f"{BASE_URL}/records/{record_id}/ai-analysis", headers=headers)
assert res_get.status_code == 200
assert 'points' in res_get.json()['ai_analysis']
assert 'kya_hua_tha' in res_get.json()['ai_analysis']
assert 'prescription_of_report' in res_get.json()['ai_analysis']
print("\nGET /records/<id>/ai-analysis successfully returned points, kya_hua_tha, and prescription_of_report!")

print("\n>>> ALL MEDICAL RECORDS AI POINTS TESTS PASSED! <<<")
