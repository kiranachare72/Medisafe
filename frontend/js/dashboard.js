/**
 * MediSafe - Dashboard Page Controller
 * Fetches real MongoDB statistics and renders them dynamically.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Ensure authentication
  requireAuth();

  // Set personalized greeting
  setGreeting();

  // Load real dashboard statistics
  await loadDashboardData();
});

function setGreeting() {
  const greetingEl = document.getElementById('userGreeting');
  const user = getUser();
  const userName = user ? user.name.split(' ')[0] : 'there';

  const hour = new Date().getHours();
  let timeOfDay = 'Good morning';
  if (hour >= 12 && hour < 17) {
    timeOfDay = 'Good afternoon';
  } else if (hour >= 17) {
    timeOfDay = 'Good evening';
  }

  if (greetingEl) {
    greetingEl.textContent = `${timeOfDay}, ${userName}!`;
  }
}

async function loadDashboardData() {
  const res = await apiFetch('/dashboard');

  if (!res.success) {
    showToast(res.message || 'Failed to load dashboard data.', 'error');
    return;
  }

  const data = res.data;

  // 1. Medicines Stats
  const activeMedsEl = document.getElementById('statActiveMedicines');
  const takenMedsEl = document.getElementById('statTakenMedicines');
  const missedMedsEl = document.getElementById('statMissedMedicines');

  if (activeMedsEl) activeMedsEl.textContent = data.medicines.total_active;
  if (takenMedsEl) takenMedsEl.textContent = data.medicines.taken_today;
  if (missedMedsEl) missedMedsEl.textContent = data.medicines.missed_today;

  // 2. Today's Medicine List Widget
  renderTodayMedicines(data.medicines.active_list);

  // 3. Next Appointment Widget
  renderNextAppointment(data.appointments.next_appointment);

  // 4. Water Tracker Widget
  renderWaterProgress(data.water);

  // 5. Recent Medical Records Widget
  renderRecentRecords(data.records.recent);

  // 6. Emergency Contacts Widget
  renderEmergencyContacts(data.emergency.contacts);
}

function renderTodayMedicines(medicines) {
  const container = document.getElementById('todayMedicinesContainer');
  if (!container) return;

  if (!medicines || medicines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💊</div>
        <div class="empty-title">No medicines scheduled</div>
        <div class="empty-desc">You haven't added any active medications yet. Add your daily medicines to keep track.</div>
        <a href="medicines.html" class="btn btn-primary btn-sm">+ Add Medicine</a>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Medicine Name</th>
            <th>Type</th>
            <th>Dosage</th>
            <th>Time</th>
            <th>Instructions</th>
          </tr>
        </thead>
        <tbody>
  `;

  medicines.forEach(med => {
    html += `
      <tr>
        <td><strong>${med.name}</strong></td>
        <td><span class="badge badge-info">${med.type || 'Tablet'}</span></td>
        <td>${med.dosage || '-'}</td>
        <td><strong>${med.time || '-'}</strong></td>
        <td>${med.instructions || 'As directed'}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function renderNextAppointment(appointment) {
  const container = document.getElementById('nextAppointmentContainer');
  if (!container) return;

  if (!appointment) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🩺</div>
        <div class="empty-title">No upcoming appointments</div>
        <div class="empty-desc">Schedule your doctor visits and health checkups in advance.</div>
        <a href="appointments.html" class="btn btn-outline btn-sm">+ Book Appointment</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="background-color: var(--primary-light); border-radius: var(--radius-md); padding: 18px; border-left: 4px solid var(--primary);">
      <h4 style="color: var(--primary); margin-bottom: 6px;">Dr. ${appointment.doctor_name}</h4>
      <p style="color: var(--text-main); font-size: 14px; margin-bottom: 4px;"><strong>Hospital:</strong> ${appointment.hospital || 'Clinic'}</p>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;"><strong>Date & Time:</strong> ${appointment.date} at ${appointment.time}</p>
      ${appointment.purpose ? `<span class="badge badge-info">${appointment.purpose}</span>` : ''}
    </div>
  `;
}

function renderWaterProgress(water) {
  const amountEl = document.getElementById('waterCurrentAmount');
  const goalEl = document.getElementById('waterGoalAmount');
  const percentEl = document.getElementById('waterPercentage');
  const progressFill = document.getElementById('waterProgressFill');

  if (amountEl) amountEl.textContent = `${water.today_intake} ml`;
  if (goalEl) goalEl.textContent = `${water.daily_goal} ml`;
  if (percentEl) percentEl.textContent = `${water.percentage}%`;

  if (progressFill) {
    progressFill.style.width = `${water.percentage}%`;
    if (water.percentage >= 100) {
      progressFill.className = 'progress-fill success';
    } else if (water.percentage >= 50) {
      progressFill.className = 'progress-fill';
    } else {
      progressFill.className = 'progress-fill warning';
    }
  }
}

function renderRecentRecords(records) {
  const container = document.getElementById('recentRecordsContainer');
  if (!container) return;

  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px 10px;">
        <div class="empty-icon" style="font-size: 30px;">📁</div>
        <div class="empty-title" style="font-size: 14px;">No medical records uploaded</div>
        <div class="empty-desc" style="font-size: 12px;">Upload lab reports, prescriptions, or documents.</div>
        <a href="medical-records.html" class="btn btn-outline btn-sm">+ Upload Record</a>
      </div>
    `;
    return;
  }

  let html = `<ul style="list-style: none; display: flex; flex-direction: column; gap: 10px;">`;
  records.forEach(rec => {
    html += `
      <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background-color: var(--bg-main); border-radius: var(--radius-md); font-size: 13px;">
        <div>
          <strong style="color: var(--text-main);">${rec.description || rec.original_filename}</strong>
          <div style="color: var(--text-muted); font-size: 11px;">${rec.file_type || 'Report'} &bull; ${rec.upload_date ? rec.upload_date.substring(0, 10) : ''}</div>
        </div>
        <a href="medical-records.html" class="btn btn-outline btn-sm">View</a>
      </li>
    `;
  });
  html += `</ul>`;
  container.innerHTML = html;
}

function renderEmergencyContacts(contacts) {
  const container = document.getElementById('emergencyContactsContainer');
  if (!container) return;

  if (!contacts || contacts.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px 10px;">
        <div class="empty-icon" style="font-size: 30px; color: var(--danger);">🚨</div>
        <div class="empty-title" style="font-size: 14px;">No emergency contacts added</div>
        <div class="empty-desc" style="font-size: 12px;">Add at least one family member or doctor for SOS.</div>
        <a href="emergency-contacts.html" class="btn btn-danger btn-sm">+ Add Contact</a>
      </div>
    `;
    return;
  }

  let html = `<ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">`;
  contacts.forEach(c => {
    html += `
      <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #fff5f5; border: 1px solid #fed7d7; border-radius: var(--radius-md);">
        <div>
          <strong style="color: #9b2c2c; font-size: 13px;">${c.name}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${c.relationship}</div>
        </div>
        <a href="tel:${c.phone}" class="btn btn-danger btn-sm" style="font-size: 12px; padding: 4px 8px;">Call</a>
      </li>
    `;
  });
  html += `</ul>`;
  container.innerHTML = html;
}
