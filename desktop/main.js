const { app, BrowserWindow, ipcMain, Notification, Menu, Tray } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverInstance = null;

// Start embedded backend server
function ensureBackendRunning(callback) {
  // Check if port 4000 is already running
  const req = http.get('http://localhost:4000/api/health', (res) => {
    if (res.statusCode === 200) {
      console.log('[Desktop] Backend is already active on http://localhost:4000');
      callback();
    } else {
      startInternalServer(callback);
    }
  });

  req.on('error', () => {
    startInternalServer(callback);
  });
}

function startInternalServer(callback) {
  try {
    console.log('[Desktop] Starting internal backend server...');
    const { server } = require('../server/server.js');
    serverInstance = server;
    setTimeout(callback, 800);
  } catch (err) {
    console.error('[Desktop] Failed to start internal server:', err);
    callback();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'Chapter One Cafe — Kitchen & Admin Console',
    backgroundColor: '#0e0e13',
    icon: path.join(__dirname, '..', 'client', 'public', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow local audio and ws seamlessly
    }
  });

  // Load Kitchen PC Receiver by default (with admin console tab accessible inside)
  mainWindow.loadURL('http://localhost:4000/kitchen');

  // Flash taskbar on focus loss if an alert happens
  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
  });

  // Custom Application Menu
  const menuTemplate = [
    {
      label: 'Chapter One Cafe',
      submenu: [
        {
          label: 'Live Kitchen Display (KDS)',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.loadURL('http://localhost:4000/kitchen')
        },
        {
          label: 'Admin Console (Management)',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.loadURL('http://localhost:4000/admin')
        },
        { type: 'separator' },
        {
          label: 'Always On Top (Counter Mode)',
          type: 'checkbox',
          checked: false,
          click: (item) => mainWindow.setAlwaysOnTop(item.checked)
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Native Windows Notifications
ipcMain.on('notify-new-order', (event, order) => {
  if (mainWindow) {
    mainWindow.flashFrame(true);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }

  if (Notification.isSupported()) {
    const notif = new Notification({
      title: `🔔 NEW ORDER #${order.order_number} — ${order.table_number}`,
      body: `Customer: ${order.customer_name} | Total: ₹${order.total}\nClick to view and accept order.`,
      silent: false
    });

    notif.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    notif.show();
  }
});

ipcMain.on('notify-assistance', (event, req) => {
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }

  if (Notification.isSupported()) {
    const notif = new Notification({
      title: `🛎️ CUSTOMER CALL: ${req.table_number}`,
      body: `Customer is requesting: ${req.request_type}`,
      silent: false
    });

    notif.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    notif.show();
  }
});

ipcMain.on('flash-window', () => {
  if (mainWindow) {
    mainWindow.flashFrame(true);
  }
});

ipcMain.handle('toggle-always-on-top', () => {
  if (!mainWindow) return false;
  const isTop = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!isTop);
  return !isTop;
});

ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const isFull = mainWindow.isFullScreen();
  mainWindow.setFullScreen(!isFull);
  return !isFull;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// App lifecycle
app.whenReady().then(() => {
  ensureBackendRunning(() => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
