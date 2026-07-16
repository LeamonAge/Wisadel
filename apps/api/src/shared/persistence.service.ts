import { Injectable } from '@nestjs/common';
import type { ImageTask, Message, SdParams, Session, SessionKind, User } from '@wisadel/contracts';
import type { ChatMessage, ChatSession, ImageTask as DbImageTask, User as DbUser } from '@prisma/client';
import { MemoryStore, type StoredUser } from './memory.store';
import { PrismaService } from './prisma.service';

@Injectable()
export class PersistenceService {
  constructor(private readonly memory: MemoryStore, private readonly prisma: PrismaService) {}

  get integrated() {
    return (process.env.DATA_MODE ?? 'memory') === 'postgres';
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    if (!this.integrated) {
      const id = this.memory.usersByEmail.get(email);
      return id ? this.memory.users.get(id) ?? null : null;
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.userWithPassword(user) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    if (!this.integrated) return this.memory.users.get(id) ?? null;
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.userWithPassword(user) : null;
  }

  async createUser(input: { email: string; passwordHash: string; nickname: string; role: 'user' | 'admin' }): Promise<User> {
    if (!this.integrated) {
      const now = new Date().toISOString();
      const user: StoredUser = { id: crypto.randomUUID(), email: input.email, passwordHash: input.passwordHash, nickname: input.nickname, avatarUrl: null, role: input.role, createdAt: now };
      this.memory.users.set(user.id, user);
      this.memory.usersByEmail.set(user.email, user.id);
      return this.publicUser(user);
    }
    const user = await this.prisma.user.create({ data: { email: input.email, passwordHash: input.passwordHash, nickname: input.nickname, role: input.role === 'admin' ? 'ADMIN' : 'USER' } });
    return this.publicUser(user);
  }

  async saveRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    if (!this.integrated) return;
    await this.prisma.refreshToken.create({ data: input });
  }

