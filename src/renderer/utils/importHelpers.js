const isElectron = !!window.electronAPI;
const isWeb = !window.electronAPI;

export async function getMonaco() {
  if (isElectron) {
    // Set up Monaco environment for Electron
    window.MonacoEnvironment = {
      getWorkerUrl: function(moduleId, label) {
        return '../node_modules/monaco-editor/min/vs/base/worker/workerMain.js';
      }
    };

    return new Promise(resolve => {
      require(['vs/editor/editor.main'], () => resolve(window.monaco));
    });
  } 

  // For web version, use the direct ESM path
  if (!window.monaco) {
    try {
      const monaco = await import('monaco-editor/esm/vs/editor/editor.api.js');
      window.monaco = monaco;
      return monaco;
    } catch (error) {
      console.error('Failed to import monaco-editor:', error);
      throw error;
    }
  }
  
  return window.monaco;
}
