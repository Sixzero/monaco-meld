
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let diffContents = null;
let originalFilePath = null;
let isQuitting = false;  // Add flag to track if we're actually quitting

app.commandLine.appendSwitch('log-level', '3');

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
  const args = process.argv;
  
  // Get the effective arguments, skipping the executable path
  const effectiveArgs = args[0].includes('monacomeld') ? args.slice(1) : args.slice(2);
  
  if (effectiveArgs.length === 0) {
    return { leftContent: null, rightContent: null, leftPath: null, rightPath: null };
  }
  
  let leftFile = '';
  let rightContent = null;
  let rightPath = null;
  originalFilePath = effectiveArgs[0];

  // Read left file
  if (fs.existsSync(effectiveArgs[0])) {
    try {
      leftFile = fs.readFileSync(effectiveArgs[0], 'utf-8');
    } catch (err) {
      console.error('Error reading leftFile:', err);
    }
  } else {
    console.log('Left file does not exist yet, starting with empty content');
  }

  // Handle the second argument
  if (effectiveArgs[1]) {
    rightPath = effectiveArgs[1];
    try {
      // Handle stdin input
      if (rightPath === '-' || !process.stdin.isTTY) {
        const stdinBuffer = fs.readFileSync(0); // fd 0 is stdin
        rightContent = stdinBuffer.toString();
        rightPath = '<stdin>';
      } else {
        // Regular file read
        rightContent = fs.readFileSync(rightPath, 'utf-8');
      }
    } catch (err) {
      console.error('Error reading content:', err);
    }
  }
  
  return { 
    leftContent: leftFile, 
    rightContent,
    leftPath: originalFilePath,
    rightPath
  };
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

  mainWindow.loadFile('public/index.html');
  mainWindow.on('close', handleWindowClose);
}

// Add window close handler
app.on('before-quit', () => {
  isQuitting = true;
});

// Handle window close event
function handleWindowClose(event) {
  if (isQuitting) return;
  
  event.preventDefault();
  mainWindow.webContents.executeJavaScript('window.hasUnsavedChanges()')
    .then(async hasChanges => {
      if (!hasChanges) {
        isQuitting = true;
        app.quit();
        return;
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save', 'Don\'t Save', 'Cancel'],
        defaultId: 0,
        message: 'Do you want to save the changes?'
      });

      if (response === 0) { // Save
        try {
          const content = await mainWindow.webContents.executeJavaScript('window.getLeftContent()');
          if (!originalFilePath) {
            console.error('No file path to save to');
            return;
          }
          fs.writeFileSync(originalFilePath, content, 'utf-8');
          isQuitting = true;
          app.quit();
        } catch (err) {
          console.error('Error saving file:', err);
          await dialog.showMessageBox(mainWindow, {
            type: 'error',
            message: 'Failed to save file: ' + err.message
          });
        }
      } else if (response === 1) { // Don't Save
        isQuitting = true;
        app.quit();
      }
      // Cancel does nothing, window stays open
    })
    .catch(err => {
      console.error('Error during close:', err);
      isQuitting = true;
      app.quit();
    });
}

// Handle IPC request for diff contents
ipcMain.handle('get-diff-contents', () => diffContents);

// Handle IPC request for saving content
ipcMain.handle('get-original-content', () => diffContents?.leftContent || null);
ipcMain.handle('save-content', async (event, content) => {
  if (!originalFilePath) return false;
  try {
    fs.writeFileSync(originalFilePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving file:', err);
    return false;
  }
});

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

