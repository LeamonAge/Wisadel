import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { PrismaService } from '../shared/prisma.service';

@Controller('local-agent-actions')
@UseGuards(AuthGuard)
export class LocalAgentActionController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('pending') async pending(@Req() request: Request, @Query('workspaceId') workspaceId: string) {
    const userId = currentUser(request).sub;
    return this.prisma.localAgentAction.findMany({ where: { userId, workspaceId, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 20 });
  }
  @Post(':id/complete') async complete(@Req() request: Request, @Param('id') id: string, @Body() body: { status: 'SUCCEEDED' | 'DENIED' | 'FAILED'; result?: unknown; error?: string }) {
    const userId = currentUser(request).sub;
    const action = await this.prisma.localAgentAction.findFirst({ where: { id, userId, status: { in: ['PENDING', 'RUNNING'] } } });
    if (!action) throw new NotFoundException('本机动作不存在或已处理');
    return this.prisma.localAgentAction.update({ where: { id }, data: { status: body.status, result: body.result as any, error: body.error?.slice(0, 4000) } });
  }
}
