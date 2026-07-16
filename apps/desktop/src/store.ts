import { create } from 'zustand';
import type { Attachment, ImageTask, Message, SdCapabilities, SdParams, Session, SessionKind, User } from '@wisadel/contracts';
import { api } from './api';

const DEFAULT_SD_PARAMS: SdParams = {
  mode: 'txt2img',
  prompt: '',
  negativePrompt: '',
  samplerName: 'Euler a',
  steps: 24,
  width: 768,
  height: 768,
  cfgScale: 7,
  seed: -1,
  batchSize: 1,
  initImageUrl: null,
  maskImageUrl: null,
  denoisingStrength: 0.65,
  maskBlur: 4,
  modelCheckpoint: null,
  vaeName: null,
  schedulerName: null,
  loras: [],
  scriptName: null,
  scriptArgs: []
};

const withSdDefaults = (params: Partial<SdParams>): SdParams => ({
  ...DEFAULT_SD_PARAMS,
  ...params
});

type Page = SessionKind | 'models' | 'extensions' | 'plugins';

interface AppState {
  user: User | null;
  page: Page;
  online: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  messages: Message[];
  loadingConversation: boolean;
  streamingText: string;
  reasoningSteps: string[];
  reasoningCollapsed: boolean;
  sending: boolean;
  sendError: string | null;
  settingsOpen: boolean;
  sdParams: SdParams;
  sdCapabilities: SdCapabilities | null;
  imageTask: ImageTask | null;
  imageTasks: ImageTask[];
  imageError: string | null;
  previewImageUrl: string | null;
  pendingImageUrls: string[];
  pendingAttachments: Attachment[];
  uploadingImage: boolean;
  uploadingFile: boolean;
  setUser: (user: User | null) => void;
  setPage: (page: Page) => Promise<void>;
  loadSessions: (kind?: SessionKind) => Promise<void>;
  createSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  sendMessage: (content: string, imageUrls?: string[], attachments?: Attachment[]) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  updateSdParams: (params: Partial<SdParams>) => void;
  loadSdCapabilities: () => Promise<void>;
  generateImage: () => Promise<void>;
  cancelImage: () => Promise<void>;
  selectImageTask: (id: string) => void;
  retryImage: (id: string) => Promise<void>;
  watchImageTask: (id: string) => void;
  setPreviewImage: (url: string | null) => void;
  uploadImage: (file: File) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  attachImage: (url: string) => void;
  removePendingImage: (url: string) => void;
  removePendingAttachment: (url: string) => void;
  setReasoningCollapsed: (collapsed: boolean) => void;
}

const conversational = (page: Page): page is SessionKind => page === 'chat' || page === 'image';
const terminalTask = (task: ImageTask) => ['succeeded', 'failed', 'cancelled'].includes(task.status);
type ConversationCache = Pick<AppState, 'sessions' | 'activeSessionId' | 'messages' | 'imageTask' | 'imageTasks' | 'sdParams' | 'reasoningSteps'>;
const conversationCache: Partial<Record<SessionKind, ConversationCache>> = {};
const inFlightSessions = new Set<string>();
let imagePoll: number | null = null;

