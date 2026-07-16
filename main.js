const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ===== 自动更新配置 =====
const GITHUB_OWNER = 'LeamonAge';
const GITHUB_REPO = 'Wisadel';

autoUpdater.setFeedURL({
  provider: 'github',
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
});
autoUpdater.allowPrerelease = false;
autoUpdater.autoDownload = true;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Wisadel',
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 localhost，生产模式加载打包后的文件
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:19006');
    // 可选：打开 DevTools
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== IPC 处理 =====
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result ? {
      version: result.updateInfo.version,
      releaseNotes: result.updateInfo.releaseNotes || '',
      size: result.updateInfo.files?.[0]?.size || 0,
    } : null;
  } catch (err) {
    throw err;
  }
});

ipcMain.handle('download-update', async () => {
  return new Promise((resolve, reject) => {
    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update-download-progress', progress.percent / 100);
    });
    autoUpdater.on('update-downloaded', () => {
      resolve(true);
    });
    autoUpdater.on('error', (err) => {
      reject(err);
    });
    autoUpdater.downloadUpdate().catch(reject);
  });
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ===== App 生命周期 =====
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
