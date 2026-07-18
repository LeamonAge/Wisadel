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
    private readonly billing: BillingService
  ) {}

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

  @Delete('sessions/:id')
  remove(@Req() request: Request, @Param('id') id: string) {
    return this.chat.deleteSession(currentUser(request).sub, id);
  }

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

    let answer = '';
    const usage: SettledModelUsage[] = [];
    const sendReasoning = (label: string) => response.write(`event: reasoning\ndata: ${JSON.stringify({ label })}\n\n`);
    const attachmentTexts = await Promise.all((input.attachments ?? []).map(async (attachment) => {
      const text = await this.storage.attachmentText(attachment.url, attachment.mimeType).catch(() => null);
      return text ? `\n\n附件 ${attachment.name}（URL: ${attachment.url}）：\n${text}` : `\n\n附件：${attachment.name}（${attachment.mimeType}，URL: ${attachment.url}，二进制文件可使用 copy_uploaded_file 复制）`;
    }));
    const enrichedContent = `${input.content || '请分析附件。'}${attachmentTexts.join('')}`;
    if (session.kind === 'image') {
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
    } else {
      for await (const chunk of this.deepseek.stream(history, enrichedContent, sendReasoning, (item) => usage.push(item))) {
        answer += chunk;
        response.write(`event: delta\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    }
    const assistant = await this.chat.addAssistantMessage(id, answer);
    if (session.kind === 'chat' && usage.length) {
      const entries = await this.billing.settleChatUsage(user.sub, usage);
      const latest = entries.at(-1);
      if (latest) response.write(`event: sanity\ndata: ${JSON.stringify({ balanceMilli: latest.balanceAfterMilli, costMilli: -latest.deltaMilli })}\n\n`);
    }
    response.write(`event: done\ndata: ${JSON.stringify(assistant)}\n\n`);
    response.end();
  }
}
