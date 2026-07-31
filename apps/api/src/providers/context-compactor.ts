import type { Message } from '@wisadel/contracts';

export type CompactedContext = { messages: Message[]; summary?: string };

// Keep the recent turns verbatim and compress older turns into a bounded, auditable note.
export function compactContext(messages: Message[], recentCount = 18): CompactedContext {
  if (messages.length <= recentCount) return { messages };
  const older = messages.slice(0, -recentCount);
  const summary = older
    .map((message, index) => `${index + 1}. ${message.role === 'assistant' ? 'Agent' : '用户'}：${message.content.replace(/\s+/g, ' ').slice(0, 420)}`)
    .join('\n')
    .slice(0, 9_000);
  return { messages: messages.slice(-recentCount), summary };
}
