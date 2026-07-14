import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, Chat, ToolCall } from '../types';
import { getActiveApiSource, chatCompletion, getDefaultTools, generateChatTitle } from '../services/api';
import { consumeSanity, getSanityState } from '../services/sanity';
import { readFile, writeFile, listDirectory } from '../services/filesystem';
import { getSystemSetting, setSystemSetting } from '../services/system';
import { SanityCosts } from '../utils/constants';

const CHATS_KEY = 'chat_history';

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  isStreaming: boolean;
  thinkingContent: string;
  streamingContent: string;

  // 对话管理
  loadChats: () => Promise<void>;
  saveChats: () => Promise<void>;
  createChat: (apiSourceId: string, model: string) => string;
  deleteChat: (id: string) => void;
  renameChat: (id: string, newTitle: string) => void;
  setActiveChat: (id: string) => void;
  clearActiveChat: () => void;

  // 消息
  sendMessage: (content: string) => Promise<void>;
  clearThinking: () => void;
  clearStreaming: () => void;
}

let _chatIdCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  isStreaming: false,
  thinkingContent: '',
  streamingContent: '',

  // ===== 持久化 =====
  loadChats: async () => {
    try {
      const raw = await AsyncStorage.getItem(CHATS_KEY);
      if (raw) {
        const chats: Chat[] = JSON.parse(raw);
        set({ chats });
      }
    } catch {}
  },

  saveChats: async () => {
    try {
      const { chats } = get();
      // 只保留最近 50 个对话
      const trimmed = chats.slice(0, 50);
      await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(trimmed));
    } catch {}
  },

  // ===== 对话管理 =====
  createChat: (apiSourceId: string, model: string) => {
    const id = `chat_${Date.now()}_${++_chatIdCounter}`;
    const chat: Chat = {
      id,
      title: '新对话',
      messages: [],
      created: Date.now(),
      updated: Date.now(),
      apiSourceId,
      model,
    };
    set((s) => {
      const chats = [chat, ...s.chats];
      AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      return { chats, activeChatId: id };
    });
    return id;
  },

  deleteChat: (id: string) => {
    set((s) => {
      const chats = s.chats.filter((c) => c.id !== id);
      const activeChatId = s.activeChatId === id
        ? (chats.length > 0 ? chats[0].id : null)
        : s.activeChatId;
      AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      return { chats, activeChatId };
    });
  },

  renameChat: (id: string, newTitle: string) => {
    set((s) => {
      const chats = s.chats.map((c) =>
        c.id === id ? { ...c, title: newTitle, updated: Date.now() } : c
      );
      AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      return { chats };
    });
  },

  setActiveChat: (id: string) => set({ activeChatId: id }),

  clearActiveChat: () => set({ activeChatId: null }),

  // ===== 发送消息 =====
  sendMessage: async (content: string) => {
    const state = get();
    let chatId = state.activeChatId;
    if (!chatId) {
      chatId = state.createChat('deepseek', 'deepseek-v4-pro');
    }

    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) return;

    // 添加用户消息
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      type: 'text',
      content,
      timestamp: Date.now(),
    };

    const isFirstMessage = chat.messages.length === 0;

    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, userMsg], updated: Date.now() }
          : c
      ),
      isStreaming: true,
      thinkingContent: '',
      streamingContent: '',
    }));

    try {
      // 消耗理智
      const sanityState = await getSanityState();
      const costPerMsg = SanityCosts.message;
      if (sanityState.balance < costPerMsg) {
        throw new Error(`理智不足！当前余额 🧠${sanityState.balance}，需要 🧠${costPerMsg}`);
      }

      const source = await getActiveApiSource();
      if (!source) throw new Error('未配置 API 源');

      // 构建消息历史
      const messages = chat.messages.concat(userMsg).map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      // 系统提示
      messages.unshift({
        role: 'system',
        content:
          '你是"理智"，一个手机 AI 助手。你可以帮助用户操作手机文件、修改系统配置。你可以使用提供的工具（read_file, write_file, list_directory, get_system_setting, set_system_setting）来完成用户的任务。在执行敏感操作前，请先向用户确认。回答问题时简洁清晰，使用中文。',
      });

      let aiContent = '';
      let thinkContent = '';
      let toolCalls: ToolCall[] = [];

      await chatCompletion(
        source,
        {
          model: chat.model,
          messages,
          tools: getDefaultTools(),
          tool_choice: 'auto',
          stream: true,
        },
        (chunk, type) => {
          if (type === 'content') {
            aiContent += chunk;
            set({ streamingContent: aiContent });
          } else if (type === 'thinking') {
            thinkContent += chunk;
            set({ thinkingContent: thinkContent });
          } else if (type === 'tool_call') {
            try {
              const tcs = JSON.parse(chunk);
              for (const tc of tcs) {
                if (tc.function) {
                  toolCalls.push({
                    id: tc.id || `tool_${Date.now()}`,
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments || '{}'),
                    status: 'pending',
                    sanityCost: 0,
                  });
                }
              }
            } catch {}
          }
        }
      );

      // 执行工具调用
      if (toolCalls.length > 0 && aiContent === '') {
        for (const tc of toolCalls) {
          tc.status = 'running';

          // 显示工具执行中
          set((s) => ({
            chats: s.chats.map((c) => {
              if (c.id !== chatId) return c;
              return {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: tc.id,
                    role: 'assistant',
                    type: 'tool_call',
                    content: `正在执行: ${tc.name}`,
                    timestamp: Date.now(),
                    toolCall: { ...tc },
                  },
                ],
              };
            }),
          }));

          try {
            let result = '';
            switch (tc.name) {
              case 'read_file':
                tc.sanityCost = SanityCosts.fileRead;
                result = await readFile(tc.args.path as string);
                break;
              case 'write_file':
                tc.sanityCost = SanityCosts.fileWrite;
                await writeFile(tc.args.path as string, tc.args.content as string);
                result = '文件写入成功';
                break;
              case 'list_directory':
                tc.sanityCost = SanityCosts.fileBrowse;
                const files = await listDirectory(tc.args.path as string);
                result = JSON.stringify(files.map((f) => `${f.isDirectory ? '📁' : '📄'} ${f.name}`));
                break;
              case 'get_system_setting':
                tc.sanityCost = SanityCosts.systemRead;
                const setting = await getSystemSetting(tc.args.setting as any);
                result = JSON.stringify(setting);
                break;
              case 'set_system_setting':
                tc.sanityCost = SanityCosts.systemModify;
                const updatedSetting = await setSystemSetting(
                  tc.args.setting as any,
                  tc.args.value as string
                );
                result = `设置已更新: ${JSON.stringify(updatedSetting)}`;
                break;
              default:
                result = `未知工具: ${tc.name}`;
            }
            tc.result = result;
            tc.status = 'done';
          } catch (err: any) {
            tc.result = `错误: ${err.message}`;
            tc.status = 'error';
          }
        }
      }

      const totalToolCost = toolCalls.reduce((sum, tc) => sum + tc.sanityCost, 0);

      // AI 回复消息
      const aiMsg: Message = {
        id: `msg_${Date.now()}_ai`,
        role: 'assistant',
        type: 'text',
        content: aiContent || toolCalls.map((tc) => `🔧 ${tc.name}: ${tc.result || tc.status}`).join('\n'),
        timestamp: Date.now(),
        thinkingContent: thinkContent || undefined,
        sanityCost: costPerMsg + totalToolCost,
      };

      // 消耗理智
      await consumeSanity(costPerMsg + totalToolCost, `对话消耗`, chatId);

      // 更新对话标题（自动总结）
      let title = chat.title;
      if (isFirstMessage && chat.title === '新对话') {
        // 用用户输入做 fallback 标题，同时异步生成 AI 标题
        title = content.length > 30 ? content.slice(0, 30) + '...' : content;

        // 异步生成 AI 标题
        generateChatTitle(source, content).then((aiTitle) => {
          if (aiTitle && aiTitle.length > 0) {
            get().renameChat(chatId!, aiTitle);
          }
        });
      }

      set((s) => {
        const chats = s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                title,
                messages: [...c.messages, aiMsg],
                updated: Date.now(),
              }
            : c
        );
        AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        return {
          chats,
          thinkingContent: '',
          streamingContent: '',
        };
      });
    } catch (err: any) {
      const errMsg: Message = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        type: 'error',
        content: `❌ ${err.message}`,
        timestamp: Date.now(),
      };
      set((s) => {
        const chats = s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: [...c.messages, errMsg] }
            : c
        );
        AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        return { chats };
      });
    } finally {
      set({ isStreaming: false, thinkingContent: '', streamingContent: '' });
    }
  },

  clearThinking: () => set({ thinkingContent: '' }),
  clearStreaming: () => set({ streamingContent: '' }),
}));
