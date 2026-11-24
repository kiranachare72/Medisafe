# MediSafe – Healthcare Management Web Application
**BSc IT Final-Year Research Project**

A modern, full-stack healthcare management web application engineered with pure **HTML5/CSS3/Vanilla JavaScript** on the frontend, **Python & Django REST Framework** on the backend, and **MongoDB Atlas** for document persistence using **PyMongo**.

---

## 1. Project Overview & Objectives

In modern healthcare, patients face difficulties managing daily multi-medication routines, tracking clinical appointments, monitoring basic vitals/hydration, and sharing medical history with caregivers during emergencies.

**MediSafe** provides an integrated healthcare ecosystem featuring:
- **Stateless Authentication:** Secure registration and login using `bcrypt` salted password hashing and signed `PyJWT` tokens.
- **Dynamic Health Profile:** Personal health metrics (Age, Blood Group, Height, Weight, Phone) and verified image uploads stored in MongoDB Atlas.
- **Real-Time Healthcare Dashboard:** Zero fake statistics. Aggregates active medicines, doses taken/missed today, nearest doctor appointment, hydration goal progress, recent reports, and emergency contacts directly from MongoDB.
- **Medication Management:** Complete CRUD with dosage schedules, adherence tracking, and history logs *(Phase 2)*.
- **Clinical Appointments & Hydration Tracking:** Appointment scheduling and hydration goal calculations *(Phase 3)*.
- **Medical Records & Emergency SOS:** Document uploads with access isolation and one-tap GPS geolocation translation to Google Maps *(Phase 4)*.
- **Prescription Scanner:** Image text extraction using Tesseract OCR with manual review verification *(Phase 5)*.
- **Health Risk Assessment:** Explainable BMI calculation and vital health indicator classification *(Phase 6)*.
- **Caregiver Collaboration:** Secure invitation tokens and granular authorized views *(Phase 7)*.

---

## 2. Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+), Fetch API | Responsive, lightweight, no bulky node_modules or client build steps |
| **Backend** | Python 3.13+, Django 6.x, Django REST Framework | Clean REST API design with modular apps |
| **Database** | MongoDB Atlas (Cloud NoSQL), PyMongo 4.x | Native BSON document storage; Django default ORM bypassed |
| **Security** | `bcrypt` (12 rounds), `PyJWT` (HS256) | Salted password hashing, stateless token validation on protected endpoints |
| **Imaging & OCR** | Pillow (PIL), PyTesseract | Profile image processing & prescription scanning |
| **CORS** | `django-cors-headers` | Cross-Origin Resource Sharing for modern browser clients |

---

## 3. Directory Structure

```text
MediSafe_Django/
│
├── frontend/
│   ├── index.html                   # Public landing page with features overview
│   ├── about.html                   # Research project documentation and architecture
│   ├── login.html                   # User login with JWT authentication
│   ├── register.html                # User registration with validation & bcrypt
│   ├── dashboard.html               # Main healthcare dashboard with real MongoDB data
│   ├── profile.html                 # User health profile & photo upload
│   ├── medicines.html               # Medication management (Phase 2)
│   ├── medicine-history.html        # Intake compliance history (Phase 2)
│   ├── appointments.html            # Doctor consultation scheduler (Phase 3)
│   ├── water-tracker.html           # Hydration tracker with daily goal (Phase 3)
│   ├── medical-records.html         # Secure medical reports upload (Phase 4)
│   ├── prescription-scanner.html    # Prescription OCR scanner (Phase 5)
│   ├── health-assessment.html       # BMI & risk checks (Phase 6)
│   ├── emergency-contacts.html      # Emergency numbers (Phase 4)
│   ├── sos.html                     # Instant GPS emergency locator (Phase 4)
│   ├── caregiver.html               # Caregiver access & invites (Phase 7)
│   ├── settings.html                # Account preferences & system info
│   │
│   ├── css/
│   │   ├── style.css                # Base theme, typography, buttons, toasts
│   │   ├── dashboard.css            # Sidebar, stats cards, tables, widgets
│   │   ├── forms.css                # Form inputs, validation alerts, modal dialogs
│   │   └── responsive.css           # Breakpoints for desktop, tablet, and mobile
│   │
│   └── js/
│       ├── config.js                # API base URL configuration
│       ├── api.js                   # Universal Fetch API wrapper & toast alerts
│       ├── auth.js                  # Token storage, auth guard, logout handlers
│       ├── dashboard.js             # Real-time dashboard data loader
│       ├── profile.js               # Profile editing & photo upload controller
│       └── [medicines, ...].js      # Module controllers
│
├── backend/
│   ├── config/                      # Django project configuration (settings, urls, wsgi)
│   ├── common/                      # PyMongo database utility & JWT decorators
│   ├── accounts/                    # Auth & Profile REST APIs
│   ├── dashboard/                   # Aggregated statistics API
│   ├── medicines/                   # Medicine & logs apps
│   ├── appointments/                # Appointments app
│   ├── water_tracker/               # Hydration tracking app
│   ├── medical_records/             # Records app
│   ├── prescriptions/               # OCR scanner app
│   ├── health_assessment/           # BMI assessment app
│   ├── emergency/                   # Emergency & SOS app
│   ├── caregivers/                  # Caregiver permissions app
│   ├── uploads/                     # Server-side upload directories (profiles, records)
│   ├── manage.py                    # Django management script
│   ├── requirements.txt             # Python dependencies
│   ├── .env                         # Active environment variables
│   └── .env.example                 # Environment template
│
├── test_phase1.py                   # Automated Phase 1 verification test suite
└── README.md                        # Documentation
```

---

## 4. Environment Configuration

