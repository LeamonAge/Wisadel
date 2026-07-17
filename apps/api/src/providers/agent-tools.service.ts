import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';

type ToolCall = { name: string; arguments: string };

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.xml', '.html', '.css', '.scss',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.svelte', '.py', '.java', '.go', '.rs',
  '.c', '.h', '.cpp', '.hpp', '.cs', '.php', '.rb', '.sh', '.ps1', '.sql', '.prisma', '.graphql'
]);
const BLOCKED_NAMES = /(^|[\\/])(\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials|secrets?)([\\/]|$)/i;
const MAX_FILE_BYTES = 512_000;

@Injectable()
export class AgentToolsService {
  readonly definitions = [
    this.tool('list_files', '列出工作区内的文件和目录。', {
      path: { type: 'string', description: '相对工作区的目录，默认为 .' },
      depth: { type: 'integer', minimum: 1, maximum: 4, description: '递归深度，默认 2' }
    }),
    this.tool('search_files', '在工作区文本文件中搜索文本，适合定位组件、函数和样式。', {
      query: { type: 'string', description: '要搜索的精确文本（不支持正则）' },
      path: { type: 'string', description: '相对工作区的搜索目录，默认为 .' }
    }, ['query']),
    this.tool('read_file', '读取工作区内的 UTF-8 文本文件。', {
      path: { type: 'string', description: '相对工作区的文件路径' },
      startLine: { type: 'integer', minimum: 1, description: '起始行，默认 1' },
      endLine: { type: 'integer', minimum: 1, description: '结束行，最多返回 500 行' }
    }, ['path']),
    this.tool('write_file', '新建文件或完整覆写文件。仅在用户明确要求修改本地文件时使用。', {
      path: { type: 'string', description: '相对工作区的文件路径' },
      content: { type: 'string', description: '完整文件内容' }
    }, ['path', 'content']),
    this.tool('replace_in_file', '精确替换文件中的一段文本，适合小范围修改现有代码。', {
      path: { type: 'string', description: '相对工作区的文件路径' },
      oldText: { type: 'string', description: '文件中唯一存在的原文本' },
      newText: { type: 'string', description: '替换后的文本' }
    }, ['path', 'oldText', 'newText']),
    this.tool('copy_uploaded_file', '把当前聊天中已上传的图片或其他附件复制到工作区目标路径。用户说“给你了、使用附件、放到某文件夹”时直接使用，不要要求用户手动移动。', {
      url: { type: 'string', description: '消息附件中提供的完整 URL' },
      destination: { type: 'string', description: '相对工作区的目标文件路径，必须包含文件名' }
    }, ['url', 'destination']),
    this.tool('run_workspace_script', '运行工作区内已经存在的 PowerShell、BAT 或 CMD 脚本。仅当用户在当前请求中明确要求运行、执行、应用或让你操作时使用。不能传入命令字符串。', {
      path: { type: 'string', description: '相对工作区的 .ps1、.bat 或 .cmd 脚本路径' }
    }, ['path']),
    this.tool('run_command', '在桌面工作区中运行用户级程序或命令行工具，例如 powershell、cmd、python、node、npm、npx、git。支持参数数组，不使用管理员权限。', {
      program: { type: 'string', description: '程序名，例如 powershell.exe、python、npm.cmd、git' },
      args: { type: 'array', items: { type: 'string' }, maxItems: 64, description: '传给程序的参数数组' },
      cwd: { type: 'string', description: '相对桌面工作区的工作目录，默认为 .' },
      timeoutSeconds: { type: 'integer', minimum: 1, maximum: 300, description: '超时秒数，默认 120' }
    }, ['program']),
    this.tool('download_file', '从公开 HTTP/HTTPS 地址下载文件到桌面工作区。适合下载依赖、图片、模型辅助文件或项目素材。', {
      url: { type: 'string', description: '公开的 HTTP/HTTPS 下载地址' },
      destination: { type: 'string', description: '相对桌面工作区的目标文件路径' }
    }, ['url', 'destination']),
    this.tool('fetch_web_page', '访问公开的 HTTP/HTTPS 网页并读取其文本内容。', {
      url: { type: 'string', description: '完整的 http 或 https URL' }
    }, ['url']),
    this.tool('search_web', '检索公开网页资料。游戏、动画、漫画、角色设定优先检索 Bilibili；短视频热点优先检索抖音；其他内容使用通用公开网页搜索。返回可核查的标题、摘要和链接。', {
      query: { type: 'string', description: '要检索的关键词或问题' },
      source: { type: 'string', enum: ['auto', 'bilibili', 'douyin', 'web'], description: '检索来源偏好，默认 auto' }
    }, ['query'])
  ];

