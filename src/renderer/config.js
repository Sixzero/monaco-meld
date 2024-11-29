
// Helper to determine if we're running in electron
const isElectron = !!window.electronAPI;

// Get port from different sources
export const currentPort = window.location.port || '3000';

// Determine base URL based on environment
export const serverOrigin = isElectron ? 
  `http://localhost:${currentPort}` : // Electron case
  window.location.origin;             // Web case

// Get full base URL for API calls
export const apiBaseUrl = `${serverOrigin}`;

// Get port from different sources in order of priority:
// 1. URL port (for web mode)
// 2. Environment variable passed through electron
// 3. Default port (3000)
// export const currentPort = (() => {
//   // Check if we're in electron context
//   if (window.electronAPI) {
//     return window.electronAPI.port || '3000';
//   }
//   // For web mode, use window.location.port or default
//   return window.location.port || '3000';
// })();
