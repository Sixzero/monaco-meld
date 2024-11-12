import { DiffOperation } from "../diffOperations.js";
import { currentPort } from '../config.js';
import { showStatusNotification } from "../ui/notifications.js";

// Add save helper function
async function saveFile(model) {
  try {
    // Add safety check for path
    if (!model?.path) {
      console.error('No file path available for save');
      showStatusNotification('No file path available', 'error');
      return false;
    }

    const content = model.original.getValue();
    const response = await fetch(`http://localhost:${currentPort}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content,
        path: model.path  // Ensure we use the path stored with the model
      })
    });
    
    if (response.ok) {
      model.initialContent = content;
      model.container.querySelector('.title-text')?.classList.remove('unsaved');
      updateWindowTitle();
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

// Create a reusable close command
export function createCloseCommand(container, diffEditor) {
  return async (e) => {
    // Prevent any default close behavior
    e?.preventDefault?.();
    
    const originalModel = diffEditor.getOriginalEditor().getModel();
    const modifiedModel = diffEditor.getModifiedEditor().getModel();
    
    const index = window.diffModels.findIndex(model => 
      model.original === originalModel || model.modified === modifiedModel
    );
    if (index !== -1) {
      const model = window.diffModels[index];
      const currentContent = model.original.getValue();
      const changes = diffEditor.getLineChanges() || [];
      
      // Check for unsaved changes or remaining diffs
      const hasUnsavedChanges = model.initialContent !== undefined && currentContent !== model.initialContent;
      const hasUnmergedChanges = changes.length > 0;
      
      if (hasUnsavedChanges || hasUnmergedChanges) {
        let message = 'Do you want to save changes?';
        if (hasUnmergedChanges) {
          message = hasUnsavedChanges ? 
            'There are unsaved changes and unmerged diffs. Do you want to save changes before quit?' :
            'There are unmerged diffs. Are you sure you want to close?';
        }
        
        const dialogOptions = {
          message,
          buttons: ['Save', 'Close Without Saving', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          noLink: true,
          type: 'question',
          title: 'Save Changes',
          normalizeAccessKeys: true,
          buttonStyles: [
            { color: '#1e8e3e', primary: true },
            {},
            {}
          ]
        };
        
        const result = await window.electronAPI?.showSaveDialog?.(dialogOptions) ?? window.confirm(message);
        if (result === true) {
          hasUnsavedChanges && await saveFile(model);
          // We don't want to save and want to just exit with unmerged diffs.
        } else if (result === 0) { // Save
          if (!await saveFile(model)) return false;
        } else if (result === 2 || result === false) { // Cancel
          return false;
        }
      }
      
      // Send delete request if we have an ID
      if (model.id) {
        try {
          const response = await fetch(`http://localhost:${currentPort}/diff/${model.id}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            console.error('Failed to delete diff:', await response.text());
          }
        } catch (err) {
          console.error('Error deleting diff:', err);
        }
      }

      // Cleanup
      diffEditor.dispose();
      window.diffModels.splice(index, 1);
      model.container.remove();
      originalModel.dispose();
      modifiedModel.dispose();
      
      // Update window title
      updateWindowTitle();

      // Focus on next available editor if exists
      if (window.diffModels.length > 0) {
        const nextIndex = Math.min(index, window.diffModels.length - 1);
        const nextEditor = window.diffModels[nextIndex].editor;
        const nextModifiedEditor = nextEditor.getModifiedEditor();
        
        setTimeout(() => {
          nextModifiedEditor.focus();
          setupKeybindings(nextEditor, nextModifiedEditor);
        }, 0);
      }

      return true;
    }
    return false;
  };
}

// Update setupKeybindings function
function setupKeybindings(diffEditor, editor) {
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

  // Update close command to use Alt+W instead of Ctrl+W
  editor.addCommand(
    monaco.KeyMod.Alt | monaco.KeyCode.KeyW,
    createCloseCommand(null, diffEditor)
  );

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
        model.original === editor.getModel() || model.modified === editor.getModel()
      );
      if (index !== -1) {
        window.diffModels[index].original.undo();
      }
    }
  );

  // Editor switching commands
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.UpArrow,
    () => {
      const currentIndex = window.diffModels.findIndex(model => 
        model.editor === diffEditor
      );
      if (currentIndex > 0) {
        const prevEditor = window.diffModels[currentIndex - 1].editor;
        const prevModifiedEditor = prevEditor.getModifiedEditor();
        prevModifiedEditor.focus();
        setupKeybindings(prevEditor, prevModifiedEditor);
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
        const nextEditor = window.diffModels[currentIndex + 1].editor;
        const nextModifiedEditor = nextEditor.getModifiedEditor();
        nextModifiedEditor.focus();
        setupKeybindings(nextEditor, nextModifiedEditor);
      }
    }
  );
}

export function setupEditorCommands(diffEditor, originalEditor, modifiedEditor, container) {
  // Create close command for the close button
  const closeCommand = createCloseCommand(container, diffEditor);
  
  // Set up focus handlers
  originalEditor.onDidFocusEditorWidget(() => {
    setupKeybindings(diffEditor, originalEditor);
  });

  modifiedEditor.onDidFocusEditorWidget(() => {
    setupKeybindings(diffEditor, modifiedEditor);
  });

  // Add change listener to track unsaved changes
  originalEditor.onDidChangeModelContent(() => {
    const index = window.diffModels.findIndex(model => model.editor === diffEditor);
    if (index !== -1) {
      const model = window.diffModels[index];
      const hasChanges = model.initialContent !== model.original.getValue();
      const titleText = container.querySelector('.title-text');
      if (hasChanges) {
        titleText?.classList.add('unsaved');
      } else {
        titleText?.classList.remove('unsaved');
      }
      updateWindowTitle();
    }
  });

  return closeCommand; // Return for the close button
}

// Add window title update helper
function updateWindowTitle() {
  const unsavedCount = window.diffModels.filter(model => 
    model.initialContent !== model.original.getValue()
  ).length;
  
  document.title = `MonacoMeld - ${window.diffModels.length} files${unsavedCount ? ` (${unsavedCount} unsaved)` : ''}`;
}

function navigateToNextChange(diffEditor, editorView) {
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
    console.log('editorView:', editorView)
    editorView.revealLineInCenter(nextChange.modifiedStartLineNumber);
  }
}

function navigateToPreviousChange(diffEditor, modifiedEditor) {
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

function acceptCurrentChange(diffEditor, modifiedEditor) {
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
