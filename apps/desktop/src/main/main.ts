/**
 * Right at Home BnB - Electron Main Process
 * Desktop Property Management System
 * @author Steven Palma
 */

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  Notification,
  shell,
  dialog,
  globalShortcut,
  nativeTheme,
  screen,
  clipboard,
  MenuItemConstructorOptions,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';

// Type definitions
interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface StoreSchema {
  windowBounds: WindowBounds;
  minimizeToTray: boolean;
  startMinimized: boolean;
  startWithSystem: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  lastSync: string | null;
  apiUrl: string;
  autoUpdate: boolean;
  offlineMode: boolean;
  backupPath: string;
  recentProperties: string[];
}

interface TrayStats {
  todayJobs: number;
  checkInsToday: number;
  checkOutsToday: number;
  pendingCleanings: number;
  revenue: number;
}

// Initialize persistent storage
const store = new Store<StoreSchema>({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    minimizeToTray: true,
    startMinimized: false,
    startWithSystem: false,
    notifications: true,
    theme: 'light',
    lastSync: null,
    apiUrl: 'https://api.rah-midland.com',
    autoUpdate: true,
    offlineMode: false,
    backupPath: '',
    recentProperties: [],
  },
});

// Brand colors
const COLORS = {
  maroon: '#500000',
  maroonDark: '#3D0000',
  maroonLight: '#722F37',
  cream: '#F5F5F0',
  white: '#FFFFFF',
  charcoal: '#2D2D2D',
};

// Global references
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let currentStats: TrayStats | null = null;

// Paths
const isDev = process.env.NODE_ENV === 'development';
const assetsPath = isDev
  ? path.join(__dirname, '../../assets')
  : path.join(process.resourcesPath, 'assets');

/**
 * Get the icon path for the current platform
 */
function getIconPath(name: string): string {
  const ext = process.platform === 'win32' ? 'ico' : 'png';
  return path.join(assetsPath, 'icons', `${name}.${ext}`);
}

/**
 * Create a native image for tray
 */
function createTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(assetsPath, 'icons', 'tray-icon.png');

  try {
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        return icon.resize({ width: 16, height: 16 });
      }
    }
  } catch (error) {
    console.error('Failed to load tray icon:', error);
  }

  // Create fallback icon - maroon colored square
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const r = 80, g = 0, b = 0, a = 255; // Maroon color

  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = r;
    canvas[i * 4 + 1] = g;
    canvas[i * 4 + 2] = b;
    canvas[i * 4 + 3] = a;
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

/**
 * Create the main application window
 */
function createWindow(): void {
  const bounds = store.get('windowBounds');
  const { workArea } = screen.getPrimaryDisplay();

  // Ensure window is within screen bounds
  const windowConfig = {
    width: Math.min(bounds.width, workArea.width),
    height: Math.min(bounds.height, workArea.height),
    x: bounds.x ?? Math.floor((workArea.width - bounds.width) / 2),
    y: bounds.y ?? Math.floor((workArea.height - bounds.height) / 2),
  };

  mainWindow = new BrowserWindow({
    ...windowConfig,
    minWidth: 1024,
    minHeight: 700,
    title: 'Right at Home BnB',
    icon: getIconPath('icon'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? COLORS.charcoal : COLORS.cream,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 15 },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Window events
  mainWindow.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow?.hide();
      if (process.platform === 'darwin') {
        app.dock?.hide();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * Save window bounds to store
 */
function saveBounds(): void {
  if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

/**
 * Create system tray
 */
function createTray(): void {
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  tray.setToolTip('Right at Home BnB');

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        showMainWindow();
      }
    }
  });

  tray.on('double-click', () => {
    showMainWindow();
  });
}

/**
 * Show main window
 */
function showMainWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'darwin') {
      app.dock?.show();
    }
  }
}

/**
 * Update tray menu with current stats
 */
