import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateMessageInput, CreateSessionInput, Message, Session } from '@wisadel/contracts';
import { randomUUID } from 'node:crypto';
import { PersistenceService } from '../shared/persistence.service';

@Injectable()
export class ChatService {
  constructor(private readonly store: PersistenceService) {}

  listSessions(userId: string, kind?: string): Promise<Session[]> {
    return this.store.listSessions(userId, kind);
  }

  createSession(userId: string, input: CreateSessionInput): Promise<Session> {
    return this.store.createSession(userId, { kind: input.kind, title: input.title ?? (input.kind === 'chat' ? '新的对话' : '新的创作'), model: input.kind === 'chat' ? process.env.DEEPSEEK_MODEL ?? 'DeepSeek' : process.env.QWEN_MODEL ?? 'Qwen Image' });
  }

  async renameSession(userId: string, id: string, title: string): Promise<Session> {
    const session = await this.store.renameSession(userId, id, title.trim().slice(0, 100));
    if (!session) throw new NotFoundException('会话不存在');
    return session;
  }

  async deleteSession(userId: string, id: string) {
    if (!(await this.store.deleteSession(userId, id))) throw new NotFoundException('会话不存在');
    return { deleted: true };
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

  addAssistantMessage(sessionId: string, content: string): Promise<Message> {
    return this.store.addMessage({ sessionId, clientId: `server-${randomUUID()}`, role: 'assistant', content });
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
