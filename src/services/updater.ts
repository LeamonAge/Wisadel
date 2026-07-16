import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Alert } from 'react-native';

// ===== GitHub Releases 更新服务 =====
const GITHUB_REPO = 'sanity-app/sanity';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
  size: number;
}

// 当前版本
export function getCurrentVersion(): string {
  try {
    const Constants = require('expo-constants');
    return Constants.default?.expoConfig?.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// 比较版本号 (semver)
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/[^0-9.]/g, '').split('.').map(Number);
  const pb = b.replace(/[^0-9.]/g, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

// 检查 GitHub Releases 最新版本
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        // 无鉴权公开仓库可用；私仓需 token
      },
    });

    if (!response.ok) {
      // 403 通常是速率限制，静默返回无更新
      if (response.status === 403) return null;
      throw new Error(`GitHub API 错误 (${response.status})`);
    }

    const release = await response.json();
    const tagName = release.tag_name?.replace(/^v/, '') || '0.0.0';

    if (compareVersions(tagName, getCurrentVersion()) <= 0) return null;

    const apkAsset = release.assets?.find(
      (a: any) => a.name?.endsWith('.apk') && a.browser_download_url
    );

    if (!apkAsset) return null;

    return {
      version: tagName,
      downloadUrl: apkAsset.browser_download_url,
      releaseNotes: release.body || '暂无更新说明',
      publishedAt: release.published_at,
      size: apkAsset.size || 0,
    };
  } catch {
    return null;
  }
}

// 下载 APK 到 Documents 目录（而非 cache，避免被系统清理）
export async function downloadUpdate(
  updateInfo: UpdateInfo,
  onProgress?: (progress: number) => void
): Promise<string> {
  const destDir = new Directory(Paths.document.uri);
  const destFile = new File(destDir, `sanity_update_${updateInfo.version}.apk`);

  // 如果已存在则删除
  if (destFile.exists) {
    destFile.delete();
  }

  const task = File.createDownloadTask(updateInfo.downloadUrl, destFile, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) {
        onProgress?.(bytesWritten / totalBytes);
      }
    },
  });

  const result = await task.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('下载失败：未获取到文件');
  }
  return result.uri;
}

// 安装 APK
// Android 上通过 Content Provider + Intent 安装（Android 7+ 需要 FileProvider）
export async function installApk(fileUri: string): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // 方式 1：通过 Android 系统安装器 Intent（支持 FileProvider）
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: fileUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
  } catch {
    // 方式 2：回退到系统分享面板
    try {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.android.package-archive',
        dialogTitle: '安装更新',
      });
    } catch {
      Alert.alert(
        '安装提示',
        `APK 已下载到内部存储。\n请前往文件管理器找到 sanity_update_${getCurrentVersion()}.apk 手动安装。`,
        [{ text: '知道了' }]
      );
    }
  }
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
