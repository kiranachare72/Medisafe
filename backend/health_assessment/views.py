"""
MediSafe - Health Risk Assessment & Informational Health Metrics.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- POST /api/health-assessment  (Calculate BMI, categorize vitals, return informational risk summary)
- GET  /api/health-assessment  (Get user's past health assessment history)
"""

from datetime import datetime
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import health_assessments_col, serialize_doc, serialize_list

DISCLAIMER_TEXT = "This assessment is for informational purposes only and is not a medical diagnosis. Please consult a qualified healthcare professional."


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([JSONParser])
def health_assessment_view(request):
    """
    GET:  Returns past health assessment history.
    POST: Calculates BMI, evaluates vital signs against clinical reference ranges,
          and saves the informational report in MongoDB.
    """
    user_id = request.user_id

    if request.method == 'GET':
        assessments = list(health_assessments_col().find({'user_id': user_id}).sort('created_at', -1))
        return Response({
            'success': True,
            'count': len(assessments),
            'assessments': serialize_list(assessments)
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data or {}

        try:
            age = int(data.get('age', 0))
            height_cm = float(data.get('height', 0))
            weight_kg = float(data.get('weight', 0))
        except (ValueError, TypeError):
            return Response({'success': False, 'message': 'Age, Height, and Weight must be valid numbers.'}, status=status.HTTP_400_BAD_REQUEST)

        if height_cm <= 50 or height_cm > 260:
            return Response({'success': False, 'message': 'Height must be between 50 and 260 cm.'}, status=status.HTTP_400_BAD_REQUEST)

        if weight_kg <= 10 or weight_kg > 350:
            return Response({'success': False, 'message': 'Weight must be between 10 and 350 kg.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Calculate BMI = Weight in kg / (Height in meters ^ 2)
        height_m = height_cm / 100.0
        bmi_val = round(weight_kg / (height_m * height_m), 1)

        if bmi_val < 18.5:
            bmi_category = "Underweight"
            bmi_color = "warning"
        elif 18.5 <= bmi_val < 25.0:
            bmi_category = "Normal Weight"
            bmi_color = "success"
        elif 25.0 <= bmi_val < 30.0:
            bmi_category = "Overweight"
            bmi_color = "warning"
        else:
            bmi_category = "Obese"
            bmi_color = "danger"

        # 2. Blood Pressure Analysis
        systolic = data.get('systolic_bp')
        diastolic = data.get('diastolic_bp')
        bp_category = "Not Provided"
        bp_color = "info"

        if systolic is not None and diastolic is not None:
            try:
                sys_val = int(systolic)
                dia_val = int(diastolic)
                if sys_val < 120 and dia_val < 80:
                    bp_category = "Normal Blood Pressure"
                    bp_color = "success"
                elif 120 <= sys_val <= 129 and dia_val < 80:
                    bp_category = "Elevated Blood Pressure"
                    bp_color = "warning"
                elif (130 <= sys_val <= 139) or (80 <= dia_val <= 89):
                    bp_category = "Stage 1 Hypertension"
                    bp_color = "warning"
                elif sys_val >= 140 or dia_val >= 90:
                    bp_category = "Stage 2 Hypertension"
                    bp_color = "danger"
            except (ValueError, TypeError):
                pass

        # 3. Blood Glucose Analysis
        blood_sugar = data.get('blood_sugar')
        glucose_category = "Not Provided"
        glucose_color = "info"

        if blood_sugar is not None:
            try:
                sugar_val = float(blood_sugar)
                if sugar_val < 140:
                    glucose_category = "Normal Blood Glucose"
                    glucose_color = "success"
                elif 140 <= sugar_val < 200:
                    glucose_category = "Borderline / Pre-diabetic Range"
                    glucose_color = "warning"
                else:
                    glucose_category = "Elevated Blood Glucose"
                    glucose_color = "danger"
            except (ValueError, TypeError):
                pass

        symptoms = str(data.get('symptoms', '')).strip()

        # Build explainable assessment factors
        factors = []
        if bmi_val >= 25.0:
            factors.append(f"BMI ({bmi_val}) is above normal range ({bmi_category}). Regular cardiovascular activity is beneficial.")
        elif bmi_val < 18.5:
            factors.append(f"BMI ({bmi_val}) is below standard range ({bmi_category}). Nutritional balance consultation recommended.")
        else:
            factors.append(f"BMI ({bmi_val}) is in the healthy normal range.")

        if bp_category != "Not Provided":
            factors.append(f"Blood Pressure status: {bp_category}.")
        if glucose_category != "Not Provided":
            factors.append(f"Blood Sugar status: {glucose_category}.")
        if symptoms:
            factors.append(f"Reported symptoms: {symptoms}.")

        assessment_doc = {
            'user_id': user_id,
            'age': age,
            'height': height_cm,
            'weight': weight_kg,
            'bmi': bmi_val,
            'bmi_category': bmi_category,
            'bmi_color': bmi_color,
            'systolic_bp': systolic,
            'diastolic_bp': diastolic,
            'bp_category': bp_category,
            'bp_color': bp_color,
            'blood_sugar': blood_sugar,
            'glucose_category': glucose_category,
            'glucose_color': glucose_color,
            'symptoms': symptoms,
            'assessment_factors': factors,
            'disclaimer': DISCLAIMER_TEXT,
            'created_at': datetime.utcnow()
        }

        res = health_assessments_col().insert_one(assessment_doc)
        assessment_doc['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': 'Health assessment completed successfully.',
            'assessment': serialize_doc(assessment_doc)
        }, status=status.HTTP_201_CREATED)
