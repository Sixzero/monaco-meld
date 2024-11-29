import { navigateToNextChange, navigateToPreviousChange } from '../editor/commands.js';
import { DiffOperation } from '../diffOperations.js';

export function createMobileNavigation(diffEditor, modifiedEditor) {
  console.log('Creating mobile navigation...');
  
  if (!diffEditor || !modifiedEditor) {
    console.warn('Missing editors, skipping mobile navigation creation');
    return null;
  }

  // Remove existing navigation if any
  const existing = document.querySelector('.mobile-nav-buttons');
  if (existing) {
    existing.remove();
  }

  const container = document.createElement('div');
  container.className = 'mobile-nav-buttons';

  // Previous change button
  const prevButton = document.createElement('button');
  prevButton.className = 'mobile-nav-button';
  prevButton.innerHTML = '↑';
  prevButton.title = 'Previous Change (Alt+↑)';
  prevButton.addEventListener('click', () => {
    navigateToPreviousChange(diffEditor, modifiedEditor);
  });

  // Undo button
  const undoButton = document.createElement('button');
  undoButton.className = 'mobile-nav-button undo';
  undoButton.innerHTML = '↺';
  undoButton.title = 'Undo Last Change (Ctrl+Z)';
  undoButton.addEventListener('click', () => {
    const index = window.diffModels.findIndex(model => 
      model.editor === diffEditor
    );
    if (index !== -1) {
      const model = window.diffModels[index];
      const diffOp = new DiffOperation(model.original, model.modified);
      diffOp.undoLastOperation();
    }
  });

  // Accept change button
  const acceptButton = document.createElement('button');
  acceptButton.className = 'mobile-nav-button accept';
  acceptButton.innerHTML = '✓';
  acceptButton.title = 'Accept Change (Alt+→)';
  acceptButton.addEventListener('click', () => {
    const currentLine = modifiedEditor.getPosition().lineNumber;
    const changes = diffEditor.getLineChanges();
    if (changes?.length) {
      const diffOp = new DiffOperation(
        diffEditor.getOriginalEditor().getModel(),
        diffEditor.getModifiedEditor().getModel()
      );
      diffOp.acceptCurrentChange(currentLine, changes);
      navigateToNextChange(diffEditor, modifiedEditor);
    }
  });

  // Next change button
  const nextButton = document.createElement('button');
  nextButton.className = 'mobile-nav-button';
  nextButton.innerHTML = '↓';
  nextButton.title = 'Next Change (Alt+↓)';
  nextButton.addEventListener('click', () => {
    navigateToNextChange(diffEditor, modifiedEditor);
  });

  container.appendChild(prevButton);
  container.appendChild(undoButton);
  container.appendChild(acceptButton);
  container.appendChild(nextButton);

  // Update visibility based on changes
  const updateVisibility = () => {
    const changes = diffEditor.getLineChanges();
    container.style.display = changes?.length ? 'flex' : 'none';
  };

  // Update visibility initially and on changes
  updateVisibility();
  const originalModel = diffEditor.getOriginalEditor().getModel();
  const modifiedModel = diffEditor.getModifiedEditor().getModel();
  originalModel.onDidChangeContent(updateVisibility);
  modifiedModel.onDidChangeContent(updateVisibility);

  // Append to body instead of waiting for external append
  document.body.appendChild(container);
  console.log('Mobile navigation created');

  return container;
}