/**
 * MediSafe - Emergency Contacts Controller
 * Manages adding, editing, deleting contacts, and quick-call dialing.
 */

let allContacts = [];
let editingContactId = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadEmergencyContacts();

  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', handleSaveContact);
  }
});

async function loadEmergencyContacts() {
  const container = document.getElementById('contactsListContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="spinner spinner-primary"></div>
        <p style="margin-top: 10px;">Loading emergency contacts...</p>
      </div>
    `;
  }

  const res = await apiFetch('/emergency-contacts');
  if (!res.success) {
    showToast(res.message || 'Failed to load contacts.', 'error');
    return;
  }

  allContacts = res.contacts || [];
  renderContacts(allContacts);
}

function renderContacts(contacts) {
  const container = document.getElementById('contactsListContainer');
  if (!container) return;

  if (contacts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color: var(--danger);">📞</div>
        <div class="empty-title">No emergency contacts configured</div>
        <div class="empty-desc">Add primary guardians, family members, or your personal doctor for immediate SOS access.</div>
        <button class="btn btn-danger btn-sm" onclick="openAddContactModal()">+ Add Emergency Contact</button>
      </div>
    `;
    return;
  }

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px;">`;

  contacts.forEach(c => {
    html += `
      <div class="card" style="border-left: 4px solid var(--danger);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <h4 style="font-size: 1.15rem; color: #991b1b;">${c.name}</h4>
            <span class="badge badge-danger">${c.relationship || 'Emergency Contact'}</span>
          </div>
          <span style="font-size: 24px;">🚨</span>
        </div>
        <p style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 16px;">
          📞 <a href="tel:${c.phone}" style="color: inherit;">${c.phone}</a>
        </p>
        <div style="display: flex; gap: 8px;">
          <a href="tel:${c.phone}" class="btn btn-danger btn-sm" style="flex: 1; text-align: center;">
            Call Now
          </a>
          <button class="btn btn-sm btn-outline" onclick="openEditContactModal('${c.id}')">✏️</button>
          <button class="btn btn-sm btn-outline" style="color: var(--danger);" onclick="deleteContact('${c.id}')">🗑️</button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function openAddContactModal() {
  editingContactId = null;
  document.getElementById('contactModalTitle').textContent = 'Add Emergency Contact';
  document.getElementById('contactForm').reset();
  document.getElementById('contactModal').classList.add('active');
}

function openEditContactModal(id) {
  const c = allContacts.find(item => item.id === id);
  if (!c) return;

  editingContactId = id;
  document.getElementById('contactModalTitle').textContent = 'Edit Emergency Contact';
  document.getElementById('contactName').value = c.name || '';
  document.getElementById('contactRelation').value = c.relationship || 'Family';
  document.getElementById('contactPhone').value = c.phone || '';

  document.getElementById('contactModal').classList.add('active');
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('active');
  editingContactId = null;
}

async function handleSaveContact(e) {
  e.preventDefault();
  const btn = document.getElementById('saveContactBtn');
  setButtonLoading(btn, true, 'Save Contact');

  const payload = {
    name: document.getElementById('contactName').value.trim(),
    relationship: document.getElementById('contactRelation').value.trim(),
    phone: document.getElementById('contactPhone').value.trim()
  };

  let res;
  if (editingContactId) {
    res = await apiFetch(`/emergency-contacts/${editingContactId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  } else {
    res = await apiFetch('/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  setButtonLoading(btn, false, 'Save Contact');

  if (res.success) {
    showToast(editingContactId ? 'Contact updated!' : 'Emergency contact added!', 'success');
    closeContactModal();
    await loadEmergencyContacts();
  } else {
    showToast(res.message || 'Failed to save contact.', 'error');
  }
}

async function deleteContact(id) {
  if (!confirm('Are you sure you want to remove this emergency contact?')) return;

  const res = await apiFetch(`/emergency-contacts/${id}`, { method: 'DELETE' });
  if (res.success) {
    showToast('Emergency contact removed.', 'info');
    await loadEmergencyContacts();
  } else {
    showToast(res.message || 'Failed to delete contact.', 'error');
  }
}
