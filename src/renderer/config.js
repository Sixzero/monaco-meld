
// Helper to determine if we're running in electron
const isElectron = !!window.electronAPI;

// Get stored server URL from localStorage or use default
const storedServerUrl = localStorage.getItem('monacomeld_server_url');
export const defaultPort = window.location.port || '9000';

// Determine base URL based on environment and stored value
export const serverOrigin = storedServerUrl || (isElectron ? 
  `http://localhost:${defaultPort}` : // Electron case
  window.location.origin);            // Web case

// Get full base URL for API calls
export const apiBaseUrl = serverOrigin;

// Function to update server URL
export const updateServerUrl = (newUrl) => {
  localStorage.setItem('monacomeld_server_url', newUrl);
  window.location.reload(); // Reload to apply new URL
};