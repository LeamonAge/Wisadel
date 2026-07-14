// ===== API 源 =====
export interface ApiSource {
  id: string;
  name: string;
  type: 'builtin' | 'custom';
  endpoint: string;
  apiKey: string;
  models: string[];
  enabled: boolean;
}

// ===== 消息类型 =====
export type MessageType =
  | 'text'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'sanity_cost';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  sanityCost: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  type: MessageType;
  content: string;
  timestamp: number;
  thinkingContent?: string;
  toolCall?: ToolCall;
  sanityCost?: number;
}

// ===== 对话 =====
export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  created: number;
  updated: number;
  apiSourceId: string;
  model: string;
}

// ===== 理智系统 =====
export interface Transaction {
  id: string;
  type: 'consume' | 'recharge';
  amount: number;
  description: string;
  timestamp: number;
  relatedChatId?: string;
}

export interface SanityState {
  balance: number;
  totalConsumed: number;
  totalRecharged: number;
  transactions: Transaction[];
}

// ===== 文件信息 =====
export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
}

// ===== 系统配置 =====
export type SystemSettingType =
  | 'brightness'
  | 'volume'
  | 'wifi'
  | 'bluetooth'
  | 'screen_timeout'
  | 'dnd'
  | 'ringer_mode';

export interface SystemSetting {
  key: SystemSettingType;
  label: string;
  value: number | boolean | string;
  readable: boolean;
  writable: boolean;
}

// ===== API 请求/响应 =====
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    tool_call_id?: string;
  }>;
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none';
  stream: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AppSettings {
  activeApiSourceId: string;
  activeModel: string;
  sanityPerMessage: number;
  sanityPerFileRead: number;
  sanityPerFileWrite: number;
  sanityPerFileDelete: number;
  sanityPerSystemModify: number;
}
