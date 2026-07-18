import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Blocks, Bot, ChevronDown, CircleUserRound, CloudOff, Download, Ellipsis, Eye, Image as ImageIcon,
  FileText, ImagePlus, Layers3, LogOut, MessageSquare, PanelLeftClose, PanelLeftOpen, Paperclip, Pencil, Plus, RotateCcw,
  Scissors,
  ScanEye, Search, Send, Settings, SlidersHorizontal, Sparkles, Square, Trash2, Upload,
  WandSparkles, X, Zap
} from 'lucide-react';
import type { SanityAccount, SanityLedgerEntry, SdParams, Session } from '@wisadel/contracts';
import { useAppStore } from '../store';
import { api } from '../api';

const navItems = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'models', label: '模型', icon: Layers3 },
  { id: 'extensions', label: '扩展', icon: Blocks },
  { id: 'plugins', label: '插件', icon: Zap }
] as const;

export function Workspace({ onLogout, standaloneImage = false }: { onLogout: () => void; standaloneImage?: boolean }) {
  const page = useAppStore((state) => state.page);
  const user = useAppStore((state) => state.user)!;
  const online = useAppStore((state) => state.online);
  const setPage = useAppStore((state) => state.setPage);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const [imagePanelWidth, setImagePanelWidth] = useState(() => {
    const saved = Number(localStorage.getItem('wisadel.imagePanelWidth'));
    return Number.isFinite(saved) && saved >= 280 && saved <= 620 ? saved : 330;
  });
  const resizingRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('wisadel.sessionSidebar') !== 'closed');

  useEffect(() => {
    const resize = (event: PointerEvent) => {
      if (!resizingRef.current) return;
      const maxWidth = Math.min(620, Math.max(280, window.innerWidth - 62 - 250 - 390));
      const width = Math.min(maxWidth, Math.max(280, window.innerWidth - event.clientX));
      setImagePanelWidth(width);
    };
    const stopResize = () => { resizingRef.current = false; document.body.classList.remove('is-resizing'); };
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResize);
    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResize);
    };
  }, []);

  useEffect(() => { localStorage.setItem('wisadel.imagePanelWidth', String(imagePanelWidth)); }, [imagePanelWidth]);
  useEffect(() => { localStorage.setItem('wisadel.sessionSidebar', sidebarOpen ? 'open' : 'closed'); }, [sidebarOpen]);

  const beginImagePanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (page !== 'image') return;
    event.preventDefault();
    resizingRef.current = true;
    document.body.classList.add('is-resizing');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="account-summary"><div className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</div><div><strong>{user.nickname}</strong><span>{user.role === 'admin' ? '管理员' : '内测用户'}</span></div></div>
        <div className="titlebar-center"><span className="status-dot" />{standaloneImage ? 'Stable Diffusion AI' : 'Wisadel Preview'}</div>
        <div className="titlebar-actions"><SanityCenter />{!online && <span className="offline-badge"><CloudOff size={14} />离线</span>}<button className="icon-button" onClick={onLogout} title="退出登录"><LogOut size={17} /></button></div>
      </header>
      <div className={`workspace-grid ${page === 'image' ? 'with-inspector' : ''} ${standaloneImage ? 'standalone-image' : ''} ${sidebarOpen ? '' : 'sidebar-collapsed'}`} style={{ '--image-panel-width': `${imagePanelWidth}px` } as CSSProperties}>
        {!standaloneImage && <nav className="rail">
          <div className="rail-logo"><Sparkles size={21} /></div>
          <div className="rail-group">
            {navItems.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => void setPage(item.id)} title={item.label}><item.icon size={20} /></button>)}
          </div>
          <button className="rail-settings" onClick={() => setSettingsOpen(true)} title="设置"><Settings size={20} /></button>
        </nav>}
        {(page === 'chat' || page === 'image') && sidebarOpen && <SessionSidebar onClose={() => setSidebarOpen(false)} />}
        {(page === 'chat' || page === 'image') ? <Conversation sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} /> : <PlaceholderPage page={page} />}
        {page === 'image' && <div className="image-panel-resizer" role="separator" aria-label="调整 Stable Diffusion 面板宽度" aria-orientation="vertical" onPointerDown={beginImagePanelResize}><span /></div>}
        {page === 'image' && <ImageInspector />}
      </div>
      <SettingsDialog />
      <ImageViewer />
    </main>
  );
}

