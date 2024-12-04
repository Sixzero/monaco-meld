const { Menu, dialog, shell } = require('electron');

function createAppMenu(win, diffHistory, closedDiffs) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Save Current',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            await win.webContents.executeJavaScript('window.saveCurrentFile?.()');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle Side by Side',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            win.webContents.executeJavaScript('window.toggleSideBySide?.()');
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Next Change',
          accelerator: 'Alt+Down',
          click: () => {
            win.webContents.executeJavaScript('window.navigateToNextChange?.()');
          }
        },
        {
          label: 'Previous Change',
          accelerator: 'Alt+Up',
          click: () => {
            win.webContents.executeJavaScript('window.navigateToPreviousChange?.()');
          }
        },
        { type: 'separator' },
        {
          label: 'Accept Current Change',
          accelerator: 'Alt+Right',
          click: () => {
            win.webContents.executeJavaScript('window.acceptCurrentChange?.()');
          }
        }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Show Closed Diffs',
          accelerator: 'CmdOrCtrl+H',
          async click(menuItem, browserWindow) {
            const window = browserWindow || win;
            if (!window) {
              console.error('No window available');
              return;
            }

            const closedDiffsList = [...closedDiffs].map(id => {
              const diff = diffHistory.get(id);
              return {
                id,
                leftPath: diff?.leftPath || 'untitled',
                rightPath: diff?.rightPath || 'untitled',
                closedAt: parseInt(id)
              };
            }).sort((a, b) => b.closedAt - a.closedAt);

            if (closedDiffsList.length === 0) {
              await dialog.showMessageBox(window, {
                type: 'info',
                title: 'Closed Diffs',
                message: 'No closed diffs available',
                buttons: ['OK']
              });
              return;
            }

            const buttons = closedDiffsList.map(diff => {
              const date = new Date(diff.closedAt);
              return `${diff.leftPath} ← ${diff.rightPath} (${date.toLocaleString()})`;
            });
            buttons.push('Cancel');

            const { response } = await dialog.showMessageBox(window, {
              type: 'question',
              title: 'Reopen Diff',
              message: 'Select a diff to reopen:',
              buttons,
              cancelId: buttons.length - 1
            });

            if (response !== buttons.length - 1) {
              const diffToReopen = closedDiffsList[response];
              if (diffToReopen && diffHistory.has(diffToReopen.id)) {
                closedDiffs.delete(diffToReopen.id);
                const diff = diffHistory.get(diffToReopen.id);

                try {
                  const res = await fetch(`http://localhost:${process.env.PORT || 9000}/diff/reopen/${diffToReopen.id}`, {
                    method: 'POST'
                  });
                  if (!res.ok) {
                    throw new Error('Failed to reopen via API');
                  }
                } catch (err) {
                  console.warn('API reopen failed, falling back to direct:', err);
                  window.webContents.send('diff-reopened', {
                    ...diff,
                    id: diffToReopen.id
                  });
                }
              }
            }
          }
        },
        {
          label: 'Clear History',
          click: async () => {
            const { response } = await dialog.showMessageBox(win, {
              type: 'question',
              buttons: ['Clear', 'Cancel'],
              defaultId: 1,
              cancelId: 1,
              title: 'Clear History',
              message: 'Are you sure you want to clear all closed diffs history?'
            });
            if (response === 0) {
              closedDiffs.clear();
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/SixZero/monaco-meld#readme');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/SixZero/monaco-meld/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About MonacoMeld',
          click: async () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About MonacoMeld',
              message: 'MonacoMeld',
              detail: 'A modern diff tool powered by Monaco Editor.\nVersion: ' + 
                     require('../../package.json').version
            });
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: 'MonacoMeld',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createAppMenu };
