/**
 * MediSafe - Medicines Management Controller
 * Handles CRUD operations, dosage logging (Taken / Missed), and modal forms.
 */

let allMedicines = [];
let editingMedId = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadMedicines();

  // Search & Filter listeners
  const searchInput = document.getElementById('searchMedInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allMedicines.filter(m => m.name.toLowerCase().includes(term) || (m.instructions && m.instructions.toLowerCase().includes(term)));
      renderMedicinesList(filtered);
    });
  }

  // Add/Edit Form submit
  const medForm = document.getElementById('medicineForm');
  if (medForm) {
    medForm.addEventListener('submit', handleSaveMedicine);
  }
});

async function loadMedicines() {
  const container = document.getElementById('medicinesListContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="spinner spinner-primary"></div>
        <p style="margin-top: 10px;">Loading your medications...</p>
      </div>
    `;
  }

  const res = await apiFetch('/medicines');
  if (!res.success) {
    showToast(res.message || 'Failed to load medicines.', 'error');
    return;
  }

  allMedicines = res.medicines || [];
  renderMedicinesList(allMedicines);
}

function renderMedicinesList(medicines) {
  const container = document.getElementById('medicinesListContainer');
  if (!container) return;

  if (medicines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💊</div>
        <div class="empty-title">No medications found</div>
        <div class="empty-desc">You have not added any active prescriptions yet. Click below to add your first medicine.</div>
        <button class="btn btn-primary btn-sm" onclick="openAddMedicineModal()">+ Add Medicine</button>
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
            <th>Frequency</th>
            <th>Scheduled Time</th>
            <th>Instructions</th>
            <th>Status</th>
            <th>Quick Dose Action</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;

  medicines.forEach(m => {
    const isInactive = m.status === 'inactive';
    html += `
      <tr style="${isInactive ? 'opacity: 0.6;' : ''}">
        <td><strong>${m.name}</strong></td>
        <td><span class="badge badge-info">${m.type || 'Tablet'}</span></td>
        <td>${m.dosage || '-'}</td>
        <td>${m.frequency || 'Once Daily'}</td>
        <td><strong>${m.time || '-'}</strong></td>
        <td>${m.instructions || 'As directed'}</td>
        <td><span class="badge ${isInactive ? 'badge-warning' : 'badge-success'}">${m.status || 'Active'}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline" style="color: var(--success); border-color: var(--success); padding: 4px 8px; font-size: 12px;" onclick="logDoseAction('${m.id}', 'taken', '${m.time || '08:00'}')">
              ✓ Taken
            </button>
            <button class="btn btn-sm btn-outline" style="color: var(--danger); border-color: var(--danger); padding: 4px 8px; font-size: 12px;" onclick="logDoseAction('${m.id}', 'missed', '${m.time || '08:00'}')">
              ✗ Missed
            </button>
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline" onclick="openEditMedicineModal('${m.id}')" title="Edit">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="deleteMedicine('${m.id}')" title="Delete" style="color: var(--danger);">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function openAddMedicineModal() {
  editingMedId = null;
  document.getElementById('medModalTitle').textContent = 'Add New Medication';
  document.getElementById('medicineForm').reset();
  document.getElementById('medStartDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('medicineModal').classList.add('active');
}

function openEditMedicineModal(id) {
  const med = allMedicines.find(m => m.id === id);
  if (!med) return;

  editingMedId = id;
  document.getElementById('medModalTitle').textContent = 'Edit Medication';
  document.getElementById('medName').value = med.name || '';
  document.getElementById('medType').value = med.type || 'Tablet';
  document.getElementById('medDosage').value = med.dosage || '';
  document.getElementById('medFrequency').value = med.frequency || 'Once Daily';
  document.getElementById('medTime').value = med.time || '08:00';
  document.getElementById('medStartDate').value = med.start_date || '';
  document.getElementById('medEndDate').value = med.end_date || '';
  document.getElementById('medInstructions').value = med.instructions || 'After food';
  document.getElementById('medNotes').value = med.notes || '';
  document.getElementById('medStatus').value = med.status || 'active';

  document.getElementById('medicineModal').classList.add('active');
}

function closeMedicineModal() {
  document.getElementById('medicineModal').classList.remove('active');
  editingMedId = null;
}

async function handleSaveMedicine(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('saveMedBtn');
  setButtonLoading(submitBtn, true, 'Save Medication');

  const payload = {
    name: document.getElementById('medName').value.trim(),
    type: document.getElementById('medType').value,
    dosage: document.getElementById('medDosage').value.trim(),
    frequency: document.getElementById('medFrequency').value,
    time: document.getElementById('medTime').value,
    start_date: document.getElementById('medStartDate').value,
    end_date: document.getElementById('medEndDate').value || null,
    instructions: document.getElementById('medInstructions').value,
    notes: document.getElementById('medNotes').value.trim(),
    status: document.getElementById('medStatus').value
  };

  let res;
  if (editingMedId) {
    res = await apiFetch(`/medicines/${editingMedId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  } else {
    res = await apiFetch('/medicines', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  setButtonLoading(submitBtn, false, 'Save Medication');

  if (res.success) {
    showToast(editingMedId ? 'Medicine updated successfully!' : 'Medicine added successfully!', 'success');
    closeMedicineModal();
    await loadMedicines();
  } else {
    showToast(res.message || 'Failed to save medicine.', 'error');
  }
}

async function deleteMedicine(id) {
  if (!confirm('Are you sure you want to delete this medication and its associated history?')) return;

  const res = await apiFetch(`/medicines/${id}`, { method: 'DELETE' });
  if (res.success) {
    showToast('Medicine deleted successfully.', 'info');
    await loadMedicines();
  } else {
    showToast(res.message || 'Failed to delete medicine.', 'error');
  }
}

async function logDoseAction(medicineId, statusVal, scheduledTime) {
  const todayStr = new Date().toISOString().split('T')[0];

  const res = await apiFetch('/medicine-logs', {
    method: 'POST',
    body: JSON.stringify({
      medicine_id: medicineId,
      status: statusVal,
      scheduled_date: todayStr,
      scheduled_time: scheduledTime
    })
  });

  if (res.success) {
    showToast(`Dose marked as ${statusVal}!`, statusVal === 'taken' ? 'success' : 'warning');
  } else {
    showToast(res.message || 'Could not record dose.', 'error');
  }
}
