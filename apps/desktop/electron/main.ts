import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;
let lastUpdateEvent: object | null = null;

const sendUpdate = (payload: object) => {
  lastUpdateEvent = payload;
  mainWindow?.webContents.send('wisadel:update', payload);
};

const configureAutoUpdate = () => {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => sendUpdate({ type: 'available', version: info.version, notes: info.releaseNotes ?? '' }));
  autoUpdater.on('download-progress', (progress) => sendUpdate({ type: 'progress', percent: progress.percent }));
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ type: 'downloaded', version: info.version }));
  autoUpdater.on('error', (error) => sendUpdate({ type: 'error', message: error.message }));
  void autoUpdater.checkForUpdates();
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#120b0b',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#120b0b', symbolColor: '#d7cece', height: 38 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.once('did-finish-load', () => {
    if (lastUpdateEvent) setTimeout(() => mainWindow?.webContents.send('wisadel:update', lastUpdateEvent!), 500);
  });

  if (!app.isPackaged) void mainWindow.loadURL('http://localhost:5173');
  else void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
};

app.whenReady().then(() => {
  ipcMain.handle('wisadel:update:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('wisadel:update:install', () => autoUpdater.quitAndInstall(false, true));
  createWindow();
  configureAutoUpdate();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
