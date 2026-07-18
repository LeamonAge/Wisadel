import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { SanityLedgerEntry } from '@wisadel/contracts';
import { PersistenceService } from '../shared/persistence.service';

export type ModelUsage = { model: string; inputTokens: number; outputTokens: number };

@Injectable()
export class BillingService {
  constructor(private readonly store: PersistenceService) {}

  account(userId: string) {
    return this.store.sanityAccount(userId);
  }

  ledger(userId: string) {
    return this.store.listSanityLedger(userId);
  }

  async assertCanStartChat(userId: string) {
    const account = await this.account(userId);
    if (account.balanceMilli <= 0) throw new HttpException('理智余额不足，请等待后续额度补充。', HttpStatus.PAYMENT_REQUIRED);
  }

  async settleChatUsage(userId: string, usages: ModelUsage[]): Promise<SanityLedgerEntry[]> {
    const combined = new Map<string, { inputTokens: number; outputTokens: number }>();
    for (const usage of usages) {
      const current = combined.get(usage.model) ?? { inputTokens: 0, outputTokens: 0 };
      current.inputTokens += Math.max(0, Math.trunc(usage.inputTokens));
      current.outputTokens += Math.max(0, Math.trunc(usage.outputTokens));
      combined.set(usage.model, current);
    }
    const entries: SanityLedgerEntry[] = [];
    for (const [model, usage] of combined) {
      const rate = this.rateFor(model);
      const costMilli = Math.round((usage.inputTokens / 1000) * rate.input * 1000) + Math.round((usage.outputTokens / 1000) * rate.output * 1000);
      try {
        const entry = await this.store.settleSanityUsage({ userId, model, ...usage, costMilli });
        if (entry) entries.push(entry);
      } catch (error) {
        if (error instanceof Error && error.message === 'insufficient sanity') throw new HttpException('理智余额不足，请等待后续额度补充。', HttpStatus.PAYMENT_REQUIRED);
        throw error;
      }
    }
    return entries;
  }

  private rateFor(model: string) {
    const normalized = model.toLowerCase();
    if (normalized.includes('flash')) return { input: 0.13, output: 0.25 };
    if (normalized.includes('qwen')) return { input: 0.25, output: 0.63 };
    return { input: 0.5, output: 1 };
  }
}
