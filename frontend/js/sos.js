/**
 * MediSafe - Emergency SOS & Geolocation Controller
 * Obtains browser GPS coordinates after user permission, generates Google Maps link,
 * and displays emergency click-to-call contacts.
 */

let currentLocation = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  // Load emergency contacts
  await loadEmergencyContacts();

  // Attach location trigger
  const locBtn = document.getElementById('getLocationBtn');
  if (locBtn) {
    locBtn.addEventListener('click', requestBrowserLocation);
  }
});

async function loadEmergencyContacts() {
  const container = document.getElementById('sosContactsList');
  if (!container) return;

  const res = await apiFetch('/emergency-contacts');
  if (!res.success) return;

  const contacts = res.contacts || [];
  if (contacts.length === 0) {
    container.innerHTML = `
      <div style="background: #fff; padding: 20px; border-radius: var(--radius-md); text-align: center; border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px;">No emergency contacts found.</p>
        <a href="emergency-contacts.html" class="btn btn-outline btn-sm">+ Add Emergency Contacts</a>
      </div>
    `;
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 12px;">`;
  contacts.forEach(c => {
    html += `
      <div style="background: #fff; border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <strong style="color: #991b1b; font-size: 1.1rem;">${c.name}</strong>
          <span class="badge badge-danger" style="margin-left: 8px;">${c.relationship}</span>
          <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">📞 ${c.phone}</div>
        </div>
        <a href="tel:${c.phone}" class="btn btn-danger btn-lg" style="font-weight: 700; padding: 10px 24px;">
          📞 Call Now
        </a>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function requestBrowserLocation() {
  const statusEl = document.getElementById('locationStatus');
  const resultCard = document.getElementById('locationResultCard');
  const btn = document.getElementById('getLocationBtn');

  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your current browser.', 'error');
    if (statusEl) statusEl.textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  setButtonLoading(btn, true, 'Acquiring GPS Position...');
  if (statusEl) statusEl.textContent = 'Requesting location permission from browser...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setButtonLoading(btn, false, '📍 Re-acquire Current GPS Location');
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : null;
      currentLocation = { lat, lng };

      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

      if (statusEl) statusEl.textContent = 'GPS location successfully acquired!';
      if (resultCard) {
        resultCard.style.display = 'block';
        document.getElementById('latValue').textContent = lat;
        document.getElementById('lngValue').textContent = lng;
        document.getElementById('accuracyValue').textContent = accuracy ? `${accuracy} meters` : 'High';
        
        const mapLink = document.getElementById('googleMapsLink');
        mapLink.href = mapsUrl;

        const shareBtn = document.getElementById('copyLocationBtn');
        shareBtn.onclick = () => {
          const textToCopy = `EMERGENCY SOS: My current location is Lat: ${lat}, Lng: ${lng}. Google Maps link: ${mapsUrl}`;
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Location link copied to clipboard!', 'success');
          }).catch(() => {
            prompt('Copy your emergency location link:', mapsUrl);
          });
        };
      }
      showToast('GPS coordinates retrieved successfully.', 'success');
    },
    (error) => {
      setButtonLoading(btn, false, '📍 Acquire My GPS Location');
      let msg = 'Failed to acquire location.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = 'Location permission was denied. Please allow location access in your browser.';
          break;
        case error.POSITION_UNAVAILABLE:
          msg = 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          msg = 'Location request timed out. Please retry.';
          break;
      }
      if (statusEl) statusEl.textContent = msg;
      showToast(msg, 'warning');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}
