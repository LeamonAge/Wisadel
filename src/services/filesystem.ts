import { File, Directory, Paths } from 'expo-file-system';
import { FileInfo } from '../types';

// ===== 文件系统服务 =====

export async function listDirectory(dirPath: string): Promise<FileInfo[]> {
  const dir = new Directory(dirPath);
  const entries = dir.list();
  const result: FileInfo[] = [];
  for (const entry of entries) {
    const isDir = entry instanceof Directory;
    result.push({
      name: entry.name,
      path: entry.uri,
      isDirectory: isDir,
      size: entry instanceof File ? entry.size : 0,
      modified: entry instanceof File ? (entry.lastModified ?? Date.now()) : Date.now(),
    });
  }
  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFile(filePath: string): Promise<string> {
  const file = new File(filePath);
  if (!file.exists) {
    throw new Error('文件不存在');
  }
  return await file.text();
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const file = new File(filePath);
  if (!file.exists) {
    file.create();
  }
  file.write(content);
}

export async function deleteFile(filePath: string): Promise<void> {
  const file = new File(filePath);
  file.delete();
}

export async function fileExists(filePath: string): Promise<boolean> {
  const file = new File(filePath);
  return file.exists;
}

export function getDocumentDirectory(): string {
  return Paths.document.uri;
}
