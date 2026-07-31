import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { WritingMasterService } from './writing-master.service';

@Controller('writing-master')
@UseGuards(AuthGuard)
export class WritingMasterController {
  constructor(private readonly writing: WritingMasterService) {}
  @Post() write(@Req() request: Request, @Body() body: { prompt?: string; style?: string; history?: string }) {
    const prompt = body.prompt?.trim(); if (!prompt) throw new Error('写作请求不能为空');
    const user = currentUser(request); const workspaceId = request.header('x-wisadel-workspace-id') ?? undefined;
    return this.writing.write({ prompt, style: body.style ?? 'fantasy', history: body.history, userId: user.sub, workspaceId });
  }
}
