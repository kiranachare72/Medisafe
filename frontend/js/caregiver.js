/**
 * MediSafe - Caregiver Coordination Controller
 * Handles issuing invitations with granular permissions, accepting tokens,
 * displaying connected caregivers, and revoking access.
 */

let allCaregivers = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadCaregivers();

  const inviteForm = document.getElementById('caregiverInviteForm');
  if (inviteForm) {
    inviteForm.addEventListener('submit', handleInviteCaregiver);
  }

  const acceptForm = document.getElementById('acceptTokenForm');
  if (acceptForm) {
    acceptForm.addEventListener('submit', handleAcceptInvitation);
  }
});

async function loadCaregivers() {
  const container = document.getElementById('caregiversListContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="spinner spinner-primary"></div>
        <p style="margin-top: 10px;">Loading caregivers...</p>
      </div>
    `;
  }

  const res = await apiFetch('/caregivers');
  if (!res.success) {
    showToast(res.message || 'Failed to load caregivers.', 'error');
    return;
  }

  allCaregivers = res.caregivers || [];
  renderCaregivers(allCaregivers);
}

function renderCaregivers(caregivers) {
  const container = document.getElementById('caregiversListContainer');
  if (!container) return;

  if (caregivers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-title">No caregivers connected</div>
        <div class="empty-desc">Invite a family member or nurse to assist with tracking your medications and appointments.</div>
        <button class="btn btn-primary btn-sm" onclick="openInviteModal()">+ Invite Caregiver</button>
      </div>
    `;
    return;
  }

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px;">`;

  caregivers.forEach(c => {
    const isAccepted = c.status === 'accepted';
    const perms = c.permissions || {};
    const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString() : '';

    html += `
      <div class="card" style="border-left: 4px solid ${isAccepted ? 'var(--success)' : 'var(--warning)'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h4 style="font-size: 1.15rem; margin-bottom: 2px;">${c.caregiver_name || c.caregiver_email}</h4>
            <span style="font-size: 12px; color: var(--text-muted);">${c.relationship || 'Caregiver'}</span>
          </div>
          <span class="badge ${isAccepted ? 'badge-success' : 'badge-warning'}">${c.status || 'pending'}</span>
        </div>

        <p style="font-size: 13px; color: var(--text-main); margin-bottom: 12px;">
          📧 ${c.caregiver_email}
        </p>

        <!-- Permissions Badges -->
        <div style="margin-bottom: 14px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Authorized Permissions:</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${perms.medicines ? '<span class="badge badge-info">💊 Medicines</span>' : ''}
            ${perms.appointments ? '<span class="badge badge-info">🩺 Appointments</span>' : ''}
            ${perms.water ? '<span class="badge badge-info">💧 Hydration</span>' : ''}
            ${perms.emergency ? '<span class="badge badge-info">🚨 Emergency</span>' : ''}
            ${perms.records ? '<span class="badge badge-warning">📁 Records</span>' : ''}
          </div>
        </div>

        <!-- Token for Pending Invites -->
        ${!isAccepted && c.invitation_token ? `
          <div style="background: var(--bg-main); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 11px; margin-bottom: 14px; word-break: break-all; border: 1px dashed var(--border-color);">
            <strong>Invitation Token:</strong> ${c.invitation_token}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <button class="btn btn-sm btn-outline" style="color: var(--danger);" onclick="revokeCaregiver('${c.id}')">
            Revoke Access
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function openInviteModal() {
  document.getElementById('caregiverInviteForm').reset();
  document.getElementById('inviteModal').classList.add('active');
}

function closeInviteModal() {
  document.getElementById('inviteModal').classList.remove('active');
}

async function handleInviteCaregiver(e) {
  e.preventDefault();
  const btn = document.getElementById('submitInviteBtn');
  setButtonLoading(btn, true, 'Generating Invitation...');

  const payload = {
    caregiver_email: document.getElementById('inviteEmail').value.trim(),
    caregiver_name: document.getElementById('inviteName').value.trim(),
    relationship: document.getElementById('inviteRelation').value.trim(),
    perm_medicines: document.getElementById('permMed').checked,
    perm_appointments: document.getElementById('permAppt').checked,
    perm_water: document.getElementById('permWater').checked,
    perm_emergency: document.getElementById('permEmerg').checked,
    perm_records: document.getElementById('permRec').checked
  };

  const res = await apiFetch('/caregivers/invite', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  setButtonLoading(btn, false, 'Send Invitation');

  if (res.success) {
    showToast('Invitation token generated!', 'success');
    closeInviteModal();
    await loadCaregivers();
  } else {
    showToast(res.message || 'Failed to send invitation.', 'error');
  }
}

async function handleAcceptInvitation(e) {
  e.preventDefault();
  const token = document.getElementById('acceptTokenInput').value.trim();
  if (!token) return;

  const btn = document.getElementById('acceptTokenBtn');
  setButtonLoading(btn, true, 'Verifying...');

  const res = await apiFetch('/caregivers/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  });

  setButtonLoading(btn, false, 'Accept & Connect');

  if (res.success) {
    showToast(res.message, 'success');
    document.getElementById('acceptTokenForm').reset();
    await loadCaregivers();
  } else {
    showToast(res.message || 'Invalid token.', 'error');
  }
}

async function revokeCaregiver(id) {
  if (!confirm('Are you sure you want to revoke this caregiver connection?')) return;

  const res = await apiFetch(`/caregivers/${id}`, { method: 'DELETE' });
  if (res.success) {
    showToast('Caregiver access revoked.', 'info');
    await loadCaregivers();
  } else {
    showToast(res.message || 'Failed to revoke caregiver.', 'error');
  }
}
