import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('wisadelUpdater', {
  download: () => ipcRenderer.invoke('wisadel:update:download'),
  install: () => ipcRenderer.invoke('wisadel:update:install'),
  onEvent: (callback: (event: { type: string; version?: string; notes?: string; percent?: number; message?: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: { type: string; version?: string; notes?: string; percent?: number; message?: string }) => callback(event);
    ipcRenderer.on('wisadel:update', listener);
    return () => ipcRenderer.removeListener('wisadel:update', listener);
  }
});

contextBridge.exposeInMainWorld('wisadelDesktop', {
  openImageStudio: () => ipcRenderer.invoke('wisadel:open-image-studio'),
  captureScreen: () => ipcRenderer.invoke('wisadel:capture-screen') as Promise<string>
});