function updateTrayMenu(stats?: TrayStats): void {
  if (!tray) return;

  if (stats) {
    currentStats = stats;
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Right at Home BnB',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: currentStats ? `${currentStats.todayJobs} Jobs Today` : 'Loading...',
      enabled: false,
    },
    {
      label: currentStats ? `${currentStats.checkInsToday} Check-ins` : '',
      enabled: false,
      visible: !!currentStats,
    },
    {
      label: currentStats ? `${currentStats.checkOutsToday} Check-outs` : '',
      enabled: false,
      visible: !!currentStats,
    },
    {
      label: currentStats ? `${currentStats.pendingCleanings} Pending Cleanings` : '',
      enabled: false,
      visible: !!currentStats,
    },
    {
      label: currentStats ? `$${currentStats.revenue.toLocaleString()} Revenue` : '',
      enabled: false,
      visible: !!currentStats,
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      accelerator: 'CmdOrCtrl+Shift+D',
      click: () => {
        showMainWindow();
        navigateTo('/');
      },
    },
    {
      label: 'Quick Actions',
      submenu: [
        {
          label: 'View Properties',
          accelerator: 'CmdOrCtrl+P',
          click: () => navigateTo('/properties'),
        },
        {
          label: 'Today\'s Schedule',
          accelerator: 'CmdOrCtrl+T',
          click: () => navigateTo('/schedule'),
        },
        {
          label: 'Cleaning Calendar',
          accelerator: 'CmdOrCtrl+C',
          click: () => navigateTo('/cleaning'),
        },
        {
          label: 'Guest CRM',
          accelerator: 'CmdOrCtrl+G',
          click: () => navigateTo('/guests'),
        },
        {
          label: 'Financial Reports',
          accelerator: 'CmdOrCtrl+F',
          click: () => navigateTo('/finance'),
        },
        {
          label: 'Smart Locks',
          accelerator: 'CmdOrCtrl+L',
          click: () => navigateTo('/locks'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Settings',
      accelerator: 'CmdOrCtrl+,',
      click: () => navigateTo('/settings'),
    },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(true),
    },
    { type: 'separator' },
    {
      label: 'Quit Right at Home BnB',
      accelerator: 'CmdOrCtrl+Q',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];

  const contextMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(contextMenu);
}

/**
 * Create application menu
 */
function createAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => navigateTo('/settings'),
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Booking',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('action', 'new-booking'),
        },
        {
          label: 'Export Data...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('action', 'export-data'),
        },
        {
          label: 'Import Data...',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow?.webContents.send('action', 'import-data'),
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.print(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
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
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => navigateTo('/'),
        },
        {
          label: 'Properties',
          accelerator: 'CmdOrCtrl+2',
          click: () => navigateTo('/properties'),
        },
        {
          label: 'Cleaning Schedule',
          accelerator: 'CmdOrCtrl+3',
          click: () => navigateTo('/cleaning'),
        },
        {
          label: 'Guests',
          accelerator: 'CmdOrCtrl+4',
          click: () => navigateTo('/guests'),
        },
        {
          label: 'Finance',
          accelerator: 'CmdOrCtrl+5',
          click: () => navigateTo('/finance'),
        },
        {
          label: 'Smart Locks',
          accelerator: 'CmdOrCtrl+6',
          click: () => navigateTo('/locks'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://docs.rah-midland.com'),
        },
        {
          label: 'Support',
          click: () => shell.openExternal('mailto:support@rah-midland.com'),
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        {
          label: 'About Right at Home BnB',
          click: () => showAboutDialog(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Navigate to a route in the renderer
 */
function navigateTo(route: string): void {
  showMainWindow();
  mainWindow?.webContents.send('navigate', route);
}

/**
 * Show notification
 */
function showNotification(
  title: string,
  body: string,
  options: { silent?: boolean; route?: string; urgency?: 'normal' | 'critical' | 'low' } = {}
): void {
  if (!store.get('notifications')) return;

  const notification = new Notification({
    title,
    body,
    icon: getIconPath('icon'),
    silent: options.silent ?? false,
    urgency: options.urgency ?? 'normal',
  });

  notification.on('click', () => {
    showMainWindow();
    if (options.route) {
      navigateTo(options.route);
    }
  });

  notification.show();
}

/**
 * Check for updates
 */
function checkForUpdates(manual = false): void {
  if (!store.get('autoUpdate') && !manual) return;

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Update check failed:', error);
    if (manual) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Check',
        message: 'You have the latest version.',
        buttons: ['OK'],
      });
    }
  });
}

/**
 * Show about dialog
 */
function showAboutDialog(): void {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Right at Home BnB',
    message: 'Right at Home BnB',
    detail: `Version: ${app.getVersion()}\nDesktop Property Management System\n\nBy Steven Palma\nMidland, TX\n\nGig 'Em Aggies!`,
    buttons: ['OK'],
  });
}

/**
 * Register global shortcuts
 */
function registerShortcuts(): void {
  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    showMainWindow();
  });
}

