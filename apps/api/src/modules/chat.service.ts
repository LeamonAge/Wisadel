import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMessageInput, CreateSessionInput, Message, Session } from '@wisadel/contracts';
import { randomUUID } from 'node:crypto';
import { PersistenceService } from '../shared/persistence.service';
import { ProviderRouterService } from '../providers/provider-router.service';

@Injectable()
export class ChatService {
  constructor(private readonly store: PersistenceService, private readonly router: ProviderRouterService) {}

  listSessions(userId: string, kind?: string): Promise<Session[]> {
    return this.store.listSessions(userId, kind);
  }

  createSession(userId: string, input: CreateSessionInput): Promise<Session> {
    return this.store.createSession(userId, { kind: input.kind, title: input.title ?? (input.kind === 'chat' ? '新的对话' : '新的创作'), model: input.kind === 'chat' ? this.router.defaultModel() : process.env.QWEN_MODEL ?? 'Qwen Image' });
  }

  async renameSession(userId: string, id: string, title: string): Promise<Session> {
    const session = await this.store.renameSession(userId, id, title.trim().slice(0, 100));
    if (!session) throw new NotFoundException('会话不存在');
    return session;
  }

  async setSessionModel(userId: string, id: string, model: string): Promise<Session> {
    const session = await this.store.setSessionModel(userId, id, model);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async deleteSession(userId: string, id: string) {
    if (!(await this.store.deleteSession(userId, id))) throw new NotFoundException('会话不存在');
    return { deleted: true };
  }

  listArchivedSessions(userId: string, kind?: string) { return this.store.listArchivedSessions(userId, kind); }

  async restoreSession(userId: string, id: string) {
    const session = await this.store.restoreSession(userId, id);
    if (!session) throw new NotFoundException('归档会话不存在或已超过保留期限');
    return session;
  }

  async listMessages(userId: string, sessionId: string): Promise<Message[]> {
    await this.getOwnedSession(userId, sessionId);
    return this.store.listMessages(userId, sessionId);
  }

  async addUserMessage(userId: string, sessionId: string, input: CreateMessageInput): Promise<Message> {
    const session = await this.getOwnedSession(userId, sessionId);
    const existing = await this.store.findMessageByClientId(sessionId, input.clientId);
    if (existing) return existing;

    const message = await this.store.addMessage({ sessionId, clientId: input.clientId, role: 'user', content: input.content, imageUrls: input.imageUrls, attachments: input.attachments });
    if (session.title === '新的对话' || session.title === '新的创作') {
      await this.store.renameSession(userId, sessionId, this.titleFrom(input.content));
    }
    return message;
  }

  addAssistantMessage(sessionId: string, content: string, trace: string[] = []): Promise<Message> {
    return this.store.addMessage({ sessionId, clientId: `server-${randomUUID()}`, role: 'assistant', content, trace });
  }

  async autoTitle(userId: string, sessionId: string, request: string, answer: string) {
    const session = await this.getOwnedSession(userId, sessionId);
    if (session.title !== '新的对话' && session.title !== '新的创作') return session;
    const generated = await Promise.resolve(this.router.summarizeTitle?.(session.model, request, answer)).catch(() => null);
    return this.store.renameSession(userId, sessionId, generated ?? this.titleFrom(request));
  }

  async getOwnedSession(userId: string, id: string) {
    const session = await this.store.findSession(userId, id);
    if (!session) throw new NotFoundException('会话不存在');
    return session;
  }

  private titleFrom(content: string) {
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact;
  }
}
