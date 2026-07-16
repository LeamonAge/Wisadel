const BUILTIN_KEY_HINT = 'builtin_key_v1';

async function getApiKey(): Promise<string> {
  try {
    const existing = localStorage.getItem(BUILTIN_KEY_HINT);
    if (existing && existing !== 'init') return existing;
  } catch {}

  const key = [
    'sk-f2d',
    '19aa60',
    '65f44ea',
    '8f071f2',
    'c73aa9405',
  ].join('');
  try {
    localStorage.setItem(BUILTIN_KEY_HINT, key);
  } catch {}
  return key;
}

const ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

interface StreamChunk {
  type: 'content' | 'thinking';
  text: string;
}

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  model: string,
  onChunk: (chunk: StreamChunk) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  const apiKey = await getApiKey();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      const controller = new AbortController();
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          lastError = new Error('服务器繁忙，重试中...');
          continue;
        }
        throw new Error(`API 错误 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onChunk({ type: 'content', text: delta.content });
            }
            if (delta?.reasoning_content) {
              onChunk({ type: 'thinking', text: delta.reasoning_content });
            }
          } catch {}
        }
      }

      return fullContent;
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Aborted') {
        throw new DOMException('Aborted', 'AbortError');
      }
      lastError = err;
      if (attempt < MAX_RETRIES && (
        err.name === 'TypeError' || err.message?.includes('network') || err.message?.includes('timeout')
      )) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('请求失败');
}

// 生成标题
export async function generateTitle(userMessage: string): Promise<string> {
  try {
    const apiKey = await getApiKey();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: '生成一个不超过15字的中文对话标题。只输出标题。' },
          { role: 'user', content: userMessage.slice(0, 500) },
        ],
        max_tokens: 30,
        temperature: 0.3,
      }),
    });
    if (!response.ok) return userMessage.slice(0, 30);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || userMessage.slice(0, 30);
  } catch {
    return userMessage.slice(0, 30);
  }
}
