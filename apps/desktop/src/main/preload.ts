/**
 * Right at Home BnB - Preload Script
 * Secure IPC bridge between main and renderer processes
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Type definitions for exposed API
export interface ElectronAPI {
  // Store operations
  store: {
    get: <T>(key: string) => Promise<T>;
    set: (key: string, value: unknown) => Promise<boolean>;
    getAll: () => Promise<Record<string, unknown>>;
  };

  // Notifications
  notification: {
    show: (title: string, body: string, options?: NotificationOptions) => Promise<boolean>;
  };

  // Tray
  tray: {
    updateStats: (stats: TrayStats) => Promise<boolean>;
  };

  // Window controls
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };

  // Theme
  theme: {
    get: () => Promise<'light' | 'dark'>;
    set: (theme: 'light' | 'dark' | 'system') => Promise<boolean>;
  };

  // Shell operations
  shell: {
    openExternal: (url: string) => Promise<boolean>;
    openPath: (path: string) => Promise<boolean>;
  };

  // Dialogs
  dialog: {
    showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
    showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogResult>;
    showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxResult>;
  };

  // File operations
  file: {
    write: (path: string, data: string) => Promise<FileResult>;
    read: (path: string) => Promise<FileReadResult>;
  };

  // Clipboard
  clipboard: {
    write: (text: string) => Promise<boolean>;
    read: () => Promise<string>;
  };

  // Printing
  print: {
    page: () => Promise<void>;
    toPDF: () => Promise<PrintResult>;
  };

  // App info
  app: {
    getInfo: () => Promise<AppInfo>;
    checkForUpdates: () => Promise<void>;
  };

  // Event listeners
  on: (channel: string, callback: (data: unknown) => void) => () => void;
  once: (channel: string, callback: (data: unknown) => void) => void;
}

interface NotificationOptions {
  silent?: boolean;
  route?: string;
  urgency?: 'normal' | 'critical' | 'low';
}

interface TrayStats {
  todayJobs: number;
  checkInsToday: number;
  checkOutsToday: number;
  pendingCleanings: number;
  revenue: number;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
}

interface MessageBoxResult {
  response: number;
}

interface FileResult {
  success: boolean;
  error?: string;
}

interface FileReadResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface PrintResult {
  success: boolean;
  path?: string;
}

interface AppInfo {
  version: string;
  name: string;
  platform: NodeJS.Platform;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
}

// Allowed channels for IPC communication
const validReceiveChannels = [
  'navigate',
  'action',
  'deep-link',
  'update-available',
  'update-downloaded',
];

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Store operations
  store: {
    get: <T>(key: string): Promise<T> => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke('store:set', key, value),
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),
  },

  // Notifications
  notification: {
    show: (title: string, body: string, options?: NotificationOptions): Promise<boolean> =>
      ipcRenderer.invoke('notification:show', title, body, options),
  },

  // Tray
  tray: {
    updateStats: (stats: TrayStats): Promise<boolean> =>
      ipcRenderer.invoke('tray:updateStats', stats),
  },

  // Window controls
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  },

  // Theme
  theme: {
    get: (): Promise<'light' | 'dark'> => ipcRenderer.invoke('theme:get'),
    set: (theme: 'light' | 'dark' | 'system'): Promise<boolean> =>
      ipcRenderer.invoke('theme:set', theme),
  },

  // Shell operations
  shell: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string): Promise<boolean> =>
      ipcRenderer.invoke('shell:openPath', path),
  },

  // Dialogs
  dialog: {
    showSaveDialog: (options: SaveDialogOptions): Promise<SaveDialogResult> =>
      ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options: OpenDialogOptions): Promise<OpenDialogResult> =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),
    showMessageBox: (options: MessageBoxOptions): Promise<MessageBoxResult> =>
      ipcRenderer.invoke('dialog:showMessageBox', options),
  },

  // File operations
  file: {
    write: (path: string, data: string): Promise<FileResult> =>
      ipcRenderer.invoke('file:write', path, data),
    read: (path: string): Promise<FileReadResult> =>
      ipcRenderer.invoke('file:read', path),
  },

  // Clipboard
  clipboard: {
    write: (text: string): Promise<boolean> => ipcRenderer.invoke('clipboard:write', text),
    read: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  },

  // Printing
  print: {
    page: (): Promise<void> => ipcRenderer.invoke('print:page'),
    toPDF: (): Promise<PrintResult> => ipcRenderer.invoke('print:toPDF'),
  },

  // App info
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
    checkForUpdates: (): Promise<void> => ipcRenderer.invoke('app:checkForUpdates'),
  },

  // Event listeners with cleanup
  on: (channel: string, callback: (data: unknown) => void): (() => void) => {
    if (!validReceiveChannels.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }

    const subscription = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(channel, subscription);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  once: (channel: string, callback: (data: unknown) => void): void => {
    if (!validReceiveChannels.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }

    ipcRenderer.once(channel, (_event, data) => callback(data));
  },
} as ElectronAPI);

// Type declaration for window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
