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
  workspaceContext: (workspacePath: string) => ipcRenderer.invoke('wisadel:workspace-context', workspacePath) as Promise<{ root: string; tree: Array<{ path: string; kind: 'file' | 'directory' }>; project: { languages: string[]; suggestedCommands: string[] }; git: { branch: string; status: string } }>,
  agentReadFile: (workspacePath: string, relativePath: string) => ipcRenderer.invoke('wisadel:agent-read-file', workspacePath, relativePath) as Promise<string>,
  agentListFiles: (workspacePath: string, relativePath: string, depth: number) => ipcRenderer.invoke('wisadel:agent-list-files', workspacePath, relativePath, depth) as Promise<string>,
  agentSearchFiles: (workspacePath: string, query: string, relativePath: string) => ipcRenderer.invoke('wisadel:agent-search-files', workspacePath, query, relativePath) as Promise<string>,
  agentWriteFile: (workspacePath: string, relativePath: string, content: string) => ipcRenderer.invoke('wisadel:agent-write-file', workspacePath, relativePath, content) as Promise<{ path: string; bytes: number }>,
  agentRunCommand: (workspacePath: string, program: string, args: string[]) => ipcRenderer.invoke('wisadel:agent-run-command', workspacePath, program, args) as Promise<{ code: number; output: string }>,
  setTheme: (theme: 'dark' | 'light', chromeColor?: string) => ipcRenderer.invoke('wisadel:set-theme', theme, chromeColor),
  setProviderSecret: (providerId: string, secret: string) => ipcRenderer.invoke('wisadel:set-provider-secret', providerId, secret) as Promise<void>
});
