import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PersistenceService } from './persistence.service';
import { StableDiffusionService } from '../providers/stable-diffusion.service';
import { randomUUID } from 'node:crypto';
import { QwenService } from '../providers/qwen.service';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly sd: StableDiffusionService,
    private readonly qwen: QwenService
  ) {}

  get integrated() { return (process.env.QUEUE_MODE ?? 'memory') === 'redis'; }

  async onModuleInit() {
    if (!this.integrated) return;
    this.connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.queue = new Queue('image-generation', { connection: this.connection });
    this.worker = new Worker('image-generation', async (job) => this.process(job.data.taskId), { connection: this.connection, concurrency: 1 });
    this.worker.on('failed', (job, error) => this.logger.error(`Image job ${job?.id} failed: ${error.message}`));
    this.logger.log(`BullMQ image worker connected to Redis (${this.sd.configured ? 'remote A1111' : 'simulation'} mode)`);
  }

  async enqueue(taskId: string) {
    if (!this.queue) return false;
    await this.queue.add('txt2img', { taskId }, { jobId: taskId, attempts: 1, removeOnComplete: 100, removeOnFail: 100 });
    return true;
  }

  async cancel(taskId: string) {
    if (!this.queue) return;
    const job = await this.queue.getJob(taskId);
    if (job && (await job.getState()) === 'waiting') await job.remove();
    if (job && (await job.getState()) === 'active') await this.sd.interrupt();
  }

  async counts() {
    if (!this.queue) return null;
    return this.queue.getJobCounts('waiting', 'active', 'failed', 'completed');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private async process(taskId: string) {
    if (this.sd.configured) {
      const task = await this.persistence.findImageTaskInternal(taskId);
      if (!task || task.status === 'cancelled') return;
      await this.persistence.updateImageTask(taskId, { status: 'processing', progress: 5 });
      try {
        let params = task.params;
        let resultUrls: string[];
        try {
          resultUrls = await this.sd.generate(params);
        } catch (firstError) {
          const capabilities = await this.sd.capabilities().catch(() => null);
          const repair = capabilities
            ? await this.qwen.repairSdError(firstError instanceof Error ? firstError.message : String(firstError), params, capabilities)
            : null;
          if (!repair || !Object.keys(repair).length) throw firstError;
          params = await this.sd.prepareParams({ ...params, ...repair });
          await this.persistence.updateImageTask(taskId, {
            params,
            progress: 12,
            errorMessage: '千问已修正 SD 参数，正在自动重试。'
          });
          resultUrls = await this.sd.generate(params);
        }
        const latest = await this.persistence.findImageTaskInternal(taskId);
        if (latest?.status !== 'cancelled') {
          await this.persistence.updateImageTask(taskId, { status: 'succeeded', progress: 100, params, resultUrls, errorMessage: null });
          await this.persistence.addMessage({
            sessionId: task.sessionId,
            clientId: `image-task-${randomUUID()}`,
            role: 'assistant',
            content: task.params.mode === 'txt2img' ? '图像已生成。' : task.params.mode === 'img2img' ? '图生图处理已完成。' : '局部重绘已完成。',
            imageUrls: resultUrls
          });
        }
      } catch (error) {
        await this.persistence.updateImageTask(taskId, { status: 'failed', progress: 0, errorCode: 'SD_ERROR', errorMessage: error instanceof Error ? error.message : 'Stable Diffusion 生成失败' });
        throw error;
      }
      return;
    }
    await this.processBeforeA1111(taskId);
  }

  private async processBeforeA1111(taskId: string) {
    for (const progress of [8, 34, 72]) {
      const task = await this.persistence.findImageTaskInternal(taskId);
      if (!task || task.status === 'cancelled') return;
      await this.persistence.updateImageTask(taskId, { status: 'processing', progress });
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const task = await this.persistence.findImageTaskInternal(taskId);
    if (!task || task.status === 'cancelled') return;
    const text = encodeURIComponent(task.params.prompt.slice(0, 28) || 'Wisadel preview');
    await this.persistence.updateImageTask(taskId, { status: 'succeeded', progress: 100, resultUrls: [`https://placehold.co/1024x1024/241010/f4d7d4?text=${text}`] });
  }
}
