import { setupEditorCommands, navigateToNextChange } from "./editor/commands.js";
import { showStatusNotification, notifyWithFocus } from "./ui/notifications.js";
import { currentPort } from "./config.js";
import { createEmptyState } from "./ui/emptyState.js";
import { defineOneMonokaiTheme } from "./editor/theme.js";
import { focusAndResizeEditor } from "./ui/functions.js";
import { ConnectionStatus } from "./ui/connectionStatus.js";

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
    hpp: 'cpp',
    h: 'cpp',
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


function createDiffEditor(containerId, leftContent, rightContent, language, leftPath, rightPath, diffId = null) {
  const container = document.createElement('div');
  container.style.minHeight = '100px';
  container.style.maxHeight = '80vh';
  container.style.height = '200px';
  container.style.marginBottom = '30px';
  container.style.border = '1px solid #454545';
  container.style.transition = 'height 0.3s ease';
  
  const titleBar = document.createElement('div');
  titleBar.style.padding = '5px 10px';
  titleBar.style.backgroundColor = '#21252b';
  titleBar.style.borderBottom = '1px solid #181A1F';
  titleBar.style.display = 'flex';
  titleBar.style.justifyContent = 'space-between';
  titleBar.style.alignItems = 'center';
  
  const titleText = document.createElement('span');
  titleText.textContent = `${leftPath ?? 'untitled'} ← ${rightPath ?? 'untitled'}`;
  titleText.style.cssText = `
    color: #9da5b4;
    font-family: 'SF Mono', 'Menlo', 'Consolas', 'DejaVu Sans Mono', monospace;
    font-size: 12px;
  `;
  titleText.classList.add('title-text');

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
  closeButton.title = 'Close (Alt+W)';
  
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
    theme: "one-monokai",
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

  // Replace the expandEditor function
  const expandEditor = () => {
    const model = window.diffModels.find(m => m.container === container);
    if (model) {
      focusAndResizeEditor(model);
    }
  };

  // Add focus handlers
  const modifiedEditor = diffEditor.getModifiedEditor();
  const originalEditor = diffEditor.getOriginalEditor();

  // Add focus handlers to both editors
  modifiedEditor.onDidFocusEditorWidget(() => expandEditor());
  originalEditor.onDidFocusEditorWidget(() => expandEditor());

  // Setup editor commands
  const closeCommand = setupEditorCommands(
    diffEditor,
    originalEditor,
    modifiedEditor,
    container
  );

  closeButton.onclick = closeCommand;

  // Store models globally
  window.diffModels = window.diffModels || [];
  const isFirstDiff = window.diffModels.length === 0;
  window.diffModels.push({
    original: originalModel,
    modified: modifiedModel,
    editor: diffEditor,
    path: leftPath,
    initialContent: leftContent,
    container: container,
    id: diffId
  });

  // Update window title
  document.title = `MonacoMeld - ${window.diffModels.length} files`;

  // Update initial focus
  setTimeout(() => {
    diffEditor.layout();
    
    // If this is the first diff, expand it and focus
    if (isFirstDiff) {
      const model = window.diffModels[0];
      focusAndResizeEditor(model);
    }
    
    // Use navigateToNextChange to go to first change if exists
    const changes = diffEditor.getLineChanges();
    if (changes && changes.length > 0) {
      navigateToNextChange(diffEditor, modifiedEditor);
    }
  }, 0);

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

function basename(filepath) {
  return filepath.split(/[\\/]/).pop();
}

function setupEventSource() {
  const evtSource = new EventSource(`http://localhost:${currentPort}/events`);
  
  evtSource.onopen = () => {
    connectionStatus.updateStatus('connected');
  };
  
  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle file change events
      if (data.type === 'fileChange') {
        // Update all diff editors that use this file
        window.diffModels.forEach(model => {
          if (model.path === data.path) {
            const currentContent = model.original.getValue();
            // Only update if content actually changed
            if (currentContent !== data.content) {
              model.original.setValue(data.content);
              showStatusNotification(`File ${basename(data.path)} was updated externally`, 'info');
            }
          }
        });
        return;
      }

      // Handle normal diff events
      const diffs = Array.isArray(data) ? data : [data];
      
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
    connectionStatus.updateStatus('disconnected');
  };
  return evtSource;
}

window.addEventListener("DOMContentLoaded", async () => {
  // Store models globally for each diff
  window.diffModels = [];
  
  // Create connection status instance
  const connectionStatus = new ConnectionStatus();
  
  // Add window close prevention handler
  window.addEventListener('keydown', (e) => {
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
    defineOneMonokaiTheme();
    monaco.editor.setTheme('one-monokai');

    try {
      const response = await fetch(`http://localhost:${currentPort}/diff`);
      const diffContents = await response.json();
      connectionStatus.updateStatus('connected');

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
      connectionStatus.updateStatus('disconnected');
      createEmptyState(document.getElementById('container'), createDiffEditor);
    }
    
    setupEventSource();

    // Focus on the original (left) editor
    setTimeout(() => window.diffModels[0]?.editor.getModifiedEditor().focus(), 100);
  });
});
