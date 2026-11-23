/**
 * MediSafe - Frontend Configuration
 * Designed for BSc IT Final-Year Research Project
 */

// If frontend is served on port 8000 (Django), use same origin; else use 127.0.0.1:8000
const API_BASE_URL = (window.location.port === '8000') 
  ? '/api' 
  : 'http://127.0.0.1:8000/api';

const MEDIA_BASE_URL = (window.location.port === '8000')
  ? ''
  : 'http://127.0.0.1:8000';

window.MEDISAFE_CONFIG = {
  API_BASE_URL,
  MEDIA_BASE_URL,
  APP_NAME: 'MediSafe Healthcare'
};
