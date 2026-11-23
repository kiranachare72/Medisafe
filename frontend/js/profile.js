/**
 * MediSafe - Profile Page Controller
 * Manages viewing, editing profile, and uploading profile photo.
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadProfile();

  // Attach submit listeners
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  const photoInput = document.getElementById('profilePhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', handlePhotoUpload);
  }
});

async function loadProfile() {
  const res = await apiFetch('/profile');

  if (!res.success) {
    showToast(res.message || 'Failed to load profile data.', 'error');
    return;
  }

  const p = res.profile;

  // Populate form fields
  document.getElementById('nameInput').value = p.name || '';
  document.getElementById('emailInput').value = p.email || '';
  document.getElementById('phoneInput').value = p.phone || '';
  document.getElementById('ageInput').value = p.age !== null ? p.age : '';
  document.getElementById('genderInput').value = p.gender || '';
  document.getElementById('bloodGroupInput').value = p.blood_group || '';
  document.getElementById('heightInput').value = p.height !== null ? p.height : '';
  document.getElementById('weightInput').value = p.weight !== null ? p.weight : '';

  // Update photo display
  updatePhotoPreview(p.profile_photo, p.name);

  // Sync with localStorage
  setUser(p);
  populateUserProfileUI();
}

function updatePhotoPreview(photoUrl, name) {
  const photoPreview = document.getElementById('photoPreview');
  if (!photoPreview) return;

  if (photoUrl) {
    const mediaBase = (window.MEDISAFE_CONFIG && window.MEDISAFE_CONFIG.MEDIA_BASE_URL) || '';
    const fullUrl = photoUrl.startsWith('http') ? photoUrl : `${mediaBase}${photoUrl}`;
    photoPreview.innerHTML = `<img src="${fullUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
  } else {
    const initial = (name ? name[0] : 'U').toUpperCase();
    photoPreview.innerHTML = `<div style="font-size: 32px; font-weight: 700; color: var(--primary);">${initial}</div>`;
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = document.getElementById('saveProfileBtn');
  setButtonLoading(btn, true);

  const payload = {
    name: document.getElementById('nameInput').value.trim(),
    phone: document.getElementById('phoneInput').value.trim(),
    age: document.getElementById('ageInput').value ? parseInt(document.getElementById('ageInput').value) : null,
    gender: document.getElementById('genderInput').value,
    blood_group: document.getElementById('bloodGroupInput').value,
    height: document.getElementById('heightInput').value ? parseFloat(document.getElementById('heightInput').value) : null,
    weight: document.getElementById('weightInput').value ? parseFloat(document.getElementById('weightInput').value) : null
  };

  const res = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  setButtonLoading(btn, false, 'Save Changes');

  if (res.success) {
    showToast('Profile updated successfully!', 'success');
    setUser(res.profile);
    populateUserProfileUI();
  } else {
    showToast(res.message || 'Failed to update profile.', 'error');
  }
}

async function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Client validation
  const validExts = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validExts.includes(file.type)) {
    showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size cannot exceed 5 MB.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('photo', file);

  showToast('Uploading profile photo...', 'info');

  const res = await apiFetch('/profile/photo', {
    method: 'POST',
    body: formData
  });

  if (res.success) {
    showToast('Profile photo updated successfully!', 'success');
    const user = getUser() || {};
    user.profile_photo = res.profile_photo;
    setUser(user);
    updatePhotoPreview(res.profile_photo, user.name);
    populateUserProfileUI();
  } else {
    showToast(res.message || 'Failed to upload photo.', 'error');
  }
}
