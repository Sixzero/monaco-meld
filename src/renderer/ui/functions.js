
// Add new function to handle focus and resize
export function focusAndResizeEditor(model) {
  // Collapse all other editors
  window.diffModels.forEach(m => {
    if (m !== model) {
      m.container.style.height = '200px';
    }
  });
  
  // Expand the focused editor
  model.container.style.height = '80vh';
  model.editor.layout();
  
  // Focus the editor
  const modifiedEditor = model.editor.getModifiedEditor();
  modifiedEditor.focus();
  
  return modifiedEditor;
}