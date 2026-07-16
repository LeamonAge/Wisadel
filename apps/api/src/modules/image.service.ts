import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SD_PARAMS, type CreateImageTaskInput, type ImageTask } from '@wisadel/contracts';
import { randomUUID } from 'node:crypto';
import { PersistenceService } from '../shared/persistence.service';
import { QueueService } from '../shared/queue.service';
import { ChatService } from './chat.service';
import { StableDiffusionService } from '../providers/stable-diffusion.service';

@Injectable()
export class ImageService {
  constructor(
    private readonly store: PersistenceService,
    private readonly queue: QueueService,
    private readonly chat: ChatService,
    private readonly sd: StableDiffusionService
  ) {}

  async create(userId: string, input: CreateImageTaskInput): Promise<ImageTask> {
    await this.chat.getOwnedSession(userId, input.sessionId);
    const existing = await this.store.findImageTaskByClientId(userId, input.clientId);
    if (existing) return existing;
    const params = await this.sd.prepareParams({ ...DEFAULT_SD_PARAMS, ...input.params });
    const task = await this.store.createImageTask(userId, { sessionId: input.sessionId, clientId: input.clientId, params });
    if (!(await this.queue.enqueue(task.id))) this.runMemoryTask(task.id);
    return task;
  }

  list(userId: string, sessionId?: string): Promise<ImageTask[]> { return this.store.listImageTasks(userId, sessionId); }

  async get(userId: string, id: string): Promise<ImageTask> {
    const task = await this.store.findImageTask(userId, id);
    if (!task) throw new NotFoundException('图像任务不存在');
    return task;
  }

  async cancel(userId: string, id: string): Promise<ImageTask> {
    const task = await this.get(userId, id);
    if (!['queued', 'processing'].includes(task.status)) return task;
    await this.queue.cancel(id);
    await this.store.updateImageTask(id, { status: 'cancelled' });
    return this.get(userId, id);
  }

  async retry(userId: string, id: string): Promise<ImageTask> {
    const previous = await this.get(userId, id);
    if (previous.status !== 'failed') throw new ForbiddenException('仅失败任务可以重试');
    const task = await this.store.createImageTask(userId, { sessionId: previous.sessionId, clientId: `retry-${randomUUID()}`, params: previous.params, retryOfId: previous.id });
    if (!(await this.queue.enqueue(task.id))) this.runMemoryTask(task.id);
    return task;
  }

  private runMemoryTask(id: string) {
    const advance = (delay: number, progress: number, done = false) => setTimeout(async () => {
      const task = await this.store.findImageTaskInternal(id);
      if (!task || task.status === 'cancelled') return;
      if (done) {
        const text = encodeURIComponent(task.params.prompt.slice(0, 28) || 'Wisadel preview');
        const resultUrls = [`https://placehold.co/1024x1024/241010/f4d7d4?text=${text}`];
        await this.store.updateImageTask(id, { status: 'succeeded', progress: 100, resultUrls });
        await this.store.addMessage({ sessionId: task.sessionId, clientId: `image-task-${id}`, role: 'assistant', content: '图像已生成。', imageUrls: resultUrls });
      } else await this.store.updateImageTask(id, { status: 'processing', progress });
    }, delay);
    advance(300, 8); advance(900, 34); advance(1500, 72); advance(2200, 100, true);
  }
}
