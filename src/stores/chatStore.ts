import { create } from 'zustand';
import { Message, Chat } from '../types';
import { streamChat, generateTitle } from '../services/api';

const CHATS_KEY = 'chats_v2';
const MAX_CHATS = 100;

let _chatIdCounter = 0;
let _abortController: AbortController | null = null;

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  streamingContent: string;
  thinkingContent: string;
  isStreaming: boolean;

  load: () => Promise<void>;
  createChat: (model?: string) => string;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  setActiveChat: (id: string) => void;

  sendMessage: (content: string) => Promise<void>;
  abortMessage: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  streamingContent: '',
  thinkingContent: '',
  isStreaming: false,

  load: async () => {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      if (raw) set({ chats: JSON.parse(raw) });
    } catch {}
  },

  createChat: (model = 'deepseek-v4-pro') => {
    const id = `chat_${Date.now()}_${++_chatIdCounter}`;
    const chat: Chat = {
      id, title: 'New Chat', messages: [],
      created: Date.now(), updated: Date.now(), model,
    };
    set((s) => {
      const chats = [chat, ...s.chats];
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      return { chats, activeChatId: id };
    });
    return id;
  },

  deleteChat: (id) => {
    set((s) => {
      const chats = s.chats.filter((c) => c.id !== id);
      const activeChatId = s.activeChatId === id
        ? (chats[0]?.id || null) : s.activeChatId;
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      return { chats, activeChatId };
    });
  },

  renameChat: (id, title) => {
    set((s) => {
      const chats = s.chats.map((c) =>
        c.id === id ? { ...c, title, updated: Date.now() } : c);
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      return { chats };
    });
  },

  setActiveChat: (id) => set({ activeChatId: id }),

  // ===== 发送消息 =====
  sendMessage: async (content: string) => {
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    const state = get();
    let chatId = state.activeChatId;
    if (!chatId) chatId = state.createChat();

    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user', content,
      timestamp: Date.now(),
    };
    const isFirst = chat.messages.length === 0;

    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, userMsg], updated: Date.now() } : c),
      isStreaming: true,
      streamingContent: '',
      thinkingContent: '',
    }));

    try {
      const msgs = [
        { role: 'system', content: '你是"理智"，一个由 LeamonAge 创建的 AI 助手。回答简洁、准确、专业。' },
        ...chat.messages.concat(userMsg).map((m) => ({ role: m.role, content: m.content })),
      ];

      let full = '';
      let thinking = '';

      await streamChat(
        msgs, chat.model,
        (chunk) => {
          if (_abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (chunk.type === 'content') {
            full += chunk.text;
            set({ streamingContent: full });
          } else {
            thinking += chunk.text;
            set({ thinkingContent: thinking });
          }
        },
        _abortController.signal,
      );

      if (_abortController?.signal.aborted) return;

      const aiMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'assistant', content: full,
        timestamp: Date.now(),
        thinkingContent: thinking || undefined,
      };

      let title = chat.title;
      if (isFirst) {
        title = content.length > 30 ? content.slice(0, 30) + '...' : content;
        generateTitle(content).then((t) => {
          if (t) get().renameChat(chatId!, t);
        });
      }

      set((s) => {
        const chats = s.chats.map((c) =>
          c.id === chatId
            ? { ...c, title, messages: [...c.messages, aiMsg], updated: Date.now() } : c);
        localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        return { chats, streamingContent: '', thinkingContent: '' };
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || _abortController?.signal.aborted) return;

      let msg = err.message || '未知错误';
      if (err.name === 'TypeError' || err.message?.includes('network') || err.message?.includes('fetch')) {
        msg = '网络连接失败，请检查网络后重试';
      } else if (err.message?.includes('timeout')) {
        msg = '请求超时，请稍后重试';
      }

      const errMsg: Message = {
        id: `e_${Date.now()}`,
        role: 'assistant', content: `❌ ${msg}`,
        timestamp: Date.now(),
      };

      set((s) => {
        const chats = s.chats.map((c) =>
          c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c);
        localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        return { chats };
      });
    } finally {
      set({ isStreaming: false, streamingContent: '', thinkingContent: '' });
      _abortController = null;
    }
  },

  abortMessage: () => {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    const state = get();
    if (state.isStreaming && state.streamingContent) {
      const partial: Message = {
        id: `c_${Date.now()}`,
        role: 'assistant', content: state.streamingContent + '\n\n_（已中断）_',
        timestamp: Date.now(),
        thinkingContent: state.thinkingContent || undefined,
      };
      set((s) => {
        const chats = s.chats.map((c) =>
          c.id === state.activeChatId
            ? { ...c, messages: [...c.messages, partial] } : c);
        localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        return { chats };
      });
    }
    set({ isStreaming: false, streamingContent: '', thinkingContent: '' });
  },
}));
