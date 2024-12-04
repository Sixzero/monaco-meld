import { setupEditorCommands, navigateToNextChange, updateWindowTitle, updateModelContent, acceptCurrentChange } from "./editor/commands.js";
import { showStatusNotification, notifyWithFocus } from "./ui/notifications.js";
import { apiBaseUrl } from "./config.js";
import { createEmptyState } from "./ui/emptyState.js";
import { defineOneMonakaiTheme } from "./editor/theme.js";
import { focusAndResizeEditor } from "./ui/functions.js";
import { ConnectionStatus } from "./ui/connectionStatus.js";
import { normalizeContent } from "./editor/contentNormalizer.js";
import { showReadyStatus } from "./ui/readyStatus.js";
import { isMobileWidth, createWidthWatcher, hasTouch } from './utils/browserDetection.js';
import { SwipeHandler } from './utils/swipeHandler.js';
import {createMobileNavigation} from './ui/mobileNavigation.js';
import { getMonaco } from './utils/importHelpers.js';

const isWeb = !window.electronAPI;
const basePath = isWeb ? '' : '..';

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
  // Use the normalizer
  rightContent = normalizeContent(leftContent, rightContent);

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
    renderSideBySide: !isMobileWidth(), // Use width check instead
    fontSize: isMobileWidth() ? 24 : 14,
    lineHeight: isMobileWidth() ? 32 : 21,
    letterSpacing: isMobileWidth() ? 0.5 : 0,
    fontFamily: "'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontWeight: isMobileWidth() ? '500' : '400',
    originalEditable: true,
    renderIndicators: false,
    renderMarginRevertIcon: false,
    ignoreTrimWhitespace: false,
    // Add these new options:
    overviewRulerBorder: false,          // Hide overview ruler border
    overviewRulerLanes: 0,               // Disable overview ruler lanes
    // Add these options to disable the gutter markers
    glyphMargin: true,
    folding: false,
    lineNumbers: 'on',
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 3,
  });

  diffEditor.setModel({
    original: originalModel,
    modified: modifiedModel,
  });

  // Watch for width changes and update editor layout
  createWidthWatcher((isMobile) => {
    diffEditor.updateOptions({
      renderSideBySide: !isMobile,
      fontSize: isMobile ? 24 : 14,
      lineHeight: isMobile ? 32 : 21,
      letterSpacing: isMobile ? 0.5 : 0,
      fontWeight: isMobile ? '500' : '400'
    });
    diffEditor.layout();
  });

  // Apply font settings to both editors
  const modifiedEditor = diffEditor.getModifiedEditor();
  const originalEditor = diffEditor.getOriginalEditor();
  
  [modifiedEditor, originalEditor].forEach(editor => {
    editor.updateOptions({
      fontSize: isMobileWidth() ? 24 : 14,
      lineHeight: isMobileWidth() ? 32 : 21,
      letterSpacing: isMobileWidth() ? 0.5 : 0,
      fontWeight: isMobileWidth() ? '500' : '400'
    });
  });

  // Add ready status indicator with change tracking
  const readyStatus = showReadyStatus(container, diffEditor);
  
  // Replace the expandEditor function
  const expandEditor = () => {
    const model = window.diffModels.find(m => m.container === container);
    if (model) {
      focusAndResizeEditor(model);
    }
  };

  // Add focus handlers
  

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

  // Add swipe support for touch devices and mouse drag
  // const swipeHandler = new SwipeHandler(
  //   container,
  //   // Swipe left to reject
  //   () => closeCommand({ preventDefault: () => {} }),
  //   // Swipe right to accept
  //   () => {
  //     const currentLine = modifiedEditor.getPosition().lineNumber;
  //     acceptCurrentChange(diffEditor, modifiedEditor);
  //     // Move to next change after accepting
  //     navigateToNextChange(diffEditor, modifiedEditor);
  //   }
  // );

  
  // Add mobile navigation buttons
  const mobileNav = createMobileNavigation();
  if (mobileNav) {
    container.appendChild(mobileNav);  // Append to container instead of body
  }

  return { diffEditor, originalModel, modifiedModel };
}


async function saveContent(content, editor, filePath) {
  try {
    const result = await fetch(`${apiBaseUrl}/save`, {
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
  const evtSource = new EventSource(`${apiBaseUrl}/events`);
  
  // Move this line outside the function
  const connectionStatus = window.connectionStatus;
  
  evtSource.onopen = () => {
    connectionStatus?.updateStatus('connected');
  };
  
  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle diff closed events
      if (data.type === 'diffClosed') {
        // Remove the diff from UI if it exists
        const index = window.diffModels.findIndex(model => model.id === data.id);
        if (index !== -1) {
          const model = window.diffModels[index];
          model.editor.dispose();
          model.container.remove();
          window.diffModels.splice(index, 1);
          updateWindowTitle();
        }
        return;
      }

      // Handle file change events
      if (data.type === 'fileChange') {
        // Update all diff editors that use this file
        window.diffModels.forEach(model => {
          if (model.path === data.path) {
            const currentContent = model.original.getValue();
            // Only update if content actually changed
            if (currentContent !== data.content) {
              updateModelContent(model, data.content)
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
            // Use the normalizer for consistency
            const normalizedContent = normalizeContent(model.original.getValue(), diff.rightContent);
            model.modified.setValue(normalizedContent);
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
            diff.rightPath,
            diff.id
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
    connectionStatus?.updateStatus('disconnected');
  };
  return evtSource;
}

window.addEventListener("DOMContentLoaded", async () => {
  // Store models globally for each diff
  window.diffModels = [];
  
  // Create connection status instance and store it globally
  window.connectionStatus = new ConnectionStatus();
  
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
  await getMonaco();
  await defineOneMonakaiTheme();
  monaco.editor.setTheme('one-monokai');

  try {
    const response = await fetch(`${apiBaseUrl}/diff`);
    const diffContents = await response.json();
    window.connectionStatus.updateStatus('connected');

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
    window.connectionStatus.updateStatus('disconnected');
    createEmptyState(document.getElementById('container'), createDiffEditor);
  }
  
  setupEventSource();

  // Focus on the original (left) editor
  setTimeout(() => window.diffModels[0]?.editor.getModifiedEditor().focus(), 100);
});
