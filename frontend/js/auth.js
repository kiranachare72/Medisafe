/**
 * MediSafe - Authentication Controller
 * Manages JWT tokens, user sessions, login, registration, and route protection.
 */

const TOKEN_KEY = 'medisafe_token';
const USER_KEY = 'medisafe_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getUser() {
  const user = localStorage.getItem(USER_KEY);
  try {
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isAuthenticated() {
  return !!getToken();
}

/**
 * Route protection: Call on protected pages (dashboard, profile, medicines, etc.)
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
  }
}

/**
 * Call on public auth pages (login, register) to redirect already signed-in users.
 */
function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.href = 'dashboard.html';
  }
}

/**
 * Logs out user and redirects to login
 */
async function handleLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore error and proceed with client-side cleanup
  }
  clearSession();
  showToast('Logged out successfully.', 'info');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 500);
}

/**
 * Populates sidebar and topbar with current user's profile info
 */
function populateUserProfileUI() {
  const user = getUser();
  if (!user) return;

  const nameElements = document.querySelectorAll('.current-user-name');
  const emailElements = document.querySelectorAll('.current-user-email');
  const avatarElements = document.querySelectorAll('.current-user-avatar');

  nameElements.forEach(el => el.textContent = user.name || 'User');
  emailElements.forEach(el => el.textContent = user.email || '');

  avatarElements.forEach(el => {
    if (user.profile_photo) {
      const mediaBase = (window.MEDISAFE_CONFIG && window.MEDISAFE_CONFIG.MEDIA_BASE_URL) || '';
      const fullUrl = user.profile_photo.startsWith('http') ? user.profile_photo : `${mediaBase}${user.profile_photo}`;
      el.innerHTML = `<img src="${fullUrl}" alt="${user.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      const initial = (user.name ? user.name[0] : 'U').toUpperCase();
      el.textContent = initial;
    }
  });
}

// Auto-run when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  populateUserProfileUI();

  // Mobile menu toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Logout buttons
  const logoutButtons = document.querySelectorAll('.logout-btn');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  });
});
