const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress));
  },
  removeUpdateProgressListener: () => {
    ipcRenderer.removeAllListeners('update-download-progress');
  },
});
