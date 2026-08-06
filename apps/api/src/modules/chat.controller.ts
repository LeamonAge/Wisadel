import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { createMessageInputSchema, createSessionInputSchema, sdParamsSchema, type CreateMessageInput, type CreateSessionInput } from '@wisadel/contracts';
import type { Request, Response } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { ZodValidationPipe } from '../shared/zod-validation.pipe';
import { ChatService } from './chat.service';
import { DeepSeekService } from '../providers/deepseek.service';
import { QwenService } from '../providers/qwen.service';
import { DEFAULT_SD_PARAMS } from '@wisadel/contracts';
import { StableDiffusionService } from '../providers/stable-diffusion.service';
import { ImageService } from './image.service';
import { ImageStorageService } from '../shared/image-storage.service';
import { BillingService } from './billing.service';
import type { SettledModelUsage } from '../providers/deepseek.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { WorkspaceService } from './workspace.service';
import { WritingSkillService } from './writing-master.service';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly deepseek: DeepSeekService,
    private readonly qwen: QwenService,
    private readonly sd: StableDiffusionService,
    private readonly images: ImageService,
    private readonly storage: ImageStorageService,
    private readonly billing: BillingService,
    private readonly router: ProviderRouterService,
    private readonly workspaces: WorkspaceService,
    private readonly writingSkill: WritingSkillService
  ) {}

  @Get('models') models() { return { models: this.router.catalogue() }; }

  @Get('sessions')
  list(@Req() request: Request, @Query('kind') kind?: string) {
    return this.chat.listSessions(currentUser(request).sub, kind);
  }

  @Post('sessions')
  create(@Req() request: Request, @Body(new ZodValidationPipe(createSessionInputSchema)) input: CreateSessionInput) {
    return this.chat.createSession(currentUser(request).sub, input);
  }

  @Patch('sessions/:id')
  rename(@Req() request: Request, @Param('id') id: string, @Body('title') title: string) {
    return this.chat.renameSession(currentUser(request).sub, id, title);
  }

  @Patch('sessions/:id/model')
  setModel(@Req() request: Request, @Param('id') id: string, @Body('model') model: string) {
    if (!this.router.catalogue().some((item) => item.id === model)) throw new Error('Unsupported model');
    return this.chat.setSessionModel(currentUser(request).sub, id, model);
  }

  @Delete('sessions/:id')
  remove(@Req() request: Request, @Param('id') id: string) {
    return this.chat.deleteSession(currentUser(request).sub, id);
  }

  @Get('sessions/archive/list')
  archived(@Req() request: Request, @Query('kind') kind?: string) { return this.chat.listArchivedSessions(currentUser(request).sub, kind); }

  @Post('sessions/:id/restore')
  restore(@Req() request: Request, @Param('id') id: string) { return this.chat.restoreSession(currentUser(request).sub, id); }

  @Get('sessions/:id/messages')
  messages(@Req() request: Request, @Param('id') id: string) {
    return this.chat.listMessages(currentUser(request).sub, id);
  }

  @Post('sessions/:id/messages/stream')
  async stream(
    @Req() request: Request,
    @Res() response: Response,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createMessageInputSchema)) input: CreateMessageInput
  ) {
    const user = currentUser(request);
    const session = await this.chat.getOwnedSession(user.sub, id);
    if (session.kind === 'chat') await this.billing.assertCanStartChat(user.sub);
    const history = await this.chat.listMessages(user.sub, id);
    const userMessage = await this.chat.addUserMessage(user.sub, id, input);

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    response.write(`event: accepted\ndata: ${JSON.stringify(userMessage)}\n\n`);

    try {
      const abortController = new AbortController();
      request.once('close', () => abortController.abort());
      let answer = '';
      const usage: SettledModelUsage[] = [];
      const trace: string[] = [];
      const sendReasoning = (label: string) => {
        const safeLabel = label.replace(/(?:\.env|api[_ -]?key|token|password|secret)\S*/gi, '[已隐藏]').replace(/([A-Za-z]:)?[\\/][^\s]{1,180}/g, '[路径已隐藏]').slice(0, 500);
        if (safeLabel && trace.at(-1) !== safeLabel) trace.push(safeLabel);
        response.write(`event: reasoning\ndata: ${JSON.stringify({ label: safeLabel })}\n\n`);
      };
      const attachmentTexts = await Promise.all((input.attachments ?? []).map(async (attachment) => {
      const text = await this.storage.attachmentText(attachment.url, attachment.mimeType).catch(() => null);
      return text ? `\n\n附件 ${attachment.name}（URL: ${attachment.url}）：\n${text}` : `\n\n附件：${attachment.name}（${attachment.mimeType}，URL: ${attachment.url}，二进制文件可使用 copy_uploaded_file 复制）`;
    }));
      const enrichedContent = `${input.content || '请分析附件。'}${attachmentTexts.join('')}`;
      if (session.kind === 'image') {
      const workspaceId = request.header('x-wisadel-workspace-id');
      const localContext = workspaceId ? { userId: user.sub, workspaceId } : undefined;
      const useGeneralAgent = /读取|查看.*文件|修改.*文件|搜索.*网页|浏览.*网页|运行.*命令|工作区|写作|代码|脚本/.test(enrichedContent);
      if (useGeneralAgent) {
        sendReasoning('图像 Agent：切换到完整工具对话');
        for await (const chunk of this.router.stream('grok-4.5', history, enrichedContent, sendReasoning, (item) => usage.push(item), localContext, '你处于 Stable Diffusion 工作区。保留完整 Agent 工具能力；涉及图像生成时，先检查本机 SD 环境、模型与参数，再给出可执行步骤。', abortController.signal)) {
          answer += chunk;
          response.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        }
      } else {
      sendReasoning('正在理解创作需求');
      const currentParams = input.currentParams ?? DEFAULT_SD_PARAMS;
      sendReasoning('正在读取 Stable Diffusion 组件');
      const capabilities = await this.sd.capabilities().catch(() => undefined);
      sendReasoning('正在整理提示词与生成参数');
      const attachmentImages = (input.attachments ?? []).filter((item) => item.mimeType.startsWith('image/')).map((item) => item.url);
      const imageUrls = [...new Set([...(input.imageUrls ?? []), ...attachmentImages])].slice(0, 4);
      const action = await this.qwen.extract(enrichedContent, currentParams, imageUrls, capabilities);
      if (action.reasoningSummary) sendReasoning(action.reasoningSummary);
      answer = action.reply;
      response.write(`event: params\ndata: ${JSON.stringify(action)}\n\n`);
      if (action.action === 'generate' && !action.requiresConfirmation) {
        sendReasoning('正在提交图像生成任务');
        const params = sdParamsSchema.parse({ ...currentParams, ...action.params });
        const task = await this.images.create(user.sub, {
          sessionId: id,
          clientId: `agent-${userMessage.id}`,
          params
        });
        response.write(`event: image_task\ndata: ${JSON.stringify(task)}\n\n`);
      }
      for (const chunk of answer.match(/.{1,8}/gu) ?? [answer]) {
        response.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
      }
      } else {
      const workspaceId = request.header('x-wisadel-workspace-id');
      const localContext = workspaceId ? { userId: user.sub, workspaceId } : undefined;
      const workspace = workspaceId ? (await this.workspaces.list(user.sub)).find((item) => item.id === workspaceId && item.trust === 'TRUSTED') : undefined;
      const settings = workspace?.settings;
      const profile = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings.agentProfile as { instructions?: string } | undefined : undefined;
      const explicitLocalPath = enrichedContent.match(/[A-Za-z]:\\[^\r\n，。！？]+/)?.[0]?.replace(/[。！？]+$/, '').trim();
      const pathGuidance = explicitLocalPath ? `USER-PROVIDED LOCAL PATH: ${explicitLocalPath}\nIf this path is inside the currently trusted workspace, use list_files/read_file directly. If it is outside, call request_workspace_change with path set exactly to this value; do not ask the user to upload files or manually repeat the path.` : undefined;
      const agentInstructions = [profile?.instructions, pathGuidance].filter(Boolean).join('\n\n') || undefined;
      if (this.writingSkill.matches(enrichedContent)) {
        const result = await this.writingSkill.run({ prompt: enrichedContent, history, userId: user.sub, workspaceId, onProgress: sendReasoning, onUsage: (item) => usage.push(item) });
        for (const chunk of result.content.match(/[\s\S]{1,16}/g) ?? [result.content]) {
          answer += chunk;
          response.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        }
      } else {
        if (history.length > 18) sendReasoning(`Summary Agent 正在压缩 ${history.length - 18} 条历史消息`);
        for await (const chunk of this.router.stream(session.model, history, enrichedContent, sendReasoning, (item) => usage.push(item), localContext, agentInstructions, abortController.signal)) {
          answer += chunk;
          response.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
        }
      }
      }
      const assistant = await this.chat.addAssistantMessage(id, answer, trace.slice(-20));
      const titledSession = await this.chat.autoTitle(user.sub, id, input.content, answer);
      response.write(`event: session\ndata: ${JSON.stringify(titledSession)}\n\n`);
      if (session.kind === 'chat' && usage.length) {
      const entries = await this.billing.settleChatUsage(user.sub, usage);
      const latest = entries.at(-1);
      if (latest) response.write(`event: sanity\ndata: ${JSON.stringify({ balanceMilli: latest.balanceAfterMilli, costMilli: -latest.deltaMilli })}\n\n`);
      }
      response.write(`event: done\ndata: ${JSON.stringify(assistant)}\n\n`);
      response.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : '模型服务暂时不可用';
      response.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      response.end();
    }
  }
}
