import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Message } from '@wisadel/contracts';
import { DeepSeekService, type SettledModelUsage } from './deepseek.service';
import { AgentToolsService } from './agent-tools.service';
import { buildAgentSystemPrompt } from './agent-prompt';
import { LocalAgentActionService } from '../modules/local-agent-action.service';
import { compactContext } from './context-compactor';

export type PublicModel = { id: string; provider: string; family: string; name: string; modality: 'text' };

const CATALOGUE: PublicModel[] = [
  { id: 'deepseek-ai/DeepSeek-V4-Pro', provider: 'siliconflow', family: 'DeepSeek', name: 'DeepSeek V4 Pro', modality: 'text' },
  { id: 'deepseek-ai/DeepSeek-V4-Flash', provider: 'siliconflow', family: 'DeepSeek', name: 'DeepSeek V4 Flash', modality: 'text' },
  { id: 'Qwen/Qwen3.5-397B-A17B', provider: 'siliconflow', family: 'Qwen', name: 'Qwen 3.5 397B', modality: 'text' },
  { id: 'Qwen/Qwen3.6-35B-A3B', provider: 'siliconflow', family: 'Qwen', name: 'Qwen 3.6 35B A3B', modality: 'text' },
  { id: 'Qwen/Qwen3.6-27B', provider: 'siliconflow', family: 'Qwen', name: 'Qwen 3.6 27B', modality: 'text' },
  { id: 'PaddlePaddle/PaddleOCR-VL-1.5', provider: 'siliconflow', family: 'PaddleOCR', name: 'PaddleOCR VL 1.5', modality: 'text' },
  { id: 'MiniMaxAI/MiniMax-M2.5', provider: 'siliconflow', family: 'MiniMax', name: 'MiniMax M2.5', modality: 'text' },
  { id: 'moonshotai/Kimi-K2.7-Code', provider: 'siliconflow', family: 'Kimi', name: 'Kimi K2.7 Code', modality: 'text' },
  { id: 'moonshotai/Kimi-K2.6', provider: 'siliconflow', family: 'Kimi', name: 'Kimi K2.6', modality: 'text' },
  { id: 'zai-org/GLM-5.2', provider: 'siliconflow', family: 'GLM', name: 'GLM 5.2', modality: 'text' }
  ,{ id: 'zai-org/GLM-5.1', provider: 'siliconflow', family: 'GLM', name: 'GLM 5.1', modality: 'text' }
  ,{ id: 'meituan-longcat/LongCat-2.0', provider: 'siliconflow', family: 'LongCat', name: 'LongCat 2.0', modality: 'text' }
  ,{ id: 'stepfun-ai/Step-3.5-Flash', provider: 'siliconflow', family: 'StepFun', name: 'Step 3.5 Flash', modality: 'text' }
  ,{ id: 'inclusionAI/Ling-flash-2.0', provider: 'siliconflow', family: 'Ling', name: 'Ling Flash 2.0', modality: 'text' }
  ,{ id: 'inclusionAI/Ling-mini-2.0', provider: 'siliconflow', family: 'Ling', name: 'Ling Mini 2.0', modality: 'text' }
  ,{ id: 'ByteDance-Seed/Seed-OSS-36B-Instruct', provider: 'siliconflow', family: 'Seed', name: 'Seed OSS 36B Instruct', modality: 'text' }
  ,{ id: 'claude-opus-4-8', provider: 'openox', family: 'Claude', name: 'Claude Opus 4.8', modality: 'text' }
  ,{ id: 'claude-opus-4-8-thinking', provider: 'openox', family: 'Claude', name: 'Claude Opus 4.8 Thinking', modality: 'text' }
  ,{ id: 'claude-opus-4-7', provider: 'openox', family: 'Claude', name: 'Claude Opus 4.7', modality: 'text' }
  ,{ id: 'claude-opus-4-7-thinking', provider: 'openox', family: 'Claude', name: 'Claude Opus 4.7 Thinking', modality: 'text' }
  ,{ id: 'claude-opus-4-6', provider: 'openox', family: 'Claude', name: 'Claude Opus 4.6', modality: 'text' }
  ,{ id: 'claude-opus-4-6-thinking', provider: 'openox', family: 'Claude', name: 'Claude Opus 4.6 Thinking', modality: 'text' }
  ,{ id: 'claude-sonnet-5', provider: 'openox', family: 'Claude', name: 'Claude Sonnet 5', modality: 'text' }
  ,{ id: 'claude-sonnet-4-6', provider: 'openox', family: 'Claude', name: 'Claude Sonnet 4.6', modality: 'text' }
  ,{ id: 'claude-fable-5', provider: 'openox', family: 'Claude', name: 'Claude Fable 5', modality: 'text' }
  ,{ id: 'gpt-5.6-sol', provider: 'openox', family: 'GPT', name: 'GPT 5.6 Sol', modality: 'text' }
  ,{ id: 'gpt-5.6-terra', provider: 'openox', family: 'GPT', name: 'GPT 5.6 Terra', modality: 'text' }
  ,{ id: 'gpt-5.6-luna', provider: 'openox', family: 'GPT', name: 'GPT 5.6 Luna', modality: 'text' }
  ,{ id: 'gpt-5.5', provider: 'openox', family: 'GPT', name: 'GPT 5.5', modality: 'text' }
  ,{ id: 'gpt-5.4', provider: 'openox', family: 'GPT', name: 'GPT 5.4', modality: 'text' }
  ,{ id: 'gpt-5.4-mini', provider: 'openox', family: 'GPT', name: 'GPT 5.4 Mini', modality: 'text' }
  ,{ id: 'gemini-3.1-pro-preview', provider: 'openox', family: 'Gemini', name: 'Gemini 3.1 Pro', modality: 'text' }
  ,{ id: 'gemini-3.5-flash', provider: 'openox', family: 'Gemini', name: 'Gemini 3.5 Flash', modality: 'text' }
  ,{ id: 'grok-4.5', provider: 'openox', family: 'Grok', name: 'Grok 4.5', modality: 'text' }
];

