import { sampleText1, sampleText2 } from "./samples.js";
import { setupEditorCommands } from "./editor/commands.js";
import { showStatusNotification } from "./ui/notifications.js";

const isWeb = !window.electronAPI;
const basePath = isWeb ? '' : '..';

// Configure Monaco loader first
require.config({
  paths: {
    'vs': `${basePath}/node_modules/monaco-editor/min/vs`
  }
});

// Setup Monaco environment before loading
window.MonacoEnvironment = {
  getWorkerUrl: function(moduleId, label) {
    return `${basePath}/public/monaco-editor-worker-loader-proxy.js`;
  }
};

function getLanguageFromPath(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop().toLowerCase();
  const langMap = {
    js: 'javascript',
    jsx: 'javascript',
    jl: 'julia',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    cpp: 'cpp',
    c: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql'
  };
  return langMap[ext] || 'plaintext';
}

// Simplified save function
async function saveContent(content, editor) {
  try {
    const result = !isWeb ? 
      await window.electronAPI.saveContent(content) :
      await fetch('http://localhost:3000/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      }).then(r => r.ok);
    
    if (!result) throw new Error('Failed to save');
    
    if (editor) {
      showStatusNotification('File saved successfully!', 'success');
    }
    
    return true;
  } catch (err) {
    console.error('Error saving:', err);
    if (editor) {
      showStatusNotification('Failed to save file!', 'error');
    }
    return false;
  }
}

// Replace polling with SSE
function setupEventSource() {
  if (!isWeb) return; // Only use SSE in web mode
  
  const evtSource = new EventSource('http://localhost:3000/events');
  
  evtSource.onmessage = (event) => {
    try {
      const newDiffContents = JSON.parse(event.data);
      
      // Update models if we have new content
      if (newDiffContents?.leftContent !== null || newDiffContents?.rightContent !== null) {
        window.originalModel.setValue(newDiffContents?.leftContent ?? '');
        window.modifiedModel.setValue(newDiffContents?.rightContent ?? '');
        
        // Update title
        if (newDiffContents?.leftPath || newDiffContents?.rightPath) {
          const leftName = newDiffContents.leftPath ?? 'untitled';
          const rightName = newDiffContents.rightPath ?? 'untitled';
          document.title = `MonacoMeld - ${leftName} ↔ ${rightName}`;
        }
      }
    } catch (err) {
      console.error('Error handling SSE message:', err);
    }
  };
  
  evtSource.onerror = (err) => {
    console.error('SSE connection error:', err);
  };
}

window.addEventListener("DOMContentLoaded", async () => {
  console.log("Loading Monaco...");
  
  // Setup SSE first, before loading Monaco
  setupEventSource();
  
  require(["vs/editor/editor.main"], async function () {
    console.log("Monaco diff editor loaded");

    let leftContent = ""; 
    let rightContent = ""; 
    let initialContent = "";
    
    try {
      // Fetch initial content
      const response = isWeb ? 
        await fetch('http://localhost:3000/diff') : 
        { json: () => window.electronAPI.getDiffContents() };
      const diffContents = await response.json();
      
      console.log("Got diff contents:", diffContents);

      // If no diffContents or both contents null, use samples
      if (!diffContents || (diffContents.leftContent === null && diffContents.rightContent === null)) {
        leftContent = sampleText1;
        rightContent = sampleText2;
      } else {
        leftContent = diffContents.leftContent ?? '';
        rightContent = diffContents.rightContent ?? '';
      }

      // Get language from file paths
      const language = getLanguageFromPath(diffContents?.leftPath) || 
                      getLanguageFromPath(diffContents?.rightPath) || 
                      'javascript';

      // Create and store models globally
      window.originalModel = monaco.editor.createModel(leftContent, language);
      window.modifiedModel = monaco.editor.createModel(rightContent, language);

      // Update window title
      if (diffContents?.leftPath || diffContents?.rightPath) {
        const leftName = diffContents.leftPath ?? 'untitled';
        const rightName = diffContents.rightPath ?? 'untitled';
        document.title = `MonacoMeld - ${leftName} ↔ ${rightName}`;
      }

      // Enable undo support
      window.originalModel.setEOL(monaco.editor.EndOfLineSequence.LF);
      window.originalModel.pushStackElement();

      // Create diff editor
      const diffEditor = monaco.editor.createDiffEditor(
        document.getElementById("container"),
        {
          theme: "vs-dark",
          automaticLayout: true,
          renderSideBySide: true,
          originalEditable: true,
          renderIndicators: true,
          renderMarginRevertIcon: true,
          ignoreTrimWhitespace: false,
        }
      );

      // Set models
      diffEditor.setModel({
        original: window.originalModel,
        modified: window.modifiedModel,
      });

      // Expose functions for main process
      window.hasUnsavedChanges = () => {
        const currentContent = window.originalModel.getValue();
        return initialContent !== null && currentContent !== initialContent;
      };

      window.getLeftContent = () => window.originalModel.getValue();

      // Focus on the original (left) editor
      setTimeout(() => diffEditor.getModifiedEditor().focus(), 100);

      const modifiedEditor = diffEditor.getModifiedEditor();
      const originalEditor = diffEditor.getOriginalEditor();

      // Setup editor commands
      setupEditorCommands(
        diffEditor, 
        originalEditor, 
        modifiedEditor,
        async () => {
          const content = window.originalModel.getValue();
          const saved = await saveContent(content, originalEditor);
          if (saved) {
            initialContent = content;
          }
        }
      );

      // Simpler beforeunload handler
      if (isWeb) {
        window.addEventListener('beforeunload', async (e) => {
          if (window.hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
            
            if (confirm('Do you want to save changes before closing?')) {
              await saveContent(window.originalModel.getValue());
            }
          }
        });
      }

    } catch (err) {
      console.error("Error initializing Monaco:", err);
      // Fallback to samples
      window.originalModel = monaco.editor.createModel(sampleText1, 'javascript');
      window.modifiedModel = monaco.editor.createModel(sampleText2, 'javascript');
    }

    // ... rest of the code ...
  });
});
