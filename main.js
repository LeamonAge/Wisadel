const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
autoUpdater.autoDownload = false;

let mainWindow = null;
let automaticUpdatePromptShown = false;

function downloadAndPromptToInstall() {
  const onError = (error) => {
    dialog.showErrorBox('更新下载失败', error?.message || '请检查网络后重试。');
  };

  autoUpdater.once('error', onError);
  autoUpdater.once('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已准备就绪',
      message: '新版本已下载完成，是否现在重启并安装？',
      buttons: ['立即安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.downloadUpdate().catch(onError);
}

function checkForUpdatesOnStartup() {
  autoUpdater.once('update-available', async (info) => {
    if (automaticUpdatePromptShown || !mainWindow) return;
    automaticUpdatePromptShown = true;

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `Wisadel ${info.version} 已发布`,
      detail: '是否立即下载更新？',
      buttons: ['立即下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) downloadAndPromptToInstall();
  });

  autoUpdater.checkForUpdates().catch(() => {
    // 启动检查失败时静默处理，用户仍可在设置中手动重试。
  });
}

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
    setTimeout(checkForUpdatesOnStartup, 1500);
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
