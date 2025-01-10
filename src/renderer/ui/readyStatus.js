export function showReadyStatus(container, diffEditor) {
  const readyDiv = document.createElement('div');
  readyDiv.style.cssText = `
    position: absolute;
    right: 25%;
    bottom: 50%;
    transform: translate(50%, 50%);
    color: #2ecc71;
    font-size: 16px;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 4px 8px;
    border-radius: 3px;
    background: rgba(40, 44, 52, 0.5);
    pointer-events: none;
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  readyDiv.textContent = 'No more changes';
  container.appendChild(readyDiv);

  let updateTimeout = null;  // Add timeout tracking

  const updateReadyStatus = () => {
    // Clear any pending update
    if (updateTimeout) clearTimeout(updateTimeout);

    // Set new timeout
    updateTimeout = setTimeout(() => {
      const changes = diffEditor.getLineChanges();
      readyDiv.style.opacity = changes?.length ? '0' : '1';
      updateTimeout = null;
    }, 200);
  };

  // Listen for changes in both editors
  const originalModel = diffEditor.getOriginalEditor().getModel();
  const modifiedModel = diffEditor.getModifiedEditor().getModel();
  originalModel.onDidChangeContent(updateReadyStatus);
  modifiedModel.onDidChangeContent(updateReadyStatus);

  // Return the update function for external updates if needed
  return { element: readyDiv, update: updateReadyStatus };
}
