/**
 * Right at Home BnB - Test Setup
 * Global test configuration and mocks
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock window.electronAPI for all tests
const mockStore = new Map<string, unknown>();

const mockElectronAPI = {
  store: {
    get: vi.fn((key: string) => Promise.resolve(mockStore.get(key) || null)),
    set: vi.fn((key: string, value: unknown) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn((key: string) => {
      mockStore.delete(key);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      mockStore.clear();
      return Promise.resolve();
    }),
  },
  notification: {
    show: vi.fn((title: string, body: string, options?: unknown) => Promise.resolve()),
    requestPermission: vi.fn(() => Promise.resolve('granted' as NotificationPermission)),
  },
  tray: {
    setTitle: vi.fn(),
    setToolTip: vi.fn(),
    setBadge: vi.fn(),
  },
  window: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(() => Promise.resolve(false)),
  },
  theme: {
    get: vi.fn(() => Promise.resolve('system')),
    set: vi.fn(),
  },
  shell: {
    openExternal: vi.fn((url: string) => Promise.resolve()),
    openPath: vi.fn((path: string) => Promise.resolve('')),
  },
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: undefined })),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0, checkboxChecked: false })),
  },
  file: {
    read: vi.fn((path: string) => Promise.resolve({ success: true, data: '' })),
    write: vi.fn((path: string, data: string) => Promise.resolve({ success: true })),
    exists: vi.fn((path: string) => Promise.resolve(true)),
  },
  clipboard: {
    writeText: vi.fn((text: string) => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve('')),
  },
  print: {
    toPDF: vi.fn(() => Promise.resolve({ success: true, data: new Uint8Array() })),
  },
  app: {
    getVersion: vi.fn(() => Promise.resolve('1.0.0')),
    getInfo: vi.fn(() =>
      Promise.resolve({
        version: '1.0.0',
        platform: 'win32',
        arch: 'x64',
        isPackaged: false,
      })
    ),
    quit: vi.fn(),
    relaunch: vi.fn(),
  },
  updates: {
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve()),
    installUpdate: vi.fn(() => Promise.resolve()),
  },
};

// Make it available globally
vi.stubGlobal('electronAPI', mockElectronAPI);

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock crypto.randomUUID if not available
if (!crypto.randomUUID) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  });
}

// Mock crypto.subtle for encryption tests
const mockCryptoSubtle = {
  importKey: vi.fn(() => Promise.resolve({})),
  deriveKey: vi.fn(() => Promise.resolve({})),
  encrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
  decrypt: vi.fn(() => Promise.resolve(new TextEncoder().encode('{}'))),
  digest: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
};

if (!crypto.subtle) {
  Object.defineProperty(crypto, 'subtle', {
    value: mockCryptoSubtle,
    writable: true,
  });
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockStore.clear();
});

// Export mocks for use in tests
export { mockElectronAPI, mockStore };
