/**
 * MediSafe - Appointments Controller
 * Handles upcoming/past consultations, booking modals, and cancellation.
 */

let allAppointments = [];
let editingApptId = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadAppointments();

  const form = document.getElementById('appointmentForm');
  if (form) {
    form.addEventListener('submit', handleSaveAppointment);
  }
});

async function loadAppointments() {
  const container = document.getElementById('appointmentsListContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="spinner spinner-primary"></div>
        <p style="margin-top: 10px;">Loading appointments...</p>
      </div>
    `;
  }

  const res = await apiFetch('/appointments');
  if (!res.success) {
    showToast(res.message || 'Failed to load appointments.', 'error');
    return;
  }

  allAppointments = res.all || [];
  renderAppointments(res.upcoming || [], res.past || []);
}

function renderAppointments(upcoming, past) {
  const container = document.getElementById('appointmentsListContainer');
  if (!container) return;

  if (upcoming.length === 0 && past.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🩺</div>
        <div class="empty-title">No appointments scheduled</div>
        <div class="empty-desc">Schedule your clinical consultations, blood tests, and checkups.</div>
        <button class="btn btn-primary btn-sm" onclick="openAddAppointmentModal()">+ Schedule Appointment</button>
      </div>
    `;
    return;
  }

  let html = `<div>`;

  // Upcoming Section
  html += `<h3 style="margin-bottom: 16px; color: var(--primary);">Upcoming Consultations (${upcoming.length})</h3>`;
  if (upcoming.length === 0) {
    html += `<p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">No upcoming appointments.</p>`;
  } else {
    html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; margin-bottom: 32px;">`;
    upcoming.forEach(appt => {
      html += renderAppointmentCard(appt, true);
    });
    html += `</div>`;
  }

  // Past Section
  if (past.length > 0) {
    html += `<h3 style="margin-bottom: 16px; color: var(--text-muted);">Past Appointments (${past.length})</h3>`;
    html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px;">`;
    past.forEach(appt => {
      html += renderAppointmentCard(appt, false);
    });
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function renderAppointmentCard(appt, isUpcoming) {
  return `
    <div class="card" style="border-left: 4px solid ${isUpcoming ? 'var(--primary)' : 'var(--text-light)'};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <h4 style="color: var(--text-main); font-size: 1.15rem;">Dr. ${appt.doctor_name}</h4>
        <span class="badge ${isUpcoming ? 'badge-info' : 'badge-warning'}">${isUpcoming ? 'Upcoming' : 'Completed'}</span>
      </div>
      <p style="font-size: 14px; margin-bottom: 6px;"><strong>Hospital/Clinic:</strong> ${appt.hospital || 'Not specified'}</p>
      <p style="font-size: 13px; color: var(--text-main); margin-bottom: 6px;"><strong>Date:</strong> ${appt.date} at ${appt.time}</p>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;"><strong>Purpose:</strong> ${appt.purpose || 'Checkup'}</p>
      ${appt.notes ? `<p style="font-size: 12px; color: var(--text-light); background: var(--bg-main); padding: 6px 10px; border-radius: var(--radius-sm); margin-bottom: 14px;">📝 ${appt.notes}</p>` : ''}
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-sm btn-outline" onclick="openEditAppointmentModal('${appt.id}')">✏️ Edit</button>
        <button class="btn btn-sm btn-outline" style="color: var(--danger);" onclick="deleteAppointment('${appt.id}')">🗑️ Cancel</button>
      </div>
    </div>
  `;
}

function openAddAppointmentModal() {
  editingApptId = null;
  document.getElementById('apptModalTitle').textContent = 'Book Doctor Appointment';
  document.getElementById('appointmentForm').reset();
  document.getElementById('apptDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('appointmentModal').classList.add('active');
}

function openEditAppointmentModal(id) {
  const appt = allAppointments.find(a => a.id === id);
  if (!appt) return;

  editingApptId = id;
  document.getElementById('apptModalTitle').textContent = 'Edit Doctor Appointment';
  document.getElementById('apptDoctor').value = appt.doctor_name || '';
  document.getElementById('apptHospital').value = appt.hospital || '';
  document.getElementById('apptDate').value = appt.date || '';
  document.getElementById('apptTime').value = appt.time || '';
  document.getElementById('apptPurpose').value = appt.purpose || '';
  document.getElementById('apptNotes').value = appt.notes || '';

  document.getElementById('appointmentModal').classList.add('active');
}

function closeAppointmentModal() {
  document.getElementById('appointmentModal').classList.remove('active');
  editingApptId = null;
}

async function handleSaveAppointment(e) {
  e.preventDefault();
  const btn = document.getElementById('saveApptBtn');
  setButtonLoading(btn, true, 'Confirm Appointment');

  const payload = {
    doctor_name: document.getElementById('apptDoctor').value.trim(),
    hospital: document.getElementById('apptHospital').value.trim(),
    date: document.getElementById('apptDate').value,
    time: document.getElementById('apptTime').value,
    purpose: document.getElementById('apptPurpose').value.trim(),
    notes: document.getElementById('apptNotes').value.trim(),
    reminder_status: true
  };

  let res;
  if (editingApptId) {
    res = await apiFetch(`/appointments/${editingApptId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  } else {
    res = await apiFetch('/appointments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  setButtonLoading(btn, false, 'Confirm Appointment');

  if (res.success) {
    showToast(editingApptId ? 'Appointment updated!' : 'Appointment scheduled successfully!', 'success');
    closeAppointmentModal();
    await loadAppointments();
  } else {
    showToast(res.message || 'Failed to save appointment.', 'error');
  }
}

async function deleteAppointment(id) {
  if (!confirm('Are you sure you want to cancel this appointment?')) return;

  const res = await apiFetch(`/appointments/${id}`, { method: 'DELETE' });
  if (res.success) {
    showToast('Appointment cancelled.', 'info');
    await loadAppointments();
  } else {
    showToast(res.message || 'Failed to delete appointment.', 'error');
  }
}