function SanityCenter() {
  const [account, setAccount] = useState<SanityAccount | null>(null);
  const [ledger, setLedger] = useState<SanityLedgerEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = async (includeLedger = false) => {
    try {
      const [nextAccount, nextLedger] = await Promise.all([api.sanityAccount(), includeLedger ? api.sanityLedger() : Promise.resolve(null)]);
      setAccount(nextAccount);
      if (nextLedger) setLedger(nextLedger);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    const onSanity = (event: Event) => {
      const detail = (event as CustomEvent<{ balanceMilli: number }>).detail;
      if (detail?.balanceMilli !== undefined) setAccount({ balanceMilli: detail.balanceMilli, balance: detail.balanceMilli / 1000, unit: 'sanity' });
      if (open) void refresh(true);
    };
    window.addEventListener('wisadel:sanity', onSanity);
    return () => window.removeEventListener('wisadel:sanity', onSanity);
  }, [open]);

  const show = () => { setOpen(true); setLoading(true); void refresh(true); };
  return <><button className="sanity-button" onClick={show} title="理智中心"><img src="/sanity-icon.png" alt="" /><span>理智</span><strong>{loading && !account ? '--' : (account?.balance ?? 0).toFixed(2)}</strong></button>{open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><section className="sanity-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><span>WISADEL SANITY</span><h2>理智中心</h2></div><button className="icon-button" onClick={() => setOpen(false)} title="关闭"><X size={19} /></button></header><div className="sanity-balance"><img src="/sanity-icon.png" alt="理智" /><div><span>当前可用理智</span><strong>{(account?.balance ?? 0).toFixed(3)}</strong><small>100 理智 = 1 元人民币</small></div></div><div className="sanity-note">新用户初始获得 100 理智。对话完成后会根据模型实际返回的输入与输出 token 精确结算；生图和云端 GPU 当前不扣理智。</div><div className="sanity-ledger"><div className="sanity-ledger-heading"><strong>最近结算</strong><span>精确至 0.001 理智</span></div>{ledger.length ? ledger.map((entry) => <div className="sanity-entry" key={entry.id}><div><strong>{entry.description}</strong><span>{entry.model} · 输入 {entry.inputTokens.toLocaleString()} / 输出 {entry.outputTokens.toLocaleString()} token</span></div><div><b>{(entry.deltaMilli / 1000).toFixed(3)}</b><span>余额 {(entry.balanceAfterMilli / 1000).toFixed(3)}</span></div></div>) : <div className="sanity-empty">尚无结算记录</div>}</div></section></div>}</>;
}

function SessionSidebar({ onClose }: { onClose: () => void }) {
  const sessions = useAppStore((state) => state.sessions);
  const activeId = useAppStore((state) => state.activeSessionId);
  const page = useAppStore((state) => state.page);
  const select = useAppStore((state) => state.selectSession);
  const create = useAppStore((state) => state.createSession);
  const remove = useAppStore((state) => state.deleteSession);
  const rename = useAppStore((state) => state.renameSession);
  const [search, setSearch] = useState('');

  const filtered = sessions.filter((session) => `${session.title}${session.preview}`.toLowerCase().includes(search.toLowerCase()));
  return <aside className="session-sidebar">
    <div className="sidebar-heading"><div><span>{page === 'chat' ? '对话工作区' : '图像工作区'}</span><strong>{page === 'chat' ? 'Wisadel 助手' : '创意画师'}</strong></div><button className="icon-button" onClick={onClose} title="收起历史会话"><PanelLeftClose size={18} /></button></div>
    <div className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索会话" /></div>
    <div className="session-list">
      {filtered.map((session) => <SessionRow key={session.id} session={session} active={session.id === activeId} onSelect={() => void select(session.id)} onDelete={() => void remove(session.id)} onRename={(title) => void rename(session.id, title)} />)}
    </div>
    <button className="new-session" onClick={() => void create()}><Plus size={17} />新建{page === 'chat' ? '对话' : '创作'}</button>
  </aside>;
}

function SessionRow({ session, active, onSelect, onDelete, onRename }: { session: Session; active: boolean; onSelect: () => void; onDelete: () => void; onRename: (title: string) => void }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const commit = () => {
    const value = title.trim();
    setEditing(false);
    if (value && value !== session.title) onRename(value);
    else setTitle(session.title);
  };
  return <div className={`session-row ${active ? 'active' : ''}`} onClick={() => { if (!editing) onSelect(); }}>
    <div className="session-icon">{session.kind === 'chat' ? <Bot size={17} /> : <WandSparkles size={17} />}</div>
    <div className="session-copy">{editing
      ? <input className="session-title-input" autoFocus value={title} maxLength={100} onClick={(event) => event.stopPropagation()} onChange={(event) => setTitle(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') { setTitle(session.title); setEditing(false); } }} />
      : <><strong>{session.title}</strong><span>{session.preview}</span></>}
    </div>
    <button className="row-menu" onClick={(event) => { event.stopPropagation(); setMenu(!menu); }} aria-label="会话菜单"><Ellipsis size={17} /></button>
    {menu && <div className="context-menu"><button className="rename" onClick={(event) => { event.stopPropagation(); setMenu(false); setTitle(session.title); setEditing(true); }}><Pencil size={15} />重命名</button><button onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 size={15} />删除</button></div>}
  </div>;
}

function Conversation({ sidebarOpen, onOpenSidebar }: { sidebarOpen: boolean; onOpenSidebar: () => void }) {
  const page = useAppStore((state) => state.page);
  const sessions = useAppStore((state) => state.sessions);
  const activeId = useAppStore((state) => state.activeSessionId);
  const messages = useAppStore((state) => state.messages);
  const loadingConversation = useAppStore((state) => state.loadingConversation);
  const streaming = useAppStore((state) => state.streamingText);
  const sending = useAppStore((state) => state.sending);
  const sendError = useAppStore((state) => state.sendError);
  const reasoningSteps = useAppStore((state) => state.reasoningSteps);
  const reasoningCollapsed = useAppStore((state) => state.reasoningCollapsed);
  const setReasoningCollapsed = useAppStore((state) => state.setReasoningCollapsed);
  const send = useAppStore((state) => state.sendMessage);
  const pendingImages = useAppStore((state) => state.pendingImageUrls);
  const pendingAttachments = useAppStore((state) => state.pendingAttachments);
  const uploading = useAppStore((state) => state.uploadingFile);
  const uploadFile = useAppStore((state) => state.uploadFile);
  const removeAttachment = useAppStore((state) => state.removePendingAttachment);
  const removePending = useAppStore((state) => state.removePendingImage);
  const attachImage = useAppStore((state) => state.attachImage);
  const previewImage = useAppStore((state) => state.setPreviewImage);
  const [input, setInput] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [showReturnBottom, setShowReturnBottom] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const active = sessions.find((session) => session.id === activeId);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);
  useEffect(() => { setInput(''); }, [page, activeId]);
  const submit = () => {
    if (sending || uploading) return;
    const hasFiles = pendingImages.length || pendingAttachments.length;
    const value = input.trim() || (hasFiles ? (page === 'image' ? '请分析这些附件，并整理成适合 Stable Diffusion 的提示词与参数。' : '请分析这些附件。') : '');
    if (!value) return;
    setInput('');
    void send(value);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } };
  const captureScreen = async () => {
    if (capturing || pendingImages.length >= 4) return;
    setCapturing(true); setCaptureError(null);
    try {
      const dataUrl = await window.wisadelDesktop?.captureScreen();
      if (!dataUrl) throw new Error('截图功能仅可在 Wisadel 桌面端使用');
      const blob = await (await fetch(dataUrl)).blob();
      const uploaded = await api.uploadImage(new File([blob], `Wisadel 截图 ${new Date().toLocaleString()}.png`, { type: 'image/png' }));
      attachImage(uploaded.url);
    } catch (error) { setCaptureError(error instanceof Error ? error.message : '截图失败，请重试');
    } finally { setCapturing(false); }
  };
  const returnToBottom = () => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });

  return <section className="conversation">
    <header className="conversation-header"><div className="conversation-title">{!sidebarOpen && <button className="icon-button history-toggle" onClick={onOpenSidebar} title="打开历史会话"><PanelLeftOpen size={18} /></button>}<div><span>{page === 'chat' ? 'AI 对话' : '图像生成'}</span><h2>{active?.title ?? (loadingConversation ? '正在载入' : '新对话')}</h2></div></div><button className="model-selector"><span className="model-status" />{page === 'chat' ? 'DeepSeek' : 'Qwen Image'}<ChevronDown size={15} /></button></header>
    <div className="message-list" ref={listRef} onScroll={(event) => { const target = event.currentTarget; setShowReturnBottom(target.scrollHeight - target.scrollTop - target.clientHeight > 180); }}>
      {loadingConversation && <div className="conversation-loading"><Sparkles size={18} />正在恢复会话</div>}
      {!loadingConversation && !messages.length && <div className="empty-conversation"><div className="empty-symbol">{page === 'chat' ? <MessageSquare size={25} /> : <WandSparkles size={25} />}</div><h3>{page === 'chat' ? '今天想一起解决什么？' : '描述你想创造的画面'}</h3><p>{page === 'chat' ? '从问题、想法或一段待整理的内容开始。' : '我会先整理提示词与参数，由你确认后再生成。'}</p><div className="suggestions">{(page === 'chat' ? ['帮我梳理一个产品想法', '解释一段复杂概念', '制定今天的工作计划'] : ['雨夜里的未来城市', '极简主义产品摄影', '电影感山谷晨雾']).map((text) => <button key={text} onClick={() => setInput(text)}>{text}</button>)}</div></div>}
      {messages.map((message) => <div key={message.id} className={`message ${message.role}`}><div className="message-avatar">{message.role === 'user' ? <CircleUserRound size={18} /> : <Sparkles size={17} />}</div><div className="message-body"><div className="message-meta">{message.role === 'user' ? '你' : page === 'chat' ? 'Wisadel' : '创意画师'}<span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div className="message-content">{message.content}</div>{!!message.imageUrls.length && <div className="message-images">{message.imageUrls.map((url) => <div className="message-image" key={url}><button onClick={() => previewImage(url)} title="查看大图"><img src={url} alt="消息图片" /></button>{page === 'image' && <button className="analyze-image" onClick={() => attachImage(url)} title="交给千问分析"><ScanEye size={14} />分析</button>}</div>)}</div>}{!!message.attachments?.length && <div className="message-files">{message.attachments.map((file) => <a href={file.url} target="_blank" rel="noreferrer" key={file.url}><FileText size={15} /><span>{file.name}</span><small>{Math.max(1, Math.ceil(file.size / 1024))} KB</small></a>)}</div>}{message.status === 'failed' && <span className="message-error">{sendError ?? '发送失败，请重试'}</span>}</div></div>)}
      {!!reasoningSteps.length && <details className="reasoning-panel" open={!reasoningCollapsed}><summary onClick={(event) => { event.preventDefault(); setReasoningCollapsed(!reasoningCollapsed); }}><Sparkles size={14} />{sending ? '正在思考与执行' : '思考与执行过程'}</summary><div>{reasoningSteps.map((step, index) => <p key={`${step}-${index}`}>{step}</p>)}</div></details>}
      {streaming && <div className="message assistant"><div className="message-avatar"><Sparkles size={17} /></div><div className="message-body"><div className="message-meta">Wisadel<span>正在输入</span></div><div className="message-content streaming">{streaming}</div></div></div>}
      <div ref={endRef} />
    </div>
    {showReturnBottom && <button className="return-bottom" onClick={returnToBottom}><ChevronDown size={16} />回到底部</button>}
    <div className="composer-wrap"><div className="composer">{!!pendingImages.length && <div className="pending-images">{pendingImages.map((url) => <div key={url}><img src={url} alt="待发送图片" /><button type="button" onClick={() => removePending(url)} title="移除图片"><X size={13} /></button></div>)}</div>}{!!pendingAttachments.length && <div className="pending-files">{pendingAttachments.map((file) => <div key={file.url}><FileText size={15} /><span>{file.name}</span><button type="button" onClick={() => removeAttachment(file.url)} title="移除文件"><X size={13} /></button></div>)}</div>}<textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keyDown} placeholder={page === 'chat' ? '输入消息，或上传本地文件...' : '描述画面，或上传图片和文件让千问分析...'} rows={1} /><div className="composer-footer"><div className="composer-tools"><input ref={uploadRef} type="file" accept={page === 'image' ? 'image/*,.txt,.md,.json,.csv,.pdf' : undefined} hidden multiple onChange={(event) => { for (const file of Array.from(event.target.files ?? []).slice(0, 8 - pendingAttachments.length)) void uploadFile(file); event.target.value = ''; }} /><button type="button" className="attach-command" onClick={() => uploadRef.current?.click()} disabled={uploading || pendingAttachments.length >= 8} title="上传本地文件"><Paperclip size={16} /></button><button type="button" className="capture-command" onClick={() => void captureScreen()} disabled={capturing || pendingImages.length >= 4} title="截取当前屏幕并附加"><Scissors size={16} /></button><span>{capturing ? '正在截取屏幕' : uploading ? '正在上传文件' : 'Enter 发送 · Shift + Enter 换行'}</span></div><button type="button" className="send-command" onClick={submit} disabled={(!input.trim() && !pendingImages.length && !pendingAttachments.length) || sending || uploading || !activeId} aria-label="发送消息" title="发送消息">{sending ? <Square size={16} /> : <Send size={17} />}</button></div>{(sendError || captureError) && <div className="composer-error">{sendError ?? captureError}</div>}</div></div>
  </section>;
}

