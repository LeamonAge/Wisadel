import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentTask, CreateAgentTaskInput } from '@wisadel/contracts';
import { randomUUID } from 'node:crypto';
import { ChatService } from './chat.service';
import { QueueService } from '../shared/queue.service';
import { PersistenceService } from '../shared/persistence.service';
import { BillingService } from './billing.service';

@Injectable()
export class AgentTaskService {
  constructor(private readonly store: PersistenceService, private readonly chat: ChatService, private readonly queue: QueueService, private readonly billing: BillingService) {}

  async create(userId: string, input: CreateAgentTaskInput): Promise<AgentTask> {
    const session = await this.chat.getOwnedSession(userId, input.sessionId);
    if (session.kind !== 'chat') throw new NotFoundException('后台 Agent 任务仅支持对话工作区');
    await this.billing.assertCanStartChat(userId);
    await this.chat.addUserMessage(userId, input.sessionId, { clientId: `background-${randomUUID()}`, content: input.content, imageUrls: input.imageUrls, attachments: input.attachments });
    const task = await this.store.createAgentTask(userId, input);
    await this.queue.enqueueAgentTask(task.id);
    return task;
  }

  list(userId: string, sessionId?: string) { return this.store.listAgentTasks(userId, sessionId); }

  async get(userId: string, id: string) {
    const task = await this.store.findAgentTask(userId, id);
    if (!task) throw new NotFoundException('后台任务不存在');
    return task;
  }

  async retry(userId: string, id: string) {
    const task = await this.store.resetAgentTask(userId, id);
    if (!task) throw new NotFoundException('只有失败的后台任务可以重试');
    await this.queue.enqueueAgentTask(id);
    return task;
  }
}
