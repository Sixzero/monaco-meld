import { apiBaseUrl } from '../config.js';
import { showStatusNotification } from './notifications.js';

export class ConnectionStatus {
  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 20px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 5px;
      pointer-events: none;
    `;
    document.body.appendChild(this.element);
    
    this.statusElement = document.createElement('span');
    this.element.appendChild(this.statusElement);
    
    this.statusElement.addEventListener('click', () => this.retry());
    this.updateStatus('connecting');
  }

  updateStatus(status) {
    const states = {
      connected: {
        text: '● Connected',
        color: '#1e8e3e',
        background: '#1e8e3e20',
        cursor: 'default',
        pointerEvents: 'none'
      },
      disconnected: {
        text: '● Disconnected',
        color: '#d93025',
        background: '#d9302520',
        cursor: 'pointer',
        pointerEvents: 'auto'
      },
      connecting: {
        text: '● Connecting...',
        color: '#f9ab00',
        background: '#f9ab0020',
        cursor: 'default',
        pointerEvents: 'none'
      }
    };
    
    const state = states[status];
    this.statusElement.textContent = state.text;
    this.statusElement.style.color = state.color;
    this.element.style.background = state.background;
    this.statusElement.style.cursor = state.cursor;
    this.statusElement.style.pointerEvents = state.pointerEvents;
    this.currentStatus = status;
  }

  async retry() {
    if (this.currentStatus === 'connected') return;
    
    this.updateStatus('connecting');
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.ok) {
        this.updateStatus('connected');
        showStatusNotification('Connected to server!', 'success');
        window.location.reload();
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
