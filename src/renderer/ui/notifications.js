export function showStatusNotification(message, type = 'success') {
  const colors = {
    success: '#1e8e3e',
    error: '#d93025',
    warning: '#f9ab00'
  };

  const statusBarElement = document.createElement('div');
  statusBarElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 1000;
  `;
  statusBarElement.textContent = message;
  document.body.appendChild(statusBarElement);
  
  setTimeout(() => statusBarElement.remove(), 2000);
}
