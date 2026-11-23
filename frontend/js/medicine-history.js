/**
 * MediSafe - Medicine Compliance History Controller
 * Loads dosage logs filtered by date, computes compliance rates, and displays history.
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  const dateInput = document.getElementById('historyDateInput');
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateInput) {
    dateInput.value = todayStr;
    dateInput.addEventListener('change', () => loadHistory(dateInput.value));
  }

  await loadHistory(todayStr);
});

async function loadHistory(selectedDate) {
  const container = document.getElementById('historyLogsContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="spinner spinner-primary"></div>
        <p style="margin-top: 10px;">Loading medication logs for ${selectedDate}...</p>
      </div>
    `;
  }

  const res = await apiFetch(`/medicine-logs?date=${selectedDate}`);
  if (!res.success) {
    showToast(res.message || 'Failed to load history.', 'error');
    return;
  }

  const logs = res.logs || [];
  renderHistoryLogs(logs, selectedDate);
}

function renderHistoryLogs(logs, selectedDate) {
  const container = document.getElementById('historyLogsContainer');
  const statsContainer = document.getElementById('historyStatsContainer');

  const takenCount = logs.filter(l => l.status === 'taken').length;
  const missedCount = logs.filter(l => l.status === 'missed').length;
  const total = logs.length;
  const rate = total > 0 ? Math.round((takenCount / total) * 100) : 0;

  if (statsContainer) {
    statsContainer.innerHTML = `
      <div class="stat-card" style="padding: 16px;">
        <div class="stat-icon green" style="width: 44px; height: 44px; font-size: 20px;">✓</div>
        <div class="stat-info">
          <div class="stat-title">Taken Doses</div>
          <div class="stat-value" style="font-size: 1.4rem;">${takenCount}</div>
        </div>
      </div>
      <div class="stat-card" style="padding: 16px;">
        <div class="stat-icon orange" style="width: 44px; height: 44px; font-size: 20px;">✗</div>
        <div class="stat-info">
          <div class="stat-title">Missed Doses</div>
          <div class="stat-value" style="font-size: 1.4rem;">${missedCount}</div>
        </div>
      </div>
      <div class="stat-card" style="padding: 16px;">
        <div class="stat-icon teal" style="width: 44px; height: 44px; font-size: 20px;">📊</div>
        <div class="stat-info">
          <div class="stat-title">Compliance Rate</div>
          <div class="stat-value" style="font-size: 1.4rem;">${rate}%</div>
        </div>
      </div>
    `;
  }

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <div class="empty-title">No medication logs recorded for ${selectedDate}</div>
        <div class="empty-desc">When you mark doses as Taken or Missed on the Medicines page, historical compliance records appear here.</div>
        <a href="medicines.html" class="btn btn-outline btn-sm">Go to Medicines</a>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Medicine Name</th>
            <th>Dosage</th>
            <th>Scheduled Time</th>
            <th>Action Status</th>
            <th>Logged At</th>
          </tr>
        </thead>
        <tbody>
  `;

  logs.forEach(l => {
    const isTaken = l.status === 'taken';
    const actionTime = l.actual_action_time ? new Date(l.actual_action_time).toLocaleTimeString() : '-';
    html += `
      <tr>
        <td><strong>${l.medicine_name}</strong></td>
        <td>${l.dosage || '-'}</td>
        <td><strong>${l.scheduled_time || '-'}</strong></td>
        <td>
          <span class="badge ${isTaken ? 'badge-success' : 'badge-danger'}">
            ${isTaken ? '✓ Taken' : '✗ Missed'}
          </span>
        </td>
        <td><small style="color: var(--text-muted);">${actionTime}</small></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}
