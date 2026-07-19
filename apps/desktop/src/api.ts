import type { AgentTask, Attachment, AuthResponse, CreateAgentTaskInput, CreateImageTaskInput, Health, ImageAgentAction, ImageTask, Message, SanityAccount, SanityLedgerEntry, SdCapabilities, SdParams, Session, SessionKind, UploadFileResponse, UploadImageResponse } from '@wisadel/contracts';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://u1056851-8a8f-2f197363.westc.seetacloud.com:8443/api/v1';
export const AUTH_EXPIRED_EVENT = 'wisadel:auth-expired';

export class ApiClient {
  private token = localStorage.getItem('wisadel.accessToken');
  private refreshToken = localStorage.getItem('wisadel.refreshToken');

  setTokens(accessToken: string | null, refreshToken: string | null = null) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) localStorage.setItem('wisadel.accessToken', accessToken); else localStorage.removeItem('wisadel.accessToken');
    if (refreshToken) localStorage.setItem('wisadel.refreshToken', refreshToken); else localStorage.removeItem('wisadel.refreshToken');
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...init.headers
      }
    });
    if (response.status === 401 && this.refreshToken && !path.startsWith('/auth/')) {
      const refreshed = await this.refreshAccess();
      if (refreshed) return this.request<T>(path, init);
    }
    if (response.status === 401 && !path.startsWith('/auth/')) this.expireSession();
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? '请求失败');
    return payload as T;
  }

  health = () => this.request<Health>('/health');
  sanityAccount = () => this.request<SanityAccount>('/billing/sanity');
  sanityLedger = () => this.request<SanityLedgerEntry[]>('/billing/sanity/ledger');
  register = (email: string, password: string, nickname: string) =>
    this.request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) });
  login = (email: string, password: string) =>
    this.request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  logout = async () => {
    if (this.refreshToken) await this.request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: this.refreshToken }) }).catch(() => undefined);
    this.setTokens(null, null);
  };
  sessions = (kind: SessionKind) => this.request<Session[]>(`/chat/sessions?kind=${kind}`);
  createSession = (kind: SessionKind) =>
    this.request<Session>('/chat/sessions', { method: 'POST', body: JSON.stringify({ kind }) });
  messages = (id: string) => this.request<Message[]>(`/chat/sessions/${id}/messages`);
  deleteSession = (id: string) => this.request(`/chat/sessions/${id}`, { method: 'DELETE' });
  renameSession = (id: string, title: string) =>
    this.request<Session>(`/chat/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
  createImageTask = (input: CreateImageTaskInput) =>
    this.request<ImageTask>('/image-tasks', { method: 'POST', body: JSON.stringify(input) });
  sdCapabilities = () => this.request<SdCapabilities>('/image-tasks/capabilities');
  agentTasks = (sessionId?: string) => this.request<AgentTask[]>(`/agent-tasks${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`);
  createAgentTask = (input: CreateAgentTaskInput) => this.request<AgentTask>('/agent-tasks', { method: 'POST', body: JSON.stringify(input) });
  retryAgentTask = (id: string) => this.request<AgentTask>(`/agent-tasks/${id}/retry`, { method: 'POST' });
  imageTasks = (sessionId?: string) => this.request<ImageTask[]>(`/image-tasks${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`);
  imageTask = (id: string) => this.request<ImageTask>(`/image-tasks/${id}`);
  cancelImageTask = (id: string) => this.request<ImageTask>(`/image-tasks/${id}/cancel`, { method: 'POST' });
  retryImageTask = (id: string) => this.request<ImageTask>(`/image-tasks/${id}/retry`, { method: 'POST' });
  uploadImage = async (file: File): Promise<UploadImageResponse> => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_URL}/uploads/images`, {
      method: 'POST',
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      body: form
    });
    if (response.status === 401 && this.refreshToken && await this.refreshAccess()) return this.uploadImage(file);
    if (response.status === 401) this.expireSession();
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? '图片上传失败');
    return payload as UploadImageResponse;
  };

  uploadFile = async (file: File): Promise<UploadFileResponse> => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_URL}/uploads/files`, { method: 'POST', headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}, body: form });
    if (response.status === 401 && this.refreshToken && await this.refreshAccess()) return this.uploadFile(file);
    if (response.status === 401) this.expireSession();
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? '文件上传失败');
    return payload as UploadFileResponse;
  };

  async streamMessage(sessionId: string, content: string, imageUrls: string[], attachments: Attachment[], currentParams: SdParams, onDelta: (delta: string) => void, onReasoning?: (label: string) => void, onParams?: (action: ImageAgentAction) => void, onImageTask?: (task: ImageTask) => void): Promise<Message> {
    const clientId = crypto.randomUUID();
    let response = await this.openMessageStream(sessionId, clientId, content, imageUrls, attachments, currentParams);
    if (response.status === 401 && this.refreshToken && await this.refreshAccess()) {
      response = await this.openMessageStream(sessionId, clientId, content, imageUrls, attachments, currentParams);
    }
    if (response.status === 401) this.expireSession();
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message ?? '消息发送失败');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: Message | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const event = block.match(/^event:\s*(.+)$/m)?.[1];
        const raw = block.match(/^data:\s*(.+)$/m)?.[1];
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (event === 'delta') onDelta(data.delta);
        if (event === 'reasoning') onReasoning?.(data.label);
        if (event === 'params') onParams?.(data);
        if (event === 'image_task') onImageTask?.(data);
        if (event === 'sanity') window.dispatchEvent(new CustomEvent('wisadel:sanity', { detail: data }));
        if (event === 'done') result = data;
      }
    }
    if (!result) throw new Error('流式响应意外中断');
    return result;
  }

  private openMessageStream(sessionId: string, clientId: string, content: string, imageUrls: string[], attachments: Attachment[], currentParams: SdParams) {
    return fetch(`${API_URL}/chat/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ clientId, content, imageUrls, attachments, currentParams })
    });
  }

  private async refreshAccess() {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: this.refreshToken }) });
      if (!response.ok) throw new Error('refresh failed');
      const result = await response.json() as AuthResponse;
      this.setTokens(result.accessToken, result.refreshToken);
      localStorage.setItem('wisadel.user', JSON.stringify(result.user));
      return true;
    } catch { return false; }
  }

  private expireSession() {
    this.setTokens(null, null);
    localStorage.removeItem('wisadel.user');
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

export const api = new ApiClient();