/**
 * Setup auto-updater events
 */
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    showNotification(
      'Update Available',
      `Version ${info.version} is available. Downloading...`,
      { route: '/settings' }
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    const response = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Update Ready',
      message: 'Update Downloaded',
      detail: `Version ${info.version} has been downloaded. Restart now to install?`,
      buttons: ['Restart', 'Later'],
      defaultId: 0,
    });

    if (response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });
}

// ============================================================================
// IPC Handlers
// ============================================================================

// Store operations
ipcMain.handle('store:get', (_event, key: keyof StoreSchema) => {
  return store.get(key);
});

ipcMain.handle('store:set', (_event, key: keyof StoreSchema, value: unknown) => {
  store.set(key, value as StoreSchema[typeof key]);
  return true;
});

ipcMain.handle('store:getAll', () => {
  return store.store;
});

// Notifications
ipcMain.handle('notification:show', (_event, title: string, body: string, options?: object) => {
  showNotification(title, body, options);
  return true;
});

// Tray
ipcMain.handle('tray:updateStats', (_event, stats: TrayStats) => {
  updateTrayMenu(stats);
  return true;
});

// Window operations
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// Theme
ipcMain.handle('theme:get', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = theme;
  store.set('theme', theme);
  return true;
});

// External
ipcMain.handle('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle('shell:openPath', (_event, filePath: string) => {
  shell.openPath(filePath);
  return true;
});

