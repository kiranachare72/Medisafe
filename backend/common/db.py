"""
MediSafe - MongoDB Connection and Collection Utility using PyMongo.
Designed for BSc IT Final-Year Research Project.

Connects to MongoDB Atlas, tests connectivity, registers useful indexes,
and provides collection handles and serialization helpers.
"""

import os
from datetime import datetime, date
from bson import ObjectId
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, PyMongoError
from django.conf import settings

# Global client and db references
_client = None
_db = None

def get_mongo_client():
    """Returns singleton PyMongo client instance."""
    global _client
    if _client is None:
        mongo_uri = getattr(settings, 'MONGO_URI', None) or os.getenv('MONGO_URI')
        try:
            _client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000
            )
            # Test ping
            _client.admin.command('ping')
            print("==================================================")
            print("[MongoDB Atlas] Successfully connected to cluster!")
            print("==================================================")
        except ConnectionFailure as ce:
            print(f"[MongoDB Atlas Error] Server selection failed: {ce}")
            _client = None
        except Exception as e:
            print(f"[MongoDB Atlas Error] Could not connect: {e}")
            _client = None
    return _client

def get_database():
    """Returns the MediSafe PyMongo database handle."""
    global _db
    if _db is None:
        client = get_mongo_client()
        if client is not None:
            raw_db_name = getattr(settings, 'DATABASE_NAME', 'medisafe')
            # Detect existing database names to gracefully handle case-sensitivity in MongoDB Atlas
            try:
                existing_dbs = client.list_database_names()
                matched_db = next((d for d in existing_dbs if d.lower() == raw_db_name.lower()), raw_db_name)
            except Exception:
                matched_db = raw_db_name.lower()

            _db = client[matched_db]
            print(f"[MongoDB Atlas] Using database: {_db.name}")
            # Ensure indexes on initialization
            init_db_indexes(_db)
    return _db

def init_db_indexes(db):
    """
    Creates beneficial indexes on collections to optimize queries.
    Safely ignores index creation if it already exists.
    """
    try:
        # Users: unique index on lowercase email
        db['users'].create_index([('email', ASCENDING)], unique=True, sparse=True)

        # Medicines: fast lookup by user_id and status
        db['medicines'].create_index([('user_id', ASCENDING), ('status', ASCENDING)])

        # Medicine Logs: fast lookup for daily compliance and history
        db['medicine_logs'].create_index([
            ('user_id', ASCENDING),
            ('scheduled_date', ASCENDING),
            ('medicine_id', ASCENDING)
        ])

        # Appointments: lookup by user_id and appointment date
        db['appointments'].create_index([('user_id', ASCENDING), ('date', ASCENDING)])

        # Water Goals & Intakes
        db['water_goals'].create_index([('user_id', ASCENDING)], unique=True)
        db['water_intakes'].create_index([('user_id', ASCENDING), ('date', ASCENDING)])

        # Medical Records: lookup by user_id
        db['medical_records'].create_index([('user_id', ASCENDING), ('upload_date', DESCENDING)])

        # Emergency Contacts
        db['emergency_contacts'].create_index([('user_id', ASCENDING)])

        # Health Assessments
        db['health_assessments'].create_index([('user_id', ASCENDING), ('assessment_date', DESCENDING)])

        # Prescriptions
        db['prescriptions'].create_index([('user_id', ASCENDING), ('created_at', DESCENDING)])

        # Caregivers
        db['caregivers'].create_index([('user_id', ASCENDING)])
        db['caregivers'].create_index([('invitation_token', ASCENDING)], sparse=True)
        db['caregivers'].create_index([('caregiver_email', ASCENDING)])

    except PyMongoError as pe:
        # Log and continue without crashing if an index already exists with different options
        print(f"[MongoDB Index Warning] {pe}")
    except Exception as e:
        print(f"[MongoDB Index Notice] {e}")

# Helper collection access functions
def get_collection(name):
    """Safely retrieves a PyMongo collection by name."""
    db = get_database()
    if db is None:
        raise ConnectionError("MongoDB database connection is not available.")
    return db[name]

def users_col():
    return get_collection('users')

def medicines_col():
    return get_collection('medicines')

def medicine_logs_col():
    return get_collection('medicine_logs')

def appointments_col():
    return get_collection('appointments')

def water_goals_col():
    return get_collection('water_goals')

def water_intakes_col():
    return get_collection('water_intakes')

def medical_records_col():
    return get_collection('medical_records')

def emergency_contacts_col():
    return get_collection('emergency_contacts')

def health_assessments_col():
    return get_collection('health_assessments')

def prescriptions_col():
    return get_collection('prescriptions')

def caregivers_col():
    return get_collection('caregivers')


# Serialization Helpers
def serialize_doc(doc):
    """
    Transforms a MongoDB document into a clean, JSON-serializable dictionary.
    Converts ObjectId to string and datetime to ISO-8601 string.
    Adds 'id' string property alongside '_id'.
    """
    if doc is None:
        return None
    if not isinstance(doc, dict):
        return doc

    serialized = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            serialized[key] = str(value)
            if key == '_id':
                serialized['id'] = str(value)
        elif isinstance(value, (datetime, date)):
            serialized[key] = value.isoformat()
        elif isinstance(value, dict):
            serialized[key] = serialize_doc(value)
        elif isinstance(value, list):
            serialized[key] = [
                serialize_doc(item) if isinstance(item, dict)
                else str(item) if isinstance(item, ObjectId)
                else item.isoformat() if isinstance(item, (datetime, date))
                else item
                for item in value
            ]
        else:
            serialized[key] = value

    if '_id' in serialized and 'id' not in serialized:
        serialized['id'] = str(serialized['_id'])

    return serialized

def serialize_list(cursor_or_list):
    """Serializes a list or PyMongo cursor of documents."""
    if not cursor_or_list:
        return []
    return [serialize_doc(doc) for doc in cursor_or_list]
