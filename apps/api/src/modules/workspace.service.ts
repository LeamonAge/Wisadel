import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { resolve, basename } from 'node:path';
import { PersistenceService } from '../shared/persistence.service';
import { PrismaService } from '../shared/prisma.service';

type Trust = 'UNTRUSTED' | 'TRUSTED';
type Workspace = { id: string; userId: string; path: string; name: string; trust: Trust; settings: Record<string, unknown>; createdAt: string; updatedAt: string };
type Audit = { id: string; userId: string; workspaceId?: string | null; tool: string; inputSummary: string; status: string; resultSummary?: string | null; createdAt: string };

@Injectable()
export class WorkspaceService {
  private readonly workspaces = new Map<string, Workspace>();
  private readonly audits = new Map<string, Audit>();
  constructor(private readonly store: PersistenceService, private readonly prisma: PrismaService) {}

  async list(userId: string) {
    if (!this.store.integrated) return [...this.workspaces.values()].filter((item) => item.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return this.prisma.workspace.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  async register(userId: string, input: { path: string; name?: string }) {
    const path = resolve(input.path);
    if (!path || path.length < 2) throw new BadRequestException('工作区路径无效');
    const name = input.name?.trim() || basename(path) || path;
    if (!this.store.integrated) {
      const existing = [...this.workspaces.values()].find((item) => item.userId === userId && item.path === path);
      if (existing) return existing;
      const now = new Date().toISOString();
      const item = { id: crypto.randomUUID(), userId, path, name, trust: 'UNTRUSTED' as Trust, settings: {}, createdAt: now, updatedAt: now };
      this.workspaces.set(item.id, item); return item;
    }
    return this.prisma.workspace.upsert({ where: { userId_path: { userId, path } }, create: { userId, path, name }, update: { name } });
  }

  async trust(userId: string, id: string, trust: Trust) {
    if (!this.store.integrated) { const item = this.workspaces.get(id); if (!item || item.userId !== userId) throw new NotFoundException('工作区不存在'); item.trust = trust; item.updatedAt = new Date().toISOString(); return item; }
    return this.prisma.workspace.update({ where: { id, userId }, data: { trust } });
  }

  async updateSettings(userId: string, id: string, settings: Record<string, unknown>) {
    if (!this.store.integrated) { const item = this.workspaces.get(id); if (!item || item.userId !== userId) throw new NotFoundException('工作区不存在'); item.settings = { ...item.settings, ...settings }; item.updatedAt = new Date().toISOString(); return item; }
    return this.prisma.workspace.update({ where: { id, userId }, data: { settings: settings as any } });
  }

  async audit(userId: string, input: Omit<Audit, 'id' | 'userId' | 'createdAt'>) {
    if (!this.store.integrated) { const item = { ...input, id: crypto.randomUUID(), userId, createdAt: new Date().toISOString() }; this.audits.set(item.id, item); return item; }
    return this.prisma.agentAuditEntry.create({ data: { userId, workspaceId: input.workspaceId ?? undefined, tool: input.tool, inputSummary: input.inputSummary, status: input.status as any, resultSummary: input.resultSummary ?? undefined } });
  }

  async auditLog(userId: string, workspaceId?: string) {
    if (!this.store.integrated) return [...this.audits.values()].filter((item) => item.userId === userId && (!workspaceId || item.workspaceId === workspaceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.prisma.agentAuditEntry.findMany({ where: { userId, ...(workspaceId ? { workspaceId } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
