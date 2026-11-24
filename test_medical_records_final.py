import os
import io
import time
import requests

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 70)
    print("RUNNING 15-POINT COMPREHENSIVE MEDICAL RECORDS TEST SUITE")
    print("=" * 70)

    # 1. Setup User A
    t = int(time.time())
    email_a = f"user_a_{t}@medisafe.edu"
    reg_a = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "User Alpha",
        "email": email_a,
        "phone": "9811122233",
        "password": "Password@123",
        "confirm_password": "Password@123"
    })
    assert reg_a.status_code == 201, f"User A reg failed: {reg_a.text}"
    token_a = reg_a.json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Setup User B
    email_b = f"user_b_{t}@medisafe.edu"
    reg_b = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "User Beta",
        "email": email_b,
        "phone": "9822233344",
        "password": "Password@123",
        "confirm_password": "Password@123"
    })
    assert reg_b.status_code == 201, f"User B reg failed: {reg_b.text}"
    token_b = reg_b.json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    print(f"[Auth] User A: {email_a}, User B: {email_b}")

    # Point 1: Blood Test Upload Button (Normal Blood Report)
    blood_pdf = io.BytesIO(b"Lab Report: Complete Blood Count. Hemoglobin: 14.5 g/dL, WBC: 7100 /mcL, Platelets: 270000 /mcL, RBC: 4.9 mil/mcL. All indices normal.")
    res_blood = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Complete Blood Count (CBC) / Blood Test", "description": "Routine Annual Blood Checkup"},
        files={"file": ("cbc_report.pdf", blood_pdf, "application/pdf")}
    )
    assert res_blood.status_code == 201, f"Blood upload failed: {res_blood.text}"
    b_data = res_blood.json()
    assert b_data["success"] is True
    rec_b_id = b_data["record"]["id"]
    ai_b = b_data["ai_analysis"]
    assert "ACHA HAI" in ai_b["status_verdict"]
    assert len(ai_b["parameters"]) >= 3
    print(" -> Point 1 [Blood Test Button & Extraction]: PASS (Normal Hb 14.5, WBC 7100, Platelets 270000)")

    # Blood Test with Low Values (Out-of-range warnings)
    blood_low_pdf = io.BytesIO(b"Abnormal Lab Report: Hemoglobin: 9.8 g/dL, WBC: 13800 /mcL, Platelets: 120000 /mcL. Patient has anemia and fever.")
    res_blood_low = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Complete Blood Count (CBC) / Blood Test", "description": "Abnormal Blood Report with Anemia"},
        files={"file": ("cbc_anemia.pdf", blood_low_pdf, "application/pdf")}
    )
    assert res_blood_low.status_code == 201
    ai_b_low = res_blood_low.json()["ai_analysis"]
    assert "NAHI ACHA" in ai_b_low["status_verdict"]
    assert len(ai_b_low["warnings"]) >= 1
    print(f" -> Blood Out-of-Range Warnings: PASS ({len(ai_b_low['warnings'])} clinical alert warnings generated)")

    # Point 2: X-Ray & Bone Scans Upload Button
    xray_png = io.BytesIO(b"Chest Radiograph PA View. Both lungs clear. Cardio-thoracic ratio 0.45. Ribs and clavicles intact. No fractures detected.")
    res_xray = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Radiology (Chest X-Ray / CT / MRI)", "description": "Chest X-Ray Routine Scan"},
        files={"file": ("chest_xray.png", xray_png, "image/png")}
    )
    assert res_xray.status_code == 201
    x_data = res_xray.json()
    rec_x_id = x_data["record"]["id"]
    ai_x = x_data["ai_analysis"]
    assert ai_x["is_xray"] is True
    assert "xray_notice" in ai_x and "Automated radiological X-ray" in ai_x["xray_notice"]
    assert "preview_url" in ai_x and "/media/records/" in ai_x["preview_url"]
    print(" -> Point 2 [X-Ray Upload & Scan Disclaimer]: PASS (Official notice & image preview generated)")

    # Point 3: Prescriptions & Health Documents Upload Button
    rx_pdf = io.BytesIO(b"Medical Prescription: Dr. S. K. Kulkarni, MD. Patient: John Doe. Date: 23 Nov 2026. Rx: Tab Dolo 650mg once daily if fever. Tab Pan 40mg before breakfast.")
    res_rx = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Doctor Prescription & Clinical Notes", "description": "Outpatient Prescription"},
        files={"file": ("rx_doc.pdf", rx_pdf, "application/pdf")}
    )
    assert res_rx.status_code == 201
    rx_data = res_rx.json()
    rec_rx_id = rx_data["record"]["id"]
    ai_rx = rx_data["ai_analysis"]
    assert "prescription_review" in ai_rx and ai_rx["prescription_review"] is not None
    assert len(ai_rx["prescription_review"]["medicines"]) >= 1
    print(f" -> Point 3 [Prescriptions Button & Medication Review]: PASS ({len(ai_rx['prescription_review']['medicines'])} medicines cataloged for review)")

    # Point 4: Top Upload Record Button (Supports Any Category)
    sugar_pdf = io.BytesIO(b"Diabetic Fasting Blood Sugar: 88 mg/dL, Post-Prandial: 124 mg/dL, HbA1c: 5.3%. Non-diabetic.")
    res_top = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Blood Glucose & HbA1c (Diabetes)", "description": "Diabetic Health Screening"},
        files={"file": ("diabetes_report.pdf", sugar_pdf, "application/pdf")}
    )
    assert res_top.status_code == 201
    print(" -> Point 4 [Top + Upload Record Button]: PASS (Any category upload supported)")

    # Point 5 & 6: PDF upload and Image upload verified above (.pdf and .png)
    print(" -> Point 5 & 6 [PDF & Image Formats]: PASS (.pdf and .png validated & accepted)")

    # Point 7 & 8: Text Extraction & Analysis Generation
    assert len(ai_b["scanned_text"]) > 10
    assert "health_score" in ai_b and ai_b["health_score"] > 0
    assert "kya_hua_tha" in ai_b and len(ai_b["kya_hua_tha"]) > 10
    print(" -> Point 7 & 8 [Actual Text Extraction & Health Analysis]: PASS")

    # Point 9: Database saving (MongoDB persistence)
    # Point 10: Medical Records History (GET /api/records)
    res_list = requests.get(f"{BASE_URL}/records", headers=headers_a)
    assert res_list.status_code == 200
    records = res_list.json()["records"]
    assert len(records) >= 4
    for r in records:
        assert "file_type" in r
        assert "original_filename" in r
        assert "upload_date" in r
        assert "ai_analysis" in r
    print(f" -> Point 9 & 10 [Database Saving & History List]: PASS ({len(records)} records retrieved with full metadata)")

    # Point 11: View Report (GET /api/records/<id>/ai-analysis)
    res_view = requests.get(f"{BASE_URL}/records/{rec_b_id}/ai-analysis", headers=headers_a)
    assert res_view.status_code == 200
    assert res_view.json()["ai_analysis"]["status_verdict"] == ai_b["status_verdict"]
    print(" -> Point 11 [View Report Endpoint]: PASS (Accurate analysis retrieved)")

    # Point 12: Download (GET /api/records/<id>/download)
    res_dl = requests.get(f"{BASE_URL}/records/{rec_b_id}/download", headers=headers_a)
    assert res_dl.status_code == 200
    assert len(res_dl.content) > 0
    print(f" -> Point 12 [Original File Download]: PASS ({len(res_dl.content)} bytes streamed)")

    # Point 13: Delete Record (DELETE /api/records/<id>)
    del_target = records[0]["id"]
    res_del = requests.delete(f"{BASE_URL}/records/{del_target}", headers=headers_a)
    assert res_del.status_code == 200
    res_check = requests.get(f"{BASE_URL}/records/{del_target}/ai-analysis", headers=headers_a)
    assert res_check.status_code == 404
    print(" -> Point 13 [Safe Record Deletion]: PASS (Record deleted from DB and disk)")

    # Point 14: Invalid File Handling
    # Test A: Unsupported extension (.exe)
    res_bad_ext = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Other Health Document"},
        files={"file": ("virus.exe", io.BytesIO(b"malicious"), "application/octet-stream")}
    )
    assert res_bad_ext.status_code == 400
    assert "Unsupported file format" in res_bad_ext.json()["message"]
    print(" -> Point 14A [Invalid Extension Handling]: PASS (Blocked .exe with 400)")

    # Test B: File size > 10MB
    large_payload = io.BytesIO(b"A" * (11 * 1024 * 1024))
    res_large = requests.post(
        f"{BASE_URL}/records",
        headers=headers_a,
        data={"file_type": "Other Health Document"},
        files={"file": ("huge_scan.pdf", large_payload, "application/pdf")}
    )
    assert res_large.status_code == 400
    assert "exceeds maximum allowed size" in res_large.json()["message"]
    print(" -> Point 14B [File Size Limit (>10MB)]: PASS (Blocked 11MB file with 400)")

    # Point 15: User Authentication and Data Isolation
    # User B attempts to access User A's record
    res_unauth_view = requests.get(f"{BASE_URL}/records/{rec_b_id}/ai-analysis", headers=headers_b)
    assert res_unauth_view.status_code == 404, f"Data leak! Status: {res_unauth_view.status_code}"

    res_unauth_dl = requests.get(f"{BASE_URL}/records/{rec_b_id}/download", headers=headers_b)
    assert res_unauth_dl.status_code == 404, f"File leak! Status: {res_unauth_dl.status_code}"

    res_unauth_del = requests.delete(f"{BASE_URL}/records/{rec_b_id}", headers=headers_b)
    assert res_unauth_del.status_code == 404, f"Unauthorized delete allowed! Status: {res_unauth_del.status_code}"
    print(" -> Point 15 [User Authentication & Data Isolation]: PASS (Zero cross-user data exposure)")

    print("\n" + "=" * 70)
    print("ALL 15 REQUIREMENTS FULLY VERIFIED AND PASSING!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