  get workspaceRoot() { return resolve(process.env.AGENT_WORKSPACE_ROOT ?? process.cwd()); }

  async execute(call: ToolCall): Promise<string> {
    let args: Record<string, unknown>;
    try { args = JSON.parse(call.arguments || '{}'); } catch { throw new BadRequestException('工具参数不是有效 JSON'); }
    switch (call.name) {
      case 'list_files': return this.listFiles(this.string(args.path, '.'), this.number(args.depth, 2));
      case 'search_files': return this.searchFiles(this.string(args.query), this.string(args.path, '.'));
      case 'read_file': return this.readFile(this.string(args.path), this.number(args.startLine, 1), this.number(args.endLine, 500));
      case 'write_file': return this.writeFile(this.string(args.path), this.string(args.content));
      case 'replace_in_file': return this.replaceInFile(this.string(args.path), this.string(args.oldText), this.string(args.newText));
      case 'copy_uploaded_file': return this.copyUploadedFile(this.string(args.url), this.string(args.destination));
      case 'run_workspace_script': return this.runWorkspaceScript(this.string(args.path));
      case 'run_command': return this.runCommand(this.string(args.program), Array.isArray(args.args) ? args.args.map(String) : [], this.string(args.cwd, '.'), this.number(args.timeoutSeconds, 120));
      case 'download_file': return this.downloadFile(this.string(args.url), this.string(args.destination));
      case 'fetch_web_page': return this.fetchWebPage(this.string(args.url));
      case 'search_web': return this.searchWeb(this.string(args.query), this.string(args.source, 'auto'));
      default: throw new BadRequestException(`未知工具：${call.name}`);
    }
  }