const stopImagePoll = () => {
  if (imagePoll !== null) window.clearInterval(imagePoll);
  imagePoll = null;
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  page: 'chat',
  online: navigator.onLine,
  sessions: [],
  activeSessionId: null,
  messages: [],
  loadingConversation: false,
  streamingText: '',
  reasoningSteps: [],
  reasoningCollapsed: true,
  sending: false,
  sendError: null,
  settingsOpen: false,
  sdParams: DEFAULT_SD_PARAMS,
  sdCapabilities: null,
  imageTask: null,
  imageTasks: [],
  imageError: null,
  previewImageUrl: null,
  pendingImageUrls: [],
  pendingAttachments: [],
  uploadingImage: false,
  uploadingFile: false,
  setUser: (user) => set(user ? { user } : {
    user: null,
    sessions: [],
    activeSessionId: null,
    messages: [],
    loadingConversation: false,
    streamingText: '',
    reasoningSteps: [],
    sending: false,
    sendError: null,
    imageTask: null,
    imageTasks: [],
    imageError: null,
    previewImageUrl: null,
    pendingImageUrls: [],
    pendingAttachments: [],
    uploadingImage: false
  }),
  setPage: async (page) => {
    if (page === get().page) return;
    stopImagePoll();
    const previousPage = get().page;
    if (conversational(previousPage)) {
      const state = get();
      conversationCache[previousPage] = { sessions: state.sessions, activeSessionId: state.activeSessionId, messages: state.messages, imageTask: state.imageTask, imageTasks: state.imageTasks, sdParams: state.sdParams, reasoningSteps: state.reasoningSteps };
    }
    const cached = conversational(page) ? conversationCache[page] : undefined;
    const targetSessionId = cached?.activeSessionId ?? null;
    set({ page, sessions: cached?.sessions ?? [], activeSessionId: targetSessionId, messages: cached?.messages ?? [], imageTask: cached?.imageTask ?? null, imageTasks: cached?.imageTasks ?? [], ...(cached ? { sdParams: cached.sdParams } : {}), reasoningSteps: [], reasoningCollapsed: true, streamingText: '', sending: Boolean(targetSessionId && inFlightSessions.has(targetSessionId)), loadingConversation: conversational(page) && !cached, imageError: null, pendingImageUrls: [], pendingAttachments: [], sendError: null });
    if (conversational(page)) await Promise.all([
      get().loadSessions(page),
      ...(page === 'image' ? [get().loadSdCapabilities()] : [])
    ]);
  },
  loadSessions: async (kind) => {
    const currentPage = get().page;
    const selectedKind = kind ?? (conversational(currentPage) ? currentPage : 'chat');
    try {
      let sessions = await api.sessions(selectedKind);
      if (!sessions.length) sessions = [await api.createSession(selectedKind)];
      if (get().page !== selectedKind) return;
      set({ sessions, online: true });
      const preferred = conversationCache[selectedKind]?.activeSessionId;
      await get().selectSession(sessions.some((item) => item.id === preferred) ? preferred! : sessions[0]!.id);
    } catch {
      if (get().page === selectedKind) set({ online: false, loadingConversation: false });
    }
  },
  createSession: async () => {
    const page = get().page;
    if (!conversational(page)) return;
    try {
      const session = await api.createSession(page);
      set((state) => ({ sessions: [session, ...state.sessions], online: true }));
      await get().selectSession(session.id);
    } catch {
      set({ online: false });
    }
  },
  selectSession: async (id) => {
    stopImagePoll();
    const keepVisible = get().activeSessionId === id && get().messages.length > 0;
    set({ activeSessionId: id, ...(keepVisible ? {} : { messages: [] }), streamingText: '', reasoningSteps: [], reasoningCollapsed: true, sending: inFlightSessions.has(id), imageTask: null, imageTasks: [], imageError: null, loadingConversation: !keepVisible });
    try {
      const imageSession = get().sessions.find((session) => session.id === id)?.kind === 'image';
      const [messages, imageTasks] = await Promise.all([
        api.messages(id),
        imageSession ? api.imageTasks(id) : Promise.resolve([])
      ]);
      if (get().activeSessionId !== id) return;
      const latestTask = imageTasks[0] ?? null;
      set({
        messages,
        imageTasks,
        imageTask: latestTask,
        ...(latestTask ? { sdParams: withSdDefaults(latestTask.params) } : {}),
        online: true,
        loadingConversation: false
      });
      if (latestTask && !terminalTask(latestTask)) get().watchImageTask(latestTask.id);
    } catch (error) {
      if (get().activeSessionId === id) set({ online: false, loadingConversation: false, imageError: error instanceof Error ? error.message : '会话载入失败' });
    }
  },
  deleteSession: async (id) => {
    await api.deleteSession(id);
    const remaining = get().sessions.filter((session) => session.id !== id);
    set({ sessions: remaining, activeSessionId: null, messages: [] });
    if (remaining[0]) await get().selectSession(remaining[0].id);
    else await get().createSession();
  },
  renameSession: async (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const session = await api.renameSession(id, trimmed);
    set((state) => ({ sessions: state.sessions.map((item) => item.id === id ? session : item) }));
  },
  sendMessage: async (content, imageUrls = get().pendingImageUrls, attachments = get().pendingAttachments) => {
    const sessionId = get().activeSessionId;
    const originPage = get().page;
    if (!sessionId || get().sending || inFlightSessions.has(sessionId) || !conversational(originPage)) return;
    inFlightSessions.add(sessionId);
    const isCurrent = () => get().activeSessionId === sessionId && get().page === originPage;
    const optimistic: Message = {
      id: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content,
      status: 'sending',
      imageUrls,
      attachments,
      createdAt: new Date().toISOString()
    };
    set((state) => ({ messages: [...state.messages, optimistic], sending: true, streamingText: '', reasoningSteps: ['正在准备请求'], reasoningCollapsed: false, sendError: null, pendingImageUrls: [], pendingAttachments: [] }));
    try {
      const assistant = await api.streamMessage(
        sessionId,
        content,
        imageUrls,
        attachments,
        get().sdParams,
        (delta) => { if (isCurrent()) set((state) => ({ streamingText: state.streamingText + delta })); },
        (label) => { if (isCurrent()) set((state) => ({ reasoningSteps: state.reasoningSteps.at(-1) === label ? state.reasoningSteps : [...state.reasoningSteps, label].slice(-12) })); },
        (action) => { if (isCurrent()) set((state) => ({ sdParams: { ...state.sdParams, ...action.params } })); },
        (task) => {
          if (!isCurrent()) return;
          set((state) => ({
            imageTask: task,
            imageTasks: [task, ...state.imageTasks.filter((item) => item.id !== task.id)],
            imageError: null
          }));
          get().watchImageTask(task.id);
        }
      );
      inFlightSessions.delete(sessionId);
      delete conversationCache[originPage];
      if (!isCurrent()) return;
      set((state) => ({
        messages: [...state.messages.map((message) => message.id === optimistic.id ? { ...message, status: 'sent' as const } : message), assistant],
        sessions: state.sessions.map((session) => session.id === sessionId ? {
          ...session,
          title: session.title === '新的对话' || session.title === '新的创作' ? (content.length > 28 ? `${content.slice(0, 28)}...` : content) : session.title,
          preview: assistant.content,
          updatedAt: assistant.createdAt
        } : session),
        streamingText: '',
        reasoningCollapsed: true,
        sending: false,
        sendError: null,
        online: true
      }));
    } catch (error) {
      inFlightSessions.delete(sessionId);
      delete conversationCache[originPage];
      if (!isCurrent()) return;
      set((state) => ({
        messages: state.messages.map((message) => message.id === optimistic.id ? { ...message, status: 'failed' as const } : message),
        sending: false,
        streamingText: '',
        reasoningCollapsed: true,
        sendError: error instanceof Error ? error.message : '消息发送失败',
        pendingImageUrls: imageUrls,
        pendingAttachments: attachments
      }));
    }
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPreviewImage: (previewImageUrl) => set({ previewImageUrl }),
  uploadImage: async (file) => {
    set({ uploadingImage: true, imageError: null });
    try {
      const uploaded = await api.uploadImage(file);
      get().attachImage(uploaded.url);
    } catch (error) {
      set({ imageError: error instanceof Error ? error.message : '图片上传失败' });
    } finally {
      set({ uploadingImage: false });
    }
  },
  uploadFile: async (file) => {
    set({ uploadingFile: true, sendError: null });
    try {
      const attachment = await api.uploadFile(file);
      set((state) => ({ pendingAttachments: state.pendingAttachments.some((item) => item.url === attachment.url) ? state.pendingAttachments : [...state.pendingAttachments, attachment].slice(-8) }));
    } catch (error) {
      set({ sendError: error instanceof Error ? error.message : '文件上传失败' });
    } finally { set({ uploadingFile: false }); }
  },
  attachImage: (url) => set((state) => ({ pendingImageUrls: state.pendingImageUrls.includes(url) ? state.pendingImageUrls : [...state.pendingImageUrls, url].slice(-4) })),
  removePendingImage: (url) => set((state) => ({ pendingImageUrls: state.pendingImageUrls.filter((item) => item !== url) })),
  removePendingAttachment: (url) => set((state) => ({ pendingAttachments: state.pendingAttachments.filter((item) => item.url !== url) })),
  setReasoningCollapsed: (reasoningCollapsed) => set({ reasoningCollapsed }),
  updateSdParams: (params) => set((state) => ({ sdParams: { ...state.sdParams, ...params } })),
  loadSdCapabilities: async () => {
    try {
      const sdCapabilities = await api.sdCapabilities();
      set({ sdCapabilities, online: true });
    } catch {
      set({ sdCapabilities: null });
    }
  },
  generateImage: async () => {
    const sessionId = get().activeSessionId;
    if (!sessionId || !get().sdParams.prompt.trim()) return;
    try {
      const task = await api.createImageTask({ sessionId, clientId: crypto.randomUUID(), params: get().sdParams });
      set((state) => ({ imageTask: task, imageTasks: [task, ...state.imageTasks.filter((item) => item.id !== task.id)], imageError: null }));
      get().watchImageTask(task.id);
    } catch (error) {
      set({ imageError: error instanceof Error ? error.message : '无法创建图像任务', online: false });
    }
  },
  cancelImage: async () => {
    const task = get().imageTask;
    if (!task) return;
    try {
      const updated = await api.cancelImageTask(task.id);
      stopImagePoll();
      set((state) => ({ imageTask: updated, imageTasks: state.imageTasks.map((item) => item.id === updated.id ? updated : item), imageError: null }));
    } catch (error) {
      set({ imageError: error instanceof Error ? error.message : '取消任务失败' });
    }
  },
  selectImageTask: (id) => {
    const task = get().imageTasks.find((item) => item.id === id);
    if (!task) return;
    set({ imageTask: task, sdParams: withSdDefaults(task.params), imageError: null });
    if (!terminalTask(task)) get().watchImageTask(task.id);
  },
  retryImage: async (id) => {
    try {
      const task = await api.retryImageTask(id);
      set((state) => ({ imageTask: task, imageTasks: [task, ...state.imageTasks.filter((item) => item.id !== task.id)], sdParams: withSdDefaults(task.params), imageError: null }));
      get().watchImageTask(task.id);
    } catch (error) {
      set({ imageError: error instanceof Error ? error.message : '重试任务失败' });
    }
  },
  watchImageTask: (id) => {
    stopImagePoll();
    imagePoll = window.setInterval(async () => {
      try {
        const updated = await api.imageTask(id);
        const refreshedMessages = updated.status === 'succeeded' && get().activeSessionId === updated.sessionId
          ? await api.messages(updated.sessionId)
          : null;
        set((state) => ({
          imageTask: state.imageTask?.id === id ? updated : state.imageTask,
          imageTasks: state.imageTasks.some((item) => item.id === id)
            ? state.imageTasks.map((item) => item.id === id ? updated : item)
            : [updated, ...state.imageTasks],
          ...(refreshedMessages ? { messages: refreshedMessages } : {}),
          imageError: null,
          online: true
        }));
        if (terminalTask(updated)) stopImagePoll();
      } catch (error) {
        stopImagePoll();
        set({ imageError: error instanceof Error ? error.message : '任务状态更新失败', online: false });
      }
    }, 700);
  }
}));

window.addEventListener('online', () => useAppStore.setState({ online: true }));
window.addEventListener('offline', () => useAppStore.setState({ online: false }));
