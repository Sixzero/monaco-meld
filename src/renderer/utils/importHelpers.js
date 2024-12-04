const isElectron = !!window.electronAPI;
const isWeb = !window.electronAPI;
const basePath = isWeb ? '' : '..';

export async function getMonaco() {
  console.log('getMonaco:', getMonaco)
  if (isElectron) {
    return new Promise(resolve => {
      require(['vs/editor/editor.main'], () => resolve(window.monaco));
    });
  } 

  // For web version, try local first then CDN
  if (!window.monaco) {
    try {
      // Try loading from local node_modules first
      await Promise.all([
        loadScript('/node_modules/monaco-editor/min/vs/loader.js')
      ]);
      
      // Configure AMD loader if successful
      window.require.config({ paths: { 'vs': '/node_modules/monaco-editor/min/vs' }});
    } catch (err) {
      console.warn('Failed to load Monaco from local, falling back to CDN:', err);
      // Fallback to CDN
      await Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js')
      ]);
      window.require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
    }

    // Load Monaco editor
    return new Promise(resolve => {
      window.require(['vs/editor/editor.main'], () => {
        resolve(window.monaco);
      });
    });
  }
  
  return window.monaco;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

