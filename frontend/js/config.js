
/**
 * MediSafe - Frontend Configuration
 */

const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE_URL = isLocal && window.location.port !== '8000'
  ? 'http://127.0.0.1:8000/api'
  : '/api';

const MEDIA_BASE_URL = isLocal && window.location.port !== '8000'
  ? 'http://127.0.0.1:8000'
  : '';

window.MEDISAFE_CONFIG = {
  API_BASE_URL,
  MEDIA_BASE_URL,
  APP_NAME: 'MediSafe Healthcare'
};