// Dialogs
ipcMain.handle('dialog:showSaveDialog', async (_event, options: Electron.SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('dialog:showOpenDialog', async (_event, options: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('dialog:showMessageBox', async (_event, options: Electron.MessageBoxOptions) => {
  const result = await dialog.showMessageBox(mainWindow!, options);
  return result;
});

// File operations
ipcMain.handle('file:write', async (_event, filePath: string, data: string) => {
  try {
    await fs.promises.writeFile(filePath, data, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:read', async (_event, filePath: string) => {
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Clipboard
ipcMain.handle('clipboard:write', (_event, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('clipboard:read', () => {
  return clipboard.readText();
});

// Print
ipcMain.handle('print:page', () => {
  mainWindow?.webContents.print();
});

ipcMain.handle('print:toPDF', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (!result.canceled && result.filePath) {
    const data = await mainWindow!.webContents.printToPDF({});
    await fs.promises.writeFile(result.filePath, data);
    return { success: true, path: result.filePath };
  }

  return { success: false };
});

// App info
ipcMain.handle('app:getInfo', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  };
});

ipcMain.handle('app:checkForUpdates', () => {
  checkForUpdates(true);
});

// ============================================================================
// Database Operations (Prisma via IPC)
// ============================================================================

// Import Prisma client - will be initialized on first use
let prisma: ReturnType<typeof import('@prisma/client').PrismaClient> | null = null;

async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || `file:${path.join(app.getPath('userData'), 'rightathome.db')}`,
        },
      },
    });
  }
  return prisma;
}

// Generic database query handler
ipcMain.handle('db:query', async (_event, model: string, args: unknown) => {
  try {
    const client = await getPrisma();
    const [modelName, operation] = model.split('.');

    // Map model names to Prisma model accessors
    const modelMap: Record<string, keyof typeof client> = {
      properties: 'property',
      propertyPhotos: 'propertyPhoto',
      bookings: 'booking',
      guests: 'guest',
      cleaningJobs: 'cleaningJob',
      smartLocks: 'smartLock',
      expenses: 'expense',
      messages: 'message',
      users: 'user',
      auditLogs: 'auditLog',
      settings: 'setting',
      conciergeQueries: 'conciergeQuery',
    };

    const prismaModel = modelMap[modelName];
    if (!prismaModel) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // Execute the operation
    const model_ = client[prismaModel] as Record<string, (args: unknown) => Promise<unknown>>;
    const result = await model_[operation](args);

    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
});

// Batch operations for efficiency
ipcMain.handle('db:batch', async (_event, operations: Array<{ model: string; args: unknown }>) => {
  try {
    const client = await getPrisma();
    const results = await client.$transaction(
      operations.map(({ model, args }) => {
        const [modelName, operation] = model.split('.');
        const modelMap: Record<string, string> = {
          properties: 'property',
          propertyPhotos: 'propertyPhoto',
          bookings: 'booking',
          guests: 'guest',
          cleaningJobs: 'cleaningJob',
          smartLocks: 'smartLock',
          expenses: 'expense',
          messages: 'message',
          users: 'user',
          auditLogs: 'auditLog',
          settings: 'setting',
        };
        const prismaModel = modelMap[modelName];
        return (client as Record<string, Record<string, (args: unknown) => unknown>>)[prismaModel][operation](args);
      })
    );
    return results;
  } catch (error) {
    console.error('Database batch error:', error);
    throw error;
  }
});

// Sync data with remote API
ipcMain.handle('db:sync', async (_event, direction: 'push' | 'pull' | 'both') => {
  try {
    const apiUrl = store.get('apiUrl');
    const client = await getPrisma();
    const lastSync = store.get('lastSync');

    if (direction === 'pull' || direction === 'both') {
      // Pull remote changes
      const response = await fetch(`${apiUrl}/sync/pull?since=${lastSync || ''}`);
      if (response.ok) {
        const data = await response.json();
        // Apply changes to local database
        for (const { model, operation, data: itemData } of data.changes) {
          const modelMap: Record<string, string> = {
            Property: 'property',
            Booking: 'booking',
            Guest: 'guest',
            CleaningJob: 'cleaningJob',
          };
          const prismaModel = modelMap[model];
          if (prismaModel && operation === 'upsert') {
            await (client as Record<string, Record<string, (args: unknown) => unknown>>)[prismaModel].upsert({
              where: { id: itemData.id },
              update: itemData,
              create: itemData,
            });
          }
        }
      }
    }

    if (direction === 'push' || direction === 'both') {
      // Push local changes (simplified - in production would track changes)
      // For now, just update the lastSync timestamp
    }

    store.set('lastSync', new Date().toISOString());
    return { success: true, lastSync: store.get('lastSync') };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: String(error) };
  }
});

// Export database to JSON
ipcMain.handle('db:export', async () => {
  try {
    const client = await getPrisma();
    const data = {
      properties: await client.property.findMany({ include: { photos: true } }),
      bookings: await client.booking.findMany(),
      guests: await client.guest.findMany(),
      cleaningJobs: await client.cleaningJob.findMany(),
      expenses: await client.expense.findMany(),
      smartLocks: await client.smartLock.findMany(),
      exportedAt: new Date().toISOString(),
    };

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Database',
      defaultPath: `rightathome-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!result.canceled && result.filePath) {
      await fs.promises.writeFile(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    }

    return { success: false, canceled: true };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: String(error) };
  }
});

// Import database from JSON
ipcMain.handle('db:import', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Database',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const fileContent = await fs.promises.readFile(result.filePaths[0], 'utf-8');
    const data = JSON.parse(fileContent);
    const client = await getPrisma();

    // Import in transaction
    await client.$transaction(async (tx) => {
      // Import properties and photos
      for (const property of data.properties || []) {
        const { photos, ...propertyData } = property;
        await tx.property.upsert({
          where: { id: propertyData.id },
          update: propertyData,
          create: propertyData,
        });
        for (const photo of photos || []) {
          await tx.propertyPhoto.upsert({
            where: { id: photo.id },
            update: photo,
            create: photo,
          });
        }
      }

      // Import guests
      for (const guest of data.guests || []) {
        await tx.guest.upsert({
          where: { id: guest.id },
          update: guest,
          create: guest,
        });
      }

      // Import bookings
      for (const booking of data.bookings || []) {
        await tx.booking.upsert({
          where: { id: booking.id },
          update: booking,
          create: booking,
        });
      }

      // Import cleaning jobs
      for (const job of data.cleaningJobs || []) {
        await tx.cleaningJob.upsert({
          where: { id: job.id },
          update: job,
          create: job,
        });
      }

      // Import expenses
      for (const expense of data.expenses || []) {
        await tx.expense.upsert({
          where: { id: expense.id },
          update: expense,
          create: expense,
        });
      }
    });

    return { success: true, imported: result.filePaths[0] };
  } catch (error) {
    console.error('Import error:', error);
    return { success: false, error: String(error) };
  }
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Apply saved theme
  const savedTheme = store.get('theme');
  nativeTheme.themeSource = savedTheme;

  createWindow();
  createTray();
  createAppMenu();
  registerShortcuts();
  setupAutoUpdater();

  // Check for updates on startup
  if (store.get('autoUpdate')) {
    setTimeout(() => checkForUpdates(), 3000);
  }

  // macOS dock behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Deep links
app.setAsDefaultProtocolClient('rightathome');

app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('Deep link:', url);
  mainWindow?.webContents.send('deep-link', url);
});

// Single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      showMainWindow();
    }
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred:\n${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
