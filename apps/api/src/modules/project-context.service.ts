import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { basename, extname, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { WorkspaceService } from './workspace.service';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);
const TEXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.cs', '.json', '.md', '.css', '.html', '.yml', '.yaml']);

@Injectable()
export class ProjectContextService {
  constructor(private readonly workspaces: WorkspaceService) {}
  async context(userId: string, workspaceId: string) {
    const workspace = (await this.workspaces.list(userId)).find((item) => item.id === workspaceId);
    if (!workspace) throw new NotFoundException('工作区不存在');
    const root = resolve(workspace.path);
    const stat = await fs.stat(root).catch(() => null);
    if (!stat?.isDirectory()) throw new BadRequestException('桌面端尚未授权或工作区路径不可访问');
    const [tree, project, git] = await Promise.all([this.tree(root), this.detect(root), this.git(root)]);
    return { workspace: { id: workspace.id, name: workspace.name, path: workspace.path, trust: workspace.trust }, tree, project, git };
  }

  private async tree(root: string) {
    const files: Array<{ path: string; kind: 'file' | 'directory' }> = [];
    const walk = async (directory: string, depth: number) => {
      if (depth > 3 || files.length >= 600) return;
      const entries = await fs.readdir(directory, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (IGNORE.has(entry.name)) continue;
        const full = resolve(directory, entry.name); const path = relative(root, full);
        files.push({ path, kind: entry.isDirectory() ? 'directory' : 'file' });
        if (entry.isDirectory()) await walk(full, depth + 1);
        if (files.length >= 600) return;
      }
    };
    await walk(root, 0); return files;
  }

  private async detect(root: string) {
    const names = new Set(await fs.readdir(root).catch(() => []));
    const scripts: string[] = [];
    if (names.has('package.json')) { try { const pkg = JSON.parse(await fs.readFile(resolve(root, 'package.json'), 'utf8')); scripts.push(...Object.keys(pkg.scripts ?? {}).map((name) => `npm run ${name}`)); } catch { /* malformed package manifest */ } }
    if (names.has('pyproject.toml')) scripts.push('python -m pytest');
    if (names.has('pytest.ini') || names.has('requirements.txt')) scripts.push('pytest');
    if (names.has('Cargo.toml')) scripts.push('cargo test');
    if (names.has('go.mod')) scripts.push('go test ./...');
    return { languages: [...new Set((await this.findExtensions(root)).map((value) => value.slice(1)))].slice(0, 12), suggestedCommands: scripts.slice(0, 20) };
  }

  private async findExtensions(root: string) { const result: string[] = []; const entries = await fs.readdir(root, { withFileTypes: true }); for (const entry of entries) { if (!entry.isDirectory() && TEXT.has(extname(entry.name))) result.push(extname(entry.name)); } return result; }
  private git(cwd: string) { return new Promise<{ branch: string; status: string; recent: string[] }>((resolveResult) => { const child = spawn('git', ['status', '--short', '--branch'], { cwd, windowsHide: true }); let output = ''; child.stdout.on('data', (item) => output += item); child.on('close', () => { const lines = output.trim().split(/\r?\n/).filter(Boolean); resolveResult({ branch: lines.shift()?.replace(/^##\s*/, '') ?? 'not-a-git-repository', status: lines.join('\n'), recent: [] }); }); child.on('error', () => resolveResult({ branch: 'not-a-git-repository', status: '', recent: [] })); }); }
}
