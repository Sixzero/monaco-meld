
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

let mainWindow;
let diffContents = null;
let originalFilePath = null;
let isQuitting = false;  // Add flag to track if we're actually quitting
let server = null;
let port = process.env.PORT || 3000;
let sseClients = new Set(); // Store SSE clients

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

// Add helper function to read file content
function readFileContent(filePath) {
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
}

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
      rightContent = rightPath === '-' || !process.stdin.isTTY ?
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

// Modify the web server function
function startWebServer() {
  server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle SSE endpoint
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      sseClients.add(res);
      
      req.on('close', () => {
        sseClients.delete(res);
      });
      
      return;
    }

    // Simplified save endpoint - only needs content
    if (req.method === 'POST' && req.url === '/save') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { content } = JSON.parse(body);
          const path = diffContents?.leftPath;
          
          if (!path) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No file path available' }));
            return;
          }

          try {
            fs.writeFileSync(path, content, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
          } catch (err) {
            console.error('Error saving file:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save file' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // Modify POST /diff to handle file paths
    if (req.method === 'POST' && req.url === '/diff') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          
          // Read file contents if only paths provided
          if (data.leftPath && !data.leftContent) {
            data.leftContent = readFileContent(data.leftPath);
          }
          if (data.rightPath && !data.rightContent) {
            data.rightContent = readFileContent(data.rightPath);
          }
          
          diffContents = data;
          
          // Notify all connected clients
          sseClients.forEach(client => {
            client.write(`data: ${JSON.stringify(data)}\n\n`);
          });
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // Handle GET /diff endpoint
    if (req.method === 'GET' && req.url === '/diff') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(diffContents || { leftContent: null, rightContent: null }));
      return;
    }

    // Original static file serving logic
    let filePath = req.url === '/' ? '/public/index.html' : req.url;
    
    // Handle monaco editor files and favicon
    if (filePath === '/favicon.ico') {
      filePath = './public/favicon.ico';
    } else if (filePath.includes('/node_modules/')) {
      filePath = filePath.replace('/node_modules/', './node_modules/');
    } else if (filePath.includes('/src/')) {
      filePath = filePath.replace('/src/', './src/');
    } else if (filePath.includes('/public/')) {
      filePath = filePath.replace('/public/', './public/');
    }
    
    const fullPath = path.join(__dirname, '..', filePath.startsWith('./') ? filePath.substring(2) : filePath.substring(1));
    
    try {
      const content = fs.readFileSync(fullPath);
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ttf': 'font/ttf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ico': 'image/x-icon'  // Add ico mime type
      }[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end(content);
    } catch (err) {
      console.error('File not found:', fullPath);
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`Web server running at http://localhost:${port}`);
  });
}

// Modify the existing app startup to always run web server
const webMode = process.argv.includes('--web');

app.whenReady().then(async () => {
  // Always start the web server
  startWebServer();
  
  // Only create window if not in web-only mode
  if (!webMode) {
    createWindow();
  }
});

// Add cleanup
app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
