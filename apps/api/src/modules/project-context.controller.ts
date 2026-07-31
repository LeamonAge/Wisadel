import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { ProjectContextService } from './project-context.service';
@Controller('workspaces/:workspaceId/context')
@UseGuards(AuthGuard)
export class ProjectContextController {
  constructor(private readonly projects: ProjectContextService) {}
  @Get() get(@Req() request: Request, @Param('workspaceId') workspaceId: string) { return this.projects.context(currentUser(request).sub, workspaceId); }
}
