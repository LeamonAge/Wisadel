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
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.invoke('wisadel:window-control', action) as Promise<boolean>,
  openImageStudio: () => ipcRenderer.invoke('wisadel:open-image-studio'),
  captureScreen: () => ipcRenderer.invoke('wisadel:capture-screen') as Promise<string>,
  chooseWorkspace: () => ipcRenderer.invoke('wisadel:choose-workspace') as Promise<string | null>,
  setTheme: (theme: 'dark' | 'light', chromeColor?: string) => ipcRenderer.invoke('wisadel:set-theme', theme, chromeColor),
  setProviderSecret: (providerId: string, secret: string) => ipcRenderer.invoke('wisadel:set-provider-secret', providerId, secret) as Promise<void>
});
