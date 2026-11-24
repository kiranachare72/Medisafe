/**
 * MediSafe - Emergency SOS & Geolocation Controller
 * Obtains browser GPS coordinates after user permission, generates Google Maps link,
 * dispatches emergency alerts to family contacts (WhatsApp/SMS) and discovers nearby emergency hospitals.
 */

let currentLocation = null;
let sosSirenInterval = null;
let sosAudioCtx = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  // Load emergency contacts
  await loadEmergencyContacts();

  // Attach SOS broadcast trigger
  const broadcastBtn = document.getElementById('broadcastSosBtn');
  if (broadcastBtn) {
    broadcastBtn.addEventListener('click', triggerEmergencySos);
  }

  // Attach location trigger if present
  const locBtn = document.getElementById('getLocationBtn');
  if (locBtn) {
    locBtn.addEventListener('click', requestBrowserLocation);
  }
});

// ==============================================================
// 1. EMERGENCY AUDIO SIREN (Web Audio API)
// ==============================================================

function playSosSiren() {
  if (sosSirenInterval) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!sosAudioCtx) {
      sosAudioCtx = new AudioContextClass();
    }
    if (sosAudioCtx.state === 'suspended') {
      sosAudioCtx.resume();
    }

    let isHigh = true;
    sosSirenInterval = setInterval(() => {
      if (!sosAudioCtx) return;
      const osc = sosAudioCtx.createOscillator();
      const gain = sosAudioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isHigh ? 960 : 720, sosAudioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, sosAudioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, sosAudioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(sosAudioCtx.destination);

      osc.start();
      osc.stop(sosAudioCtx.currentTime + 0.35);
      isHigh = !isHigh;
    }, 380);

    const toggleBtn = document.getElementById('toggleSirenBtn');
    if (toggleBtn) toggleBtn.textContent = '🔕 Mute Siren';

  } catch (e) {
    console.warn("SOS Audio Context warning:", e);
  }
}

function stopSosSiren() {
  if (sosSirenInterval) {
    clearInterval(sosSirenInterval);
    sosSirenInterval = null;
  }
  const toggleBtn = document.getElementById('toggleSirenBtn');
  if (toggleBtn) toggleBtn.textContent = '📢 Test Emergency Siren';
  showToast('Emergency siren silenced.', 'info');
}

function toggleSosSiren() {
  if (sosSirenInterval) {
    stopSosSiren();
  } else {
    playSosSiren();
    showToast('🚨 Sounding emergency siren!', 'warning');
  }
}

// ==============================================================
// 2. TRIGGER EMERGENCY SOS (Family Alerts + Nearby Hospitals)
// ==============================================================

async function triggerEmergencySos() {
  const btn = document.getElementById('broadcastSosBtn');
  const statusEl = document.getElementById('locationStatus');

  setButtonLoading(btn, true, '🚨 Acquiring GPS & Broadcasting...');
  if (statusEl) statusEl.textContent = 'Fetching current coordinates for emergency dispatch...';

  // Sound siren immediately
  playSosSiren();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        currentLocation = { lat, lng };
        await sendEmergencyDispatch(lat, lng);
        setButtonLoading(btn, false, '🚨 TRIGGER EMERGENCY SOS NOW');
      },
      async (err) => {
        console.warn("GPS unavailable or timed out, dispatching without exact coordinates:", err);
        if (statusEl) statusEl.textContent = 'GPS permission denied or timeout. Dispatching city-wide alert...';
        await sendEmergencyDispatch(null, null);
        setButtonLoading(btn, false, '🚨 TRIGGER EMERGENCY SOS NOW');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  } else {
    await sendEmergencyDispatch(null, null);
    setButtonLoading(btn, false, '🚨 TRIGGER EMERGENCY SOS NOW');
  }
}

