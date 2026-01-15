/**
 * Right at Home BnB - Electron Preload Script
 * Secure bridge between renderer and main process
 * @author ECHO OMEGA PRIME
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Storage
  getStore: (key) => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),

  // Notifications
  showNotification: (title, body, options) =>
    ipcRenderer.invoke('show-notification', title, body, options),

  // Tray
  updateTrayStats: (stats) => ipcRenderer.invoke('update-tray-stats', stats),

  // Navigation
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, route) => callback(route));
  },

  // Deep links
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (event, url) => callback(url));
  },

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Platform
  platform: process.platform,
});

// Notify renderer when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  console.log('Right at Home BnB Desktop - Ready');
});
