import { setupEditorCommands } from "./editor/commands.js";
import { showStatusNotification, notifyWithFocus } from "./ui/notifications.js";
import { currentPort } from "./config.js";
import {createEmptyState} from "./ui/emptyState.js"

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

function createDiffEditor(containerId, leftContent, rightContent, language, leftPath, rightPath, diffId = null) { // Add diffId param
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
  titleText.classList.add('title-text');  // Add class for styling
  
  // Add style for unsaved indicator
  const style = document.createElement('style');
  style.textContent = `
    .title-text.unsaved::after {
      content: ' •';
      color: #f9ab00;
    }
  `;
  document.head.appendChild(style);
  
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.background = 'none';
  closeButton.style.border = 'none';
  closeButton.style.color = '#888';
  closeButton.style.fontSize = '20px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 5px';
  closeButton.title = 'Close (Alt+W)'; // Updated shortcut hint
  
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
    container: container,
    id: diffId // Store the ID
  });

  // Update window title
  document.title = `MonacoMeld - ${window.diffModels.length} files`;

  return { diffEditor, originalModel, modifiedModel };
}


async function saveContent(content, editor, filePath) {
  try {
    const result = await fetch(`http://localhost:${currentPort}/save`, {
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

function setupEventSource() {
  const evtSource = new EventSource(`http://localhost:${currentPort}/events`);
  
  evtSource.onmessage = (event) => {
    try {
      const newDiffContents = JSON.parse(event.data);
      const diffs = Array.isArray(newDiffContents) ? newDiffContents : [newDiffContents];
      
      // Remove empty state if it exists and we're getting diffs
      if (window.diffModels.length === 0 && diffs.length > 0) {
        const container = document.getElementById('container');
        while (container.firstChild) {
          container.firstChild.remove();
        }
      }
      
      // Store initial model count to check if this is the first diff
      const initialModelCount = window.diffModels.length;
      
      // Show notification for new diffs
      if (diffs.length > 0) {
        notifyWithFocus(
          'New Diffs Available',
          `${diffs.length} new diff${diffs.length > 1 ? 's' : ''} received`
        );
      }
      
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

      // Focus only if this was the first diff added
      if (initialModelCount === 0 && window.diffModels.length > 0) {
        setTimeout(() => window.diffModels[0]?.editor.getModifiedEditor().focus(), 100);
      }

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
  // Store models globally for each diff
  window.diffModels = [];
  
  // Add window close prevention handler
  window.addEventListener('keydown', (e) => {
    console.log('e:', e)
    // Check for Ctrl+W (Windows/Linux) or Cmd+W (Mac)
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyW') {
      // Prevent window close if we have more than one diff
      if (window.diffModels.length > 0) {
        e.preventDefault();
      }
    }
  }, true); // Use capture phase to handle event before browser
  
  console.log("Loading Monaco...");
  require(["vs/editor/editor.main"], async function () {

    try {
      const response = await fetch(`http://localhost:${currentPort}/diff`);
      const diffContents = await response.json();

      // Convert single diff to array format for consistency
      const diffs = Array.isArray(diffContents) ? diffContents : [diffContents];
      
      if (diffs.length === 0 || (diffs.length === 1 && !diffs[0].leftContent && !diffs[0].rightContent)) {
        createEmptyState(document.getElementById('container'), createDiffEditor);
      } else {
        diffs.forEach((diff) => {
          createDiffEditor(
            'container',
            diff.leftContent,
            diff.rightContent,
            getLanguageFromPath(diff.leftPath) || 
            getLanguageFromPath(diff.rightPath) || 
            'javascript',
            diff.leftPath,
            diff.rightPath,
            diff.id
          );
        });
      }

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
      createEmptyState(document.getElementById('container'), createDiffEditor);
    }
    
    setupEventSource();

    // Focus on the original (left) editor
    setTimeout(() => window.diffModels[0]?.editor.getModifiedEditor().focus(), 100);
  });
});