function ImageInspector() {
  const params = useAppStore((state) => state.sdParams);
  const capabilities = useAppStore((state) => state.sdCapabilities);
  const update = useAppStore((state) => state.updateSdParams);
  const generate = useAppStore((state) => state.generateImage);
  const cancel = useAppStore((state) => state.cancelImage);
  const task = useAppStore((state) => state.imageTask);
  const tasks = useAppStore((state) => state.imageTasks);
  const error = useAppStore((state) => state.imageError);
  const selectTask = useAppStore((state) => state.selectImageTask);
  const retry = useAppStore((state) => state.retryImage);
  const previewImage = useAppStore((state) => state.setPreviewImage);
  const attachImage = useAppStore((state) => state.attachImage);
  const [uploadingTarget, setUploadingTarget] = useState<'init' | 'mask' | null>(null);
  const initUploadRef = useRef<HTMLInputElement>(null);
  const maskUploadRef = useRef<HTMLInputElement>(null);
  const setNumber = (key: keyof SdParams, value: string) => update({ [key]: Number(value) });
  const busy = task && ['queued', 'processing'].includes(task.status);
  const needsInit = params.mode !== 'txt2img';
  const needsMask = params.mode === 'inpaint';
  const canGenerate = params.prompt.trim() && (!needsInit || params.initImageUrl) && (!needsMask || params.maskImageUrl);
  const availableScripts = params.mode === 'txt2img' ? capabilities?.scripts.txt2img ?? [] : capabilities?.scripts.img2img ?? [];
  const toggleLora = (name: string) => update({
    loras: params.loras.some((item) => item.name === name)
      ? params.loras.filter((item) => item.name !== name)
      : [...params.loras, { name, weight: 0.8 }].slice(0, 8)
  });
  const uploadControlImage = async (file: File, target: 'init' | 'mask') => {
    setUploadingTarget(target);
    try {
      const uploaded = await api.uploadImage(file);
      update(target === 'init' ? { initImageUrl: uploaded.url } : { maskImageUrl: uploaded.url });
      attachImage(uploaded.url);
    } finally {
      setUploadingTarget(null);
    }
  };

  return <aside className="image-inspector">
    <header><div><span>生成控制</span><h2>Stable Diffusion</h2></div><SlidersHorizontal size={19} /></header>
    <div className="mode-tabs"><button className={params.mode === 'txt2img' ? 'active' : ''} onClick={() => update({ mode: 'txt2img' })}>文生图</button><button className={params.mode === 'img2img' ? 'active' : ''} onClick={() => update({ mode: 'img2img' })}>图生图</button><button className={params.mode === 'inpaint' ? 'active' : ''} onClick={() => update({ mode: 'inpaint' })}>局部重绘</button></div>
    <section className="sd-components">
      <div className="image-history-heading"><strong>组件编排</strong><span>{capabilities?.mode === 'remote' ? '实时' : '未连接'}</span></div>
      <div className="component-grid">
        <label>模型<select value={params.modelCheckpoint ?? ''} onChange={(event) => update({ modelCheckpoint: event.target.value || null })}><option value="">当前模型</option>{capabilities?.models.map((model) => <option key={model.title} value={model.title}>{model.modelName}</option>)}</select></label>
        <label>调度器<select value={params.schedulerName ?? ''} onChange={(event) => update({ schedulerName: event.target.value || null })}><option value="">自动</option>{capabilities?.schedulers.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>VAE<select value={params.vaeName ?? ''} onChange={(event) => update({ vaeName: event.target.value || null })}><option value="">自动</option>{capabilities?.vaes.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>脚本<select value={params.scriptName ?? ''} onChange={(event) => update({ scriptName: event.target.value || null, scriptArgs: [] })}><option value="">关闭</option>{availableScripts.map((name) => <option key={name}>{name}</option>)}</select></label>
      </div>
      <div className="lora-control"><span>LoRA</span><div>{capabilities?.loras.length ? capabilities.loras.map((lora) => <button key={lora.name} className={params.loras.some((item) => item.name === lora.name) ? 'active' : ''} onClick={() => toggleLora(lora.name)}>{lora.alias}</button>) : <em>未安装</em>}</div></div>
    </section>
    {task?.resultUrls[0] ? <div className="result-preview"><button className="result-image-button" onClick={() => previewImage(task.resultUrls[0]!)} title="点击查看大图"><img src={task.resultUrls[0]} alt="生成结果" /><span><Eye size={15} />查看大图</span></button><div className="result-actions"><a href={task.resultUrls[0]} download title="下载图片"><Download size={16} /></a><button onClick={() => attachImage(task.resultUrls[0]!)} title="交给千问分析"><ScanEye size={16} /></button><button onClick={() => update({ mode: 'img2img', initImageUrl: task.resultUrls[0]! })} title="作为图生图原图"><ImagePlus size={16} /></button></div></div> : <div className="preview-placeholder"><ImageIcon size={24} /><span>{busy ? `正在生成 ${task.progress}%` : '生成结果将显示在这里'}</span>{busy && <div className="progress"><i style={{ width: `${task.progress}%` }} /></div>}</div>}
    {!!tasks.length && <section className="image-history"><div className="image-history-heading"><strong>生成历史</strong><span>{tasks.length} 项</span></div><div className="image-history-list">{tasks.map((item) => <button key={item.id} className={item.id === task?.id ? 'active' : ''} onClick={() => selectTask(item.id)} title={item.params.prompt}>{item.resultUrls[0] ? <img src={item.resultUrls[0]} alt="" /> : <ImageIcon size={17} />}<i className={`task-state ${item.status}`} /></button>)}</div></section>}
    {needsInit && <section className="mode-assets"><div className="image-history-heading"><strong>{params.mode === 'inpaint' ? '重绘素材' : '参考原图'}</strong><span>{params.mode === 'inpaint' ? '原图 + 蒙版' : '上传或使用生成图'}</span></div><div className="asset-grid"><button className={params.initImageUrl ? 'asset-upload filled' : 'asset-upload'} onClick={() => initUploadRef.current?.click()}>{params.initImageUrl ? <img src={params.initImageUrl} alt="原图" /> : <><Upload size={18} /><span>{uploadingTarget === 'init' ? '上传中' : '上传原图'}</span></>}</button>{needsMask && <button className={params.maskImageUrl ? 'asset-upload filled mask' : 'asset-upload mask'} onClick={() => maskUploadRef.current?.click()}>{params.maskImageUrl ? <img src={params.maskImageUrl} alt="蒙版" /> : <><Upload size={18} /><span>{uploadingTarget === 'mask' ? '上传中' : '上传蒙版'}</span></>}</button>}</div><input ref={initUploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="上传原图" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadControlImage(file, 'init'); event.target.value = ''; }} /><input ref={maskUploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="上传蒙版" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadControlImage(file, 'mask'); event.target.value = ''; }} /><label className="strength-control">重绘强度 <span>{params.denoisingStrength.toFixed(2)}</span><input type="range" min="0" max="1" step="0.05" value={params.denoisingStrength} onChange={(event) => update({ denoisingStrength: Number(event.target.value) })} /></label>{needsMask && <label className="strength-control">蒙版模糊 <span>{params.maskBlur}px</span><input type="range" min="0" max="64" step="1" value={params.maskBlur} onChange={(event) => update({ maskBlur: Number(event.target.value) })} /></label>}</section>}
    <label className="field-block">提示词<textarea value={params.prompt} onChange={(event) => update({ prompt: event.target.value })} rows={4} placeholder="描述主体、环境、光线与风格" /></label>
    <label className="field-block">负面提示词<textarea value={params.negativePrompt} onChange={(event) => update({ negativePrompt: event.target.value })} rows={2} placeholder="不希望出现的内容" /></label>
    <div className="control-grid"><label>采样器<select value={params.samplerName} onChange={(event) => update({ samplerName: event.target.value })}>{(capabilities?.samplers.length ? capabilities.samplers : ['Euler a', 'DPM++ 2M', 'UniPC']).map((name) => <option key={name}>{name}</option>)}</select></label><label>步数<input type="number" value={params.steps} min="1" max="80" onChange={(event) => setNumber('steps', event.target.value)} /></label><label>宽度<input type="number" value={params.width} step="64" min="256" max="1536" onChange={(event) => setNumber('width', event.target.value)} /></label><label>高度<input type="number" value={params.height} step="64" min="256" max="1536" onChange={(event) => setNumber('height', event.target.value)} /></label><label>CFG<input type="number" value={params.cfgScale} step="0.5" min="1" max="20" onChange={(event) => setNumber('cfgScale', event.target.value)} /></label><label>种子<input type="number" value={params.seed} min="-1" onChange={(event) => setNumber('seed', event.target.value)} /></label></div>
    {(error || task?.status === 'failed') && <div className="task-error"><span>{error ?? task?.errorMessage ?? '生成失败，请检查参数后重试。'}</span>{task?.status === 'failed' && <button onClick={() => void retry(task.id)}><RotateCcw size={14} />重试</button>}</div>}
    <button className={`generate-command ${busy ? 'busy' : ''}`} onClick={() => busy ? void cancel() : void generate()} disabled={!canGenerate || Boolean(uploadingTarget)}>{busy ? <><X size={18} />取消生成</> : <><WandSparkles size={18} />{params.mode === 'txt2img' ? '确认并生成' : params.mode === 'img2img' ? '开始图生图' : '开始局部重绘'}</>}</button>
  </aside>;
}

