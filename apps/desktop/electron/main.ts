import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import { appendFileSync, rmSync } from 'node:fs';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;
let imageStudioWindow: BrowserWindow | null = null;
let lastUpdateEvent: object | null = null;
let tray: Tray | null = null;
let quitting = false;

const showWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const createTray = () => {
  const icon = nativeImage.createFromPath(path.join(process.resourcesPath, 'Wisadel.ico'));
  tray = new Tray(icon);
  tray.setToolTip('Wisadel');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Wisadel', click: showWindow },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
};

const sendUpdate = (payload: object) => {
  lastUpdateEvent = payload;
  try {
    appendFileSync(path.join(app.getPath('userData'), 'updater.log'), `${new Date().toISOString()} ${JSON.stringify(payload)}\n`);
  } catch {
    // Updating must continue even when the diagnostic log cannot be written.
  }
  mainWindow?.webContents.send('wisadel:update', payload);
};

const clearUpdaterCache = () => {
  const cacheDirectory = path.join(process.env.LOCALAPPDATA ?? app.getPath('appData'), `${app.getName()}-updater`);
  rmSync(cacheDirectory, { recursive: true, force: true, maxRetries: 2 });
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
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  if (!app.isPackaged) void mainWindow.loadURL('http://localhost:5173');
  else void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
};

const openImageStudio = () => {
  if (imageStudioWindow && !imageStudioWindow.isDestroyed()) {
    if (imageStudioWindow.isMinimized()) imageStudioWindow.restore();
    imageStudioWindow.focus();
    return;
  }
  imageStudioWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#120b0b',
    title: 'Stable Diffusion AI · Wisadel',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#120b0b', symbolColor: '#d7cece', height: 38 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  imageStudioWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  imageStudioWindow.on('closed', () => { imageStudioWindow = null; });
  if (!app.isPackaged) void imageStudioWindow.loadURL('http://localhost:5173/?workspace=image');
  else void imageStudioWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { workspace: 'image' } });
};

app.whenReady().then(() => {
  ipcMain.handle('wisadel:update:download', async () => {
    try {
      // A failed NSIS download can leave an old installer in this cache and make every retry fail.
      clearUpdaterCache();
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendUpdate({ type: 'error', message });
      throw error;
    }
  });
  ipcMain.handle('wisadel:update:install', async () => {
    try {
      quitting = true;
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      quitting = false;
      const message = error instanceof Error ? error.message : String(error);
      sendUpdate({ type: 'error', message });
      throw error;
    }
  });
  ipcMain.handle('wisadel:open-image-studio', openImageStudio);
  ipcMain.handle('wisadel:capture-screen', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    const source = sources[0];
    if (!source || source.thumbnail.isEmpty()) throw new Error('无法获取当前屏幕截图');
    return source.thumbnail.toDataURL();
  });
  createWindow();
  createTray();
  configureAutoUpdate();
  app.on('activate', showWindow);
});

app.on('window-all-closed', () => {
  // The application remains available from the system tray.
});

app.on('before-quit', () => { quitting = true; });
