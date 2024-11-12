
const { contextBridge, ipcRenderer } = require('electron');

// Forward console messages from main to renderer
ipcRenderer.on('console-log', (event, ...args) => {
  console.log('[Main Process]:', ...args);
});

ipcRenderer.on('console-error', (event, ...args) => {
  console.error('[Main Process]:', ...args);
});

contextBridge.exposeInMainWorld('electronAPI', {
  focusWindow: () => ipcRenderer.invoke('focus-window'), // Add this
});