function ImageViewer() {
  const url = useAppStore((state) => state.previewImageUrl);
  const close = useAppStore((state) => state.setPreviewImage);
  if (!url) return null;
  return <div className="image-viewer" onMouseDown={() => close(null)}><button onClick={() => close(null)} title="关闭"><X size={20} /></button><img src={url} alt="大图预览" onMouseDown={(event) => event.stopPropagation()} /></div>;
}

function PlaceholderPage({ page }: { page: 'models' | 'extensions' | 'plugins' }) {
  if (page === 'models') return <ModelsCatalog />;
  const copy = { models: ['模型管理', '集中查看后续可接入的 Checkpoint、LoRA 与 VAE。'], extensions: ['扩展', 'ControlNet 与高级工作流将在后续版本开放。'], plugins: ['插件', '社区插件体系正在设计中。'] }[page];
  return <section className="placeholder-page"><div className="section-title"><span>后续功能</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div><div className="placeholder-table"><div className="table-toolbar"><div className="search-field"><Search size={15} /><input placeholder="搜索" disabled /></div><button disabled><Plus size={16} />添加</button></div>{['核心能力', '创作辅助', '自动化工作流'].map((name, index) => <div className="placeholder-row" key={name}><div className="resource-icon">{index === 0 ? <Layers3 /> : index === 1 ? <WandSparkles /> : <Blocks />}</div><div><strong>{name}</strong><span>此能力尚未在 MVP 中启用</span></div><span className="coming-soon">即将推出</span></div>)}</div></section>;
}

