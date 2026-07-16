import { app, BrowserWindow, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';

const configureAutoUpdate = () => {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info) => {
    const choice = await dialog.showMessageBox({
      type: 'info',
      buttons: ['立即下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
      title: '发现新版本',
      message: `Wisadel ${info.version} 已可用`,
      detail: '下载完成后，应用会提示你重启安装。'
    });
    if (choice.response === 0) void autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-downloaded', async () => {
    const choice = await dialog.showMessageBox({
      type: 'info',
      buttons: ['重启并安装', '下次启动时安装'],
      defaultId: 0,
      cancelId: 1,
      title: '更新已下载',
      message: 'Wisadel 更新已准备就绪。'
    });
    if (choice.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', (error) => console.warn('Auto-update failed:', error.message));
  void autoUpdater.checkForUpdates();
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#120b0b',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#120b0b', symbolColor: '#d7cece', height: 38 },
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!app.isPackaged) void window.loadURL('http://localhost:5173');
  else void window.loadFile(path.join(__dirname, '../dist/index.html'));
};

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdate();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