  private async listFiles(path: string, depth: number) {
    const root = this.safePath(path);
    const output: string[] = [];
    const walk = async (current: string, level: number) => {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 300)) {
        if (this.ignored(entry.name)) continue;
        const full = resolve(current, entry.name);
        output.push(`${relative(this.workspaceRoot, full)}${entry.isDirectory() ? '/' : ''}`);
        if (entry.isDirectory() && level < Math.min(4, Math.max(1, depth))) await walk(full, level + 1);
      }
    };
    await walk(root, 1);
    return output.slice(0, 1000).join('\n') || '(空目录)';
  }

  private async searchFiles(query: string, path: string) {
    if (!query || query.length > 500) throw new BadRequestException('搜索文本长度无效');
    const root = this.safePath(path);
    const matches: string[] = [];
    const walk = async (current: string) => {
      if (matches.length >= 200) return;
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        if (this.ignored(entry.name)) continue;
        const full = resolve(current, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (this.isTextFile(full)) {
          const stat = await fs.stat(full);
          if (stat.size > MAX_FILE_BYTES) continue;
          const lines = (await fs.readFile(full, 'utf8')).split(/\r?\n/);
          lines.forEach((line, index) => { if (line.includes(query) && matches.length < 200) matches.push(`${relative(this.workspaceRoot, full)}:${index + 1}: ${line.slice(0, 300)}`); });
        }
      }
    };
    await walk(root);
    return matches.join('\n') || '未找到匹配项';
  }

  private async readFile(path: string, startLine: number, endLine: number) {
    const full = this.safePath(path, true);
    this.assertTextFile(full);
    const stat = await fs.stat(full);
    if (stat.size > MAX_FILE_BYTES) throw new BadRequestException('文件过大，不能直接读取');
    const lines = (await fs.readFile(full, 'utf8')).split(/\r?\n/);
    const start = Math.max(1, startLine);
    const end = Math.min(lines.length, Math.max(start, endLine), start + 499);
    return lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join('\n');
  }

  private async writeFile(path: string, content: string) {
    const full = this.safePath(path, true);
    this.assertTextFile(full);
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new BadRequestException('写入内容过大');
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    return `已写入 ${relative(this.workspaceRoot, full)}（${Buffer.byteLength(content, 'utf8')} 字节）`;
  }

  private async replaceInFile(path: string, oldText: string, newText: string) {
    const full = this.safePath(path, true);
    this.assertTextFile(full);
    const content = await fs.readFile(full, 'utf8');
    const first = content.indexOf(oldText);
    if (first < 0) throw new BadRequestException('未找到要替换的原文本，请先重新读取文件');
    if (content.indexOf(oldText, first + oldText.length) >= 0) throw new BadRequestException('原文本不唯一，请提供更长的上下文');
    const updated = content.slice(0, first) + newText + content.slice(first + oldText.length);
    if (Buffer.byteLength(updated, 'utf8') > MAX_FILE_BYTES) throw new BadRequestException('修改后的文件过大');
    await fs.writeFile(full, updated, 'utf8');
    return `已修改 ${relative(this.workspaceRoot, full)}`;
  }

  private async copyUploadedFile(url: string, destination: string) {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/uploads/')) throw new BadRequestException('该 URL 不是 Wisadel 聊天附件');
    const filename = basename(decodeURIComponent(parsed.pathname));
    if (!filename || filename !== decodeURIComponent(parsed.pathname).split('/').at(-1)) throw new BadRequestException('附件地址无效');
    const uploadRoot = resolve(process.env.UPLOAD_DIR ?? './uploads');
    const source = resolve(uploadRoot, filename);
    if (relative(uploadRoot, source).startsWith('..')) throw new BadRequestException('附件路径无效');
    const stat = await fs.stat(source).catch(() => null);
    if (!stat?.isFile()) throw new BadRequestException('附件不存在或已被清理');
    if (stat.size > 20 * 1024 * 1024) throw new BadRequestException('附件超过 20MB 限制');
    const target = this.safePath(destination, true);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    return `已将附件复制到 ${relative(this.workspaceRoot, target)}（${stat.size} 字节）`;
  }

  private async runWorkspaceScript(path: string) {
    this.assertFullAccess();
    const script = this.safePath(path, true);
    const extension = extname(script).toLowerCase();
    if (!['.ps1', '.bat', '.cmd'].includes(extension)) throw new BadRequestException('仅允许运行 .ps1、.bat 和 .cmd 脚本');
    const stat = await fs.stat(script).catch(() => null);
    if (!stat?.isFile()) throw new BadRequestException('脚本不存在');
    if (stat.size > 1024 * 1024) throw new BadRequestException('脚本超过 1MB 限制');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(?:KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|REDIS_URL|CREDENTIAL)/i.test(key)));
    const command = extension === '.ps1' ? 'powershell.exe' : 'cmd.exe';
    const args = extension === '.ps1' ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script] : ['/d', '/s', '/c', script];
    return new Promise<string>((resolvePromise, reject) => {
      const child = spawn(command, args, { cwd: dirname(script), env, windowsHide: true, shell: false });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => { child.kill(); reject(new BadRequestException('脚本运行超过 60 秒，已终止')); }, 60_000);
      child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-20_000); });
      child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-20_000); });
      child.on('error', (error) => { clearTimeout(timer); reject(new BadRequestException(`无法启动脚本：${error.message}`)); });
      child.on('close', (code) => {
        clearTimeout(timer);
        const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
        resolvePromise(`脚本 ${relative(this.workspaceRoot, script)} 运行结束，退出码 ${code ?? -1}${output ? `\n输出：\n${output}` : ''}`);
      });
    });
  }

  private async runCommand(program: string, args: string[], cwd: string, timeoutSeconds: number) {
    this.assertFullAccess();
    if (!/^[a-zA-Z0-9_.-]+$/.test(program)) throw new BadRequestException('program 必须是程序名，不能包含路径或 Shell 运算符');
    if (args.some((arg) => arg.length > 4000)) throw new BadRequestException('单个命令参数过长');
    const workingDirectory = this.safePath(cwd);
    const stat = await fs.stat(workingDirectory).catch(() => null);
    if (!stat?.isDirectory()) throw new BadRequestException('工作目录不存在');
    return this.spawnProcess(program, args, workingDirectory, Math.min(300, Math.max(1, timeoutSeconds)) * 1000);
  }

  private async downloadFile(url: string, destination: string) {
    this.assertFullAccess();
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new BadRequestException('仅支持 HTTP/HTTPS 下载');
    if (this.isPrivateHost(parsed.hostname)) throw new BadRequestException('不允许从本机或内网地址下载');
    const target = this.safePath(destination, true);
    const response = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(120_000), headers: { 'User-Agent': 'Wisadel-Agent/0.1' } });
    if (!response.ok) throw new BadRequestException(`下载失败 (${response.status})`);
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > 500 * 1024 * 1024) throw new BadRequestException('下载文件超过 500MB 限制');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 500 * 1024 * 1024) throw new BadRequestException('下载文件超过 500MB 限制');
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return `已下载到 ${relative(this.workspaceRoot, target)}（${buffer.length} 字节）`;
  }

  private spawnProcess(program: string, args: string[], cwd: string, timeoutMs: number) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(?:KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|REDIS_URL|CREDENTIAL)/i.test(key)));
    return new Promise<string>((resolvePromise, reject) => {
      const child = spawn(program, args, { cwd, env, windowsHide: true, shell: false });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; child.kill(); reject(new BadRequestException(`命令运行超过 ${Math.ceil(timeoutMs / 1000)} 秒，已终止`)); } }, timeoutMs);
      child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-40_000); });
      child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-40_000); });
      child.on('error', (error) => { if (settled) return; settled = true; clearTimeout(timer); reject(new BadRequestException(`无法启动程序：${error.message}`)); });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
        resolvePromise(`命令运行结束，退出码 ${code ?? -1}${output ? `\n输出：\n${output}` : ''}`);
      });
    });
  }

  private assertFullAccess() { if (process.env.AGENT_FULL_ACCESS !== 'true') throw new BadRequestException('完整 Agent 权限尚未启用'); }

  private async fetchWebPage(url: string) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new BadRequestException('仅支持 HTTP/HTTPS');
    if (this.isPrivateHost(parsed.hostname)) throw new BadRequestException('不允许访问本机或内网地址');
    const response = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'Wisadel/0.1 Agent' } });
    if (!response.ok) throw new BadRequestException(`网页请求失败 (${response.status})`);
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('text/') && !type.includes('json')) throw new BadRequestException('网页不是可读取的文本内容');
    const raw = (await response.text()).slice(0, 300_000);
    return raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30_000);
  }

  private async searchWeb(query: string, source: string) {
    if (!query || query.length > 300) throw new BadRequestException('检索关键词无效');
    const preference = source === 'auto'
      ? /游戏|动画|动漫|漫画|角色|番剧|声优|小说|设定|galgame|二次元/i.test(query) ? 'bilibili'
        : /抖音|短视频|热搜|热点|直播|网红/i.test(query) ? 'douyin' : 'web'
      : source;
    const scoped = preference === 'bilibili' ? `site:bilibili.com ${query}`
      : preference === 'douyin' ? `site:douyin.com ${query}` : query;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(scoped)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'Mozilla/5.0 Wisadel/0.2' } });
    if (!response.ok) throw new BadRequestException(`公开检索失败 (${response.status})`);
    const html = await response.text();
    const items = [...html.matchAll(/<li class="b_algo"[\s\S]*?<h2><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<p>([\s\S]*?)<\/p>/gi)]
      .slice(0, 5)
      .map((match) => ({ url: match[1] ?? '', title: (match[2] ?? '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim(), summary: (match[3] ?? '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim() }))
      .filter((item) => item.title && item.url);
    if (!items.length) return `未检索到可引用的公开结果（来源偏好：${preference}）。`;
    return [`公开检索完成（来源偏好：${preference}）`, ...items.map((item, index) => `${index + 1}. ${item.title}\n${item.summary}\n${item.url}`)].join('\n\n');
  }

  private safePath(path: string, blockSecrets = false) {
    if (!path || isAbsolute(path)) throw new BadRequestException('必须使用工作区相对路径');
    const full = resolve(this.workspaceRoot, path);
    const rel = relative(this.workspaceRoot, full);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new BadRequestException('路径超出授权工作区');
    if (blockSecrets && BLOCKED_NAMES.test(rel)) throw new BadRequestException('该敏感文件禁止访问');
    return full;
  }

  private assertTextFile(path: string) { if (!this.isTextFile(path)) throw new BadRequestException('仅允许访问常见文本/代码文件'); }
  private isTextFile(path: string) { return TEXT_EXTENSIONS.has(extname(path).toLowerCase()) || ['Dockerfile', 'Makefile'].includes(basename(path)); }
  private ignored(name: string) { return ['node_modules', '.git', 'dist', 'release', 'coverage', '.next', 'uploads'].includes(name) || BLOCKED_NAMES.test(name); }
  private isPrivateHost(host: string) { return host === 'localhost' || host === '::1' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host); }
  private string(value: unknown, fallback?: string): string { if (typeof value === 'string') return value; if (fallback !== undefined) return fallback; throw new BadRequestException('缺少字符串参数'); }
  private number(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
  private tool(name: string, description: string, properties: Record<string, object>, required: string[] = []) {
    return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } };
  }
}
