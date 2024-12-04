import { apiBaseUrl, updateServerUrl } from '../config.js';
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
      flex-direction: column;
      align-items: flex-end;
      gap: 5px;
    `;
    document.body.appendChild(this.element);
    
    this.statusElement = document.createElement('span');
    this.element.appendChild(this.statusElement);

    // Create input field for server URL
    this.urlInput = document.createElement('input');
    this.urlInput.type = 'text';
    this.urlInput.value = apiBaseUrl;
    this.urlInput.style.cssText = `
      display: none;
      background: #2d2d2d;
      color: #e0e0e0;
      border: 1px solid #454545;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      width: 200px;
      margin-top: 5px;
    `;
    this.element.appendChild(this.urlInput);
    
    this.statusElement.addEventListener('click', () => this.retry());
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.retry();
    });
    
    this.updateStatus('connecting');
  }

  updateStatus(status) {
    const states = {
      connected: {
        text: '● Connected',
        color: '#1e8e3e',
        background: '#1e8e3e20',
        cursor: 'default',
        pointerEvents: 'none',
        showInput: false
      },
      disconnected: {
        text: '● Disconnected (click to retry)',
        color: '#d93025',
        background: '#d9302520',
        cursor: 'pointer',
        pointerEvents: 'auto',
        showInput: true
      },
      connecting: {
        text: '● Connecting...',
        color: '#f9ab00',
        background: '#f9ab0020',
        cursor: 'default',
        pointerEvents: 'none',
        showInput: false
      }
    };
    
    const state = states[status];
    this.statusElement.textContent = state.text;
    this.statusElement.style.color = state.color;
    this.element.style.background = state.background;
    this.statusElement.style.cursor = state.cursor;
    this.statusElement.style.pointerEvents = state.pointerEvents;
    this.urlInput.style.display = state.showInput ? 'block' : 'none';
    this.currentStatus = status;
  }

  async retry() {
    if (this.currentStatus === 'connected') return;
    
    this.updateStatus('connecting');
    try {
      const newUrl = this.urlInput.value;
      const response = await fetch(`${newUrl}/health`);
      if (response.ok) {
        this.updateStatus('connected');
        showStatusNotification('Connected to server!', 'success');
        // Store new URL and reload
        updateServerUrl(newUrl);
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
