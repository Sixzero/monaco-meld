
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const Store = require('electron-store'); // Add near the top with other requires

// Add file watcher map
const fileWatchers = new Map();

let mainWindow;
let diffContents = null;
let diffHistory = new Map(); // Add diff history storage
let originalFilePath = null;
let isQuitting = false;  // Add flag to track if we're actually quitting
let server = null;
let port = process.env.PORT || 3000;
let sseClients = new Set(); // Store SSE clients

// Add after requires
const store = new Store();

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
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return null;
  }
}

// Add path resolution helper
function resolveFilePath(filePath, pwd) {
  if (!filePath || !pwd) return filePath;
  return path.isAbsolute(filePath) ? filePath : path.join(pwd, filePath);
}

function parseProcessInput() {
  const args = process.argv;
  
  // Get the effective arguments, skipping the executable path
  let effectiveArgs = args[0].includes('monacomeld') ? args.slice(1) : args.slice(2);
  effectiveArgs = effectiveArgs.filter(arg => !arg.startsWith('--'))
  console.log('effectiveArgs:', effectiveArgs)

  if (effectiveArgs.length === 0) {
    console.log('No input files specified');
    return { leftContent: null, rightContent: null, leftPath: null, rightPath: null };
  }
  
  let leftFile = '';
  let rightContent = null;
  let rightPath = null;
  originalFilePath = effectiveArgs[0];

  if (fs.existsSync(effectiveArgs[0])) {
    try {
      leftFile = fs.readFileSync(effectiveArgs[0], 'utf-8');
    } catch (err) {
      console.error('Error reading leftFile:', err);
    }
  }

  // Handle the second argument
  if (effectiveArgs[1]) {
    rightPath = effectiveArgs[1];
    try {
      rightContent = rightPath === '-' || !process.stdin.isTTY ?
        fs.readFileSync(0).toString() : // fd 0 is stdin
        fs.readFileSync(rightPath, 'utf-8');
      rightPath = rightPath === '-' ? '<stdin>' : rightPath;
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

// Modify createWindow function
function createWindow() {
  // Get stored bounds or use defaults
  const defaultBounds = {
    width: 1800,
    height: 800
  };
  
  const bounds = store.get('windowBounds', defaultBounds);
  
  // Ensure minimum size
  const width = Math.max(bounds.width, 800);
  const height = Math.max(bounds.height, 600);
  
  mainWindow = new BrowserWindow({
    ...bounds,
    width,
    height,
    webPreferences: { 
      worldSafeExecuteJavaScript: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('public/index.html');
  mainWindow.on('close', handleWindowClose);
  
  // Save window size and position when it's resized or moved
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });
  
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });
}

// Modify the web server function
function startWebServer() {
  server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE'); // Added DELETE
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Add health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Handle SSE endpoint
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      sseClients.add(res);
      console.log('New SSE client connected, total:', sseClients.size);
      
      // Send all stored diffs to new client
      for (const [id, diff] of diffHistory.entries()) {
        res.write(`data: ${JSON.stringify({...diff, id})}\n\n`);
      }
      
      req.on('close', () => {
        sseClients.delete(res);
        console.log('SSE client disconnected, remaining:', sseClients.size);
      });
      
      return;
    }

    // Simplified save endpoint - only needs content
    if (req.method === 'POST' && req.url === '/save') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { content, path } = JSON.parse(body);
          console.log('Save path:', path)
          
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
    
    // Modify POST /diff to store history
    if (req.method === 'POST' && req.url === '/diff') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const pwd = data.pwd || process.cwd();
          
          // Only resolve paths if both pwd and path exist
          if (data.leftPath) {
            const resolvedLeftPath = resolveFilePath(data.leftPath, pwd);
            data.leftPath = resolvedLeftPath;
            if (!data.leftContent) {
              data.leftContent = readFileContent(data.leftPath);
            }
            // Setup watcher for left file
            setupFileWatcher(resolvedLeftPath);
          }
          
          if (data.rightPath) {
            const resolvedRightPath = resolveFilePath(data.rightPath, pwd);
            data.rightPath = resolvedRightPath;
            if (!data.rightContent) {
              data.rightContent = readFileContent(data.rightPath);
            }
            // Setup watcher for right file
            setupFileWatcher(resolvedRightPath);
          }

          const id = Date.now().toString();
          diffHistory.set(id, data);
          
          // Notify all web clients with ID
          sseClients.forEach(client => {
            client.write(`data: ${JSON.stringify({...data, id})}\n\n`);
          });
          
          // Focus window if it exists
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            // On macOS, bounce the dock icon
            if (process.platform === 'darwin') {
              app.dock.bounce('critical');
            }
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', id }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // Add endpoint to remove diff
    if (req.method === 'DELETE' && req.url.startsWith('/diff/')) {
      const id = req.url.split('/')[2];
      if (diffHistory.has(id)) {
        diffHistory.delete(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Diff not found' }));
      }
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE', // Added DELETE
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

// Add function to setup file watcher
function setupFileWatcher(filePath) {
  if (!filePath || fileWatchers.has(filePath)) return;

  try {
    const watcher = fs.watch(filePath, (eventType, filename) => {
      if (eventType === 'change') {
        const content = readFileContent(filePath);
        if (content !== null) {
          // Notify all connected clients about the file change
          sseClients.forEach(client => {
            client.write(`data: ${JSON.stringify({
              type: 'fileChange',
              path: filePath,
              content
            })}\n\n`);
          });
        }
      }
    });

    fileWatchers.set(filePath, watcher);
    console.log(`Watching file: ${filePath}`);
  } catch (err) {
    console.error(`Error setting up watcher for ${filePath}:`, err);
  }
}

// Modify the existing app startup to always run web server
const noServer = process.argv.includes('--no-server');
const webMode = process.argv.includes('--web');

app.whenReady().then(async () => {
  // Only start web server if not disabled
  if (!noServer) {
    startWebServer();
  }
  
  // Parse input files before loading the window
  try {
    diffContents = parseProcessInput();
  } catch (err) {
    console.error('Error reading input files:', err);
  }
  // Only create window if not in web-only mode
  if (!webMode) {
    createWindow();
  }
});

// Add cleanup
app.on('window-all-closed', () => {
  // Close all file watchers
  for (const [path, watcher] of fileWatchers) {
    watcher.close();
  }
  fileWatchers.clear();
  
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
        buttons: ['Save', 'Close Without Saving', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
        title: 'Save Changes',
        message: 'Do you want to save the changes?',
        normalizeAccessKeys: true,
        buttonStyles: [
          { color: '#1e8e3e', primary: true }, // Green color for Save
          {}, // Default for Close Without Saving
          {}  // Default for Cancel
        ]
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
      } else if (response === 1) { // Close Without Saving
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

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Add IPC handler for window focus
ipcMain.handle('focus-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    // On macOS, bounce the dock icon
    if (process.platform === 'darwin') {
      app.dock.bounce('critical');
    }
  }
});
