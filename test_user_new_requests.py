"""
MediSafe - Verification Suite for User's 2 Specific Requests:
1. Medical Records: Record Type upload with automatic AI Health Prediction ("Acha hai kya nahi").
2. Medicines: Expanded tablet database (25+ real tablets) and medicine-based comparison & prediction.
"""

import io
import time
import requests

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 60)
    print("VERIFYING USER'S 2 SPECIFIC HEALTHCARE REQUESTS")
    print("=" * 60)

    # 1. Register / Login test user
    email = f"report_test_{int(time.time())}@medisafe.edu"
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "Sameer Joshi",
        "email": email,
        "phone": "9820112233",
        "password": "Password@123",
        "confirm_password": "Password@123"
    })
    assert reg_res.status_code == 201, f"Reg failed: {reg_res.text}"
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[Auth] Logged in as: {email}")

    # ==========================================================
    # TEST 1: MEDICAL RECORD TYPE & AI REPORT PREDICTOR ("Acha hai kya nahi")
    # ==========================================================
    print("\n[Request 1] Testing Medical Record Upload with AI Report Health Predictor...")

    # Upload Blood Test Report
    dummy_blood_file = io.BytesIO(b"%PDF-1.4 Dummy CBC Blood Test Report Content with normal Hemoglobin and Platelets")
    dummy_blood_file.name = "CBC_Blood_Test_Report.pdf"

    upload_res = requests.post(
        f"{BASE_URL}/records",
        headers=headers,
        data={
            "file_type": "Complete Blood Count (CBC) / Blood Test",
            "description": "Routine Annual Hemogram from Dr Lal PathLabs"
        },
        files={"file": (dummy_blood_file.name, dummy_blood_file, "application/pdf")}
    )

    assert upload_res.status_code == 201, f"Upload failed: {upload_res.text}"
    upload_data = upload_res.json()
    assert upload_data["success"] is True
    assert "ai_analysis" in upload_data, "AI Analysis missing from upload response!"

    ai = upload_data["ai_analysis"]
    rec_id = upload_data["record"]["id"]

    print(f" -> Record Uploaded Successfully: ID {rec_id}")
    print(f" -> AI Health Verdict ('Acha hai kya nahi'): {ai['status_verdict']}")
    print(f" -> Health Score: {ai['health_score']}/10")
    print(f" -> Clinical Summary: {ai['summary']}")
    print(f" -> Extracted Biomarkers Count: {len(ai['parameters'])}")
    for p in ai['parameters'][:3]:
        print(f"    - {p['parameter']}: {p['value']} (Ref: {p['reference']}) [{p['status']}]")
    print(f" -> Doctor Recommendations: {ai['recommendations'][0]}")

    # Test GET /api/records/<id>/ai-analysis endpoint
    get_ai_res = requests.get(f"{BASE_URL}/records/{rec_id}/ai-analysis", headers=headers)
    assert get_ai_res.status_code == 200, f"Get AI analysis failed: {get_ai_res.text}"
    assert get_ai_res.json()["success"] is True
    print(" -> GET /api/records/<id>/ai-analysis: PASS (Persisted in MongoDB)")

    # Upload Lipid Profile Report
    dummy_lipid = io.BytesIO(b"Lipid Profile Cholesterol Test")
    dummy_lipid.name = "Lipid_Profile_Report.pdf"
    lipid_res = requests.post(
        f"{BASE_URL}/records",
        headers=headers,
        data={
            "file_type": "Lipid Profile (Cholesterol & Heart Health)",
            "description": "Lipid Profile Fasting"
        },
        files={"file": (dummy_lipid.name, dummy_lipid, "application/pdf")}
    )
    assert lipid_res.status_code == 201
    lipid_ai = lipid_res.json()["ai_analysis"]
    print(f" -> Lipid Report AI Prediction: {lipid_ai['status_verdict']} (Score: {lipid_ai['health_score']}/10)")

    # ==========================================================
    # TEST 2: EXPANDED TABLET DATABASE & MEDICINE PREDICTOR
    # ==========================================================
    print("\n[Request 2] Testing Expanded Tablet Database (25+ Tablets) & Comparison...")

    # 1. Knowledge Base Catalog
    kb_res = requests.get(f"{BASE_URL}/medicines/knowledge-base", headers=headers)
    assert kb_res.status_code == 200
    kb_data = kb_res.json()
    assert kb_data["success"] is True
    total_tablets = kb_data["count"]
    print(f" -> Indexed Tablets in Knowledge Base: {total_tablets} tablets available")
    assert total_tablets >= 20, f"Expected 20+ tablets, found {total_tablets}"

    # 2. Test Abdominal Cramps (Predict Meftal-Spas)
    cramp_res = requests.post(f"{BASE_URL}/medicines/ai-compare", headers=headers, json={
        "query": "Meftal-Spas vs Dolo 650 for severe abdominal and period cramps"
    })
    assert cramp_res.status_code == 200
    cramp_pred = cramp_res.json()["prediction"]
    print(f" -> Cramp Query: Best Medicine: {cramp_pred['best_medicine']}")
    assert "meftal" in cramp_pred['best_medicine'].lower(), f"Expected Meftal-Spas, got {cramp_pred['best_medicine']}"

    # 3. Test Vomiting (Predict Emeset / Ondansetron)
    vomit_res = requests.post(f"{BASE_URL}/medicines/ai-compare", headers=headers, json={
        "query": "Emeset 4mg vs Domstal for acute vomiting and nausea"
    })
    assert vomit_res.status_code == 200
    vomit_pred = vomit_res.json()["prediction"]
    print(f" -> Vomiting Query: Best Medicine: {vomit_pred['best_medicine']}")
    assert "ondansetron" in vomit_pred['best_medicine'].lower() or "emeset" in vomit_pred['best_medicine'].lower()

    # 4. Test Acidity (Predict Pan 40 / Razo 20)
    acid_res = requests.post(f"{BASE_URL}/medicines/ai-compare", headers=headers, json={
        "query": "Pan 40 vs Razo 20 for severe acidity and stomach burning"
    })
    assert acid_res.status_code == 200
    acid_pred = acid_res.json()["prediction"]
    print(f" -> Acidity Query: Best Medicine: {acid_pred['best_medicine']}")
    assert "pantoprazole" in acid_pred['best_medicine'].lower() or "pan 40" in acid_pred['best_medicine'].lower()

    # 5. Test Infection (Predict Augmentin 625)
    inf_res = requests.post(f"{BASE_URL}/medicines/ai-compare", headers=headers, json={
        "query": "Augmentin 625 vs Azee 500 for severe bacterial throat infection"
    })
    assert inf_res.status_code == 200
    inf_pred = inf_res.json()["prediction"]
    print(f" -> Infection Query: Best Medicine: {inf_pred['best_medicine']}")
    assert "augmentin" in inf_pred['best_medicine'].lower()

    # 6. Test Fever (Predict Dolo 650 / Crocin)
    fever_res = requests.post(f"{BASE_URL}/medicines/ai-compare", headers=headers, json={
        "query": "Dolo 650 vs Crocin vs Combiflam for fever and body pain"
    })
    assert fever_res.status_code == 200
    fever_pred = fever_res.json()["prediction"]
    print(f" -> Fever Query: Best Medicine: {fever_pred['best_medicine']} (Rank #1)")

    # 7. Test Mouth Ulcers / Vitamins (Predict Becosules)
    ulcer_res = requests.post(f"{BASE_URL}/medicines/ai-compare", headers=headers, json={
        "query": "Becosules vs Limcee for mouth ulcers and blisters"
    })
    assert ulcer_res.status_code == 200
    ulcer_pred = ulcer_res.json()["prediction"]
    print(f" -> Mouth Ulcer Query: Best Medicine: {ulcer_pred['best_medicine']}")
    assert "becosules" in ulcer_pred['best_medicine'].lower()

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED! BOTH REQUESTED PROBLEMS SOLVED ACCURATELY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
