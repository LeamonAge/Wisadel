import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Message } from '@wisadel/contracts';
import { DeepSeekService, type SettledModelUsage } from './deepseek.service';

export type PublicModel = { id: string; provider: string; family: string; name: string; modality: 'text' };

const CATALOGUE: PublicModel[] = [
  { id: 'deepseek-chat', provider: 'deepseek', family: 'DeepSeek', name: 'DeepSeek Chat', modality: 'text' },
  { id: 'deepseek-ai/DeepSeek-V4-Pro', provider: 'siliconflow', family: 'DeepSeek', name: 'DeepSeek V4 Pro', modality: 'text' },
  { id: 'deepseek-ai/DeepSeek-V4-Flash', provider: 'siliconflow', family: 'DeepSeek', name: 'DeepSeek V4 Flash', modality: 'text' },
  { id: 'Qwen/Qwen3.5-397B-A17B', provider: 'siliconflow', family: 'Qwen', name: 'Qwen 3.5 397B', modality: 'text' },
  { id: 'MiniMaxAI/MiniMax-M2.5', provider: 'siliconflow', family: 'MiniMax', name: 'MiniMax M2.5', modality: 'text' },
  { id: 'claude-sonnet-5', provider: 'openox', family: 'Claude', name: 'Claude Sonnet 5', modality: 'text' },
  { id: 'gpt-5.6-sol', provider: 'openox', family: 'GPT', name: 'GPT 5.6 Sol', modality: 'text' },
  { id: 'gemini-3.1-pro-preview', provider: 'openox', family: 'Gemini', name: 'Gemini 3.1 Pro', modality: 'text' },
  { id: 'grok-4.5', provider: 'openox', family: 'Grok', name: 'Grok 4.5', modality: 'text' },
  { id: 'moonshotai/Kimi-K2.7-Code', provider: 'siliconflow', family: 'Kimi', name: 'Kimi K2.7 Code', modality: 'text' },
  { id: 'zai-org/GLM-5.2', provider: 'siliconflow', family: 'GLM', name: 'GLM 5.2', modality: 'text' }
];

@Injectable()
export class ProviderRouterService {
  constructor(private readonly deepseek: DeepSeekService) {}
  // The picker is a capability catalogue. A missing key is reported when that
  // particular model is used, rather than hiding the model family altogether.
  catalogue() { return CATALOGUE; }
  defaultModel() { return this.catalogue()[0]?.id ?? 'deepseek-chat'; }
  async *stream(model: string, messages: Message[], latest: string, onProgress?: (label: string) => void, onUsage?: (usage: SettledModelUsage) => void): AsyncGenerator<string> {
    const entry = CATALOGUE.find((item) => item.id === model) ?? CATALOGUE[0];
    if (!entry || entry.provider === 'deepseek') { yield* this.deepseek.stream(messages, latest, onProgress, onUsage); return; }
    const key = this.keyFor(entry.provider); const base = entry.provider === 'siliconflow' ? (process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1') : (process.env.OPENOX_BASE_URL ?? 'https://openox.tech/v1');
    if (!key) throw new ServiceUnavailableException(`${entry.provider} API 未配置`);
    const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: false, messages: [...messages.slice(-18).map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: latest }], temperature: 0.2 }) });
    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new ServiceUnavailableException(body?.error?.message ?? `${entry.provider} 请求失败 (${response.status})`);
    const text = String(body?.choices?.[0]?.message?.content ?? '');
    if (body?.usage) onUsage?.({ model: body.model ?? model, inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 });
    for (const chunk of text.match(/[\s\S]{1,16}/g) ?? [text]) yield chunk;
  }
  private keyFor(provider: string) { return provider === 'siliconflow' ? process.env.SILICONFLOW_API_KEY : process.env.OPENOX_API_KEY ?? process.env.OPENOX_TEXT_API_KEY; }
}
