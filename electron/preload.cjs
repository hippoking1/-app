const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  reloadAndClearCache: () => ipcRenderer.invoke('reload-and-clear-cache'),
  focusMainWindow: () => ipcRenderer.invoke('focus-main-window'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});
