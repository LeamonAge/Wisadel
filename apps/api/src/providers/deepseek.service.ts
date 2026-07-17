import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Message } from '@wisadel/contracts';
import { AgentToolsService } from './agent-tools.service';

type ProviderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
};

@Injectable()
export class DeepSeekService {
  constructor(private readonly tools: AgentToolsService) {}

  get configured() { return Boolean(process.env.DEEPSEEK_API_KEY); }

  async *stream(messages: Message[], latest: string, onProgress?: (label: string) => void): AsyncGenerator<string> {
    if ((process.env.AI_MODE ?? 'mock') === 'mock' || !this.configured) {
      const text = `这是 Wisadel 的本地模拟回复。我已经收到：${latest}。配置 DeepSeek 环境变量后，这里会切换为真实 Agent。`;
      for (const chunk of text.match(/.{1,8}/gu) ?? [text]) { yield chunk; await new Promise((resolve) => setTimeout(resolve, 20)); }
      return;
    }

    const conversation: ProviderMessage[] = [
      {
        role: 'system',
        content: `你是 Wisadel，一套能力可比肩《流浪地球》中 MOSS 的高级 AI 工作台，底层由 DeepSeek 提供推理能力。你不仅回答问题，还能使用工具访问公开网页，并在授权工作区 ${this.tools.workspaceRoot} 内检索、读取和修改本地文件。

当用户要求查看、修改或运行本地项目时，必须实际调用工具，不得只提供示例代码，也不得声称自己无法操作。用户已经启用持久的用户级 Agent 权限：可以运行程序、PowerShell、Python、Node、npm、git，下载公开网络文件，安装用户级依赖并执行工作区脚本。先检查现有结构，再进行范围明确的操作，完成后核验结果。对不确定的角色、作品、游戏、动画、漫画或时效性信息，先调用 search_web；游戏、动画、漫画和角色设定优先 source=bilibili，短视频热点优先 source=douyin。聊天附件会在用户消息中给出名称、类型和 URL；需要把附件放入工作区目录时，直接调用 copy_uploaded_file。需要下载文件时使用 download_file；需要运行工具或安装依赖时使用 run_command；已有脚本可使用 run_workspace_script。不得声称没有执行能力，绝不捏造工具结果。不要请求管理员提权，不要尝试读取或导出 API 密钥、凭据和服务环境变量。

文件工具仅限授权工作区。不得尝试读取环境变量、.env、凭据、密钥或绕过路径限制。不要覆盖与任务无关的内容。网页工具用于读取用户提供或任务需要的公开网页，不得探测本机、局域网或云元数据地址。使用自信、冷静、简洁且准确的中文回答。`
      },
      ...messages.slice(-18).map((message): ProviderMessage => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })),
      { role: 'user', content: latest }
    ];

    try {
      onProgress?.('正在分析任务');
      let finalText = '';
      const callCounts = new Map<string, number>();
      let stopReason = '';
      for (let turn = 0; turn < 10; turn += 1) {
        const reply = await this.complete(conversation);
        const toolCalls = reply.tool_calls ?? [];
        if (!toolCalls.length) {
          finalText = reply.content?.trim() || '任务已经处理完成。';
          break;
        }

        conversation.push({ role: 'assistant', content: reply.content ?? null, tool_calls: toolCalls });
        if (reply.content?.trim()) onProgress?.(reply.content.trim().replace(/\s+/g, ' ').slice(0, 300));
        for (const call of toolCalls) {
          onProgress?.(this.toolLabel(call.function.name, call.function.arguments));
          const signature = `${call.function.name}:${call.function.arguments}`;
          const count = (callCounts.get(signature) ?? 0) + 1;
          callCounts.set(signature, count);
          if (count > 2) {
            conversation.push({ role: 'tool', tool_call_id: call.id, content: '已阻止重复工具调用：相同操作连续执行不会产生新结果。请基于已有结果结束任务。' });
            stopReason = '检测到重复工具调用';
            continue;
          }
          let result: string;
          try {
            result = await this.tools.execute(call.function);
          } catch (error) {
            result = `工具执行失败：${error instanceof Error ? error.message : '未知错误'}`;
          }
          conversation.push({ role: 'tool', tool_call_id: call.id, content: result });
        }
        if (stopReason) break;
      }
      if (!finalText) {
        onProgress?.('正在整理执行结果');
        conversation.push({
          role: 'system',
          content: `工具执行阶段已经结束（${stopReason || '达到 10 轮安全上限'}）。现在禁止继续调用工具。请根据已有工具结果直接给出最终答复：说明实际完成的修改、尚未完成的部分及具体原因；不要声称仍需调用工具，也不要输出“工具调用达到上限”。`
        });
        const closing = await this.complete(conversation, false);
        finalText = closing.content?.trim() || '本轮工具执行已结束，但模型没有返回总结。已有修改将保留。';
      }
      for (const chunk of finalText.match(/[\s\S]{1,16}/g) ?? [finalText]) yield chunk;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(error instanceof Error ? `DeepSeek Agent 暂时不可用：${error.message}` : 'DeepSeek Agent 暂时不可用');
    }
  }

  private toolLabel(name: string, rawArguments: string) {
    let detail = '';
    try {
      const args = JSON.parse(rawArguments || '{}');
      detail = String(args.destination ?? args.path ?? args.query ?? args.url ?? '').slice(0, 120);
    } catch { /* provider arguments are validated by the tool layer */ }
    const label = ({ list_files: '查看项目目录', search_files: '搜索相关代码', read_file: '读取文件', write_file: '写入文件', replace_in_file: '修改文件', copy_uploaded_file: '复制聊天附件', run_workspace_script: '运行工作区脚本', run_command: '运行程序或命令', download_file: '下载文件', fetch_web_page: '访问网页', search_web: '检索公开资料' } as Record<string, string>)[name] ?? '执行工具';
    return detail ? `${label}：${detail}` : label;
  }

  private async complete(messages: ProviderMessage[], allowTools = true, model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'): Promise<ProviderMessage> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`${(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages,
          ...(allowTools ? { tools: this.tools.definitions, tool_choice: 'auto' } : {}),
          temperature: 0.2
        })
      });
      const body = await response.json().catch(() => undefined) as { choices?: Array<{ message?: ProviderMessage }>; error?: { message?: string } } | undefined;
      if (!response.ok) throw new ServiceUnavailableException(`DeepSeek 请求失败 (${response.status})${body?.error?.message ? `：${body.error.message}` : ''}`);
      const message = body?.choices?.[0]?.message;
      if (!message) throw new ServiceUnavailableException('DeepSeek 没有返回有效消息');
      if (!message.tool_calls?.length && /DSML|tool_calls>|invoke name=/i.test(message.content ?? '')) {
        const toolModel = process.env.DEEPSEEK_TOOL_MODEL ?? 'deepseek-chat';
        if (model !== toolModel) return this.complete(messages, allowTools, toolModel);
        throw new ServiceUnavailableException('当前 DeepSeek 模型返回了不兼容的工具协议，请配置支持标准 tool_calls 的模型');
      }
      return message;
    } finally { clearTimeout(timer); }
  }
}
