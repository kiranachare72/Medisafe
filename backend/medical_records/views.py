"""
MediSafe - Medical Records Management.
Designed for BSc IT Final-Year Research Project.

Endpoints:
- GET    /api/records               (List all medical records for user)
- POST   /api/records               (Upload new record: PDF, JPG, PNG)
- GET    /api/records/<id>/download (Secure owner-verified file download)
- DELETE /api/records/<id>          (Delete record and remove from disk)
"""

import os
import time
import uuid
from datetime import datetime
from bson import ObjectId
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from common.auth import jwt_required
from common.db import medical_records_col, serialize_doc, serialize_list


@api_view(['GET', 'POST'])
@jwt_required
@parser_classes([MultiPartParser, FormParser])
def records_list_or_upload(request):
    """
    GET:  Returns user's uploaded medical records metadata.
    POST: Uploads file with validation and stores metadata in MongoDB.
    """
    user_id = request.user_id

    if request.method == 'GET':
        records = list(medical_records_col().find({'user_id': user_id}).sort('upload_date', -1))
        return Response({
            'success': True,
            'count': len(records),
            'records': serialize_list(records)
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        if 'file' not in request.FILES:
            return Response({'success': False, 'message': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES['file']
        if not uploaded_file.name:
            return Response({'success': False, 'message': 'Empty filename.'}, status=status.HTTP_400_BAD_REQUEST)

        # 10 MB limit
        if uploaded_file.size > 10 * 1024 * 1024:
            return Response({'success': False, 'message': 'File size exceeds maximum allowed size of 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(uploaded_file.name)[1].lower()
        allowed_exts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx']
        if ext not in allowed_exts:
            return Response({
                'success': False,
                'message': f'Unsupported file format. Allowed formats: {", ".join(allowed_exts)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique server filename
        stored_filename = f"rec_{user_id}_{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
        records_dir = os.path.join(settings.MEDIA_ROOT, 'records')
        os.makedirs(records_dir, exist_ok=True)
        file_path = os.path.join(records_dir, stored_filename)

        try:
            with open(file_path, 'wb+') as dest:
                for chunk in uploaded_file.chunks():
                    dest.write(chunk)
        except Exception as e:
            return Response({'success': False, 'message': f'File write failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        file_type = str(request.data.get('file_type', 'Medical Report')).strip()
        description = str(request.data.get('description', uploaded_file.name)).strip()

        new_record = {
            'user_id': user_id,
            'original_filename': uploaded_file.name,
            'stored_filename': stored_filename,
            'file_type': file_type,
            'file_size': uploaded_file.size,
            'description': description,
            'storage_path': file_path,
            'download_url': f"/api/records/download-file/{stored_filename}",
            'upload_date': datetime.utcnow()
        }

        res = medical_records_col().insert_one(new_record)
        new_record['_id'] = res.inserted_id

        return Response({
            'success': True,
            'message': 'Medical record uploaded successfully.',
            'record': serialize_doc(new_record)
        }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@jwt_required
def download_record(request, id):
    """
    GET: Securely downloads record after verifying authenticated user ownership.
    """
    user_id = request.user_id
    try:
        rec_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid record ID.'}, status=status.HTTP_400_BAD_REQUEST)

    record = medical_records_col().find_one({'_id': rec_id, 'user_id': user_id})
    if not record:
        return Response({'success': False, 'message': 'Record not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    file_path = record.get('storage_path')
    if not file_path or not os.path.exists(file_path):
        return Response({'success': False, 'message': 'File not found on storage server.'}, status=status.HTTP_404_NOT_FOUND)

    response = FileResponse(open(file_path, 'rb'), as_attachment=True, filename=record.get('original_filename', 'record.pdf'))
    return response


@api_view(['DELETE'])
@jwt_required
def delete_record(request, id):
    """
    DELETE: Deletes record from MongoDB and disk after verifying ownership.
    """
    user_id = request.user_id
    try:
        rec_id = ObjectId(id)
    except Exception:
        return Response({'success': False, 'message': 'Invalid record ID.'}, status=status.HTTP_400_BAD_REQUEST)

    record = medical_records_col().find_one({'_id': rec_id, 'user_id': user_id})
    if not record:
        return Response({'success': False, 'message': 'Record not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

    # Delete disk file if it exists
    file_path = record.get('storage_path')
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    medical_records_col().delete_one({'_id': rec_id})

    return Response({
        'success': True,
        'message': 'Medical record deleted successfully.'
    }, status=status.HTTP_200_OK)
