import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { createAgentTaskInputSchema, type CreateAgentTaskInput } from '@wisadel/contracts';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { ZodValidationPipe } from '../shared/zod-validation.pipe';
import { AgentTaskService } from './agent-task.service';

@Controller('agent-tasks')
@UseGuards(AuthGuard)
export class AgentTaskController {
  constructor(private readonly tasks: AgentTaskService) {}

  @Get()
  list(@Req() request: Request, @Query('sessionId') sessionId?: string) { return this.tasks.list(currentUser(request).sub, sessionId); }

  @Get(':id')
  get(@Req() request: Request, @Param('id') id: string) { return this.tasks.get(currentUser(request).sub, id); }

  @Post()
  create(@Req() request: Request, @Body(new ZodValidationPipe(createAgentTaskInputSchema)) input: CreateAgentTaskInput) { return this.tasks.create(currentUser(request).sub, input); }

  @Post(':id/retry')
  retry(@Req() request: Request, @Param('id') id: string) { return this.tasks.retry(currentUser(request).sub, id); }
}
