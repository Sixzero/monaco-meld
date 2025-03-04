import { DiffOperation } from "../diffOperations.js";
import { apiBaseUrl } from '../config.js';
import { showStatusNotification } from "../ui/notifications.js";
import { focusAndResizeEditor } from '../ui/functions.js';
import { getMonaco } from '../utils/importHelpers.js';
import { createEmptyState } from "../ui/emptyState.js";

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
    // Set the model state to "closing" to prevent file change updates
    model.state = "closing";
    
    const state = new DiffModelState(model, diffEditor);
    
    // Handle closing based on state
    if (state.hasUnsavedChanges()) {
      const result = await showCloseDialog(
        'There are unsaved changes. Would you like to save before closing?',
        ['Save', 'Close Without Saving', 'Cancel']
      );
      
      if (result === 0 && !await saveFile(model)) {
        // If save failed, reset the state
        model.state = "active";
        return false;
      }
      
      if (result === 2) {
        // User cancelled, reset the state
        model.state = "active";
        return false;
      }
    } else if (state.hasUnmergedChanges()) {
      const result = await showCloseDialog(
        'There are unmerged diffs. Are you sure you want to close?',
        ['Close', 'Cancel']
      );
      
      if (result === 1) {
        // User cancelled, reset the state
        model.state = "active";
        return false;
      }
    }

    // Clean up the diff
    await cleanupDiff(model, diffEditor, index);
    return true;
  };
}

// Separate cleanup logic (Single Responsibility)
async function cleanupDiff(model, diffEditor, index) {
  console.log('cleanupDiff called - diffModels:', window.diffModels.length, 'Container children:', document.getElementById('container').children.length);
  model.state = "removing";

  if (model.id) {
    try {
      console.log('Deleting diff with id:', model.id);
      const response = await fetch(`${apiBaseUrl}/diff/${model.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        console.error('Failed to delete diff:', await response.text());
      }
    } catch (err) {
      console.error('Error deleting diff:', err);
    }
  }

  // Clear any references in currentFocusedModel
  if (window.currentFocusedModel?.diffEditor === diffEditor) {
    window.currentFocusedModel = null;
  }

  // Cleanup resources in correct order
  window.diffModels.splice(index, 1); // Remove from array first

  // Dispose content listeners if they exist
  model.contentListeners?.forEach(disposable => disposable.dispose());

  // First clear the diff editor model to prevent the disposed model error
  diffEditor.setModel(null);
  
  // Then dispose the editor
  diffEditor.dispose();
  
  // Then dispose models
  model.original.dispose();
  model.modified.dispose();
  
  // Finally remove the DOM element
  model.container.remove();
  
  updateWindowTitle();

  // Show empty state if no more diffs
  if (window.diffModels.length === 0) {
    const container = document.getElementById('container');
    createEmptyState(container, window.createDiffEditor);
  } else {
    // Handle focus after cleanup
    const nextIndex = Math.min(index, window.diffModels.length - 1);
    const nextModel = window.diffModels[nextIndex];
    if (nextModel) {
      const nextModifiedEditor = focusAndResizeEditor(nextModel);
      setTimeout(() => {
        if (nextModel.editor) { // Check if editor still exists
          setupKeybindings(nextModel.editor, nextModifiedEditor);
          // Dispatch focus change event
          window.dispatchEvent(new CustomEvent('custom:editor-focus-changed'));
        }
      }, 0);
    }
  }
  console.log('window.diffModels:', window.diffModels)
  // Add debug logging after cleanup
  console.log('After cleanupDiff - diffModels:', window.diffModels.length, 'Container children:', document.getElementById('container').children.length);
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
 // Ensure we have exactly one DiffOperation instance
  const getOrCreateDiffOp = (diffEditor) => {
    const index = window.diffModels.findIndex(model => 
      model.editor === diffEditor
    );
    
    if (index === -1) {
      console.warn('No model found for editor');
      return null;
    }
    
    const model = window.diffModels[index];
    const diffOp = new DiffOperation(model.original, model.modified);
    return diffOp;
  };
  // Undo command
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
    () => {
      const diffOp = getOrCreateDiffOp(diffEditor);
      diffOp?.undoLastOperation();
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
    // Found next change in current diff
    editorView.setPosition({
      lineNumber: nextChange.modifiedStartLineNumber,
      column: 1,
    });
    editorView.revealLineInCenter(nextChange.modifiedStartLineNumber);
  } else {
    // No more changes in current diff, try to move to next diff
    const currentIndex = window.diffModels.findIndex(model => 
      model.editor === diffEditor
    );
    
    if (currentIndex < window.diffModels.length - 1) {
      // There is a next diff
      const nextModel = window.diffModels[currentIndex + 1];
      const nextModifiedEditor = nextModel.editor.getModifiedEditor();
      const nextChanges = nextModel.editor.getLineChanges();
      
      if (nextChanges?.length > 0) {
        // Focus the next diff
        focusAndResizeEditor(nextModel);
        // Go to first change
        nextModifiedEditor.setPosition({
          lineNumber: nextChanges[0].modifiedStartLineNumber,
          column: 1
        });
        nextModifiedEditor.revealLineInCenter(nextChanges[0].modifiedStartLineNumber);
      }
    }
  }
}

export function navigateToPreviousChange(diffEditor, modifiedEditor) {
  const changes = diffEditor.getLineChanges();
  const currentLine = modifiedEditor.getPosition().lineNumber;
  const prevChange = [...(changes || [])]
    .reverse()
    .find((change) => change.modifiedStartLineNumber < currentLine);

  if (prevChange) {
    // Found previous change in current diff
    modifiedEditor.setPosition({
      lineNumber: prevChange.modifiedStartLineNumber,
      column: 1,
    });
    modifiedEditor.revealLineInCenter(prevChange.modifiedStartLineNumber);
  } else {
    // No more changes in current diff, try to move to previous diff
    const currentIndex = window.diffModels.findIndex(model => 
      model.editor === diffEditor
    );
    
    if (currentIndex > 0) {
      // There is a previous diff
      const prevModel = window.diffModels[currentIndex - 1];
      const prevModifiedEditor = prevModel.editor.getModifiedEditor();
      const prevChanges = prevModel.editor.getLineChanges();
      
      if (prevChanges?.length > 0) {
        // Focus the previous diff
        focusAndResizeEditor(prevModel);
        // Go to last change
        const lastChange = prevChanges[prevChanges.length - 1];
        prevModifiedEditor.setPosition({
          lineNumber: lastChange.modifiedStartLineNumber,
          column: 1
        });
        prevModifiedEditor.revealLineInCenter(lastChange.modifiedStartLineNumber);
      }
    }
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
