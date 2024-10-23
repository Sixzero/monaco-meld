
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let diffContents = null;

// Create custom console logger that sends to renderer
function createCustomLogger() {
  const originalConsole = { ...console };
  return {
    log: (...args) => {
      originalConsole.log(...args);
      if (mainWindow) {
        mainWindow.webContents.send('console-log', ...args);
      }
    },
    error: (...args) => {
      originalConsole.error(...args);
      if (mainWindow) {
        mainWindow.webContents.send('console-error', ...args);
      }
    }
  };
}

// Replace global console
console = createCustomLogger();

function parseProcessInput() {
  const args = process.argv.slice(2);
  let leftFile = null;
  let rightContent = null;

  if (args.length >= 1) {
    leftFile = args[0];
  }

  // Check if we have a process substitution input
  if (process.stdin.isTTY === false) {
    rightContent = fs.readFileSync(0, 'utf-8'); // Read from stdin
  } else if (args.length >= 2) {
    rightContent = fs.readFileSync(args[1], 'utf-8');
  }
  let leftContent = leftFile ? fs.readFileSync(leftFile, 'utf-8') : null;
  console.log('leftContent:', leftContent)
  console.log('rightContent:', rightContent)
  
  return { leftContent, rightContent };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 800,
    webPreferences: { 
      worldSafeExecuteJavaScript: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Parse input files before loading the window
  try {
    diffContents = parseProcessInput();
  } catch (err) {
    console.error('Error reading input files:', err);
  }

  mainWindow.loadFile('src/renderer/index.html');
  mainWindow.openDevTools();
}

// Handle IPC request for diff contents
ipcMain.handle('get-diff-contents', () => diffContents);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

