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

function createDiffEditor(containerId, leftContent, rightContent, language, leftPath, rightPath) {
  const container = document.createElement('div');
  container.style.minHeight = '100px';  // Minimum height
  container.style.maxHeight = '500px';  // Maximum height
  container.style.marginBottom = '30px';
  container.style.border = '1px solid #454545';
  
  const titleBar = document.createElement('div');
  titleBar.style.padding = '5px 10px';
  titleBar.style.backgroundColor = '#2d2d2d';
  titleBar.style.borderBottom = '1px solid #454545';
  titleBar.style.display = 'flex';
  titleBar.style.justifyContent = 'space-between';
  titleBar.style.alignItems = 'center';
  
  const titleText = document.createElement('span');
  titleText.textContent = `${leftPath ?? 'untitled'} ← ${rightPath ?? 'untitled'}`; // Changed ↔ to ←
  titleText.style.color = '#e0e0e0';  // Light gray color for better visibility
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = '#888';
  closeButton.style.fontSize = '20px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 5px';
  closeButton.title = 'Close (Ctrl+W)';
  
  titleBar.appendChild(titleText);
  titleBar.appendChild(closeButton);
  
  const editorContainer = document.createElement('div');
  editorContainer.style.height = '100%';
  
  container.appendChild(titleBar);
  container.appendChild(editorContainer);
  document.getElementById(containerId).appendChild(container);

  const originalModel = monaco.editor.createModel(leftContent, language);
  const modifiedModel = monaco.editor.createModel(rightContent, language);

  const diffEditor = monaco.editor.createDiffEditor(editorContainer, {
    theme: "vs-dark",
    automaticLayout: true,
    renderSideBySide: true,
    originalEditable: true,
    renderIndicators: true,
    renderMarginRevertIcon: true,
    ignoreTrimWhitespace: false,
  });

  diffEditor.setModel({
    original: originalModel,
    modified: modifiedModel,
  });

  // Calculate content height
  const lineHeight = 19; // Default Monaco line height
  const headerHeight = 30; // Title bar height
  const padding = 10; // Some padding
  const leftLines = (leftContent?.match(/\n/g) || []).length + 1;
  const rightLines = (rightContent?.match(/\n/g) || []).length + 1;
  const lines = Math.max(leftLines, rightLines);
  const contentHeight = Math.min(500, Math.max(100, lines * lineHeight + headerHeight + padding));
  
  container.style.height = `${contentHeight}px`;

  // Setup editor commands
  const modifiedEditor = diffEditor.getModifiedEditor();
  const originalEditor = diffEditor.getOriginalEditor();
  const closeCommand = setupEditorCommands(
    diffEditor,
    originalEditor,
    modifiedEditor,
    container
  );

  closeButton.onclick = closeCommand;

  // Store models globally
  window.diffModels = window.diffModels || [];
  window.diffModels.push({
    original: originalModel,
    modified: modifiedModel,
    editor: diffEditor,
    path: leftPath,
    initialContent: leftContent,
    container: container // Add container reference
  });

  // Update window title
  document.title = `MonacoMeld - ${window.diffModels.length} files`;

  return { diffEditor, originalModel, modifiedModel };
}

// Simplified save function
async function saveContent(content, editor, filePath) {
  try {
    const result = !isWeb ? 
      await window.electronAPI.saveContent(content, filePath) :
      await fetch('http://localhost:3000/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, path: filePath })
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
  const evtSource = new EventSource('http://localhost:3000/events');
  
  evtSource.onmessage = (event) => {
    try {
      const newDiffContents = JSON.parse(event.data);
      const diffs = Array.isArray(newDiffContents) ? newDiffContents : [newDiffContents];
      
      diffs.forEach(diff => {
        // Try to find existing diff by path
        const IS_EXISTING_FILE_OVERWRITE_ENABLED = false;
        const existingDiffIndex = window.diffModels.findIndex(
          model => model.path === diff.leftPath
        );

        if (IS_EXISTING_FILE_OVERWRITE_ENABLED && existingDiffIndex >= 0) {
          // Update existing diff
          const model = window.diffModels[existingDiffIndex];
          if (diff.leftContent !== null) {
            model.original.setValue(diff.leftContent);
          }
          if (diff.rightContent !== null) {
            model.modified.setValue(diff.rightContent);
          }
        } else {
          // Create new diff editor
          createDiffEditor(
            'container',
            diff.leftContent ?? '',
            diff.rightContent ?? '',
            getLanguageFromPath(diff.leftPath) || 
            getLanguageFromPath(diff.rightPath) || 
            'javascript',
            diff.leftPath,
            diff.rightPath
          );
        }
      });

      // Update window title to reflect number of diffs
      document.title = `MonacoMeld - ${window.diffModels.length} files`;

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
  
  setupEventSource();
  
  require(["vs/editor/editor.main"], async function () {
    try {
      const response = isWeb ? 
        await fetch('http://localhost:3000/diff') : 
        { json: () => window.electronAPI.getDiffContents() };
      const diffContents = await response.json();

      // Convert single diff to array format for consistency
      const diffs = Array.isArray(diffContents) ? diffContents : [diffContents];
      
      // Store models globally for each diff
      window.diffModels = [];

      diffs.forEach((diff) => {
        createDiffEditor(
          'container',
          diff?.leftContent ?? sampleText1,
          diff?.rightContent ?? sampleText2,
          getLanguageFromPath(diff?.leftPath) || 
          getLanguageFromPath(diff?.rightPath) || 
          'javascript',
          diff?.leftPath,
          diff?.rightPath
        );
      });

      // Update hasUnsavedChanges to check all editors
      window.hasUnsavedChanges = () => {
        return window.diffModels.some(model => {
          const currentContent = model.original.getValue();
          return model.initialContent !== undefined && 
                 currentContent !== model.initialContent;
        });
      };

      // Update getLeftContent to get content from first editor
      window.getLeftContent = () => window.diffModels[0]?.original.getValue() ?? '';

    } catch (err) {
      console.error("Error initializing Monaco:", err);
      // Fallback to single diff with samples
      createDiffEditor(
        'container',
        sampleText1,
        sampleText2,
        'javascript',
        'sample1.js',
        'sample2.js'
      );
    }

    // Focus on the original (left) editor
    setTimeout(() => window.diffModels[0]?.editor.getModifiedEditor().focus(), 100);
  });
});
