const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  notifyNewOrder: (order) => ipcRenderer.send('notify-new-order', order),
  notifyAssistance: (req) => ipcRenderer.send('notify-assistance', req),
  flashWindow: () => ipcRenderer.send('flash-window'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
