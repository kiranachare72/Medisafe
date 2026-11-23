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

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">`;

  records.forEach(r => {
    const sizeKB = r.file_size ? (r.file_size / 1024).toFixed(1) + ' KB' : '';
    const dateStr = r.upload_date ? new Date(r.upload_date).toLocaleDateString() : '';

    html += `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span class="badge badge-info">${r.file_type || 'Report'}</span>
            <small style="color: var(--text-muted);">${dateStr}</small>
          </div>
          <h4 style="font-size: 1.05rem; margin-bottom: 6px; word-break: break-word;">${r.description || r.original_filename}</h4>
          <p style="font-size: 12px; color: var(--text-light); margin-bottom: 16px;">📄 ${r.original_filename} ${sizeKB ? `(${sizeKB})` : ''}</p>
        </div>
        <div style="display: flex; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="downloadRecordFile('${r.id}', '${r.original_filename}')">
            ⬇️ Download
          </button>
          <button class="btn btn-sm btn-outline" style="color: var(--danger);" onclick="deleteRecordFile('${r.id}')" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function openUploadModal() {
  document.getElementById('recordUploadForm').reset();
  document.getElementById('uploadModal').classList.add('active');
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

  const submitBtn = document.getElementById('submitUploadBtn');
  setButtonLoading(submitBtn, true, 'Upload Document');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', document.getElementById('recordType').value);
  formData.append('description', document.getElementById('recordDesc').value.trim() || file.name);

  const res = await apiFetch('/records', {
    method: 'POST',
    body: formData
  });

  setButtonLoading(submitBtn, false, 'Upload Document');

  if (res.success) {
    showToast('Medical record uploaded successfully!', 'success');
    closeUploadModal();
    await loadRecords();
  } else {
    showToast(res.message || 'Upload failed.', 'error');
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