The backend reads configuration settings from `backend/.env`.

```ini
# backend/.env
MONGO_URI=mongodb+srv://yt:PEWJaOEjqa5Nn0yw@cluster0.kumnajn.mongodb.net/medisafe_db?retryWrites=true&w=majority
DATABASE_NAME=medisafe
SECRET_KEY=medisafe-super-secret-django-key-bsc-it-2026
JWT_SECRET=medisafe-jwt-secure-secret-token-key-2026
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
FRONTEND_URL=http://127.0.0.1:5500
```

> **Security Note:** Secrets and connection strings are strictly kept out of client-side code and committed files.

---

## 5. How to Run the Application

### Option A: Run Everything via Django (Easiest & Recommended)
Django is configured to serve both the REST APIs and the frontend static client seamlessly:

```bash
# 1. Navigate to backend directory
cd backend

# 2. Start the Django development server
python manage.py runserver 127.0.0.1:8000
```

Open your browser at:
- **Landing Page:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Sign In:** [http://127.0.0.1:8000/login.html](http://127.0.0.1:8000/login.html)
- **Register:** [http://127.0.0.1:8000/register.html](http://127.0.0.1:8000/register.html)
- **Dashboard:** [http://127.0.0.1:8000/dashboard.html](http://127.0.0.1:8000/dashboard.html)

---

### Option B: Run Backend & Frontend Separately (Live Server)
If you prefer running the frontend on VS Code Live Server or Python HTTP server:

**Terminal 1 (Backend):**
```bash
cd backend
python manage.py runserver 127.0.0.1:8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
python -m http.server 5500
```

Open your browser at: [http://127.0.0.1:5500/](http://127.0.0.1:5500/)

`django-cors-headers` is fully configured to allow cross-origin requests between port 5500 and port 8000.

---

## 6. API Documentation (Phase 1)

### Authentication

#### 1. Register User
- **Method:** `POST /api/auth/register`
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+91 9876543210",
    "password": "Password123!",
    "confirm_password": "Password123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful. Welcome to MediSafe!",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "6740...102a",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+91 9876543210"
    }
  }
  ```

#### 2. Login User
- **Method:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
  ```

#### 3. Current User
- **Method:** `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Returns sanitized user profile document.

---

### Profile

#### 1. Get Profile
- **Method:** `GET /api/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** Returns profile details including age, gender, blood group, height, weight.

#### 2. Update Profile
- **Method:** `PUT /api/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "phone": "+91 9876543210",
    "age": 24,
    "gender": "Female",
    "blood_group": "O+",
    "height": 168.0,
    "weight": 60.5
  }
  ```
- **Response (200 OK):** Returns updated profile and writes changes to MongoDB Atlas.

#### 3. Upload Profile Photo
- **Method:** `POST /api/profile/photo`
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `multipart/form-data` with `photo` file field.
- **Allowed Formats:** `.jpg`, `.jpeg`, `.png`, `.webp` (Max 5 MB).
- **Response (200 OK):** Returns server-side photo path (`/uploads/profiles/...`).

---

### Dashboard

#### 1. Get Dashboard Summary
- **Method:** `GET /api/dashboard`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "name": "Jane Doe", "email": "..." },
      "medicines": {
        "total_active": 0,
        "today_scheduled": 0,
        "taken_today": 0,
        "missed_today": 0,
        "active_list": []
      },
      "appointments": { "next_appointment": null, "has_upcoming": false },
      "water": {
        "today_intake": 0,
        "daily_goal": 2500,
        "percentage": 0
      },
      "records": { "recent": [] },
      "emergency": { "contacts": [] }
    }
  }
  ```

---

## 7. Testing & Verification

Automated test suites are provided:
1. `test_phase1.py`: Tests MongoDB Atlas, Authentication, Profile, and Dashboard aggregation.
2. `test_all_features.py`: Full-stack test covering all 8 domain modules (Medicines, Appointments, Water, Records, Prescriptions OCR, BMI Health Check, Emergency, Caregivers).
3. `test_new_changes.py`: Dedicated verification for the 6 advanced features requested by the researcher:
   - AI Medicine Photo Scan & Safety Quality Predictor (`/api/medicines/ai-scan`)
   - Real-time Audio Siren Alarm for Scheduled Dose Reminders
   - Doctor Appointment Email Confirmation Dispatch (`django.core.mail.send_mail`)
   - Nearby Emergency Hospitals Location Finder (`/api/appointments/nearby-hospitals`)
   - Instant 1-Click SOS Broadcast (`/api/emergency/dispatch-alert`) with WhatsApp, SMS, and hospital directions
   - AI Water Intake Photo Volume Estimation & Auto-Logging (`/api/water/photo-analysis`)
   - AI Multi-Medicine Comparison & Best Tablet Predictor (`/api/medicines/ai-compare`)
   - System Status removal from Settings UI

Run the test suites:
```bash
python test_all_features.py
python test_new_changes.py
```

### Verification Results:
- `test_all_features.py`: **8/8 Modules Verified (100% PASS)**
- `test_new_changes.py`: **6/6 Advanced Features Verified (100% PASS)**

---

## 8. How to Run the Application

### Step 1: Open PowerShell or Terminal
```bash
cd "c:\Users\Admin\OneDrive\Pictures\Antigravity\MediSafe_Django"
```

### Step 2: Start the Django Backend Server
```bash
python backend/manage.py runserver 127.0.0.1:8000
```

### Step 3: Open in Browser
Open your web browser and go to:
```text
http://127.0.0.1:8000/
```
The Django server directly serves the full frontend application and connects seamlessly to your MongoDB Atlas cloud database!
