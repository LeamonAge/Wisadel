import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PersistenceService } from './persistence.service';
import { StableDiffusionService } from '../providers/stable-diffusion.service';
import { randomUUID } from 'node:crypto';
import { QwenService } from '../providers/qwen.service';
import { DeepSeekService, type SettledModelUsage } from '../providers/deepseek.service';
import { BillingService } from '../modules/billing.service';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;
  private agentQueue?: Queue;
  private agentWorker?: Worker;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly sd: StableDiffusionService,
    private readonly qwen: QwenService,
    private readonly deepseek: DeepSeekService,
    private readonly billing: BillingService
  ) {}

  get integrated() { return (process.env.QUEUE_MODE ?? 'memory') === 'redis'; }

  async onModuleInit() {
    if (!this.integrated) return;
    this.connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    this.queue = new Queue('image-generation', { connection: this.connection });
    this.agentQueue = new Queue('agent-tasks', { connection: this.connection });
    this.worker = new Worker('image-generation', async (job) => this.process(job.data.taskId), { connection: this.connection, concurrency: 1 });
    this.agentWorker = new Worker('agent-tasks', async (job) => this.processAgentTask(job.data.taskId), { connection: this.connection, concurrency: 1 });
    this.worker.on('failed', (job, error) => this.logger.error(`Image job ${job?.id} failed: ${error.message}`));
    this.agentWorker.on('failed', (job, error) => this.logger.error(`Agent job ${job?.id} failed: ${error.message}`));
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

  async enqueueAgentTask(taskId: string) {
    if (!this.agentQueue) {
      void this.processAgentTask(taskId);
      return true;
    }
    await this.agentQueue.add('execute', { taskId }, { jobId: taskId, attempts: 2, backoff: { type: 'exponential', delay: 1500 }, removeOnComplete: 100, removeOnFail: 100 });
    return true;
  }

  async counts() {
    if (!this.queue) return null;
    return this.queue.getJobCounts('waiting', 'active', 'failed', 'completed');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.agentWorker?.close();
    await this.queue?.close();
    await this.agentQueue?.close();
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

  private async processAgentTask(taskId: string) {
    const task = await this.persistence.findAgentTaskInternal(taskId);
    if (!task || task.status === 'cancelled' || task.status === 'succeeded') return;
    await this.persistence.updateAgentTask(taskId, { status: 'running', errorMessage: null });
    await this.persistence.updateAgentStep(taskId, 0, { status: 'running', detail: '正在恢复任务上下文并制定执行计划' });
    try {
      const history = await this.persistence.listMessages(task.userId, task.sessionId);
      await this.persistence.updateAgentStep(taskId, 0, { status: 'succeeded', detail: '已保存三步执行计划，后台任务可以在关闭窗口后继续。' });
      await this.persistence.updateAgentStep(taskId, 1, { status: 'running', detail: '正在调用 Agent 与已授权工具' });
      let answer = '';
      const usage: SettledModelUsage[] = [];
      for await (const chunk of this.deepseek.stream(history.slice(0, -1), task.content, (label) => void this.persistence.updateAgentStep(taskId, 1, { detail: label }), (item) => usage.push(item))) answer += chunk;
      await this.persistence.updateAgentStep(taskId, 1, { status: 'succeeded', detail: 'Agent 执行完成。' });
      await this.persistence.updateAgentStep(taskId, 2, { status: 'running', detail: '正在写入结果与结算用量' });
      await this.persistence.addMessage({ sessionId: task.sessionId, clientId: `agent-task-${randomUUID()}`, role: 'assistant', content: answer });
      if (usage.length) await this.billing.settleChatUsage(task.userId, usage);
      await this.persistence.updateAgentStep(taskId, 2, { status: 'succeeded', detail: '结果已写入当前对话。' });
      await this.persistence.updateAgentTask(taskId, { status: 'succeeded' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '后台任务执行失败';
      await this.persistence.updateAgentStep(taskId, 1, { status: 'failed', detail: message });
      await this.persistence.updateAgentTask(taskId, { status: 'failed', errorMessage: message });
      throw error;
    }
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
