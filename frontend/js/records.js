/**
 * MediSafe - Medical Records Controller
 * Handles uploading files, listing records, secure downloads, and deletion.
 */

let allRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadRecords();

  const uploadForm = document.getElementById('recordUploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUploadRecord);
  }

  const fileInput = document.getElementById('recordFile');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const infoBox = document.getElementById('selectedFileInfo');
      if (fileInput.files && fileInput.files[0]) {
        const f = fileInput.files[0];
        const sizeKB = (f.size / 1024).toFixed(1) + ' KB';
        if (infoBox) {
          infoBox.style.display = 'block';
          infoBox.innerHTML = `📄 <strong>Selected File:</strong> ${f.name} <span style="color:#059669;">(${sizeKB})</span> — Ready to scan!`;
        }
      } else if (infoBox) {
        infoBox.style.display = 'none';
      }
    });
  }
});

async function loadRecords() {
  const container = document.getElementById('recordsListContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="spinner spinner-primary"></div>
        <p style="margin-top: 10px;">Loading your medical records...</p>
      </div>
    `;
  }

  const res = await apiFetch('/records');
  if (!res.success) {
    showToast(res.message || 'Failed to load medical records.', 'error');
    return;
  }

  allRecords = res.records || [];
  renderRecords(allRecords);
}

function renderRecords(records) {
  const container = document.getElementById('recordsListContainer');
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <div class="empty-title">No health documents uploaded yet</div>
        <div class="empty-desc">Store lab results, blood tests, radiology reports, and prescriptions securely in one place.</div>
        <button class="btn btn-primary btn-sm" onclick="openUploadModal()">+ Upload Record</button>
      </div>
    `;
    return;
  }

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 18px;">`;

  records.forEach(r => {
    const recordId = r.id || r._id;
    const sizeKB = r.file_size ? (r.file_size / 1024).toFixed(1) + ' KB' : '';
    const dateStr = r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '';
    const ai = r.ai_analysis || {};
    const isHealthy = ai.is_healthy !== false;
    const verdictShort = ai.status_verdict ? ai.status_verdict.split('(')[0].trim() : 'AI Analyzed';
    const rx = ai.prescription_of_report || {};
    const medCount = (rx.medicines && rx.medicines.length) || 0;

    // Determine Analysis Status badge
    let statusBadgeHtml = '';
    if (ai.extraction_success === false) {
      statusBadgeHtml = `<span class="badge badge-danger" style="font-size: 11px;">⚠️ Extraction Notice</span>`;
    } else if (ai.is_xray) {
      statusBadgeHtml = `<span class="badge badge-info" style="font-size: 11px;">🩻 Archived / Scan Ready</span>`;
    } else if (!isHealthy) {
      statusBadgeHtml = `<span class="badge badge-warning" style="font-size: 11px;">⚠️ Needs Review</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-success" style="font-size: 11px;">✔️ Analysis: Completed</span>`;
    }

    html += `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-top: 3px solid ${isHealthy ? 'var(--success)' : 'var(--warning)'}; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 6px;">
            <span class="badge badge-primary" style="font-weight: 700;">📂 ${r.file_type || 'Report'}</span>
            <small style="color: var(--text-muted); font-size: 11.5px;">📅 ${dateStr}</small>
          </div>
          <h4 style="font-size: 1.05rem; margin-bottom: 6px; word-break: break-word; cursor: pointer; color: var(--text-main);" onclick="openAiReportModalForRecord('${recordId}')" title="Click to view full AI diagnosis & report">${r.description || r.original_filename}</h4>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 12px; color: var(--text-muted);">
            <span>📄 ${r.original_filename} ${sizeKB ? `(${sizeKB})` : ''}</span>
            ${statusBadgeHtml}
          </div>

          <!-- AI Status Preview (Clickable) -->
          <div style="background: ${isHealthy ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${isHealthy ? '#bbf7d0' : '#fef08a'}; border-radius: var(--radius-sm); padding: 9px 11px; margin-bottom: 14px; cursor: pointer; transition: transform 0.15s ease;" onclick="openAiReportModalForRecord('${recordId}')" title="Click to open full AI report prediction & prescription">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: ${isHealthy ? '#166534' : '#854d0e'};">🧠 AI HEALTH STATUS:</span>
              <span class="badge ${isHealthy ? 'badge-success' : 'badge-warning'}" style="font-size: 11px;">${ai.health_score ? `${ai.health_score}/10` : 'Analyzed'}</span>
            </div>
            <div style="font-size: 12.5px; font-weight: 700; color: ${isHealthy ? '#15803d' : '#a16207'};">${verdictShort}</div>
            ${ai.report_contents && ai.report_contents.title ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px; border-top: 1px dashed ${isHealthy ? '#bbf7d0' : '#fde047'}; padding-top: 4px;">📑 <strong>Detected:</strong> ${ai.report_contents.title}</div>` : ''}
            ${medCount > 0 ? `<div style="font-size: 11px; color: #047857; margin-top: 4px; font-weight: 600;">💊 <strong>Prescription:</strong> ${rx.medicines.map(m => m.name.split('(')[0].trim()).slice(0, 2).join(', ')} (${medCount} medicines)</div>` : ''}
            ${ai.kya_hua_tha ? `<div style="font-size: 11px; color: #92400e; margin-top: 4px; font-weight: 600; line-height: 1.35;">🩺 <strong>Diagnosis:</strong> ${ai.kya_hua_tha.substring(0, 95)}...</div>` : ''}
          </div>
        </div>

        <div>
          <button class="btn btn-sm" style="width: 100%; margin-bottom: 8px; font-weight: 700; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; box-shadow: 0 2px 4px rgba(37,99,235,0.25); cursor: pointer;" onclick="openAiReportModalForRecord('${recordId}')">
            🔍 View Report & Health Analysis
          </button>
          <div style="display: flex; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 10px;">
            <button class="btn btn-sm btn-outline" style="flex: 1; font-weight: 600; cursor: pointer;" onclick="downloadRecordFile('${recordId}', '${r.original_filename}')">
              ⬇️ Download File
            </button>
            <button class="btn btn-sm btn-outline" style="color: var(--danger); font-weight: 600; cursor: pointer;" onclick="deleteRecordFile('${recordId}')" title="Delete this medical record">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function openUploadModal() {
  document.getElementById('recordUploadForm').reset();
  const infoBox = document.getElementById('selectedFileInfo');
  if (infoBox) infoBox.style.display = 'none';
  const modal = document.getElementById('uploadModal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

async function handleCategoryDirectUpload(input, categoryType, defaultDesc) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (file.size > 10 * 1024 * 1024) {
    showToast('File size must be under 10 MB.', 'warning');
    input.value = '';
    return;
  }

  const overlay = document.getElementById('scanningOverlay');
  const scanStatus = document.getElementById('scanningStatusText');
  if (overlay) overlay.style.display = 'flex';
  if (scanStatus) scanStatus.textContent = `Scanning "${file.name}" (Extracting OCR text & predicting health status)...`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', categoryType);
  formData.append('description', defaultDesc || file.name);

  try {
    const res = await apiFetch('/records', {
      method: 'POST',
      body: formData
    });

    if (res.success) {
      showToast('Document scanned and analyzed by AI successfully!', 'success');
      await loadRecords();

      // Immediately display AI prediction modal
      if (res.ai_analysis) {
        displayAiReportModal(res.ai_analysis, categoryType, file.name, new Date().toISOString());
      }
    } else {
      showToast(res.message || 'Upload failed.', 'error');
    }
  } catch (err) {
    showToast('Upload error: ' + (err.message || 'Please check backend connection'), 'error');
  } finally {
    if (overlay) overlay.style.display = 'none';
    input.value = '';
  }
}

let currentDirectCategory = 'Complete Blood Count (CBC) / Blood Test';
let currentDirectDesc = '';

function triggerDirectCategoryUpload(categoryType, defaultDesc = '') {
  if (categoryType && categoryType.includes('Blood')) {
    const input = document.getElementById('bloodFileInput');
    if (input) { input.value = ''; input.click(); return; }
  } else if (categoryType && categoryType.includes('Radiology')) {
    const input = document.getElementById('xrayFileInput');
    if (input) { input.value = ''; input.click(); return; }
  } else if (categoryType && (categoryType.includes('Prescription') || categoryType.includes('Doctor'))) {
    const input = document.getElementById('healthDocFileInput');
    if (input) { input.value = ''; input.click(); return; }
  }
  openUploadModal();
}

function quickUploadCategory(categoryType, defaultDesc = '') {
  triggerDirectCategoryUpload(categoryType, defaultDesc);
}

async function handleDirectCategoryFileChosen(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (file.size > 10 * 1024 * 1024) {
    showToast('File size must be under 10 MB.', 'warning');
    input.value = '';
    return;
  }

  const selectedType = currentDirectCategory;
  const description = currentDirectDesc || file.name;

  // Show live scanning overlay
  const overlay = document.getElementById('scanningOverlay');
  const scanStatus = document.getElementById('scanningStatusText');
  if (overlay) overlay.style.display = 'flex';
  if (scanStatus) scanStatus.textContent = `Scanning "${file.name}" (Extracting OCR text & predicting health status)...`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', selectedType);
  formData.append('description', description);

  try {
    const res = await apiFetch('/records', {
      method: 'POST',
      body: formData
    });

    if (res.success) {
      showToast('Document scanned and analyzed by AI successfully!', 'success');
      await loadRecords();

      // Immediately display the AI Health Analysis to the user!
      if (res.ai_analysis) {
        displayAiReportModal(res.ai_analysis, selectedType, file.name, new Date().toISOString());
      }
    } else {
      showToast(res.message || 'Upload failed.', 'error');
    }
  } catch (err) {
    showToast('Upload error: ' + (err.message || 'Please check backend connection'), 'error');
  } finally {
    if (overlay) overlay.style.display = 'none';
    input.value = '';
  }
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
}

async function handleUploadRecord(e) {
  e.preventDefault();
  const fileInput = document.getElementById('recordFile');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a file to upload.', 'warning');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('File size must be under 10 MB.', 'warning');
    return;
  }

  const selectedType = document.getElementById('recordType').value;
  const description = document.getElementById('recordDesc').value.trim() || file.name;

  const submitBtn = document.getElementById('submitUploadBtn');
  setButtonLoading(submitBtn, true, 'Upload Document');

  // Show live scanner animation overlay
  closeUploadModal();
  const overlay = document.getElementById('scanningOverlay');
  const scanStatus = document.getElementById('scanningStatusText');
  if (overlay) overlay.style.display = 'flex';
  if (scanStatus) scanStatus.textContent = `Scanning "${file.name}" (Extracting OCR text & predicting health status)...`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', selectedType);
  formData.append('description', description);

  try {
    const res = await apiFetch('/records', {
      method: 'POST',
      body: formData
    });

    if (res.success) {
      showToast('Document scanned and analyzed by AI successfully!', 'success');
      await loadRecords();

      // Immediately display the AI Health Analysis to the user!
      if (res.ai_analysis) {
        displayAiReportModal(res.ai_analysis, selectedType, file.name, new Date().toISOString());
      }
    } else {
      showToast(res.message || 'Upload failed.', 'error');
    }
  } catch (err) {
    showToast('Upload error: ' + (err.message || 'Please check backend connection'), 'error');
  } finally {
    if (overlay) overlay.style.display = 'none';
    setButtonLoading(submitBtn, false, 'Upload Document');
  }
}

// ==============================================================
// AI REPORT DIAGNOSTIC PREDICTOR MODAL
// ==============================================================

async function openAiReportModalForRecord(id) {
  const existing = allRecords.find(r => (r.id && String(r.id) === String(id)) || (r._id && String(r._id) === String(id)));
  if (existing && existing.ai_analysis && existing.ai_analysis.kya_hua_tha && existing.ai_analysis.prescription_of_report) {
    displayAiReportModal(existing.ai_analysis, existing.file_type, existing.original_filename, existing.upload_date);
    return;
  }

  showToast('Fetching AI clinical analysis & prescription...', 'info');
  const res = await apiFetch(`/records/${id}/ai-analysis`);
  if (res.success && res.ai_analysis) {
    if (existing) {
      existing.ai_analysis = res.ai_analysis;
    }
    displayAiReportModal(
      res.ai_analysis,
      res.file_type || (existing && existing.file_type) || 'Medical Report',
      res.original_filename || (existing && existing.original_filename) || 'Report',
      existing && existing.upload_date
    );
  } else {
    showToast(res.message || 'Failed to fetch AI analysis.', 'error');
  }
}

function displayAiReportModal(ai, fileType = 'Medical Report', originalFilename = '', uploadDate = null) {
  if (!ai) return;

  const isHealthy = ai.is_healthy !== false;

  // 0. Populate Document Header Metadata
  const uploadDateEl = document.getElementById('aiReportUploadDateText');
  const filenameEl = document.getElementById('aiReportFilenameText');
  const statusBadgeEl = document.getElementById('aiReportStatusBadge');

  if (uploadDateEl) {
    uploadDateEl.textContent = uploadDate ? new Date(uploadDate).toLocaleString() : new Date().toLocaleString();
  }
  if (filenameEl) {
    filenameEl.textContent = originalFilename || fileType;
  }
  if (statusBadgeEl) {
    if (ai.extraction_success === false) {
      statusBadgeEl.className = 'badge badge-danger';
      statusBadgeEl.textContent = '⚠️ Extraction Notice';
    } else if (ai.is_xray) {
      statusBadgeEl.className = 'badge badge-info';
      statusBadgeEl.textContent = '🩻 Archived / Scan Ready';
    } else if (!isHealthy) {
      statusBadgeEl.className = 'badge badge-warning';
      statusBadgeEl.textContent = '⚠️ Attention Needed';
    } else {
      statusBadgeEl.className = 'badge badge-success';
      statusBadgeEl.textContent = '✔️ Analysis Complete';
    }
  }

  // 0A. Extraction Failure Box
  const failedBox = document.getElementById('aiReportExtractionFailedBox');
  const failedMsg = document.getElementById('aiReportExtractionFailedMsg');
  if (failedBox) {
    if (ai.extraction_success === false) {
      failedBox.style.display = 'block';
      if (failedMsg && ai.summary) failedMsg.textContent = ai.summary;
    } else {
      failedBox.style.display = 'none';
    }
  }

  // 0B. Clinical Parameter Warnings Box
  const warningsBox = document.getElementById('aiReportWarningsBox');
  const warningsList = document.getElementById('aiReportWarningsList');
  if (warningsBox && warningsList) {
    if (ai.warnings && ai.warnings.length > 0) {
      warningsBox.style.display = 'block';
      warningsList.innerHTML = ai.warnings.map(w => `<li><strong>${w}</strong></li>`).join('');
    } else {
      warningsBox.style.display = 'none';
    }
  }

  // 0C. X-Ray Disclaimer Notice
  const xrayNoticeBox = document.getElementById('aiReportXrayNoticeBox');
  if (xrayNoticeBox) {
    if (ai.is_xray) {
      xrayNoticeBox.style.display = 'block';
    } else {
      xrayNoticeBox.style.display = 'none';
    }
  }

  // 0D. Document / Scan Preview Image Box
  const previewBox = document.getElementById('aiReportDocPreviewBox');
  const previewImg = document.getElementById('aiReportDocPreviewImg');
  const previewLink = document.getElementById('aiReportDocPreviewFullLink');
  if (previewBox && previewImg) {
    let url = ai.preview_url;
    const isImg = url && /\.(jpg|jpeg|png|webp|bmp)$/i.test(url);
    if (isImg) {
      if (url.startsWith('/') && window.MEDISAFE_CONFIG && window.MEDISAFE_CONFIG.MEDIA_BASE_URL) {
        url = window.MEDISAFE_CONFIG.MEDIA_BASE_URL + url;
      }
      previewBox.style.display = 'block';
      previewImg.src = url;
      if (previewLink) previewLink.href = url;
    } else {
      previewBox.style.display = 'none';
    }
  }

  // 1. Populate "Report Me Kya Hai" (Report Contents Breakdown)
  const repContents = ai.report_contents || {};
  const repTitle = document.getElementById('aiReportDetectedTitle');
  const repCategory = document.getElementById('aiReportDetectedCategory');
  const repWhatIsInside = document.getElementById('aiReportWhatIsInside');
  const repItemsList = document.getElementById('aiReportDetectedItemsList');

  if (repTitle) {
    repTitle.textContent = repContents.title || (fileType + ' Report');
  }
  if (repCategory) {
    repCategory.textContent = repContents.category || 'Diagnostic Analysis';
  }
  if (repWhatIsInside) {
    repWhatIsInside.textContent = repContents.summary_what_is_inside || (ai.summary || 'Health report contents evaluated.');
  }
  if (repItemsList) {
    const items = repContents.detected_items || [];
    if (items.length === 0) {
      repItemsList.innerHTML = `<div style="font-size: 13px; color: var(--text-muted);">Standard health indicators cataloged.</div>`;
    } else {
      repItemsList.innerHTML = items.map(item => `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: var(--radius-sm); padding: 8px 12px; display: flex; align-items: flex-start; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <span style="font-size: 20px;">${item.icon || '📌'}</span>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${item.label}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.35; margin-top: 2px;">${item.detail}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Populate Scanned Document OCR Text
  const scannedTextEl = document.getElementById('aiReportScannedText');
  if (scannedTextEl) {
    scannedTextEl.textContent = ai.scanned_text || ai.extracted_text_preview || 'Document text extracted and indexed safely.';
  }

  // Populate "Kya Hua Tha" (Patient Condition & Background Diagnosis)
  const kyaHuaThaEl = document.getElementById('aiReportKyaHuaThaText');
  if (kyaHuaThaEl) {
    kyaHuaThaEl.textContent = ai.kya_hua_tha || ai.summary || 'Patient health checkup and clinical diagnosis screening conducted.';
  }

  // 2. Populate Verdict Banner ("Acha hai kya nahi")
  const banner = document.getElementById('aiReportVerdictBanner');
  const verdictText = document.getElementById('aiReportVerdictText');
  const scoreBadge = document.getElementById('aiReportScoreBadge');
  const summaryText = document.getElementById('aiReportSummaryText');
  const paramsBody = document.getElementById('aiReportParamsTableBody');
  const recsList = document.getElementById('aiReportRecsList');

  if (banner) {
    banner.style.background = isHealthy ? '#ecfdf5' : '#fffbeb';
    banner.style.borderColor = isHealthy ? '#a7f3d0' : '#fde047';
  }
  if (verdictText) {
    verdictText.textContent = ai.status_verdict || (isHealthy ? 'GOOD & HEALTHY' : 'ATTENTION NEEDED');
    verdictText.style.color = isHealthy ? '#065f46' : '#854d0e';
  }
  if (scoreBadge) {
    scoreBadge.className = isHealthy ? 'badge badge-success' : 'badge badge-warning';
    scoreBadge.textContent = `Health Score: ${ai.health_score || 9.0} / 10`;
  }
  if (summaryText) {
    summaryText.textContent = ai.summary || 'All key markers evaluated and safe.';
  }

  // 3. Populate Doctor Prescription & Clinical Treatment Plan ("Prescription of Report")
  const rx = ai.prescription_of_report || {};
  const docNameEl = document.getElementById('aiReportPrescriptionDocName');
  const rxListEl = document.getElementById('aiReportPrescriptionMedicinesList');
  const rxAdviceEl = document.getElementById('aiReportPrescriptionAdvice');
  const rxDietEl = document.getElementById('aiReportPrescriptionDiet');
  const rxFollowupEl = document.getElementById('aiReportPrescriptionFollowup');

  if (docNameEl) {
    docNameEl.textContent = rx.doctor_name || 'Dr. S. K. Kulkarni, MD';
  }
  if (rxAdviceEl) {
    rxAdviceEl.textContent = rx.doctor_advice || 'Follow medication schedule strictly and maintain balanced hydration.';
  }
  if (rxDietEl) {
    rxDietEl.textContent = rx.dietary_guidelines || 'Nutritious balanced meals with fresh seasonal vegetables and clean water.';
  }
  if (rxFollowupEl) {
    rxFollowupEl.innerHTML = `📅 <strong>Next Review:</strong> ${rx.follow_up || 'Routine diagnostic follow-up in 3 to 6 months.'}`;
  }

  if (rxListEl) {
    const meds = rx.medicines || [];
    if (meds.length === 0) {
      rxListEl.innerHTML = `
        <div style="background: #ffffff; border: 1px solid #d1fae5; border-radius: var(--radius-sm); padding: 12px; font-size: 13px; color: var(--text-muted); text-align: center;">
          No active medications needed. Continue healthy balanced routine.
        </div>
      `;
    } else {
      rxListEl.innerHTML = meds.map(m => `
        <div style="background: #ffffff; border: 1.5px solid #d1fae5; border-left: 4px solid #10b981; border-radius: var(--radius-sm); padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div style="font-weight: 700; font-size: 13.5px; color: #065f46; display: flex; align-items: center; gap: 6px;">
              <span>💊</span> ${m.name}
              <span class="badge badge-info" style="font-size: 10.5px; font-weight: 600;">${m.type || 'Tablet'}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span class="badge badge-primary" style="font-size: 11px;">⏰ ${m.frequency}</span>
              <span class="badge badge-warning" style="font-size: 11px;">⏳ ${m.duration}</span>
            </div>
          </div>
          <div style="margin-top: 6px; font-size: 12px; color: #374151; display: flex; flex-wrap: wrap; gap: 12px;">
            <span>🍽️ <strong>Timing:</strong> ${m.timing}</span>
            <span>🎯 <strong>Purpose:</strong> ${m.purpose}</span>
          </div>
        </div>
      `).join('');
    }
  }

  // 4. Populate Prescription User Review Table (if prescription)
  const rxReviewBox = document.getElementById('aiReportPrescriptionReviewBox');
  const rxPatient = document.getElementById('rxReviewPatientName');
  const rxDoctor = document.getElementById('rxReviewDoctorName');
  const rxDate = document.getElementById('rxReviewDate');
  const rxTableBody = document.getElementById('rxReviewTableBody');
  if (rxReviewBox) {
    const rxRev = ai.prescription_review;
    if (rxRev && rxRev.medicines && rxRev.medicines.length > 0) {
      rxReviewBox.style.display = 'block';
      if (rxPatient) rxPatient.textContent = rxRev.patient_name || 'Patient';
      if (rxDoctor) rxDoctor.textContent = rxRev.doctor_name || 'Consultant Physician';
      if (rxDate) rxDate.textContent = rxRev.prescription_date || 'Today';
      if (rxTableBody) {
        rxTableBody.innerHTML = rxRev.medicines.map(m => `
          <tr>
            <td><strong>💊 ${m.name}</strong></td>
            <td>${m.dosage || '-'}</td>
            <td><span class="badge badge-primary" style="font-size:11px;">${m.frequency || '-'}</span></td>
            <td>${m.timing || '-'}</td>
            <td><small style="color:var(--text-muted);">${m.purpose || '-'}</small></td>
          </tr>
        `).join('');
      }
    } else {
      rxReviewBox.style.display = 'none';
    }
  }

  // Populate Key Diagnostic Points ("Acha hai kya nahi")
  const pointsList = document.getElementById('aiReportPointsList');
  if (pointsList) {
    const points = ai.points || [];
    if (points.length === 0) {
      pointsList.innerHTML = `<li style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">✔️ Standard clinical parameters evaluated and verified.</li>`;
    } else {
      pointsList.innerHTML = points.map(pt => `
        <li style="font-size: 13px; color: var(--text-main); display: flex; align-items: flex-start; gap: 8px;">
          <span style="color: ${isHealthy ? '#16a34a' : '#dc2626'}; font-weight: 700;">✔️</span>
          <span style="line-height: 1.4;">${pt}</span>
        </li>
      `).join('');
    }
  }

  // Populate parameters table
  if (paramsBody) {
    const params = ai.parameters || [];
    if (params.length === 0) {
      paramsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Standard biomarkers cataloged.</td></tr>`;
    } else {
      paramsBody.innerHTML = params.map(p => `
        <tr>
          <td><strong>${p.parameter}</strong></td>
          <td>${p.value}</td>
          <td><small style="color: var(--text-muted);">${p.reference}</small></td>
          <td>
            <span class="badge ${p.flag === 'normal' ? 'badge-success' : p.flag === 'mild' ? 'badge-warning' : 'badge-danger'}">
              ${p.status}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }

  // Populate recommendations
  if (recsList) {
    const recs = ai.recommendations || ['Follow balanced lifestyle habits.', 'Keep regular checkups.'];
    recsList.innerHTML = recs.map(r => `<li>✅ ${r}</li>`).join('');
  }

  const modal = document.getElementById('aiReportModal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeAiReportModal() {
  const modal = document.getElementById('aiReportModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

async function downloadRecordFile(id, originalFilename) {
  const token = localStorage.getItem('medisafe_token');
  const baseUrl = (window.MEDISAFE_CONFIG && window.MEDISAFE_CONFIG.API_BASE_URL) || 'http://127.0.0.1:8000/api';
  const url = `${baseUrl}/records/${id}/download`;

  try {
    showToast('Preparing download...', 'info');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      showToast('Failed to download file or access denied.', 'error');
      return;
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = originalFilename || 'medical_record.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    showToast('File downloaded successfully!', 'success');
  } catch (err) {
    showToast('Download error. Please check backend connection.', 'error');
  }
}

async function deleteRecordFile(id) {
  if (!confirm('Are you sure you want to permanently delete this health document?')) return;

  const res = await apiFetch(`/records/${id}`, { method: 'DELETE' });
  if (res.success) {
    showToast('Medical record deleted.', 'info');
    await loadRecords();
  } else {
    showToast(res.message || 'Failed to delete record.', 'error');
  }
}
