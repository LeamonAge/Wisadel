import { Controller, Get, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, currentUser } from '../shared/auth.guard';
import { PersistenceService } from '../shared/persistence.service';
import { QueueService } from '../shared/queue.service';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly store: PersistenceService, private readonly queue: QueueService) {}

  @Get('overview')
  async overview(@Req() request: Request) {
    if (currentUser(request).role !== 'admin') throw new ForbiddenException('需要管理员权限');
    const counts = await this.store.adminOverview();
    const queue = await this.queue.counts();
    return {
      ...counts,
      queue,
      services: { api: 'up', database: this.store.integrated ? 'up' : 'mock', redis: this.queue.integrated ? 'up' : 'mock', stableDiffusion: 'not-connected' }
    };
  }

  @Get('users')
  users(@Req() request: Request) {
    if (currentUser(request).role !== 'admin') throw new ForbiddenException('需要管理员权限');
    return this.store.listUsers();
  }
}
