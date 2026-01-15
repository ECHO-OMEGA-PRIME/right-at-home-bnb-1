/**
 * Right at Home BnB - Electron Main Process
 * Desktop app with system tray for Steven's property management
 * @author ECHO OMEGA PRIME
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize persistent storage
const store = new Store({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    minimizeToTray: true,
    startMinimized: false,
    notifications: true,
    theme: 'light',
    lastSync: null,
  }
});

// Global references
let mainWindow = null;
let tray = null;
let isQuitting = false;

// Brand colors
const COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
};

/**
 * Create the main application window
 */
function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 1024,
    minHeight: 700,
    title: 'Right at Home BnB',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: COLORS.cream,
    show: false, // Show after ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    // Frame settings for custom titlebar (optional)
    // frame: false,
    // titleBarStyle: 'hiddenInset',
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      mainWindow.show();
    }
  });

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create system tray with menu
 */
function createTray() {
  // Create tray icon (would be actual icon file)
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');

  // Fallback: Create a simple icon if file doesn't exist
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      throw new Error('Icon not found');
    }
  } catch {
    // Create a simple colored icon as fallback
    trayIcon = nativeImage.createEmpty();
  }

  // Resize for proper display
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Right at Home BnB');

  updateTrayMenu();

  // Click behavior
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        if (process.platform === 'darwin') {
          app.dock.show();
        }
      }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      if (process.platform === 'darwin') {
        app.dock.show();
      }
    }
  });
}

/**
 * Update tray menu with current status
 */
function updateTrayMenu(stats = null) {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Right at Home BnB',
      enabled: false,
      icon: path.join(__dirname, 'assets', 'icon-small.png'),
    },
    { type: 'separator' },
    {
      label: stats ? `${stats.todayJobs} Jobs Today` : 'Loading...',
      enabled: false,
    },
    {
      label: stats ? `${stats.checkInsToday} Check-ins` : '',
      enabled: false,
    },
    {
      label: stats ? `${stats.pendingCleanings} Pending Cleanings` : '',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        mainWindow?.show();
        if (process.platform === 'darwin') {
          app.dock.show();
        }
      },
    },
    {
      label: 'Quick Actions',
      submenu: [
        {
          label: 'View Properties',
          click: () => navigateTo('/properties'),
        },
        {
          label: 'Today\'s Schedule',
          click: () => navigateTo('/schedule'),
        },
        {
          label: 'Messages',
          click: () => navigateTo('/messages'),
        },
        {
          label: 'Finance',
          click: () => navigateTo('/finance'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => navigateTo('/settings'),
    },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Navigate to a route in the app
 */
function navigateTo(route) {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.webContents.send('navigate', route);
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  }
}

/**
 * Show desktop notification
 */
function showNotification(title, body, options = {}) {
  if (!store.get('notifications')) return;

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: options.silent || false,
    urgency: options.urgency || 'normal',
  });

  notification.on('click', () => {
    mainWindow?.show();
    if (options.route) {
      navigateTo(options.route);
    }
  });

  notification.show();
}

/**
 * Check for updates (placeholder)
 */
function checkForUpdates() {
  // Would integrate with electron-updater
  showNotification(
    'Up to Date',
    'You have the latest version of Right at Home BnB.'
  );
}

// IPC Handlers
ipcMain.handle('get-store', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('show-notification', (event, title, body, options) => {
  showNotification(title, body, options);
  return true;
});

ipcMain.handle('update-tray-stats', (event, stats) => {
  updateTrayMenu(stats);
  return true;
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
  };
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  // macOS dock behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Handle deep links (for OAuth, etc.)
app.setAsDefaultProtocolClient('rightathome');

app.on('open-url', (event, url) => {
  event.preventDefault();
  // Handle deep link
  console.log('Deep link:', url);
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
