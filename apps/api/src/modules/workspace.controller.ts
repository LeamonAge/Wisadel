import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService) {}
  @Get() list(@Req() request: Request) { return this.workspaces.list(currentUser(request).sub); }
  @Post() register(@Req() request: Request, @Body() body: { path: string; name?: string }) { return this.workspaces.register(currentUser(request).sub, body); }
  @Patch(':id/trust') trust(@Req() request: Request, @Param('id') id: string, @Body('trust') trust: 'TRUSTED' | 'UNTRUSTED') { return this.workspaces.trust(currentUser(request).sub, id, trust); }
  @Patch(':id/settings') settings(@Req() request: Request, @Param('id') id: string, @Body() settings: Record<string, unknown>) { return this.workspaces.updateSettings(currentUser(request).sub, id, settings); }
  @Get(':id/audit') audit(@Req() request: Request, @Param('id') id: string) { return this.workspaces.auditLog(currentUser(request).sub, id); }
  @Get('audit') allAudit(@Req() request: Request, @Query('workspaceId') workspaceId?: string) { return this.workspaces.auditLog(currentUser(request).sub, workspaceId); }
}
