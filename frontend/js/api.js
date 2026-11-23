/**
 * MediSafe - API Utility & Toast Notification Helper
 * Provides a reliable, reusable Fetch wrapper with automatic JWT headers and error handling.
 */

// Toast notification helper
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 400);
    }
  }, 4000);
}

/**
 * Universal Fetch API wrapper
 * Handles Authorization headers, JSON serialization, and standard error handling.
 */
async function apiFetch(endpoint, options = {}) {
  const baseUrl = (window.MEDISAFE_CONFIG && window.MEDISAFE_CONFIG.API_BASE_URL) || 'http://127.0.0.1:8000/api';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = options.headers ? { ...options.headers } : {};

  // Attach JWT Bearer token if present
  const token = localStorage.getItem('medisafe_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set default JSON Content-Type if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Check for 401 Unauthorized
    if (response.status === 401) {
      // Do not redirect if already on login/register pages
      const isAuthPage = window.location.pathname.includes('login') || window.location.pathname.includes('register');
      if (!isAuthPage) {
        localStorage.removeItem('medisafe_token');
        localStorage.removeItem('medisafe_user');
        showToast('Your session has expired. Please sign in again.', 'warning');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1200);
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = (data && data.message) || `Request failed with status ${response.status}`;
      return { success: false, status: response.status, message: errorMsg, data };
    }

    return { success: true, status: response.status, ...data };

  } catch (error) {
    console.error(`[API Error: ${endpoint}]`, error);
    return {
      success: false,
      message: 'Unable to connect to the backend server. Please verify the Django backend is running.'
    };
  }
}

/**
 * Helper to toggle button loading state
 */
function setButtonLoading(button, isLoading, originalHtml = 'Submit') {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Processing...`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || originalHtml;
  }
}