async function sendEmergencyDispatch(lat, lng) {
  const statusEl = document.getElementById('locationStatus');
  const payload = {
    lat: lat,
    lng: lng,
    notes: 'I need immediate medical assistance! Please call or reach my location.'
  };

  const res = await apiFetch('/emergency/dispatch-alert', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!res.success) {
    showToast(res.message || 'Failed to dispatch SOS alert.', 'error');
    if (statusEl) statusEl.textContent = 'Failed to broadcast SOS. Please call contacts directly below.';
    return;
  }

  if (statusEl) statusEl.textContent = '✅ Emergency alerts generated & nearby hospitals located!';
  showToast('🚨 EMERGENCY SOS BROADCASTED! Check family alerts below.', 'error');

  // Display location card if coordinates present
  if (lat && lng) {
    const resultCard = document.getElementById('locationResultCard');
    if (resultCard) {
      resultCard.style.display = 'block';
      document.getElementById('latValue').textContent = lat;
      document.getElementById('lngValue').textContent = lng;
      document.getElementById('accuracyValue').textContent = 'High';

      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const mapLink = document.getElementById('googleMapsLink');
      if (mapLink) mapLink.href = mapsUrl;

      const copyBtn = document.getElementById('copyLocationBtn');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const text = `EMERGENCY SOS! My location: ${mapsUrl}`;
          navigator.clipboard.writeText(text).then(() => showToast('Emergency link copied!', 'success'));
        };
      }
    }
  }

  // Display SOS Alert Result Banner
  renderEmergencyDispatchResults(res);
}

function renderEmergencyDispatchResults(res) {
  const banner = document.getElementById('sosAlertResultBanner');
  if (!banner) return;
  banner.style.display = 'block';

  const familyContainer = document.getElementById('familyDispatchedList');
  const hospitalMapLink = document.getElementById('sosHospitalMapLink');

  if (hospitalMapLink && res.nearby_hospital_url) {
    hospitalMapLink.href = res.nearby_hospital_url;
  }

  const alerts = res.family_alerts || [];
  if (alerts.length === 0) {
    familyContainer.innerHTML = `
      <div style="background: #fff; padding: 14px; border-radius: var(--radius-sm); border: 1px dashed #f87171;">
        <p style="color: #991b1b; font-size: 13px; margin: 0 0 8px 0;">No family emergency contacts registered yet.</p>
        <a href="emergency-contacts.html" class="btn btn-sm btn-outline">+ Add Family Emergency Contact</a>
      </div>
    `;
  } else {
    let html = '';
    alerts.forEach(a => {
      html += `
        <div style="background: #fff; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong style="color: #991b1b; font-size: 1rem;">${a.name}</strong>
            <span class="badge badge-danger" style="margin-left: 6px; font-size: 11px;">${a.relationship}</span>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">📞 ${a.phone}</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="${a.whatsapp_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background: #25D366; color: #fff; font-weight: 600;">
              💬 WhatsApp Alert
            </a>
            <a href="${a.sms_url}" class="btn btn-sm btn-outline" style="border-color: #ef4444; color: #ef4444;">
              📱 SMS Alert
            </a>
            <a href="tel:${a.phone}" class="btn btn-sm btn-danger">
              📞 Call Now
            </a>
          </div>
        </div>
      `;
    });
    familyContainer.innerHTML = html;
  }

  banner.scrollIntoView({ behavior: 'smooth' });
}

// ==============================================================
// 3. LOAD CONTACTS LIST
// ==============================================================

async function loadEmergencyContacts() {
  const container = document.getElementById('sosContactsList');
  if (!container) return;

  const res = await apiFetch('/emergency-contacts');
  if (!res.success) return;

  const contacts = res.contacts || [];
  if (contacts.length === 0) {
    container.innerHTML = `
      <div style="background: #fff; padding: 20px; border-radius: var(--radius-md); text-align: center; border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px;">No emergency contacts configured yet.</p>
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
        <div style="display: flex; gap: 8px;">
          <a href="tel:${c.phone}" class="btn btn-danger" style="font-weight: 700; padding: 8px 18px;">
            📞 Call Now
          </a>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function requestBrowserLocation() {
  triggerEmergencySos();
}
