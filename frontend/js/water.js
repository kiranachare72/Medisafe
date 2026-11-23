/**
 * MediSafe - Hydration Tracker Controller
 * Manages daily water logs, progress bar, quick buttons, custom goals, and deletion.
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  await loadWaterData();

  // Custom intake form
  const customForm = document.getElementById('customWaterForm');
  if (customForm) {
    customForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountInput = document.getElementById('customWaterAmount');
      const amount = parseInt(amountInput.value);
      if (amount > 0) {
        await logWater(amount);
        amountInput.value = '';
      }
    });
  }

  // Goal form
  const goalForm = document.getElementById('goalForm');
  if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newGoal = parseInt(document.getElementById('newGoalInput').value);
      if (newGoal >= 500 && newGoal <= 10000) {
        await updateGoal(newGoal);
      }
    });
  }
});

async function loadWaterData() {
  const res = await apiFetch('/water');
  if (!res.success) {
    showToast(res.message || 'Failed to load water data.', 'error');
    return;
  }

  const d = res.data;
  renderWaterProgress(d);
  renderTodayEntries(d.today_entries || []);
  renderHistory(d.history || []);
}

function renderWaterProgress(data) {
  const amountEl = document.getElementById('waterCurrent');
  const goalEl = document.getElementById('waterGoal');
  const percentEl = document.getElementById('waterPercent');
  const fillEl = document.getElementById('waterBarFill');

  if (amountEl) amountEl.textContent = `${data.today_total} ml`;
  if (goalEl) goalEl.textContent = `${data.daily_goal} ml`;
  if (percentEl) percentEl.textContent = `${data.percentage}%`;

  if (fillEl) {
    fillEl.style.width = `${data.percentage}%`;
    if (data.percentage >= 100) {
      fillEl.className = 'progress-fill success';
    } else if (data.percentage >= 50) {
      fillEl.className = 'progress-fill';
    } else {
      fillEl.className = 'progress-fill warning';
    }
  }

  // Pre-fill goal input
  const goalInput = document.getElementById('newGoalInput');
  if (goalInput) goalInput.value = data.daily_goal;
}

function renderTodayEntries(entries) {
  const container = document.getElementById('todayEntriesContainer');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div class="empty-icon" style="font-size: 30px;">💧</div>
        <div class="empty-title">No water logged today</div>
        <div class="empty-desc">Click a quick button above (+250ml, +500ml) to log water.</div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Amount</th>
            <th>Logged Time</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
  `;

  entries.forEach(e => {
    html += `
      <tr>
        <td><strong>+${e.amount} ml</strong></td>
        <td>${e.time || '-'}</td>
        <td>${e.date || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline" style="color: var(--danger); padding: 2px 8px; font-size: 12px;" onclick="deleteEntry('${e.id}')">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function renderHistory(history) {
  const container = document.getElementById('waterHistoryCards');
  if (!container) return;

  let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px;">`;
  history.forEach(h => {
    const isToday = h.date === new Date().toISOString().split('T')[0];
    html += `
      <div style="background: ${isToday ? 'var(--primary-light)' : 'var(--bg-main)'}; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; text-align: center;">
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">${h.date.substring(5)}</div>
        <strong style="color: var(--primary); font-size: 14px;">${h.amount} ml</strong>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

async function logWater(amount) {
  const res = await apiFetch('/water', {
    method: 'POST',
    body: JSON.stringify({ amount })
  });

  if (res.success) {
    showToast(`Logged ${amount} ml!`, 'success');
    await loadWaterData();
  } else {
    showToast(res.message || 'Failed to log water.', 'error');
  }
}

async function deleteEntry(id) {
  if (!confirm('Remove this water entry?')) return;

  const res = await apiFetch(`/water/${id}`, { method: 'DELETE' });
  if (res.success) {
    showToast('Entry removed.', 'info');
    await loadWaterData();
  } else {
    showToast(res.message || 'Failed to delete entry.', 'error');
  }
}

function openGoalModal() {
  document.getElementById('goalModal').classList.add('active');
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('active');
}

async function updateGoal(goal) {
  const res = await apiFetch('/water/goal', {
    method: 'PUT',
    body: JSON.stringify({ daily_goal: goal })
  });

  if (res.success) {
    showToast(`Daily goal updated to ${goal} ml!`, 'success');
    closeGoalModal();
    await loadWaterData();
  } else {
    showToast(res.message || 'Failed to update goal.', 'error');
  }
}