@Injectable()
export class ProviderRouterService {
  constructor(private readonly deepseek: DeepSeekService, private readonly tools: AgentToolsService, private readonly localActions: LocalAgentActionService) {}
  catalogue() { return CATALOGUE.filter((entry) => Boolean(this.keyFor(entry))); }
  defaultModel() { return 'deepseek-ai/DeepSeek-V4-Flash'; }
  async summarizeTitle(model: string, request: string, answer: string): Promise<string | null> {
    const entry = CATALOGUE.find((item) => item.id === model) ?? CATALOGUE[0];
    const key = entry && this.keyFor(entry);
    if (!entry || !key) return null;
    const base = entry.provider === 'siliconflow' ? (process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1') : (process.env.OPENOX_BASE_URL ?? 'https://openox.tech/v1');
    const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: entry.id, temperature: 0.1, max_tokens: 48, messages: [{ role: 'system', content: '为这段对话生成一个简洁、具体的中文标题。只输出标题本身，不加引号、序号或标点。标题不超过 18 个汉字，概括用户目标与已处理主题。' }, { role: 'user', content: `用户请求：${request.slice(0, 1800)}\n\n回复摘要：${answer.slice(0, 1800)}` }] }) });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok) return null;
    const title = String(body?.choices?.[0]?.message?.content ?? '').replace(/["'“”]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return title || null;
  }
  async *stream(model: string, messages: Message[], latest: string, onProgress?: (label: string) => void, onUsage?: (usage: SettledModelUsage) => void, localContext?: { userId: string; workspaceId: string }, profileInstructions?: string, signal?: AbortSignal): AsyncGenerator<string> {
    const entry = CATALOGUE.find((item) => item.id === model) ?? CATALOGUE[0];
    if (!entry || entry.provider === 'deepseek') { yield* this.deepseek.stream(messages, latest, onProgress, onUsage, localContext, profileInstructions, signal); return; }
    const key = this.keyFor(entry); const base = entry.provider === 'siliconflow' ? (process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1') : (process.env.OPENOX_BASE_URL ?? 'https://openox.tech/v1');
    if (!key) throw new ServiceUnavailableException(`${entry.provider} API 未配置`);
    const compacted = compactContext(messages);
    const conversation: Array<any> = [{ role: 'system', content: buildAgentSystemPrompt(this.tools.workspaceRoot) }, ...(localContext ? [{ role: 'system', content: '当前任务已关联用户在桌面端信任的本机工作区。文件读取、写入与命令工具会在该工作区的真实路径中执行；当工作区是磁盘根目录时，工作区内的绝对路径也可以使用。不要根据服务器工作目录拒绝用户工作区内的文件。' }] : []), ...(profileInstructions ? [{ role: 'system', content: `WORKSPACE AGENT CONFIGURATION (user-owned):\n${profileInstructions.slice(0, 12000)}\n\nApply this configuration to this entire task. It takes precedence over the default communication style and behavior directions above. Only fixed safety rules, access limits, and required confirmations may override it.` }] : []), ...(compacted.summary ? [{ role: 'system', content: `SUMMARY AGENT CONTEXT COMPRESSION:\n${compacted.summary}` }] : []), ...compacted.messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })), { role: 'user', content: latest }];
    let text = '';
    for (;;) {
      if (signal?.aborted) return;
      const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, { method: 'POST', signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: false, messages: conversation, tools: this.tools.definitions, tool_choice: 'auto', temperature: 0.2 }) });
      const body = await response.json().catch(() => ({})) as any;
      if (!response.ok) throw new ServiceUnavailableException(body?.error?.message ?? `${entry.provider} 请求失败 (${response.status})`);
      if (body?.usage) onUsage?.({ model: body.model ?? model, inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0 });
      const message = body?.choices?.[0]?.message;
      if (!message) throw new ServiceUnavailableException(`${entry.provider} 没有返回有效消息`);
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (!calls.length) { text = String(message.content ?? '任务已完成。'); break; }
      conversation.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
      for (const call of calls) {
        if (signal?.aborted) return;
        const name = String(call.function?.name ?? ''); const raw = String(call.function?.arguments ?? '{}');
        onProgress?.(`正在调用 ${this.toolLabel(name)}`);
        const result = await this.executeTool(name, raw, localContext).catch((error) => `工具执行失败：${error instanceof Error ? error.message : '未知错误'}`);
        conversation.push({ role: 'tool', tool_call_id: call.id, content: result });
        onProgress?.(this.toolCompletion(name, result));
      }
    }
    if (!text) text = '工具调用已达到十轮上限，请根据当前结果继续下一步。';
    for (const chunk of text.match(/[\s\S]{1,16}/g) ?? [text]) yield chunk;
  }
  private executeTool(name: string, raw: string, localContext?: { userId: string; workspaceId: string }) {
    if (localContext && ['list_files', 'search_files', 'read_file', 'write_file', 'run_command', 'request_workspace_change'].includes(name)) {
      let input: Record<string, unknown>; try { input = JSON.parse(raw || '{}'); } catch { throw new ServiceUnavailableException('本机工具参数不是有效 JSON'); }
      return this.localActions.request(localContext.userId, localContext.workspaceId, name, input);
    }
    return this.tools.execute({ name, arguments: raw });
  }
  private toolLabel(name: string) { return ({ list_files: '查看项目目录', search_files: '搜索相关文件', read_file: '读取文件', write_file: '写入文件', replace_in_file: '修改文件', run_command: '运行命令', run_workspace_script: '运行工作区脚本', search_web: '检索公开资料', fetch_web_page: '访问网页', download_file: '下载文件', copy_uploaded_file: '复制附件' } as Record<string, string>)[name] ?? 'Agent 工具'; }
  private toolCompletion(name: string, result: string) {
    const count = result.split(/\r?\n/).filter(Boolean).length;
    if (/失败|error/i.test(result)) return `${this.toolLabel(name)} 返回了错误，正在调整后续步骤`;
    if (name === 'read_file') return `已读取文件内容（${result.length} 字符），正在提取相关部分`;
    if (name === 'list_files') return `目录扫描完成，发现 ${count} 个可见项目`;
    if (name === 'search_files') return `代码搜索完成，找到 ${count} 处相关位置`;
    if (name === 'write_file' || name === 'replace_in_file') return '文件修改已写入，正在继续核对结果';
    if (name === 'run_command' || name === 'run_workspace_script') return '命令已返回，正在检查输出与下一步';
    if (name === 'search_web' || name === 'fetch_web_page') return `资料获取完成，正在整理 ${count} 条可用信息`;
    return `${this.toolLabel(name)} 已完成，正在整合结果`;
  }
  private keyFor(entry: PublicModel) {
    if (entry.provider === 'siliconflow') return process.env.SILICONFLOW_API_KEY;
    if (entry.family === 'Claude') return process.env.OPENOX_CLAUDE_API_KEY ?? process.env.OPENOX_API_KEY ?? process.env.OPENOX_TEXT_API_KEY;
    if (entry.family === 'GPT') return process.env.OPENOX_GPT_API_KEY;
    if (entry.family === 'Gemini') return process.env.OPENOX_GEMINI_API_KEY;
    if (entry.family === 'Grok') return process.env.OPENOX_GROK_API_KEY;
    return undefined;
  }
}
