/**
 * MediSafe - Medicines Management & AI Health Assistant Controller
 * Features:
 * 1. Complete CRUD operations & Daily Intake Logs (Taken / Missed)
 * 2. Real-time Audio Siren Alarm Reminder on scheduled dose time
 * 3. AI Medicine Photo Scanner & Safety Predictor (Quality & Safety Check)
 * 4. AI Best Medicine Predictor & Comparison Engine (Best tablet prediction)
 */

let allMedicines = [];
let editingMedId = null;
let currentSirenInterval = null;
let audioCtx = null;
let triggeredAlertsToday = new Set();
let scannedTemplateMed = null;

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

  // AI Medicine Photo Scan Form
  const scanForm = document.getElementById('aiMedScanForm');
  if (scanForm) {
    scanForm.addEventListener('submit', handleAiScanMedicine);
  }

  // AI Compare / Predict Best Medicine Form
  const compareForm = document.getElementById('aiCompareForm');
  if (compareForm) {
    compareForm.addEventListener('submit', handleAiCompareMedicines);
  }

  // Start background reminder loop (every 20 seconds)
  setInterval(checkMedicineReminderAlarms, 20000);
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
        <td><strong style="color: var(--primary); font-size: 15px;">⏰ ${m.time || '-'}</strong></td>
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


// ==============================================================
// 1. REAL-TIME AUDIO SIREN REMINDER ALARM SYSTEM
// ==============================================================

function playSirenSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    let isHigh = false;
    currentSirenInterval = setInterval(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isHigh ? 980 : 720, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
      isHigh = !isHigh;
    }, 400);

  } catch (e) {
    console.warn("Audio Context error:", e);
  }
}

function stopSirenAlarm() {
  if (currentSirenInterval) {
    clearInterval(currentSirenInterval);
    currentSirenInterval = null;
  }
  const modal = document.getElementById('sirenAlarmModal');
  if (modal) modal.classList.remove('active');
}

function triggerSirenModal(medName, dosage, timeStr, medId) {
  playSirenSound();

  document.getElementById('sirenMedName').textContent = medName;
  document.getElementById('sirenMedDosage').textContent = dosage || '1 dose';
  document.getElementById('sirenMedTime').textContent = timeStr;

  const takenBtn = document.getElementById('sirenTakenBtn');
  if (takenBtn) {
    takenBtn.onclick = async () => {
      stopSirenAlarm();
      if (medId) {
        await logDoseAction(medId, 'taken', timeStr);
      }
      showToast(`Marked ${medName} as Taken!`, 'success');
    };
  }

  document.getElementById('sirenAlarmModal').classList.add('active');
}

function testSirenAlarmDemo() {
  triggerSirenModal("Dolo 650", "650 mg (After food)", "Scheduled Now", null);
  showToast("🚨 Testing Medicine Reminder Siren Alarm!", "warning");
}

