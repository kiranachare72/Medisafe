/**
 * MediSafe - Prescription Scanner with OCR Controller
 * Handles prescription image upload, OCR processing, candidate medicine review,
 * manual confirmation into active schedule, and past scan history.
 */

let activeScanData = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadScanHistory();

  const scanForm = document.getElementById('scanUploadForm');
  if (scanForm) {
    scanForm.addEventListener('submit', handleScanPrescription);
  }

  const confirmForm = document.getElementById('confirmMedForm');
  if (confirmForm) {
    confirmForm.addEventListener('submit', handleConfirmMedicine);
  }
});

async function handleScanPrescription(e) {
  e.preventDefault();
  const fileInput = document.getElementById('prescriptionImage');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a prescription image.', 'warning');
    return;
  }

  const btn = document.getElementById('scanSubmitBtn');
  setButtonLoading(btn, true, 'Processing Prescription OCR...');

  const formData = new FormData();
  formData.append('image', file);

  const res = await apiFetch('/prescriptions/scan', {
    method: 'POST',
    body: formData
  });

  setButtonLoading(btn, false, '🔍 Scan Prescription Image');

  if (res.success) {
    activeScanData = res;
    showToast('Prescription scanned successfully! Please review the details.', 'success');
    renderScanResults(res);
    await loadScanHistory();
  } else {
    showToast(res.message || 'Prescription scanning failed.', 'error');
  }
}

function renderScanResults(data) {
  const resultCard = document.getElementById('scanResultCard');
  if (!resultCard) return;

  resultCard.style.display = 'block';

  // Raw OCR Text
  document.getElementById('rawOcrText').textContent = data.raw_text || 'No readable text extracted.';

  // Image Preview
  if (data.image_url) {
    const mediaBase = (window.MEDISAFE_CONFIG && window.MEDISAFE_CONFIG.MEDIA_BASE_URL) || '';
    const imgEl = document.getElementById('scannedImgPreview');
    imgEl.src = data.image_url.startsWith('http') ? data.image_url : `${mediaBase}${data.image_url}`;
    imgEl.style.display = 'block';
  }

  // Pre-fill first candidate medicine into editable review form
  const candidates = data.candidate_medicines || [];
  if (candidates.length > 0) {
    const first = candidates[0];
    document.getElementById('reviewMedName').value = first.name || '';
    document.getElementById('reviewMedType').value = first.type || 'Tablet';
    document.getElementById('reviewMedDosage').value = first.dosage || '';
    document.getElementById('reviewMedFrequency').value = first.frequency || 'Once Daily';
    document.getElementById('reviewMedTime').value = first.time || '08:00';
    document.getElementById('reviewMedInstructions').value = first.instructions || 'After food';
    document.getElementById('reviewMedNotes').value = `Extracted: ${first.raw_line || ''}`;
  }

  resultCard.scrollIntoView({ behavior: 'smooth' });
}

async function handleConfirmMedicine(e) {
  e.preventDefault();
  const btn = document.getElementById('confirmMedBtn');
  setButtonLoading(btn, true, 'Confirm & Save Medicine');

  const payload = {
    name: document.getElementById('reviewMedName').value.trim(),
    type: document.getElementById('reviewMedType').value,
    dosage: document.getElementById('reviewMedDosage').value.trim(),
    frequency: document.getElementById('reviewMedFrequency').value,
    time: document.getElementById('reviewMedTime').value,
    instructions: document.getElementById('reviewMedInstructions').value,
    notes: document.getElementById('reviewMedNotes').value.trim(),
    prescription_id: activeScanData ? activeScanData.prescription_id : null
  };

  const res = await apiFetch('/prescriptions/confirm', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  setButtonLoading(btn, false, 'Confirm & Add to Schedule');

  if (res.success) {
    showToast(`"${payload.name}" added to your medication schedule!`, 'success');
    document.getElementById('scanResultCard').style.display = 'none';
    document.getElementById('scanUploadForm').reset();
    activeScanData = null;
    await loadScanHistory();
  } else {
    showToast(res.message || 'Failed to confirm medicine.', 'error');
  }
}

async function loadScanHistory() {
  const container = document.getElementById('scanHistoryContainer');
  if (!container) return;

  const res = await apiFetch('/prescriptions');
  if (!res.success) return;

  const scans = res.prescriptions || [];
  if (scans.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div class="empty-icon" style="font-size: 32px;">🔬</div>
        <div class="empty-title">No scanned prescriptions</div>
        <div class="empty-desc">Upload a photo of a doctor's prescription above to extract medicine details.</div>
      </div>
    `;
    return;
  }

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">`;
  scans.forEach(s => {
    const isAdded = s.status === 'reviewed_and_added';
    const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString() : '';
    html += `
      <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span class="badge ${isAdded ? 'badge-success' : 'badge-warning'}">${isAdded ? 'Confirmed' : 'Pending Review'}</span>
          <small style="color: var(--text-muted);">${dateStr}</small>
        </div>
        <strong style="font-size: 14px; display: block; margin-bottom: 6px;">📄 ${s.original_filename}</strong>
        <p style="font-size: 12px; color: var(--text-muted); max-height: 40px; overflow: hidden; text-overflow: ellipsis;">
          ${s.raw_text ? s.raw_text.substring(0, 80) + '...' : 'No text'}
        </p>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}