function ModelsCatalog() {
  const openStudio = () => {
    if (window.wisadelDesktop) void window.wisadelDesktop.openImageStudio();
    else void window.open(`${window.location.pathname}?workspace=image`, '_blank', 'noopener');
  };
  const items = [
    { title: 'Stable Diffusion AI', tag: '图像生成', description: '进入独立的创作工作台，使用千问协作、Stable Diffusion 参数控制与云端 GPU 生图。', action: openStudio, icon: <WandSparkles size={25} />, ready: true },
    { title: 'DeepSeek V4 Pro', tag: '对话推理', description: '主对话模型。用于复杂推理、研究、工具执行与长内容协作。', icon: <Bot size={25} />, ready: false },
    { title: 'Qwen Vision', tag: '多模态', description: '图像理解与创作辅助能力将统一归入此模型中心。', icon: <ScanEye size={25} />, ready: false }
  ];
  return <section className="placeholder-page models-page"><div className="section-title"><span>MODEL CENTER</span><h1>模型</h1><p>统一管理 Wisadel 可用的对话、视觉、图像生成与后续接入模型。</p></div><div className="model-catalog">{items.map((item) => <button className={`model-card ${item.ready ? 'available' : ''}`} key={item.title} onClick={item.action} disabled={!item.ready}><div className="model-card-icon">{item.icon}</div><div className="model-card-copy"><div><strong>{item.title}</strong><span>{item.tag}</span></div><p>{item.description}</p></div><div className="model-card-action">{item.ready ? '打开工作台' : '即将接入'}</div></button>)}</div></section>;
}