function checkMedicineReminderAlarms() {
  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMins = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMins}`;
  const todayKey = now.toISOString().split('T')[0];

  allMedicines.forEach(m => {
    if (m.status === 'active' && m.time === currentTime) {
      const alertKey = `${todayKey}_${m.id}_${currentTime}`;
      if (!triggeredAlertsToday.has(alertKey)) {
        triggeredAlertsToday.add(alertKey);
        triggerSirenModal(m.name, m.dosage, m.time, m.id);
      }
    }
  });
}


// ==============================================================
// 2. AI MEDICINE SCANNER & SAFETY PREDICTOR (Changle ahe ka nahi)
// ==============================================================

function openAiScanModal() {
  document.getElementById('aiScanModal').classList.add('active');
  document.getElementById('aiScanResultBox').style.display = 'none';
  document.getElementById('aiMedScanForm').reset();
}

function closeAiScanModal() {
  document.getElementById('aiScanModal').classList.remove('active');
}

async function handleAiScanMedicine(e) {
  e.preventDefault();
  const fileInput = document.getElementById('aiMedPhotoInput');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select or capture a medicine photo.', 'warning');
    return;
  }

  const btn = document.getElementById('aiScanSubmitBtn');
  setButtonLoading(btn, true, 'AI Analyzing Medicine Strip...');

  const formData = new FormData();
  formData.append('image', file);

  const res = await apiFetch('/medicines/ai-scan', {
    method: 'POST',
    body: formData
  });

  setButtonLoading(btn, false, '🔍 Upload & AI Predict Quality');

  if (res.success) {
    showToast('AI analysis completed!', 'success');
    renderAiScanResult(res.analysis, res.schedule_template);
  } else {
    showToast(res.message || 'AI Scan failed.', 'error');
  }
}

function renderAiScanResult(analysis, template) {
  scannedTemplateMed = template;
  const box = document.getElementById('aiScanResultBox');
  box.style.display = 'block';

  document.getElementById('aiIdentifiedName').textContent = analysis.identified_name;
  document.getElementById('aiCategory').textContent = analysis.category;

  const verdictEl = document.getElementById('aiSafetyVerdict');
  verdictEl.textContent = analysis.safety_verdict;
  verdictEl.className = analysis.safety_score >= 8.5 ? 'badge badge-success' : 'badge badge-warning';

  document.getElementById('aiSafetyScore').textContent = `${analysis.safety_score} / 10`;
  document.getElementById('aiDosageAdvice').textContent = analysis.recommended_dosage;
  document.getElementById('aiPrecautions').textContent = analysis.precautions;

  // Pros & Cons
  const prosList = document.getElementById('aiProsList');
  prosList.innerHTML = analysis.pros.map(p => `<li>✅ ${p}</li>`).join('');

  const consList = document.getElementById('aiConsList');
  consList.innerHTML = analysis.cons.map(c => `<li>⚠️ ${c}</li>`).join('');

  box.scrollIntoView({ behavior: 'smooth' });
}

async function addScannedMedToSchedule() {
  if (!scannedTemplateMed) return;

  const btn = document.getElementById('addScannedBtn');
  setButtonLoading(btn, true, 'Adding to Schedule...');

  const res = await apiFetch('/medicines', {
    method: 'POST',
    body: JSON.stringify(scannedTemplateMed)
  });

  setButtonLoading(btn, false, '✓ 1-Click Add to Daily Schedule');

  if (res.success) {
    showToast(`Added ${scannedTemplateMed.name} to your schedule!`, 'success');
    closeAiScanModal();
    await loadMedicines();
  } else {
    showToast(res.message || 'Failed to add medicine.', 'error');
  }
}


// ==============================================================
// 3. AI BEST MEDICINE COMPARISON & PREDICTOR (Konti goli changli ahe)
// ==============================================================

function openAiCompareModal() {
  document.getElementById('aiCompareModal').classList.add('active');
  document.getElementById('aiCompareResultBox').style.display = 'none';
  document.getElementById('aiCompareForm').reset();
}

function closeAiCompareModal() {
  document.getElementById('aiCompareModal').classList.remove('active');
}

function setCompareQuery(text) {
  const input = document.getElementById('aiCompareQuery');
  if (input) {
    input.value = text;
    const fakeEvent = { preventDefault: () => {} };
    handleAiCompareMedicines(fakeEvent);
  }
}

async function handleAiCompareMedicines(e) {
  if (e && e.preventDefault) e.preventDefault();
  const query = document.getElementById('aiCompareQuery').value.trim();
  if (!query) return;

  const btn = document.getElementById('aiCompareSubmitBtn');
  setButtonLoading(btn, true, 'AI Evaluating Options...');

  const res = await apiFetch('/medicines/ai-compare', {
    method: 'POST',
    body: JSON.stringify({ query })
  });

  setButtonLoading(btn, false, '⚡ Predict Best Medicine');

  if (res.success) {
    renderAiCompareResult(res.prediction);
  } else {
    showToast(res.message || 'Comparison failed.', 'error');
  }
}

function renderAiCompareResult(pred) {
  const box = document.getElementById('aiCompareResultBox');
  box.style.display = 'block';

  document.getElementById('aiBestName').textContent = pred.best_medicine;
  document.getElementById('aiBestReason').textContent = pred.comparison_reason;
  document.getElementById('aiBestDosage').textContent = pred.dosage_advice;
  document.getElementById('aiBestPrecautions').textContent = pred.precautions;

  // Comparison Rankings
  const rankTableBody = document.getElementById('aiRankingTableBody');
  rankTableBody.innerHTML = pred.comparison_ranking.map((item, idx) => `
    <tr>
      <td><strong>#${idx + 1}</strong></td>
      <td><strong>${item.name}</strong></td>
      <td><span class="badge ${idx === 0 ? 'badge-success' : 'badge-info'}">${item.badge}</span></td>
      <td><strong>${item.score}/10</strong></td>
      <td><small>${item.verdict}</small></td>
    </tr>
  `).join('');

  box.scrollIntoView({ behavior: 'smooth' });
}
