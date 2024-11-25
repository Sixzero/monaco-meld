export function showReadyStatus(container, diffEditor) {
  const readyDiv = document.createElement('div');
  readyDiv.style.cssText = `
    position: absolute;
    right: 50%;
    bottom: 50%;
    transform: translate(50%, 50%);
    color: #2ecc71;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    padding: 4px 8px;
    border-radius: 3px;
    background: rgba(46, 204, 113, 0.15);
    pointer-events: none;
  `;
  readyDiv.textContent = 'Ready';
  container.appendChild(readyDiv);

  // Update ready status when changes occur
  const updateReadyStatus = () => {
    const changes = diffEditor.getLineChanges();
    console.log('changes:', changes?.length)
    console.log('changes:', changes)
    readyDiv.style.display = changes?.length ? 'none' : 'block';
  };

  // Initial status check
  updateReadyStatus();

  return { element: readyDiv, update: updateReadyStatus };
}
