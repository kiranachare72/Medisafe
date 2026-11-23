/**
 * MediSafe - Health Risk Assessment Controller
 * Calculates BMI, submits vitals, displays clinical reference classifications,
 * and maintains past assessment history.
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  // Pre-fill user metrics from profile if available
  const user = getUser();
  if (user) {
    if (user.age) document.getElementById('assessAge').value = user.age;
    if (user.height) document.getElementById('assessHeight').value = user.height;
    if (user.weight) document.getElementById('assessWeight').value = user.weight;
  }

  await loadAssessmentsHistory();

  const form = document.getElementById('assessmentForm');
  if (form) {
    form.addEventListener('submit', handleAssessHealth);
  }
});

async function handleAssessHealth(e) {
  e.preventDefault();
  const btn = document.getElementById('submitAssessBtn');
  setButtonLoading(btn, true, 'Calculate & Assess Vitals');

  const payload = {
    age: parseInt(document.getElementById('assessAge').value),
    height: parseFloat(document.getElementById('assessHeight').value),
    weight: parseFloat(document.getElementById('assessWeight').value),
    systolic_bp: document.getElementById('assessSystolic').value ? parseInt(document.getElementById('assessSystolic').value) : null,
    diastolic_bp: document.getElementById('assessDiastolic').value ? parseInt(document.getElementById('assessDiastolic').value) : null,
    blood_sugar: document.getElementById('assessSugar').value ? parseFloat(document.getElementById('assessSugar').value) : null,
    symptoms: document.getElementById('assessSymptoms').value.trim()
  };

  const res = await apiFetch('/health-assessment', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  setButtonLoading(btn, false, 'Calculate & Assess Vitals');

  if (res.success) {
    showToast('Health assessment report generated!', 'success');
    renderCurrentResult(res.assessment);
    await loadAssessmentsHistory();
  } else {
    showToast(res.message || 'Failed to complete assessment.', 'error');
  }
}

function renderCurrentResult(a) {
  const container = document.getElementById('currentResultCard');
  if (!container) return;

  container.style.display = 'block';

  document.getElementById('resultBmi').textContent = a.bmi;
  const bmiCatEl = document.getElementById('resultBmiCategory');
  bmiCatEl.textContent = a.bmi_category;
  bmiCatEl.className = `badge badge-${a.bmi_color || 'info'}`;

  // Blood Pressure
  document.getElementById('resultBpCategory').textContent = a.bp_category || 'Not Provided';
  document.getElementById('resultBpBadge').className = `badge badge-${a.bp_color || 'info'}`;

  // Blood Sugar
  document.getElementById('resultGlucoseCategory').textContent = a.glucose_category || 'Not Provided';
  document.getElementById('resultGlucoseBadge').className = `badge badge-${a.glucose_color || 'info'}`;

  // Factors List
  const factorsList = document.getElementById('resultFactorsList');
  if (factorsList) {
    if (a.assessment_factors && a.assessment_factors.length > 0) {
      factorsList.innerHTML = a.assessment_factors.map(f => `<li style="margin-bottom: 6px;">${f}</li>`).join('');
    } else {
      factorsList.innerHTML = `<li>Vitals appear within standard baseline limits.</li>`;
    }
  }

  // Scroll to results
  container.scrollIntoView({ behavior: 'smooth' });
}

async function loadAssessmentsHistory() {
  const container = document.getElementById('assessmentsHistoryContainer');
  if (!container) return;

  const res = await apiFetch('/health-assessment');
  if (!res.success) return;

  const assessments = res.assessments || [];
  if (assessments.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div class="empty-icon" style="font-size: 32px;">❤️</div>
        <div class="empty-title">No past health assessments</div>
        <div class="empty-desc">Submit your vitals above to calculate your BMI and generate an informational report.</div>
      </div>
    `;
    return;
  }

  let html = `<div style="display: flex; flex-direction: column; gap: 12px;">`;
  assessments.forEach(item => {
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
    html += `
      <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong>Date: ${dateStr}</strong>
          <span class="badge badge-${item.bmi_color || 'info'}">BMI: ${item.bmi} (${item.bmi_category})</span>
        </div>
        <div style="color: var(--text-muted);">
          Height: ${item.height} cm &bull; Weight: ${item.weight} kg
          ${item.systolic_bp ? `&bull; BP: ${item.systolic_bp}/${item.diastolic_bp}` : ''}
          ${item.blood_sugar ? `&bull; Sugar: ${item.blood_sugar} mg/dL` : ''}
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}
