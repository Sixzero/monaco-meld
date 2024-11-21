
// Get port from different sources in order of priority:
// 1. URL port (for web mode)
// 2. Environment variable passed through electron
// 3. Default port (3000)
export const currentPort = (() => {
  // Check if we're in electron context
  if (window.electronAPI) {
    return window.electronAPI.port || '3000';
  }
  // For web mode, use window.location.port or default
  return window.location.port || '3000';
})();
