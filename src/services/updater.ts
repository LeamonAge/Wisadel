/**
 * Wisadel 自动更新服务（桌面版渲染进程端）
 * 通过 preload.js 暴露的 IPC 与主进程通信
 */

export interface UpdateInfo {
  version: string;
  releaseNotes: string;
  size: number;
}

export type UpdateStatusCallback = (status: UpdateStatus) => void;

export interface UpdateStatus {
  type: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';
  message?: string;
  progress?: number;
  version?: string;
}

const electronAPI = (window as any).electronAPI;

// ===== 获取当前版本 =====
export function getCurrentVersion(): string {
  return '0.1.10';
}

// ===== 检查更新 =====
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!electronAPI?.checkForUpdate) {
    console.warn('[updater] 不在 Electron 环境中');
    return null;
  }
  try {
    const info = await electronAPI.checkForUpdate();
    return info;
  } catch (err) {
    console.error('[updater] 检查更新失败:', err);
    throw err;
  }
}

// ===== 下载更新 =====
export async function downloadUpdate(
  onProgress?: (progress: number) => void
): Promise<void> {
  if (!electronAPI?.downloadUpdate) {
    throw new Error('不在 Electron 环境中');
  }

  if (onProgress) {
    electronAPI.onUpdateProgress(onProgress);
  }

  try {
    await electronAPI.downloadUpdate();
  } finally {
    if (onProgress) {
      electronAPI.removeUpdateProgressListener();
    }
  }
}

// ===== 安装更新 =====
export async function installUpdate(): Promise<void> {
  if (!electronAPI?.installUpdate) {
    throw new Error('不在 Electron 环境中');
  }
  await electronAPI.installUpdate();
}

// ===== 格式化文件大小 =====
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
