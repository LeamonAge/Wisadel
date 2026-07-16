export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinkingContent?: string;
  isStreaming?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  created: number;
  updated: number;
  model: string;
}

export interface UserAccount {
  email: string;
  passwordHash: string;
  createdAt: number;
}
