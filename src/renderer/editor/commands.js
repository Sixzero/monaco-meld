import { DiffOperation } from "../diffOperations.js";
import { apiBaseUrl } from '../config.js';
import { showStatusNotification } from "../ui/notifications.js";
import { focusAndResizeEditor } from '../ui/functions.js';
import { getMonaco } from '../utils/importHelpers.js';

// Add save helper function
async function saveFile(model) {
  try {
    if (!model?.path) {
      console.error('No file path available for save');
      showStatusNotification('No file path available', 'error');
      return false;
    }

    const content = model.original.getValue();
    const response = await fetch(`${apiBaseUrl}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content,
        path: model.path
      })
    });
    
    if (response.ok) {
      updateModelContent(model, content); // Use the new function
      showStatusNotification('File saved successfully!', 'success');
      return true;
    }
    
    showStatusNotification('Failed to save file!', 'error');
    return false;
  } catch (err) {
    console.error('Error saving:', err);
    showStatusNotification('Failed to save file!', 'error');
    return false;
  }
}

// Add new function for handling model content updates
export function updateModelContent(model, content) {
  const currentContent = model.original.getValue();
  if (currentContent !== content) {
    model.original.setValue(content);
  }
  model.initialContent = content;
  model.container.querySelector('.title-text')?.classList.remove('unsaved');
  updateWindowTitle();
}

// Create a model state checker class following Single Responsibility Principle
class DiffModelState {
  constructor(model, diffEditor) {
    this.model = model;
    this.diffEditor = diffEditor;
  }

  hasUnsavedChanges() {
    const currentContent = this.model.original.getValue();
    return this.model.initialContent !== currentContent;
  }

  hasUnmergedChanges() {
    return (this.diffEditor.getLineChanges() || []).length > 0;
  }

  updateUnsavedIndicator() {
    const hasChanges = this.hasUnsavedChanges();
    const titleText = this.model.container.querySelector('.title-text');
    if (hasChanges) {
      titleText?.classList.add('unsaved');
    } else {
      titleText?.classList.remove('unsaved');
    }
  }
}

// Separate dialog handling (Single Responsibility)
async function showCloseDialog(message, buttons) {
  if (window.electronAPI?.showSaveDialog) {
    return window.electronAPI.showSaveDialog({
      message,
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      noLink: true,
      type: 'question',
      title: 'Close File'
    });
  }
  // Web fallback
  if (buttons.length === 3) { // Save dialog
    return window.confirm('Do you want to save and exit?') ? 0 : 
           window.confirm('Close without saving?') ? 1 : 2;
  }
  return window.confirm(message) ? 0 : 1; // Simple confirm
}

// Simplified close command following KISS
export function createCloseCommand(diffEditor) {
  return async (e) => {
    e?.preventDefault?.();
    
    const originalModel = diffEditor.getOriginalEditor().getModel();
    const modifiedModel = diffEditor.getModifiedEditor().getModel();
    
    const index = window.diffModels.findIndex(model => 
      model.original === originalModel || model.modified === modifiedModel
    );
    
    if (index === -1) return false;

    const model = window.diffModels[index];
    const state = new DiffModelState(model, diffEditor);
    
    // Handle closing based on state
    if (state.hasUnsavedChanges()) {
      const result = await showCloseDialog(
        'There are unsaved changes. Would you like to save before closing?',
        ['Save', 'Close Without Saving', 'Cancel']
      );
      
      if (result === 0 && !await saveFile(model)) return false; // Save failed
      if (result === 2) return false; // Cancelled
    } else if (state.hasUnmergedChanges()) {
      const result = await showCloseDialog(
        'There are unmerged diffs. Are you sure you want to close?',
        ['Close', 'Cancel']
      );
      
      if (result === 1) return false; // Cancelled
    }

    // Clean up the diff
    await cleanupDiff(model, diffEditor, index);
    return true;
  };
}

// Separate cleanup logic (Single Responsibility)
async function cleanupDiff(model, diffEditor, index) {
  if (model.id) {
    try {
      console.log('`${apiBaseUrl}/diff/${model.id}`:', `${apiBaseUrl}/diff/${model.id}`)
      const response = await fetch(`${apiBaseUrl}/diff/${model.id}`, {  // Use apiBaseUrl
        method: 'DELETE'
      });
      if (!response.ok) {
        console.error('Failed to delete diff:', await response.text());
      }
    } catch (err) {
      console.error('Error deleting diff:', err);
    }
  }

  // Cleanup resources
  diffEditor.dispose();
  window.diffModels.splice(index, 1);
  model.container.remove();
  model.original.dispose();
  model.modified.dispose();
  
  updateWindowTitle();

  // Handle focus
  if (window.diffModels.length > 0) {
    const nextIndex = Math.min(index, window.diffModels.length - 1);
    const nextModel = window.diffModels[nextIndex];
    const nextModifiedEditor = focusAndResizeEditor(nextModel);
    
    setTimeout(() => setupKeybindings(nextModel.editor, nextModifiedEditor), 0);
  }
}

// Update setupKeybindings function
async function setupKeybindings(diffEditor, editor) {
  const monaco = await getMonaco();

  // Save command
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    async () => {
      const index = window.diffModels.findIndex(model => 
        model.editor === diffEditor &&
        (model.original === editor.getModel() || model.modified === editor.getModel())
      );
      if (index !== -1) await saveFile(window.diffModels[index]);
    }
  );

  // Add all three close combinations
  const closeHandler = createCloseCommand(diffEditor);
  editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyW, closeHandler);
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, closeHandler);
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyQ, closeHandler);

  // Transfer chunk commands
  editor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
    () => acceptCurrentChange(diffEditor, editor)
  );

  editor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
    () => acceptCurrentChange(diffEditor, editor)
  );

  // Navigation commands
  editor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
    () => navigateToNextChange(diffEditor, editor)
  );

  editor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
    () => navigateToPreviousChange(diffEditor, editor)
  );

  // Undo command
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
    () => {
      const index = window.diffModels.findIndex(model => 
        model.editor === diffEditor
      );
      if (index !== -1) {
        const model = window.diffModels[index];
        const diffOp = new DiffOperation(model.original, model.modified);
        diffOp.undoLastOperation();
      }
    }
  );

  // Update editor switching commands with scrolling
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.UpArrow,
    () => {
      const currentIndex = window.diffModels.findIndex(model => 
        model.editor === diffEditor
      );
      if (currentIndex > 0) {
        const prevModel = window.diffModels[currentIndex - 1];
        const prevModifiedEditor = focusAndResizeEditor(prevModel);
        setupKeybindings(prevModel.editor, prevModifiedEditor);
        // Changed from 'start' to 'center'
        prevModel.container.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  );

  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.DownArrow,
    () => {
      const currentIndex = window.diffModels.findIndex(model => 
        model.editor === diffEditor
      );
      if (currentIndex < window.diffModels.length - 1) {
        const nextModel = window.diffModels[currentIndex + 1];
        const nextModifiedEditor = focusAndResizeEditor(nextModel);
        setupKeybindings(nextModel.editor, nextModifiedEditor);
        // Changed from 'start' to 'center'
        nextModel.container.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  );
}

export function setupEditorCommands(diffEditor, originalEditor, modifiedEditor, container) {
  // Create close command for the close button
  const closeCommand = createCloseCommand(diffEditor);
  
  // Set up focus handlers
  originalEditor.onDidFocusEditorWidget(() => {
    setupKeybindings(diffEditor, originalEditor);
    window.currentFocusedModel = {
      diffEditor,
      modifiedEditor: modifiedEditor
    };
    // Dispatch a custom event that mobile navigation can listen to
    window.dispatchEvent(new CustomEvent('custom:editor-focus-changed'));
  });

  modifiedEditor.onDidFocusEditorWidget(() => {
    setupKeybindings(diffEditor, modifiedEditor);
    window.currentFocusedModel = {
      diffEditor,
      modifiedEditor: modifiedEditor
    };
    // Dispatch a custom event that mobile navigation can listen to
    window.dispatchEvent(new CustomEvent('custom:editor-focus-changed'));
  });

  // Add change listener to track unsaved changes
  originalEditor.onDidChangeModelContent(() => {
    const index = window.diffModels.findIndex(model => model.editor === diffEditor);
    if (index !== -1) {
      const model = window.diffModels[index];
      const state = new DiffModelState(model, diffEditor);
      state.updateUnsavedIndicator();
      updateWindowTitle();
    }
  });

  return closeCommand;
}

// Add window title update helper
export function updateWindowTitle() {
  const unsavedCount = window.diffModels.filter(model => 
    model.initialContent !== model.original.getValue()
  ).length;
  
  document.title = `MonacoMeld - ${window.diffModels.length} files${unsavedCount ? ` (${unsavedCount} unsaved)` : ''}`;
}

// Export the navigation functions
export function navigateToNextChange(diffEditor, editorView) {
  const changes = diffEditor.getLineChanges();
  const currentLine = editorView.getPosition().lineNumber;
  const nextChange = changes?.find(
    (change) => change.modifiedStartLineNumber > currentLine
  );

  if (nextChange) {
    editorView.setPosition({
      lineNumber: nextChange.modifiedStartLineNumber,
      column: 1,
    });
    editorView.revealLineInCenter(nextChange.modifiedStartLineNumber);
  }
}

export function navigateToPreviousChange(diffEditor, modifiedEditor) {
  const changes = diffEditor.getLineChanges();
  const currentLine = modifiedEditor.getPosition().lineNumber;
  const prevChange = [...(changes || [])]
    .reverse()
    .find((change) => change.modifiedStartLineNumber < currentLine);

  if (prevChange) {
    modifiedEditor.setPosition({
      lineNumber: prevChange.modifiedStartLineNumber,
      column: 1,
    });
    modifiedEditor.revealLineInCenter(prevChange.modifiedStartLineNumber);
  }
}

export function acceptCurrentChange(diffEditor, modifiedEditor) {
  const changes = diffEditor.getLineChanges();
  const currentLine = modifiedEditor.getPosition().lineNumber;
  
  // Find the correct model from the diffModels array
  const index = window.diffModels.findIndex(model => 
    model.modified === modifiedEditor.getModel()
  );
  
  if (index === -1) return;
  
  const { original: originalModel, modified: modifiedModel } = window.diffModels[index];
  const diffOp = new DiffOperation(originalModel, modifiedModel);
  diffOp.acceptCurrentChange(currentLine, changes);
}
