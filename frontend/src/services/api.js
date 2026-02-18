import axios from 'axios';

// Dynamically determine API base URL based on current host
// This allows the app to work both locally and on the network
const getApiBaseUrl = () => {
  // If environment variable is set, use that
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // For local development on same machine
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  // For network access - use same hostname but backend port
  return `http://${window.location.hostname}:8000`;
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;

