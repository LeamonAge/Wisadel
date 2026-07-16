import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

const EXTENSION_MIMES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};
const SAFE_FILE_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf', 'application/xml', 'text/xml', 'text/html', 'text/css', 'text/javascript', 'application/javascript', 'application/typescript']);

@Injectable()
export class ImageStorageService {
  async saveFile(buffer: Buffer, mimeType: string, originalName: string) {
    const imageExtension = MIME_EXTENSIONS[mimeType];
    const originalExtension = extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    if (!imageExtension && !SAFE_FILE_TYPES.has(mimeType) && !['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.cs', '.vue', '.svelte', '.yaml', '.yml', '.toml', '.sql'].includes(originalExtension)) {
      throw new BadRequestException('暂不支持该文件类型');
    }
    const extension = imageExtension ?? (originalExtension.slice(1) || 'txt');
    const uploadDir = this.uploadDir();
    await mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(resolve(uploadDir, filename), buffer);
    return { url: `${this.publicBaseUrl()}/uploads/${filename}`, name: basename(originalName).slice(0, 255), mimeType, size: buffer.length };
  }

  async attachmentText(url: string, mimeType: string): Promise<string | null> {
    if (!mimeType.startsWith('text/') && !mimeType.includes('json') && !mimeType.includes('xml') && !mimeType.includes('javascript') && !mimeType.includes('typescript')) return null;
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/uploads/')) return null;
    const filename = basename(parsed.pathname);
    const buffer = await readFile(resolve(this.uploadDir(), filename));
    return buffer.toString('utf8').slice(0, 60_000);
  }
  async save(buffer: Buffer, mimeType: string): Promise<string> {
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) throw new BadRequestException('仅支持 PNG、JPEG 和 WebP 图片');
    const uploadDir = this.uploadDir();
    await mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(resolve(uploadDir, filename), buffer);
    return `${this.publicBaseUrl()}/uploads/${filename}`;
  }

  async saveBase64(raw: string): Promise<string> {
    const match = raw.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
    return this.save(Buffer.from(match?.[2] ?? raw, 'base64'), match?.[1] ?? 'image/png');
  }

  async toVisionSource(url: string): Promise<string> {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/uploads/')) return url;
    const filename = basename(parsed.pathname);
    if (!filename || filename !== parsed.pathname.split('/').at(-1)) throw new BadRequestException('图片地址无效');
    const extension = extname(filename).toLowerCase();
    const mimeType = EXTENSION_MIMES[extension];
    if (!mimeType) throw new BadRequestException('图片格式不受支持');
    const buffer = await readFile(resolve(this.uploadDir(), filename));
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private uploadDir() { return resolve(process.env.UPLOAD_DIR ?? './uploads'); }
  private publicBaseUrl() { return (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''); }
}
