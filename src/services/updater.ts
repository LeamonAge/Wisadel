/**
 * Wisadel 自动更新服务
 * 基于 electron-updater + GitHub Releases
 * 打包方式：NSIS 安装包，支持增量更新
 */

const { app, dialog, BrowserWindow } = require('@electron/remote');
const { autoUpdater } = require('electron-updater');

// ===== GitHub Releases 配置 =====
const GITHUB_OWNER = 'LeamonAge';
const GITHUB_REPO = 'Wisadel';
const GITHUB_FEED_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

// ===== 更新日志回调 =====
export type UpdateStatusCallback = (status: UpdateStatus) => void;

export interface UpdateStatus {
  type: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  message?: string;
  progress?: number; // 0-100
  version?: string;
}

let statusCallback: UpdateStatusCallback | null = null;

// ===== 初始化 autoUpdater =====
export function initAutoUpdater(callback?: UpdateStatusCallback) {
  if (callback) statusCallback = callback;

  // 配置 GitHub 发布源
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  });

  // 是否允许预发布版本
  autoUpdater.allowPrerelease = false;
  // 自动下载更新包
  autoUpdater.autoDownload = true;

  // ---- 事件绑定 ----
  autoUpdater.on('checking-for-update', () => {
    emitStatus({ type: 'checking', message: '正在检查更新…' });
  });

  autoUpdater.on('update-available', (info: any) => {
    emitStatus({
      type: 'available',
      message: `发现新版本 v${info.version}`,
      version: info.version,
    });
  });

  autoUpdater.on('download-progress', (progressObj: any) => {
    const percent = Math.round(progressObj.percent || 0);
    emitStatus({
      type: 'downloading',
      message: `正在下载更新… ${percent}%`,
      progress: percent,
    });
  });

  autoUpdater.on('update-downloaded', async (info: any) => {
    emitStatus({
      type: 'downloaded',
      message: `更新已就绪 (v${info.version})`,
      version: info.version,
    });

    // 弹窗询问用户是否立即重启安装
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        title: '更新就绪',
        message: `Wisadel v${info.version} 已下载完成`,
        detail: '是否立即重启以完成安装？',
        buttons: ['立即重启', '稍后提醒'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    }
  });

  autoUpdater.on('error', (err: Error) => {
    emitStatus({
      type: 'error',
      message: `更新检查失败：${err.message}`,
    });
  });

  return autoUpdater;
}

// ===== 手动检查更新 =====
export function checkForUpdate(): void {
  if (!autoUpdater) {
    console.warn('[updater] autoUpdater 未初始化');
    return;
  }
  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error('[updater] 检查更新出错：', err.message);
  });
}

// ===== 获取当前版本 =====
export function getCurrentVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '0.0.0';
  }
}

// ===== 内部辅助 =====
function emitStatus(status: UpdateStatus) {
  statusCallback?.(status);
}
