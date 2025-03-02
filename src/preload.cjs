
const { contextBridge, ipcRenderer } = require('electron');

// Forward console messages from main to renderer
ipcRenderer.on('console-log', (event, ...args) => {
  console.log('[Main Process]:', ...args);
});

ipcRenderer.on('console-error', (event, ...args) => {
  console.error('[Main Process]:', ...args);
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    port: process.env.PORT || '3000',
    focusWindow: () => ipcRenderer.invoke('focus-window'),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    
    // Add method to get app version from package.json
    // getAppVersion: () => get version
  }
);
