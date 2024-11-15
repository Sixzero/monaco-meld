import { currentPort } from '../config.js';
import { showStatusNotification } from './notifications.js';

export class ConnectionStatus {
  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 5px;
    `;
    this.element.title = 'Click to retry connection';
    document.body.appendChild(this.element);
    
    this.element.addEventListener('click', () => this.retry());
    this.updateStatus('connecting');
  }

  updateStatus(status) {
    const states = {
      connected: {
        text: '● Connected',
        color: '#1e8e3e',
        background: '#1e8e3e20'
      },
      disconnected: {
        text: '● Disconnected',
        color: '#d93025',
        background: '#d9302520'
      },
      connecting: {
        text: '● Connecting...',
        color: '#f9ab00',
        background: '#f9ab0020'
      }
    };
    
    const state = states[status];
    this.element.textContent = state.text;
    this.element.style.color = state.color;
    this.element.style.background = state.background;
    this.currentStatus = status;
  }

  async retry() {
    if (this.currentStatus === 'connected') return;
    
    this.updateStatus('connecting');
    try {
      const response = await fetch(`http://localhost:${currentPort}/health`);
      if (response.ok) {
        this.updateStatus('connected');
        showStatusNotification('Connected to server!', 'success');
        window.location.reload(); // Reload to reinitialize everything
      } else {
        throw new Error('Health check failed');
      }
    } catch (err) {
      console.error('Connection failed:', err);
      this.updateStatus('disconnected');
      showStatusNotification('Failed to connect to server', 'error');
    }
  }
}
