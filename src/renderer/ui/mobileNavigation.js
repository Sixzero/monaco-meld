import { navigateToNextChange, navigateToPreviousChange, acceptCurrentChange } from '../editor/commands.js';
import { DiffOperation } from '../diffOperations.js';

export function createMobileNavigation() {

  const nav = document.createElement('div');
  nav.className = 'mobile-nav-buttons';
  nav.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    padding: 10px;
    background: rgba(30, 30, 30, 0.9);
    border-radius: 8px;
    z-index: 1000;
  `;

  const buttons = [
    {
      icon: '↑',
      title: 'Previous Change (Alt+↑)',
      className: 'mobile-nav-button',
      onClick: () => {
        if (window.currentFocusedModel) {
          navigateToPreviousChange(
            window.currentFocusedModel.diffEditor, 
            window.currentFocusedModel.modifiedEditor
          );
        }
      }
    },
    {
      icon: '↺',
      title: 'Undo Last Change (Ctrl+Z)',
      className: 'mobile-nav-button undo',
      onClick: () => {
        if (window.currentFocusedModel) {
          const model = window.diffModels.find(m => 
            m.editor === window.currentFocusedModel.diffEditor
          );
          if (model) {
            const diffOp = new DiffOperation(model.original, model.modified);
            diffOp.undoLastOperation();
          }
        }
      }
    },
    {
      icon: '✓',
      title: 'Accept Change (Alt+→)',
      className: 'mobile-nav-button accept',
      onClick: () => {
        if (window.currentFocusedModel) {
          const currentLine = window.currentFocusedModel.modifiedEditor.getPosition().lineNumber;
          acceptCurrentChange(
            window.currentFocusedModel.diffEditor, 
            window.currentFocusedModel.modifiedEditor
          );
          navigateToNextChange(
            window.currentFocusedModel.diffEditor, 
            window.currentFocusedModel.modifiedEditor
          );
        }
      }
    },
    {
      icon: '↓',
      title: 'Next Change (Alt+↓)',
      className: 'mobile-nav-button',
      onClick: () => {
        if (window.currentFocusedModel) {
          navigateToNextChange(
            window.currentFocusedModel.diffEditor, 
            window.currentFocusedModel.modifiedEditor
          );
        }
      }
    }
  ];

  buttons.forEach(({icon, title, className, onClick}) => {
    const button = document.createElement('button');
    button.innerHTML = icon;
    button.title = title;
    button.className = className;
    button.style.cssText = `
      width: 44px;
      height: 44px;
      border-radius: 8px;
      border: 1px solid #454545;
      background: #2d2d2d;
      color: #e0e0e0;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      padding: 0;
    `;
    button.addEventListener('click', onClick);
    nav.appendChild(button);
  });

  // Update accept button state based on changes
  function updateAcceptButton() {
    const acceptButton = nav.querySelector('.accept');
    if (!acceptButton) return;

    if (window.currentFocusedModel?.diffEditor) {
      const hasChanges = window.currentFocusedModel.diffEditor.getLineChanges()?.length > 0;
      console.log('hasChanges:', hasChanges)
      acceptButton.disabled = !hasChanges;
      acceptButton.style.opacity = hasChanges ? '1' : '0.5';
      acceptButton.style.cursor = hasChanges ? 'pointer' : 'not-allowed';
    } else {
      acceptButton.disabled = true;
      acceptButton.style.opacity = '0.5';
      acceptButton.style.cursor = 'not-allowed';
    }
  }

  // Update button state when content changes
  function setupButtonStateListeners() {
    window.diffModels.forEach(model => {
      // Store disposables on the model for cleanup
      if (!model.contentListeners) {
        model.contentListeners = [
          model.original.onDidChangeContent(updateAcceptButton),
          model.modified.onDidChangeContent(updateAcceptButton)
        ];
      }
    });
  }

  // Initial setup
  setupButtonStateListeners();
  updateAcceptButton();
  
  // Listen for focus changes with more explicit event name
  window.addEventListener('custom:editor-focus-changed', updateAcceptButton);

  // Update listeners when new models are added
  const originalPush = window.diffModels.push;
  window.diffModels.push = function(...args) {
    const result = originalPush.apply(this, args);
    setupButtonStateListeners();
    updateAcceptButton();
    return result;
  };

  document.body.appendChild(nav);
  return nav;
}