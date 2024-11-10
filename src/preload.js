
const { contextBridge, ipcRenderer } = require('electron');

// Forward console messages from main to renderer
ipcRenderer.on('console-log', (event, ...args) => {
  console.log('[Main Process]:', ...args);
});

ipcRenderer.on('console-error', (event, ...args) => {
  console.error('[Main Process]:', ...args);
});

contextBridge.exposeInMainWorld('electronAPI', {
  getDiffContents: () => ipcRenderer.invoke('get-diff-contents'),
  getOriginalContent: () => ipcRenderer.invoke('get-original-content'),
  saveContent: (content) => ipcRenderer.invoke('save-content', content),
  updateDiffContent: (callback) => ipcRenderer.on('update-diff-content', callback)
});