function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const close = useAppStore((state) => state.setSettingsOpen);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const autoGenerate = useAppStore((state) => state.autoGenerate);
  const setAutoGenerate = useAppStore((state) => state.setAutoGenerate);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={() => close(false)}><section className="settings-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><span>偏好设置</span><h2>Wisadel 设置</h2></div><button className="icon-button" onClick={() => close(false)}><X size={19} /></button></header><div className="settings-content"><nav><button className="active"><Settings size={17} />常规</button><button><CircleUserRound size={17} />个性化</button><button><SlidersHorizontal size={17} />高级</button></nav><div className="settings-panel"><h3>常规</h3><div className="setting-row"><div><strong>界面主题</strong><span>主题会保存在当前设备。</span></div><div className="theme-switch" role="group" aria-label="界面主题"><button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>深色</button><button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>浅色</button></div></div><div className="setting-row"><div><strong>自动生成</strong><span>{autoGenerate ? '生成请求会直接提交给 Stable Diffusion。' : '关闭后，每次生成前需要手动确认。'}</span></div><button className={autoGenerate ? 'toggle on' : 'toggle'} onClick={() => setAutoGenerate(!autoGenerate)} aria-pressed={autoGenerate} aria-label="自动生成开关"><i /></button></div><div className="setting-row"><div><strong>本地缓存</strong><span>保留最近会话，断网时仍可浏览</span></div><button className="toggle on" aria-label="本地缓存开关"><i /></button></div><div className="setting-note">自定义 API、本地 SD 与自动更新将在后续版本开放。</div></div></div></section></div>;
}
