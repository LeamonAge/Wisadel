import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';

@Injectable()
export class LocalAgentActionService {
  constructor(private readonly prisma: PrismaService) {}
  async request(userId: string, workspaceId: string, tool: string, input: Record<string, unknown>) {
    const workspace = await this.prisma.workspace.findFirst({ where: { id: workspaceId, userId, trust: 'TRUSTED' } });
    if (!workspace) throw new ServiceUnavailableException('未选择已信任的本机工作区，无法执行本机 Agent 操作');
    const action = await this.prisma.localAgentAction.create({ data: { userId, workspaceId, tool, input: input as any } });
    const deadline = Date.now() + 5 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((resolveResult) => setTimeout(resolveResult, 700));
      const current = await this.prisma.localAgentAction.findUnique({ where: { id: action.id } });
      if (!current) throw new ServiceUnavailableException('本机动作记录丢失');
      if (current.status === 'SUCCEEDED') return JSON.stringify(current.result ?? { ok: true });
      if (current.status === 'DENIED') throw new ServiceUnavailableException('用户拒绝了本机 Agent 操作');
      if (current.status === 'FAILED') throw new ServiceUnavailableException(current.error ?? '本机 Agent 操作失败');
    }
    await this.prisma.localAgentAction.update({ where: { id: action.id }, data: { status: 'FAILED', error: '等待桌面端执行超时' } });
    throw new ServiceUnavailableException('等待桌面端执行本机动作超时');
  }
}
