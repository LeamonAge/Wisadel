import { FileInfo } from '../types';

// ===== 文件系统服务（桌面版暂存实现） =====
// 桌面版使用标准 node:fs 或 Electron dialog 来处理文件系统

export async function listDirectory(dirPath: string): Promise<FileInfo[]> {
  // 桌面版暂不支持本地文件系统浏览
  return [];
}

export async function readFile(filePath: string): Promise<string> {
  throw new Error('文件系统服务在桌面版暂不可用');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  throw new Error('文件系统服务在桌面版暂不可用');
}

export async function deleteFile(filePath: string): Promise<void> {
  throw new Error('文件系统服务在桌面版暂不可用');
}

export async function fileExists(filePath: string): Promise<boolean> {
  return false;
}

export function getDocumentDirectory(): string {
  return '/';
}