  async findValidRefreshToken(tokenHash: string) {
    if (!this.integrated) return true;
    return this.prisma.refreshToken.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } });
  }

  async revokeRefreshToken(tokenHash: string) {
    if (!this.integrated) return;
    await this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async listSessions(userId: string, kind?: string): Promise<Session[]> {
    if (!this.integrated) return [...this.memory.sessions.values()].filter((session) => session.userId === userId && (!kind || session.kind === kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((session) => this.publicSession(session));
    const sessions = await this.prisma.chatSession.findMany({ where: { userId, deletedAt: null, ...(kind ? { kind: kind === 'image' ? 'IMAGE' : 'CHAT' } : {}) }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } });
    return sessions.map((session) => this.publicSession(session, session.messages[0]?.content ?? '开始新的会话'));
  }

  async createSession(userId: string, input: { kind: SessionKind; title: string; model: string }): Promise<Session> {
    if (!this.integrated) {
      const session = { id: crypto.randomUUID(), userId, kind: input.kind, title: input.title, model: input.model, preview: '开始新的会话', updatedAt: new Date().toISOString() };
      this.memory.sessions.set(session.id, session);
      this.memory.messages.set(session.id, []);
      return this.publicSession(session);
    }
    return this.publicSession(await this.prisma.chatSession.create({ data: { userId, kind: input.kind === 'image' ? 'IMAGE' : 'CHAT', title: input.title, model: input.model } }));
  }

  async findSession(userId: string, id: string): Promise<Session | null> {
    if (!this.integrated) {
      const session = this.memory.sessions.get(id);
      return session?.userId === userId ? this.publicSession(session) : null;
    }
    const session = await this.prisma.chatSession.findFirst({ where: { id, userId, deletedAt: null } });
    return session ? this.publicSession(session) : null;
  }

  async renameSession(userId: string, id: string, title: string): Promise<Session | null> {
    if (!this.integrated) {
      const session = this.memory.sessions.get(id);
      if (!session || session.userId !== userId) return null;
      session.title = title; session.updatedAt = new Date().toISOString();
      return this.publicSession(session);
    }
    const count = await this.prisma.chatSession.updateMany({ where: { id, userId, deletedAt: null }, data: { title } });
    return count.count ? this.findSession(userId, id) : null;
  }

  async deleteSession(userId: string, id: string) {
    if (!this.integrated) {
      const session = this.memory.sessions.get(id);
      if (!session || session.userId !== userId) return false;
      this.memory.sessions.delete(id); this.memory.messages.delete(id); return true;
    }
    return (await this.prisma.chatSession.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } })).count > 0;
  }

  async listMessages(userId: string, sessionId: string): Promise<Message[]> {
    if (!(await this.findSession(userId, sessionId))) return [];
    if (!this.integrated) return this.memory.messages.get(sessionId) ?? [];
    return (await this.prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } })).map((message) => this.publicMessage(message));
  }

  async findMessageByClientId(sessionId: string, clientId: string): Promise<Message | null> {
    if (!this.integrated) return (this.memory.messages.get(sessionId) ?? []).find((message) => message.clientId === clientId) ?? null;
    const message = await this.prisma.chatMessage.findUnique({ where: { sessionId_clientId: { sessionId, clientId } } });
    return message ? this.publicMessage(message) : null;
  }

  async addMessage(input: { sessionId: string; clientId: string; role: Message['role']; content: string; imageUrls?: string[]; attachments?: Message['attachments'] }): Promise<Message> {
    if (!this.integrated) {
      const message: Message = { id: crypto.randomUUID(), sessionId: input.sessionId, clientId: input.clientId, role: input.role, content: input.content, status: 'sent', imageUrls: input.imageUrls ?? [], attachments: input.attachments ?? [], createdAt: new Date().toISOString() };
      this.memory.messages.get(input.sessionId)?.push(message);
      const session = this.memory.sessions.get(input.sessionId); if (session) { session.preview = input.content.slice(0, 80); session.updatedAt = message.createdAt; }
      return message;
    }
    const role = { user: 'USER', assistant: 'ASSISTANT', system: 'SYSTEM', tool: 'TOOL' }[input.role] as any;
    const message = await this.prisma.$transaction(async (tx) => {
      const metadata = input.imageUrls?.length || input.attachments?.length ? { imageUrls: input.imageUrls ?? [], attachments: input.attachments ?? [] } : undefined;
      const created = await tx.chatMessage.create({ data: { sessionId: input.sessionId, clientId: input.clientId, role, content: input.content, metadata } });
      await tx.chatSession.update({ where: { id: input.sessionId }, data: { updatedAt: new Date() } });
      return created;
    });
    return this.publicMessage(message);
  }

  async createImageTask(userId: string, input: { sessionId: string; clientId: string; params: SdParams; retryOfId?: string | null }): Promise<ImageTask> {
    if (!this.integrated) {
      const now = new Date().toISOString();
      const task = { id: crypto.randomUUID(), userId, clientId: input.clientId, sessionId: input.sessionId, status: 'queued' as const, progress: 0, params: input.params, resultUrls: [], errorCode: null, errorMessage: null, retryOfId: input.retryOfId ?? null, createdAt: now, updatedAt: now };
      this.memory.imageTasks.set(task.id, task); return this.publicImageTask(task);
    }
    const task = await this.prisma.imageTask.create({ data: { userId, sessionId: input.sessionId, clientId: input.clientId, params: input.params as any, retryOfId: input.retryOfId } });
    return this.publicImageTask(task);
  }

  async findImageTask(userId: string, id: string): Promise<ImageTask | null> {
    if (!this.integrated) { const task = this.memory.imageTasks.get(id); return task?.userId === userId ? this.publicImageTask(task) : null; }
    const task = await this.prisma.imageTask.findFirst({ where: { id, userId } }); return task ? this.publicImageTask(task) : null;
  }

  async findImageTaskInternal(id: string): Promise<ImageTask | null> {
    if (!this.integrated) { const task = this.memory.imageTasks.get(id); return task ? this.publicImageTask(task) : null; }
    const task = await this.prisma.imageTask.findUnique({ where: { id } }); return task ? this.publicImageTask(task) : null;
  }

  async findImageTaskByClientId(userId: string, clientId: string): Promise<ImageTask | null> {
    if (!this.integrated) { const task = [...this.memory.imageTasks.values()].find((item) => item.userId === userId && item.clientId === clientId); return task ? this.publicImageTask(task) : null; }
    const task = await this.prisma.imageTask.findUnique({ where: { userId_clientId: { userId, clientId } } }); return task ? this.publicImageTask(task) : null;
  }

  async listImageTasks(userId: string, sessionId?: string): Promise<ImageTask[]> {
    if (!this.integrated) return [...this.memory.imageTasks.values()]
      .filter((task) => task.userId === userId && (!sessionId || task.sessionId === sessionId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((task) => this.publicImageTask(task));
    return (await this.prisma.imageTask.findMany({ where: { userId, ...(sessionId ? { sessionId } : {}) }, orderBy: { createdAt: 'desc' } })).map((task) => this.publicImageTask(task));
  }

  async updateImageTask(id: string, data: Partial<Pick<ImageTask, 'status' | 'progress' | 'params' | 'resultUrls' | 'errorCode' | 'errorMessage'>>) {
    if (!this.integrated) { const task = this.memory.imageTasks.get(id); if (task) Object.assign(task, data, { updatedAt: new Date().toISOString() }); return; }
    await this.prisma.imageTask.update({ where: { id }, data: { ...(data.status ? { status: data.status.toUpperCase() as any } : {}), ...(data.progress !== undefined ? { progress: data.progress } : {}), ...(data.params ? { params: data.params as any } : {}), ...(data.resultUrls ? { resultUrls: data.resultUrls } : {}), ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}), ...(data.errorMessage !== undefined ? { errorMessage: data.errorMessage } : {}) } });
  }

  async adminOverview() {
    if (!this.integrated) { const tasks = [...this.memory.imageTasks.values()]; return { users: this.memory.users.size, sessions: this.memory.sessions.size, queuedTasks: tasks.filter((x) => x.status === 'queued').length, processingTasks: tasks.filter((x) => x.status === 'processing').length, completedTasks: tasks.filter((x) => x.status === 'succeeded').length }; }
    const [users, sessions, queuedTasks, processingTasks, completedTasks] = await Promise.all([this.prisma.user.count(), this.prisma.chatSession.count({ where: { deletedAt: null } }), this.prisma.imageTask.count({ where: { status: 'QUEUED' } }), this.prisma.imageTask.count({ where: { status: 'PROCESSING' } }), this.prisma.imageTask.count({ where: { status: 'SUCCEEDED' } })]);
    return { users, sessions, queuedTasks, processingTasks, completedTasks };
  }

  async listUsers(): Promise<User[]> {
    if (!this.integrated) return [...this.memory.users.values()].map((user) => this.publicUser(user));
    return (await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } })).map((user) => this.publicUser(user));
  }

  private publicUser(user: DbUser | StoredUser): User { return { id: user.id, email: user.email, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role.toString().toLowerCase() as User['role'], createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt }; }
  private userWithPassword(user: DbUser): StoredUser { return { ...this.publicUser(user), passwordHash: user.passwordHash }; }
  private publicSession(session: ChatSession | (Session & { userId: string }), preview = '开始新的会话'): Session { return { id: session.id, title: session.title, kind: session.kind.toString().toLowerCase() as SessionKind, model: session.model, preview: 'preview' in session ? session.preview : preview, updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : session.updatedAt }; }
  private publicMessage(message: ChatMessage): Message { const metadata = (message.metadata ?? {}) as any; return { id: message.id, clientId: message.clientId, sessionId: message.sessionId, role: message.role.toLowerCase() as Message['role'], content: message.content, status: 'sent', imageUrls: metadata.imageUrls ?? [], attachments: metadata.attachments ?? [], createdAt: message.createdAt.toISOString() }; }
  private publicImageTask(task: DbImageTask | (ImageTask & { userId: string; clientId: string })): ImageTask { return { id: task.id, sessionId: task.sessionId, status: task.status.toString().toLowerCase() as ImageTask['status'], progress: task.progress, params: task.params as SdParams, resultUrls: Array.isArray(task.resultUrls) ? task.resultUrls as string[] : [], errorCode: task.errorCode, errorMessage: task.errorMessage, retryOfId: task.retryOfId, createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt, updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt }; }
}
