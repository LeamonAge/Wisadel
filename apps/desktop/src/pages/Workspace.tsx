import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  Blocks,
  Bot,
  ChevronDown,
  CircleUserRound,
  Download,
  Ellipsis,
  Eye,
  Image as ImageIcon,
  FileText,
  ImagePlus,
  Layers3,
  ListTodo,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  ScanEye,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Upload,
  WandSparkles,
  X,
  Zap,
  Minus,
  Moon,
  Sun,
  Square as WindowSquare
} from 'lucide-react';
import type {
  AgentTask,
  SanityAccount,
  SanityLedgerEntry,
  SdParams,
  Session
} from '@wisadel/contracts';
import { useAppStore } from '../store';
import { api, type PublicModel, type Workspace as WorkspaceRecord } from '../api';
import '../workspace-editor.css';

const navItems = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'models', label: '模型', icon: Layers3 },
  { id: 'extensions', label: '扩展', icon: Blocks },
  { id: 'plugins', label: '插件', icon: Zap }
] as const;

export function Workspace({
  onLogout,
  standaloneImage = false
}: {
  onLogout: () => void;
  standaloneImage?: boolean;
}) {
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
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem('wisadel.sessionSidebar') !== 'closed'
  );

  useEffect(() => {
    const resize = (event: PointerEvent) => {
      if (!resizingRef.current) return;
      const maxWidth = Math.min(620, Math.max(280, window.innerWidth - 62 - 250 - 390));
      const width = Math.min(maxWidth, Math.max(280, window.innerWidth - event.clientX));
      setImagePanelWidth(width);
    };
    const stopResize = () => {
      resizingRef.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResize);
    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResize);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('wisadel.imagePanelWidth', String(imagePanelWidth));
  }, [imagePanelWidth]);
  useEffect(() => {
    localStorage.setItem('wisadel.sessionSidebar', sidebarOpen ? 'open' : 'closed');
  }, [sidebarOpen]);

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
        <AppearanceQuickSwitch />
        <AccountMenu user={user} onLogout={onLogout} />
        <div className="titlebar-center">
          <span className="status-dot" />
          {standaloneImage ? 'Stable Diffusion AI' : 'Wisadel Preview'}
          {!standaloneImage && <WorkspaceTrustMenu />}
        </div>
        <div className="titlebar-actions">
          <SanityCenter />
          {!online && <span className="offline-badge">离线</span>}
          <WindowControls />
        </div>
      </header>
      <div
        className={`workspace-grid ${page === 'image' ? 'with-inspector' : ''} ${standaloneImage ? 'standalone-image' : ''} ${sidebarOpen ? '' : 'sidebar-collapsed'}`}
        style={{ '--image-panel-width': `${imagePanelWidth}px` } as CSSProperties}
      >
        {!standaloneImage && (
          <nav className="rail">
            <div className="rail-logo">
              <Sparkles size={21} />
            </div>
            <div className="rail-group">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={page === item.id ? 'active' : ''}
                  onClick={() => void setPage(item.id)}
                  title={item.label}
                >
                  <item.icon size={20} />
                </button>
              ))}
            </div>
            <button className="rail-settings" onClick={() => setSettingsOpen(true)} title="设置">
              <Settings size={20} />
            </button>
          </nav>
        )}
        {(page === 'chat' || page === 'image') && sidebarOpen && (
          <SessionSidebar onClose={() => setSidebarOpen(false)} />
        )}
        {page === 'chat' || page === 'image' ? (
          <Conversation sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />
        ) : (
          <PlaceholderPage page={page} />
        )}
        {page === 'image' && (
          <div
            className="image-panel-resizer"
            role="separator"
            aria-label="调整 Stable Diffusion 面板宽度"
            aria-orientation="vertical"
            onPointerDown={beginImagePanelResize}
          >
            <span />
          </div>
        )}
        {page === 'image' && <ImageInspector />}
      </div>
      <SettingsDialog />
      <ProfileEditor />
      <ImageViewer />
      {!standaloneImage && <LocalAgentRunner />}
      {!standaloneImage && <WorkspaceAuditPanel />}
    </main>
  );
}

function WorkspaceAuditPanel() {
  const [entries, setEntries] = useState<
    Array<{
      id: string;
      tool: string;
      status: string;
      inputSummary: string;
      resultSummary?: string;
      createdAt: string;
    }>
  >([]);
  useEffect(() => {
    const workspaceId = localStorage.getItem('wisadel.workspaceId');
    if (!workspaceId) return;
    const refresh = () =>
      void api
        .workspaceAudit(workspaceId)
        .then(setEntries)
        .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, []);
  if (!entries.length) return null;
  return (
    <aside className="workspace-audit-panel">
      <header>
        <ListTodo size={14} />
        <strong>Agent 审计</strong>
      </header>
      {entries.slice(0, 5).map((entry) => (
        <article key={entry.id}>
          <span className={entry.status.toLowerCase()}>{entry.status}</span>
          <div>
            <strong>{entry.tool}</strong>
            <p>{entry.inputSummary}</p>
            {entry.resultSummary && <small>{entry.resultSummary}</small>}
          </div>
        </article>
      ))}
    </aside>
  );
}

function LocalAgentRunner() {
  useEffect(() => {
    let running = false;
    const poll = async () => {
      if (running) return;
      const workspaceId = localStorage.getItem('wisadel.workspaceId');
      if (!workspaceId) return;
      try {
        const workspaces = await api.workspaces();
        const workspace = workspaces.find(
          (item) => item.id === workspaceId && item.trust === 'TRUSTED'
        );
        if (!workspace) return;
        const actions = await api.localAgentActions(workspace.id);
        for (const action of actions) {
          running = true;
          try {
            const input = action.input;
            const result =
              action.tool === 'read_file'
                ? await window.wisadelDesktop?.agentReadFile(
                    workspace.path,
                    String(input.path ?? '')
                  )
                : action.tool === 'write_file'
                  ? await window.wisadelDesktop?.agentWriteFile(
                      workspace.path,
                      String(input.path ?? ''),
                      String(input.content ?? '')
                    )
                  : action.tool === 'run_command'
                    ? await window.wisadelDesktop?.agentRunCommand(
                        workspace.path,
                        String(input.program ?? ''),
                        Array.isArray(input.args) ? input.args.map(String) : []
                      )
                    : Promise.reject(new Error(`不支持的本机工具：${action.tool}`));
            await api.completeLocalAgentAction(action.id, 'SUCCEEDED', result);
          } catch (error) {
            await api.completeLocalAgentAction(
              action.id,
              'FAILED',
              undefined,
              error instanceof Error ? error.message : '本机执行失败'
            );
          } finally {
            running = false;
          }
        }
      } catch {
        running = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 900);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}

function WorkspaceTrustMenu() {
  const [items, setItems] = useState<WorkspaceRecord[]>([]);
  const [selected, setSelected] = useState(() => localStorage.getItem('wisadel.workspaceId') ?? '');
  const [context, setContext] = useState<{
    project: { languages: string[]; suggestedCommands: string[] };
    git: { branch: string; status: string };
    tree: Array<{ path: string; kind: 'file' | 'directory' }>;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    void api
      .workspaces()
      .then((next) => {
        setItems(next);
        if (!selected && next[0]) {
          setSelected(next[0].id);
          localStorage.setItem('wisadel.workspaceId', next[0].id);
        }
      })
      .catch(() => undefined);
  }, [selected]);
  const active = items.find((item) => item.id === selected);
  const choose = async () => {
    const path = await window.wisadelDesktop?.chooseWorkspace();
    if (!path) return;
    const registered = await api.registerWorkspace(path);
    setItems((all) => [registered, ...all.filter((item) => item.id !== registered.id)]);
    setSelected(registered.id);
    localStorage.setItem('wisadel.workspaceId', registered.id);
  };
  if (!active)
    return (
      <button className="workspace-trust-badge untrusted" onClick={() => void choose()}>
        选择工作区
      </button>
    );
  const inspect = async () => {
    if (active.trust !== 'TRUSTED') return;
    const next = await window.wisadelDesktop?.workspaceContext(active.path);
    if (next) {
      setContext(next);
      setSelectedFile(null);
      setShowDiff(false);
    }
  };
  const openFile = async (relativePath: string) => {
    setLoadingFile(true);
    setSaveError('');
    try {
      const content = await window.wisadelDesktop?.agentReadFile(active.path, relativePath);
      if (content == null) return;
      setSelectedFile(relativePath);
      setOriginalContent(content);
      setEditedContent(content);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingFile(false);
    }
  };
  const saveFile = async () => {
    if (!selectedFile || editedContent === originalContent) return;
    setSaveError('');
    try {
      await window.wisadelDesktop?.agentWriteFile(active.path, selectedFile, editedContent);
      setOriginalContent(editedContent);
      setShowDiff(false);
      const next = await window.wisadelDesktop?.workspaceContext(active.path);
      if (next) setContext(next);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  };
  const diffLines = (() => {
    const before = originalContent.split('\n');
    const after = editedContent.split('\n');
    const max = Math.max(before.length, after.length);
    return Array.from({ length: max }, (_, index) => ({
      before: before[index] ?? '',
      after: after[index] ?? '',
      changed: before[index] !== after[index]
    }));
  })();
  return (
    <>
      {context && (
        <div className="modal-backdrop" onMouseDown={() => setContext(null)}>
          <section
            className="workspace-context-dialog workspace-editor-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>LOCAL WORKSPACE</span>
                <h2>{active.name}</h2>
              </div>
              <button className="icon-button" onClick={() => setContext(null)} title="关闭">
                <X size={18} />
              </button>
            </header>
            <div className="workspace-context-grid">
              <div>
                <strong>Git</strong>
                <p>{context.git.branch}</p>
                <pre>{context.git.status || '工作区无改动'}</pre>
              </div>
              <div>
                <strong>语言</strong>
                <p>{context.project.languages.join(' · ') || '未识别'}</p>
                <strong>建议命令</strong>
                {context.project.suggestedCommands.map((command) => (
                  <code key={command}>{command}</code>
                ))}
              </div>
            </div>
            <div className="workspace-editor-layout">
              <div className="workspace-files">
                {context.tree
                  .filter((item) => item.kind === 'file')
                  .slice(0, 160)
                  .map((item) => (
                    <button
                      className={selectedFile === item.path ? 'active' : ''}
                      key={item.path}
                      onClick={() => void openFile(item.path)}
                    >
                      {item.path}
                    </button>
                  ))}
              </div>
              <div className="workspace-editor">
                <div className="workspace-editor-toolbar">
                  <strong>{selectedFile ?? '选择文件查看'}</strong>
                  {selectedFile && (
                    <>
                      <span>{editedContent === originalContent ? '未修改' : '已修改'}</span>
                      <button
                        disabled={editedContent === originalContent || loadingFile}
                        onClick={() => setShowDiff(true)}
                      >
                        审阅差异
                      </button>
                    </>
                  )}
                </div>
                {selectedFile && (
                  <textarea
                    value={editedContent}
                    onChange={(event) => setEditedContent(event.target.value)}
                    spellCheck={false}
                    disabled={loadingFile}
                  />
                )}
                {saveError && <p className="workspace-editor-error">{saveError}</p>}
              </div>
            </div>
            {showDiff && selectedFile && (
              <div className="workspace-diff">
                <header>
                  <strong>保存前差异</strong>
                  <button className="icon-button" onClick={() => setShowDiff(false)} title="关闭">
                    <X size={16} />
                  </button>
                </header>
                <pre>
                  {diffLines.map((line, index) => (
                    <span className={line.changed ? 'changed' : ''} key={index}>
                      {line.changed ? `- ${line.before}\n+ ${line.after}` : `  ${line.after}`}\n
                    </span>
                  ))}
                </pre>
                <footer>
                  <button onClick={() => setShowDiff(false)}>取消</button>
                  <button className="primary" onClick={() => void saveFile()}>
                    确认保存
                  </button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
      <button
        className={`workspace-trust-badge ${active.trust.toLowerCase()}`}
        onClick={() =>
          void api
            .trustWorkspace(active.id, active.trust === 'TRUSTED' ? 'UNTRUSTED' : 'TRUSTED')
            .then((next) =>
              setItems((all) => all.map((item) => (item.id === next.id ? next : item)))
            )
        }
        onDoubleClick={() => void inspect()}
        title={
          active.trust === 'TRUSTED' ? '单击切换信任状态，双击查看本机工程摘要' : '单击设为已信任'
        }
      >
        <span>{active.name}</span>
        <small>{active.trust === 'TRUSTED' ? '已信任' : '待信任'}</small>
      </button>
    </>
  );
}

function WindowControls() {
  const control = (action: 'minimize' | 'maximize' | 'close') => {
    void window.wisadelDesktop?.windowControl(action);
  };
  return (
    <div className="window-controls">
      <button onClick={() => control('minimize')} aria-label="最小化" title="最小化">
        <Minus size={15} />
      </button>
      <button onClick={() => control('maximize')} aria-label="最大化或还原" title="最大化或还原">
        <WindowSquare size={13} />
      </button>
      <button
        className="close-control"
        onClick={() => control('close')}
        aria-label="关闭"
        title="关闭"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function AppearanceQuickSwitch() {
  const mode = useAppStore((state) => state.appearanceMode);
  const backgroundUrl = useAppStore((state) => state.backgroundUrl);
  const setTheme = useAppStore((state) => state.setTheme);
  const setMode = useAppStore((state) => state.setAppearanceMode);
  return (
    <div className="appearance-switch" aria-label="Appearance mode">
      <button
        className={mode === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
        title="Dark"
      >
        <Moon size={14} />
      </button>
      <button
        className={mode === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
        title="Light"
      >
        <Sun size={14} />
      </button>
      <button
        className={mode === 'custom' ? 'active' : ''}
        disabled={!backgroundUrl}
        onClick={() => setMode('custom')}
        title={backgroundUrl ? 'Custom background' : 'Choose a background in settings'}
      >
        <ImageIcon size={14} />
      </button>
    </div>
  );
}

function AccountMenu({
  user,
  onLogout
}: {
  user: { nickname: string; role: string };
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="account-menu">
      <button
        className="account-summary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="账户菜单"
      >
        <div className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{user.nickname}</strong>
          <span>{user.role === 'admin' ? '管理员' : '内测用户'}</span>
        </div>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="account-popover">
          <button type="button" onClick={() => setOpen(false)}>
            <CircleUserRound size={16} />
            账户设置
          </button>
          <button type="button" onClick={onLogout}>
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

function SanityCenter() {
  const [account, setAccount] = useState<SanityAccount | null>(null);
  const [ledger, setLedger] = useState<SanityLedgerEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = async (includeLedger = false) => {
    try {
      const [nextAccount, nextLedger] = await Promise.all([
        api.sanityAccount(),
        includeLedger ? api.sanityLedger() : Promise.resolve(null)
      ]);
      setAccount(nextAccount);
      if (nextLedger) setLedger(nextLedger);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onSanity = (event: Event) => {
      const detail = (event as CustomEvent<{ balanceMilli: number }>).detail;
      if (detail?.balanceMilli !== undefined)
        setAccount({
          balanceMilli: detail.balanceMilli,
          balance: detail.balanceMilli / 1000,
          unit: 'sanity'
        });
      if (open) void refresh(true);
    };
    window.addEventListener('wisadel:sanity', onSanity);
    return () => window.removeEventListener('wisadel:sanity', onSanity);
  }, [open]);

  const show = () => {
    setOpen(true);
    setLoading(true);
    void refresh(true);
  };
  return (
    <>
      <button className="sanity-button" onClick={show} title="理智中心">
        <img src="./sanity-icon.png" alt="" />
        <span>理智</span>
        <strong>{loading && !account ? '--' : (account?.balance ?? 0).toFixed(2)}</strong>
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="sanity-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>WISADEL SANITY</span>
                <h2>理智中心</h2>
              </div>
              <button className="icon-button" onClick={() => setOpen(false)} title="关闭">
                <X size={19} />
              </button>
            </header>
            <div className="sanity-balance">
              <img src="./sanity-icon.png" alt="理智" />
              <div>
                <span>当前可用理智</span>
                <strong>{(account?.balance ?? 0).toFixed(3)}</strong>
                <small>100 理智 = 1 元人民币</small>
              </div>
            </div>
            <div className="sanity-note">
              新用户初始获得 100 理智。对话完成后会根据模型实际返回的输入与输出 token
              精确结算；生图和云端 GPU 当前不扣理智。
            </div>
            <div className="sanity-ledger">
              <div className="sanity-ledger-heading">
                <strong>最近结算</strong>
                <span>精确至 0.001 理智</span>
              </div>
              {ledger.length ? (
                ledger.map((entry) => (
                  <div className="sanity-entry" key={entry.id}>
                    <div>
                      <strong>{entry.description}</strong>
                      <span>
                        {entry.model} · 输入 {entry.inputTokens.toLocaleString()} / 输出{' '}
                        {entry.outputTokens.toLocaleString()} token
                      </span>
                    </div>
                    <div>
                      <b>{(entry.deltaMilli / 1000).toFixed(3)}</b>
                      <span>余额 {(entry.balanceAfterMilli / 1000).toFixed(3)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sanity-empty">尚无结算记录</div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
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

  const filtered = sessions.filter((session) =>
    `${session.title}${session.preview}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <aside className="session-sidebar">
      <div className="sidebar-heading">
        <div>
          <span>{page === 'chat' ? '对话工作区' : '图像工作区'}</span>
          <strong>{page === 'chat' ? 'Wisadel 助手' : '创意画师'}</strong>
        </div>
        <button className="icon-button" onClick={onClose} title="收起历史会话">
          <PanelLeftClose size={18} />
        </button>
      </div>
      <div className="search-field">
        <Search size={15} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索会话"
        />
      </div>
      <div className="session-list">
        {filtered.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            active={session.id === activeId}
            onSelect={() => void select(session.id)}
            onDelete={() => void remove(session.id)}
            onRename={(title) => void rename(session.id, title)}
          />
        ))}
      </div>
      <button className="new-session" onClick={() => void create()}>
        <Plus size={17} />
        新建{page === 'chat' ? '对话' : '创作'}
      </button>
    </aside>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
  onRename
}: {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);
  const commit = () => {
    const value = title.trim();
    setEditing(false);
    if (value && value !== session.title) onRename(value);
    else setTitle(session.title);
  };
  return (
    <div
      className={`session-row ${active ? 'active' : ''}`}
      onClick={() => {
        if (!editing) onSelect();
      }}
    >
      <div className="session-icon">
        {session.kind === 'chat' ? <Bot size={17} /> : <WandSparkles size={17} />}
      </div>
      <div className="session-copy">
        {editing ? (
          <input
            className="session-title-input"
            autoFocus
            value={title}
            maxLength={100}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') {
                setTitle(session.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <>
            <strong>{session.title}</strong>
            <span>{session.preview}</span>
          </>
        )}
      </div>
      <button
        className="row-menu"
        onClick={(event) => {
          event.stopPropagation();
          setMenu(!menu);
        }}
        aria-label="会话菜单"
      >
        <Ellipsis size={17} />
      </button>
      {menu && (
        <div className="context-menu">
          <button
            className="rename"
            onClick={(event) => {
              event.stopPropagation();
              setMenu(false);
              setTitle(session.title);
              setEditing(true);
            }}
          >
            <Pencil size={15} />
            重命名
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={15} />
            删除
          </button>
        </div>
      )}
    </div>
  );
}

function Conversation({
  sidebarOpen,
  onOpenSidebar
}: {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}) {
  const page = useAppStore((state) => state.page);
  const sessions = useAppStore((state) => state.sessions);
  const activeId = useAppStore((state) => state.activeSessionId);
  const messages = useAppStore((state) => state.messages);
  const loadingConversation = useAppStore((state) => state.loadingConversation);
  const streaming = useAppStore((state) => state.streamingText);
  const sending = useAppStore((state) => state.sending);
  const sendError = useAppStore((state) => state.sendError);
  const currentUser = useAppStore((state) => state.user)!;
  const [assistantProfile, setAssistantProfile] = useState(() => JSON.parse(localStorage.getItem('wisadel.assistantProfile') ?? '{"name":"Wisadel","avatarUrl":""}') as { name: string; avatarUrl: string });
  useEffect(() => { const refresh = () => setAssistantProfile(JSON.parse(localStorage.getItem('wisadel.assistantProfile') ?? '{"name":"Wisadel","avatarUrl":""}')); window.addEventListener('wisadel:assistant-profile', refresh); return () => window.removeEventListener('wisadel:assistant-profile', refresh); }, []);
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
  const reloadSession = useAppStore((state) => state.selectSession);
  const [input, setInput] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [showReturnBottom, setShowReturnBottom] = useState(false);
  const [backgroundStarting, setBackgroundStarting] = useState(false);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const active = sessions.find((session) => session.id === activeId);
  const [models, setModels] = useState<PublicModel[]>(FALLBACK_MODELS);
  useEffect(() => {
    if (page === 'chat')
      void api
        .models()
        .then((result) => {
          if (result.models.length) setModels(result.models);
        })
        .catch(() => undefined);
  }, [page]);
  const changeModel = async (model: string) => {
    if (!activeId) return;
    const session = await api.setSessionModel(activeId, model);
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((item) => (item.id === session.id ? session : item))
    }));
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);
  useEffect(() => {
    setInput('');
  }, [page, activeId]);
  useEffect(() => {
    if (page !== 'chat' || !activeId) {
      setAgentTasks([]);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const tasks = await api.agentTasks(activeId);
        if (active) setAgentTasks(tasks);
      } catch {
        /* offline state is already surfaced elsewhere */
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [page, activeId]);
  const submit = () => {
    if (sending || uploading) return;
    const hasFiles = pendingImages.length || pendingAttachments.length;
    const value =
      input.trim() ||
      (hasFiles
        ? page === 'image'
          ? '请分析这些附件，并整理成适合 Stable Diffusion 的提示词与参数。'
          : '请分析这些附件。'
        : '');
    if (!value) return;
    setInput('');
    void send(value);
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  const startBackgroundTask = async () => {
    const value = input.trim();
    if (!value || !activeId || page !== 'chat' || backgroundStarting) return;
    setBackgroundStarting(true);
    setCaptureError(null);
    try {
      const task = await api.createAgentTask({
        sessionId: activeId,
        content: value,
        imageUrls: pendingImages,
        attachments: pendingAttachments
      });
      setInput('');
      setAgentTasks((items) => [task, ...items]);
      await reloadSession(activeId);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : '无法创建后台任务');
    } finally {
      setBackgroundStarting(false);
    }
  };
  const captureScreen = async () => {
    if (capturing || pendingImages.length >= 4) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const dataUrl = await window.wisadelDesktop?.captureScreen();
      if (!dataUrl) throw new Error('截图功能仅可在 Wisadel 桌面端使用');
      const blob = await (await fetch(dataUrl)).blob();
      const uploaded = await api.uploadImage(
        new File([blob], `Wisadel 截图 ${new Date().toLocaleString()}.png`, { type: 'image/png' })
      );
      attachImage(uploaded.url);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : '截图失败，请重试');
    } finally {
      setCapturing(false);
    }
  };
  const returnToBottom = () =>
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });

  return (
    <section className="conversation">
      <header className="conversation-header">
        <div className="conversation-title">
          {!sidebarOpen && (
            <button
              className="icon-button history-toggle"
              onClick={onOpenSidebar}
              title="打开历史会话"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
          <div>
            <span>{page === 'chat' ? 'AI 对话' : '图像生成'}</span>
            <h2>{active?.title ?? (loadingConversation ? '正在载入' : '新对话')}</h2>
          </div>
        </div>
        {page === 'chat' ? (
          <select
            className="model-selector"
            value={active?.model ?? ''}
            onChange={(event) => void changeModel(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.family} · {model.name}
              </option>
            ))}
          </select>
        ) : (
          <button className="model-selector">
            <span className="model-status" />
            Qwen Image
            <ChevronDown size={15} />
          </button>
        )}
      </header>
      {page === 'chat' && (
        <ModelPicker models={models} selectedModel={active?.model ?? ''} onSelect={changeModel} />
      )}
      <div
        className="message-list"
        ref={listRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          setShowReturnBottom(target.scrollHeight - target.scrollTop - target.clientHeight > 180);
        }}
      >
        {loadingConversation && (
          <div className="conversation-loading">
            <Sparkles size={18} />
            正在恢复会话
          </div>
        )}
        {!loadingConversation && !messages.length && (
          <div className="empty-conversation">
            <div className="empty-symbol">
              {page === 'chat' ? <MessageSquare size={25} /> : <WandSparkles size={25} />}
            </div>
            <h3>{page === 'chat' ? '今天想一起解决什么？' : '描述你想创造的画面'}</h3>
            <p>
              {page === 'chat'
                ? '从问题、想法或一段待整理的内容开始。'
                : '我会先整理提示词与参数，由你确认后再生成。'}
            </p>
            <div className="suggestions">
              {(page === 'chat'
                ? ['帮我梳理一个产品想法', '解释一段复杂概念', '制定今天的工作计划']
                : ['雨夜里的未来城市', '极简主义产品摄影', '电影感山谷晨雾']
              ).map((text) => (
                <button key={text} onClick={() => setInput(text)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <button className="message-avatar" onClick={() => window.dispatchEvent(new CustomEvent('wisadel:edit-profile', { detail: message.role === 'user' ? 'user' : 'assistant' }))} title={message.role === 'user' ? '编辑用户资料' : '编辑 AI 资料'}>
              {message.role === 'user' ? (currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : <CircleUserRound size={18} />) : (assistantProfile.avatarUrl ? <img src={assistantProfile.avatarUrl} alt="" /> : <Sparkles size={17} />)}
            </button>
            <div className="message-body">
              <div className="message-meta">
                {message.role === 'user' ? '你' : page === 'chat' ? 'Wisadel' : '创意画师'}
                <span>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="message-content">{message.content}</div>
              {!!message.imageUrls.length && (
                <div className="message-images">
                  {message.imageUrls.map((url) => (
                    <div className="message-image" key={url}>
                      <button onClick={() => previewImage(url)} title="查看大图">
                        <img src={url} alt="消息图片" />
                      </button>
                      {page === 'image' && (
                        <button
                          className="analyze-image"
                          onClick={() => attachImage(url)}
                          title="交给千问分析"
                        >
                          <ScanEye size={14} />
                          分析
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!!message.attachments?.length && (
                <div className="message-files">
                  {message.attachments.map((file) => (
                    <a href={file.url} target="_blank" rel="noreferrer" key={file.url}>
                      <FileText size={15} />
                      <span>{file.name}</span>
                      <small>{Math.max(1, Math.ceil(file.size / 1024))} KB</small>
                    </a>
                  ))}
                </div>
              )}
              {message.status === 'failed' && (
                <span className="message-error">{sendError ?? '发送失败，请重试'}</span>
              )}
            </div>
          </div>
        ))}
        {!!reasoningSteps.length && (
          <details className="reasoning-panel" open={!reasoningCollapsed}>
            <summary
              onClick={(event) => {
                event.preventDefault();
                setReasoningCollapsed(!reasoningCollapsed);
              }}
            >
              <Sparkles size={14} />
              {sending ? '正在思考与执行' : '思考与执行过程'}
            </summary>
            <div>
              {reasoningSteps.map((step, index) => (
                <p key={`${step}-${index}`}>{step}</p>
              ))}
            </div>
          </details>
        )}
        {streaming && (
          <div className="message assistant">
            <div className="message-avatar">
              <Sparkles size={17} />
            </div>
            <div className="message-body">
              <div className="message-meta">
                Wisadel<span>正在输入</span>
              </div>
              <div className="message-content streaming">{streaming}</div>
            </div>
          </div>
        )}
        {page === 'chat' && (
          <AgentTaskPanel
            tasks={agentTasks}
            onRetry={async (id) => {
              const task = await api.retryAgentTask(id);
              setAgentTasks((items) => items.map((item) => (item.id === id ? task : item)));
            }}
          />
        )}
        <div ref={endRef} />
      </div>
      {showReturnBottom && (
        <button className="return-bottom" onClick={returnToBottom}>
          <ChevronDown size={16} />
          回到底部
        </button>
      )}
      <div className="composer-wrap">
        <div className="composer">
          {!!pendingImages.length && (
            <div className="pending-images">
              {pendingImages.map((url) => (
                <div key={url}>
                  <img src={url} alt="待发送图片" />
                  <button type="button" onClick={() => removePending(url)} title="移除图片">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!!pendingAttachments.length && (
            <div className="pending-files">
              {pendingAttachments.map((file) => (
                <div key={file.url}>
                  <FileText size={15} />
                  <span>{file.name}</span>
                  <button type="button" onClick={() => removeAttachment(file.url)} title="移除文件">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={keyDown}
            placeholder={
              page === 'chat'
                ? '输入消息，或上传本地文件...'
                : '描述画面，或上传图片和文件让千问分析...'
            }
            rows={1}
          />
          <div className="composer-footer">
            <div className="composer-tools">
              <input
                ref={uploadRef}
                type="file"
                accept={page === 'image' ? 'image/*,.txt,.md,.json,.csv,.pdf' : undefined}
                hidden
                multiple
                onChange={(event) => {
                  for (const file of Array.from(event.target.files ?? []).slice(
                    0,
                    8 - pendingAttachments.length
                  ))
                    void uploadFile(file);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                className="attach-command"
                onClick={() => uploadRef.current?.click()}
                disabled={uploading || pendingAttachments.length >= 8}
                title="上传本地文件"
              >
                <Paperclip size={16} />
              </button>
              <button
                type="button"
                className="capture-command"
                onClick={() => void captureScreen()}
                disabled={capturing || pendingImages.length >= 4}
                title="截取当前屏幕并附加"
              >
                <Scissors size={16} />
              </button>
              {page === 'chat' && (
                <button
                  type="button"
                  className="background-command"
                  onClick={() => void startBackgroundTask()}
                  disabled={!input.trim() || backgroundStarting || sending}
                  title="放入后台任务队列"
                >
                  <ListTodo size={16} />
                </button>
              )}
              <span>
                {backgroundStarting
                  ? '正在创建后台任务'
                  : capturing
                    ? '正在截取屏幕'
                    : uploading
                      ? '正在上传文件'
                      : 'Enter 发送 · Shift + Enter 换行'}
              </span>
            </div>
            <button
              type="button"
              className="send-command"
              onClick={submit}
              disabled={
                (!input.trim() && !pendingImages.length && !pendingAttachments.length) ||
                sending ||
                uploading ||
                !activeId
              }
              aria-label="发送消息"
              title="发送消息"
            >
              {sending ? <Square size={16} /> : <Send size={17} />}
            </button>
          </div>
          {(sendError || captureError) && (
            <div className="composer-error">{sendError ?? captureError}</div>
          )}
        </div>
      </div>
    </section>
  );
}

const FALLBACK_MODELS: PublicModel[] = [
  {
    id: 'deepseek-ai/DeepSeek-V4-Pro',
    provider: 'siliconflow',
    family: 'DeepSeek',
    name: 'DeepSeek V4 Pro',
    modality: 'text'
  },
  {
    id: 'deepseek-ai/DeepSeek-V4-Flash',
    provider: 'siliconflow',
    family: 'DeepSeek',
    name: 'DeepSeek V4 Flash',
    modality: 'text'
  },
  {
    id: 'Qwen/Qwen3.5-397B-A17B',
    provider: 'siliconflow',
    family: 'Qwen',
    name: 'Qwen 3.5 397B',
    modality: 'text'
  },
  {
    id: 'Qwen/Qwen3.6-35B-A3B',
    provider: 'siliconflow',
    family: 'Qwen',
    name: 'Qwen 3.6 35B A3B',
    modality: 'text'
  },
  {
    id: 'Qwen/Qwen3.6-27B',
    provider: 'siliconflow',
    family: 'Qwen',
    name: 'Qwen 3.6 27B',
    modality: 'text'
  },
  {
    id: 'PaddlePaddle/PaddleOCR-VL-1.5',
    provider: 'siliconflow',
    family: 'PaddleOCR',
    name: 'PaddleOCR VL 1.5',
    modality: 'text'
  },
  {
    id: 'MiniMaxAI/MiniMax-M2.5',
    provider: 'siliconflow',
    family: 'MiniMax',
    name: 'MiniMax M2.5',
    modality: 'text'
  },
  {
    id: 'moonshotai/Kimi-K2.7-Code',
    provider: 'siliconflow',
    family: 'Kimi',
    name: 'Kimi K2.7 Code',
    modality: 'text'
  },
  {
    id: 'moonshotai/Kimi-K2.6',
    provider: 'siliconflow',
    family: 'Kimi',
    name: 'Kimi K2.6',
    modality: 'text'
  },
  {
    id: 'zai-org/GLM-5.2',
    provider: 'siliconflow',
    family: 'GLM',
    name: 'GLM 5.2',
    modality: 'text'
  },
  {
    id: 'zai-org/GLM-5.1',
    provider: 'siliconflow',
    family: 'GLM',
    name: 'GLM 5.1',
    modality: 'text'
  },
  {
    id: 'meituan-longcat/LongCat-2.0',
    provider: 'siliconflow',
    family: 'LongCat',
    name: 'LongCat 2.0',
    modality: 'text'
  },
  {
    id: 'stepfun-ai/Step-3.5-Flash',
    provider: 'siliconflow',
    family: 'StepFun',
    name: 'Step 3.5 Flash',
    modality: 'text'
  },
  {
    id: 'inclusionAI/Ling-flash-2.0',
    provider: 'siliconflow',
    family: 'Ling',
    name: 'Ling Flash 2.0',
    modality: 'text'
  },
  {
    id: 'inclusionAI/Ling-mini-2.0',
    provider: 'siliconflow',
    family: 'Ling',
    name: 'Ling Mini 2.0',
    modality: 'text'
  },
  {
    id: 'ByteDance-Seed/Seed-OSS-36B-Instruct',
    provider: 'siliconflow',
    family: 'Seed',
    name: 'Seed OSS 36B Instruct',
    modality: 'text'
  },
  {
    id: 'claude-opus-4-8',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Opus 4.8',
    modality: 'text'
  },
  {
    id: 'claude-opus-4-8-thinking',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Opus 4.8 Thinking',
    modality: 'text'
  },
  {
    id: 'claude-opus-4-7',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Opus 4.7',
    modality: 'text'
  },
  {
    id: 'claude-opus-4-7-thinking',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Opus 4.7 Thinking',
    modality: 'text'
  },
  {
    id: 'claude-opus-4-6',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Opus 4.6',
    modality: 'text'
  },
  {
    id: 'claude-opus-4-6-thinking',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Opus 4.6 Thinking',
    modality: 'text'
  },
  {
    id: 'claude-sonnet-5',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Sonnet 5',
    modality: 'text'
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Sonnet 4.6',
    modality: 'text'
  },
  {
    id: 'claude-fable-5',
    provider: 'openox',
    family: 'Claude',
    name: 'Claude Fable 5',
    modality: 'text'
  },
  { id: 'gpt-5.6-sol', provider: 'openox', family: 'GPT', name: 'GPT 5.6 Sol', modality: 'text' },
  {
    id: 'gpt-5.6-terra',
    provider: 'openox',
    family: 'GPT',
    name: 'GPT 5.6 Terra',
    modality: 'text'
  },
  { id: 'gpt-5.6-luna', provider: 'openox', family: 'GPT', name: 'GPT 5.6 Luna', modality: 'text' },
  { id: 'gpt-5.5', provider: 'openox', family: 'GPT', name: 'GPT 5.5', modality: 'text' },
  { id: 'gpt-5.4', provider: 'openox', family: 'GPT', name: 'GPT 5.4', modality: 'text' },
  { id: 'gpt-5.4-mini', provider: 'openox', family: 'GPT', name: 'GPT 5.4 Mini', modality: 'text' },
  {
    id: 'gemini-3.1-pro-preview',
    provider: 'openox',
    family: 'Gemini',
    name: 'Gemini 3.1 Pro',
    modality: 'text'
  },
  {
    id: 'gemini-3.5-flash',
    provider: 'openox',
    family: 'Gemini',
    name: 'Gemini 3.5 Flash',
    modality: 'text'
  },
  { id: 'grok-4.5', provider: 'openox', family: 'Grok', name: 'Grok 4.5', modality: 'text' }
];

const OFFICIAL_BRAND_SLUG: Record<string, string> = {
  deepseek: 'deepseek',
  qwen: 'qwen',
  paddleocr: 'paddlepaddle',
  minimax: 'minimax',
  seed: 'bytedance',
  claude: 'anthropic',
  gemini: 'googlegemini',
  grok: 'x'
};

const visualForFamily = (family: string) => {
  const key = family.toLowerCase().replaceAll(' ', '');
  const slug = OFFICIAL_BRAND_SLUG[key];
  return (
    <span className={`family-icon model-brand ${key}`}>
      {slug ? (
        <img src={`https://cdn.simpleicons.org/${slug}`} alt={`${family} official logo`} />
      ) : (
        <b>{family.slice(0, 2).toUpperCase()}</b>
      )}
    </span>
  );
};

function ModelPicker({
  models,
  selectedModel,
  onSelect
}: {
  models: PublicModel[];
  selectedModel: string;
  onSelect: (model: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState<string | null>(null);
  const catalogue = models.length > 1 ? models : FALLBACK_MODELS;
  const selected = catalogue.find((item) => item.id === selectedModel) ?? catalogue[0];
  const families = [...new Set(catalogue.map((item) => item.family))];
  const versions = family ? catalogue.filter((item) => item.family === family) : [];
  const choose = async (id: string) => {
    await onSelect(id);
    setOpen(false);
    setFamily(null);
  };
  const label = selected ? `${selected.family} - ${selected.name}` : 'Select model';
  return (
    <div className="model-picker">
      <button className="model-picker-trigger" onClick={() => setOpen((value) => !value)}>
        {selected ? visualForFamily(selected.family) : <Bot size={15} />}
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="model-picker-menu">
          <header>
            {family ? (
              <button onClick={() => setFamily(null)}>返回模型系列</button>
            ) : (
              <strong>选择 AI 模型</strong>
            )}
            <button className="icon-button" onClick={() => setOpen(false)}>
              <X size={15} />
            </button>
          </header>
          {!family && (
            <div className="model-provider-grid">
              {families.map((name) => (
                <button key={name} onClick={() => setFamily(name)}>
                  {visualForFamily(name)}
                  <strong>{name}</strong>
                  <small>{catalogue.filter((item) => item.family === name).length} 个版本</small>
                </button>
              ))}
            </div>
          )}
          {family && (
            <div className="model-version-list">
              {versions.map((model) => (
                <button
                  key={model.id}
                  className={model.id === selectedModel ? 'active' : ''}
                  onClick={() => void choose(model.id)}
                >
                  {visualForFamily(model.family)}
                  <div>
                    <strong>{model.name}</strong>
                    <small>
                      {model.provider === 'siliconflow'
                        ? 'SiliconFlow'
                        : model.provider === 'openox'
                          ? 'OpenOx'
                          : 'DeepSeek'}{' '}
                      · {model.id}
                    </small>
                  </div>
                  {model.id === selectedModel && <span className="model-status" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentTaskPanel({
  tasks,
  onRetry
}: {
  tasks: AgentTask[];
  onRetry: (id: string) => Promise<void>;
}) {
  const visible = tasks.slice(0, 3);
  if (!visible.length) return null;
  return (
    <section className="agent-task-panel">
      <header>
        <div>
          <ListTodo size={15} />
          <strong>后台任务</strong>
        </div>
        <span>关闭窗口后仍会继续</span>
      </header>
      {visible.map((task) => (
        <article className={`agent-task ${task.status}`} key={task.id}>
          <div className="agent-task-heading">
            <strong>{task.content}</strong>
            <span>
              {
                (
                  {
                    queued: '排队中',
                    running: '执行中',
                    succeeded: '已完成',
                    failed: '失败',
                    cancelled: '已取消'
                  } as Record<string, string>
                )[task.status]
              }
            </span>
          </div>
          <ol>
            {task.steps.map((step) => (
              <li className={step.status} key={step.id}>
                <i />{' '}
                <div>
                  <strong>{step.title}</strong>
                  {step.detail && <span>{step.detail}</span>}
                </div>
              </li>
            ))}
          </ol>
          {task.status === 'failed' && (
            <footer>
              <span>{task.errorMessage ?? '后台任务失败'}</span>
              <button onClick={() => void onRetry(task.id)}>
                <RotateCcw size={13} />
                重试
              </button>
            </footer>
          )}
        </article>
      ))}
    </section>
  );
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
  const canGenerate =
    params.prompt.trim() &&
    (!needsInit || params.initImageUrl) &&
    (!needsMask || params.maskImageUrl);
  const availableScripts =
    params.mode === 'txt2img'
      ? (capabilities?.scripts.txt2img ?? [])
      : (capabilities?.scripts.img2img ?? []);
  const toggleLora = (name: string) =>
    update({
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

  return (
    <aside className="image-inspector">
      <header>
        <div>
          <span>生成控制</span>
          <h2>Stable Diffusion</h2>
        </div>
        <SlidersHorizontal size={19} />
      </header>
      <div className="mode-tabs">
        <button
          className={params.mode === 'txt2img' ? 'active' : ''}
          onClick={() => update({ mode: 'txt2img' })}
        >
          文生图
        </button>
        <button
          className={params.mode === 'img2img' ? 'active' : ''}
          onClick={() => update({ mode: 'img2img' })}
        >
          图生图
        </button>
        <button
          className={params.mode === 'inpaint' ? 'active' : ''}
          onClick={() => update({ mode: 'inpaint' })}
        >
          局部重绘
        </button>
      </div>
      <section className="sd-components">
        <div className="image-history-heading">
          <strong>组件编排</strong>
          <span>{capabilities?.mode === 'remote' ? '实时' : '未连接'}</span>
        </div>
        <div className="component-grid">
          <label>
            模型
            <select
              value={params.modelCheckpoint ?? ''}
              onChange={(event) => update({ modelCheckpoint: event.target.value || null })}
            >
              <option value="">当前模型</option>
              {capabilities?.models.map((model) => (
                <option key={model.title} value={model.title}>
                  {model.modelName}
                </option>
              ))}
            </select>
          </label>
          <label>
            调度器
            <select
              value={params.schedulerName ?? ''}
              onChange={(event) => update({ schedulerName: event.target.value || null })}
            >
              <option value="">自动</option>
              {capabilities?.schedulers.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            VAE
            <select
              value={params.vaeName ?? ''}
              onChange={(event) => update({ vaeName: event.target.value || null })}
            >
              <option value="">自动</option>
              {capabilities?.vaes.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            脚本
            <select
              value={params.scriptName ?? ''}
              onChange={(event) =>
                update({ scriptName: event.target.value || null, scriptArgs: [] })
              }
            >
              <option value="">关闭</option>
              {availableScripts.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="lora-control">
          <span>LoRA</span>
          <div>
            {capabilities?.loras.length ? (
              capabilities.loras.map((lora) => (
                <button
                  key={lora.name}
                  className={params.loras.some((item) => item.name === lora.name) ? 'active' : ''}
                  onClick={() => toggleLora(lora.name)}
                >
                  {lora.alias}
                </button>
              ))
            ) : (
              <em>未安装</em>
            )}
          </div>
        </div>
      </section>
      {task?.resultUrls[0] ? (
        <div className="result-preview">
          <button
            className="result-image-button"
            onClick={() => previewImage(task.resultUrls[0]!)}
            title="点击查看大图"
          >
            <img src={task.resultUrls[0]} alt="生成结果" />
            <span>
              <Eye size={15} />
              查看大图
            </span>
          </button>
          <div className="result-actions">
            <a href={task.resultUrls[0]} download title="下载图片">
              <Download size={16} />
            </a>
            <button onClick={() => attachImage(task.resultUrls[0]!)} title="交给千问分析">
              <ScanEye size={16} />
            </button>
            <button
              onClick={() => update({ mode: 'img2img', initImageUrl: task.resultUrls[0]! })}
              title="作为图生图原图"
            >
              <ImagePlus size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="preview-placeholder">
          <ImageIcon size={24} />
          <span>{busy ? `正在生成 ${task.progress}%` : '生成结果将显示在这里'}</span>
          {busy && (
            <div className="progress">
              <i style={{ width: `${task.progress}%` }} />
            </div>
          )}
        </div>
      )}
      {!!tasks.length && (
        <section className="image-history">
          <div className="image-history-heading">
            <strong>生成历史</strong>
            <span>{tasks.length} 项</span>
          </div>
          <div className="image-history-list">
            {tasks.map((item) => (
              <button
                key={item.id}
                className={item.id === task?.id ? 'active' : ''}
                onClick={() => selectTask(item.id)}
                title={item.params.prompt}
              >
                {item.resultUrls[0] ? (
                  <img src={item.resultUrls[0]} alt="" />
                ) : (
                  <ImageIcon size={17} />
                )}
                <i className={`task-state ${item.status}`} />
              </button>
            ))}
          </div>
        </section>
      )}
      {needsInit && (
        <section className="mode-assets">
          <div className="image-history-heading">
            <strong>{params.mode === 'inpaint' ? '重绘素材' : '参考原图'}</strong>
            <span>{params.mode === 'inpaint' ? '原图 + 蒙版' : '上传或使用生成图'}</span>
          </div>
          <div className="asset-grid">
            <button
              className={params.initImageUrl ? 'asset-upload filled' : 'asset-upload'}
              onClick={() => initUploadRef.current?.click()}
            >
              {params.initImageUrl ? (
                <img src={params.initImageUrl} alt="原图" />
              ) : (
                <>
                  <Upload size={18} />
                  <span>{uploadingTarget === 'init' ? '上传中' : '上传原图'}</span>
                </>
              )}
            </button>
            {needsMask && (
              <button
                className={params.maskImageUrl ? 'asset-upload filled mask' : 'asset-upload mask'}
                onClick={() => maskUploadRef.current?.click()}
              >
                {params.maskImageUrl ? (
                  <img src={params.maskImageUrl} alt="蒙版" />
                ) : (
                  <>
                    <Upload size={18} />
                    <span>{uploadingTarget === 'mask' ? '上传中' : '上传蒙版'}</span>
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={initUploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label="上传原图"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadControlImage(file, 'init');
              event.target.value = '';
            }}
          />
          <input
            ref={maskUploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label="上传蒙版"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadControlImage(file, 'mask');
              event.target.value = '';
            }}
          />
          <label className="strength-control">
            重绘强度 <span>{params.denoisingStrength.toFixed(2)}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={params.denoisingStrength}
              onChange={(event) => update({ denoisingStrength: Number(event.target.value) })}
            />
          </label>
          {needsMask && (
            <label className="strength-control">
              蒙版模糊 <span>{params.maskBlur}px</span>
              <input
                type="range"
                min="0"
                max="64"
                step="1"
                value={params.maskBlur}
                onChange={(event) => update({ maskBlur: Number(event.target.value) })}
              />
            </label>
          )}
        </section>
      )}
      <label className="field-block">
        提示词
        <textarea
          value={params.prompt}
          onChange={(event) => update({ prompt: event.target.value })}
          rows={4}
          placeholder="描述主体、环境、光线与风格"
        />
      </label>
      <label className="field-block">
        负面提示词
        <textarea
          value={params.negativePrompt}
          onChange={(event) => update({ negativePrompt: event.target.value })}
          rows={2}
          placeholder="不希望出现的内容"
        />
      </label>
      <div className="control-grid">
        <label>
          采样器
          <select
            value={params.samplerName}
            onChange={(event) => update({ samplerName: event.target.value })}
          >
            {(capabilities?.samplers.length
              ? capabilities.samplers
              : ['Euler a', 'DPM++ 2M', 'UniPC']
            ).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          步数
          <input
            type="number"
            value={params.steps}
            min="1"
            max="80"
            onChange={(event) => setNumber('steps', event.target.value)}
          />
        </label>
        <label>
          宽度
          <input
            type="number"
            value={params.width}
            step="64"
            min="256"
            max="1536"
            onChange={(event) => setNumber('width', event.target.value)}
          />
        </label>
        <label>
          高度
          <input
            type="number"
            value={params.height}
            step="64"
            min="256"
            max="1536"
            onChange={(event) => setNumber('height', event.target.value)}
          />
        </label>
        <label>
          CFG
          <input
            type="number"
            value={params.cfgScale}
            step="0.5"
            min="1"
            max="20"
            onChange={(event) => setNumber('cfgScale', event.target.value)}
          />
        </label>
        <label>
          种子
          <input
            type="number"
            value={params.seed}
            min="-1"
            onChange={(event) => setNumber('seed', event.target.value)}
          />
        </label>
      </div>
      {(error || task?.status === 'failed') && (
        <div className="task-error">
          <span>{error ?? task?.errorMessage ?? '生成失败，请检查参数后重试。'}</span>
          {task?.status === 'failed' && (
            <button onClick={() => void retry(task.id)}>
              <RotateCcw size={14} />
              重试
            </button>
          )}
        </div>
      )}
      <button
        className={`generate-command ${busy ? 'busy' : ''}`}
        onClick={() => (busy ? void cancel() : void generate())}
        disabled={!canGenerate || Boolean(uploadingTarget)}
      >
        {busy ? (
          <>
            <X size={18} />
            取消生成
          </>
        ) : (
          <>
            <WandSparkles size={18} />
            {params.mode === 'txt2img'
              ? '确认并生成'
              : params.mode === 'img2img'
                ? '开始图生图'
                : '开始局部重绘'}
          </>
        )}
      </button>
    </aside>
  );
}

function ImageViewer() {
  const url = useAppStore((state) => state.previewImageUrl);
  const close = useAppStore((state) => state.setPreviewImage);
  if (!url) return null;
  return (
    <div className="image-viewer" onMouseDown={() => close(null)}>
      <button onClick={() => close(null)} title="关闭">
        <X size={20} />
      </button>
      <img src={url} alt="大图预览" onMouseDown={(event) => event.stopPropagation()} />
    </div>
  );
}

function PlaceholderPage({ page }: { page: 'models' | 'extensions' | 'plugins' }) {
  if (page === 'models') return <ModelsCatalog />;
  const copy = {
    models: ['模型管理', '集中查看后续可接入的 Checkpoint、LoRA 与 VAE。'],
    extensions: ['扩展', 'ControlNet 与高级工作流将在后续版本开放。'],
    plugins: ['插件', '社区插件体系正在设计中。']
  }[page];
  return (
    <section className="placeholder-page">
      <div className="section-title">
        <span>后续功能</span>
        <h1>{copy[0]}</h1>
        <p>{copy[1]}</p>
      </div>
      <div className="placeholder-table">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={15} />
            <input placeholder="搜索" disabled />
          </div>
          <button disabled>
            <Plus size={16} />
            添加
          </button>
        </div>
        {['核心能力', '创作辅助', '自动化工作流'].map((name, index) => (
          <div className="placeholder-row" key={name}>
            <div className="resource-icon">
              {index === 0 ? <Layers3 /> : index === 1 ? <WandSparkles /> : <Blocks />}
            </div>
            <div>
              <strong>{name}</strong>
              <span>此能力尚未在 MVP 中启用</span>
            </div>
            <span className="coming-soon">即将推出</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModelsCatalog() {
  const items = [
    {
      title: '图像能力',
      tag: '暂未开放',
      description:
        '图像工作区正在迁移到统一模型路由。本版本暂不提供 Stable Diffusion 或其他图像模型入口。',
      icon: <ImageIcon size={25} />,
      ready: false
    }
  ];
  return (
    <section className="placeholder-page models-page">
      <div className="section-title">
        <span>MODEL CENTER</span>
        <h1>模型</h1>
        <p>统一管理 Wisadel 可用的对话、视觉、图像生成与后续接入模型。</p>
      </div>
      <div className="model-catalog">
        {items.map((item) => (
          <button
            className={`model-card ${item.ready ? 'available' : ''}`}
            key={item.title}
            disabled={!item.ready}
          >
            <div className="model-card-icon">{item.icon}</div>
            <div className="model-card-copy">
              <div>
                <strong>{item.title}</strong>
                <span>{item.tag}</span>
              </div>
              <p>{item.description}</p>
            </div>
            <div className="model-card-action">暂未开放</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfileEditor() {
  const user = useAppStore((state) => state.user)!;
  const setUser = useAppStore((state) => state.setUser);
  const [kind, setKind] = useState<'user' | 'assistant' | null>(null);
  const [name, setName] = useState(''); const [avatar, setAvatar] = useState(''); const [error, setError] = useState('');
  useEffect(() => { const open = (event: Event) => { const next = (event as CustomEvent<'user' | 'assistant'>).detail; setKind(next); const assistant = JSON.parse(localStorage.getItem('wisadel.assistantProfile') ?? '{"name":"Wisadel","avatarUrl":""}'); setName(next === 'user' ? user.nickname : assistant.name ?? 'Wisadel'); setAvatar(next === 'user' ? user.avatarUrl ?? '' : assistant.avatarUrl ?? ''); setError(''); }; window.addEventListener('wisadel:edit-profile', open); return () => window.removeEventListener('wisadel:edit-profile', open); }, [user]);
  if (!kind) return null;
  const save = async () => { try { if (!name.trim()) throw new Error('名称不能为空'); if (kind === 'user') { const next = await api.updateProfile(name.trim(), avatar.trim() || null); setUser(next); localStorage.setItem('wisadel.user', JSON.stringify(next)); } else localStorage.setItem('wisadel.assistantProfile', JSON.stringify({ name: name.trim(), avatarUrl: avatar.trim() })); setKind(null); } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); } };
    return <div className="modal-backdrop" onMouseDown={() => setKind(null)}><section className="settings-dialog profile-dialog" onMouseDown={(event) => event.stopPropagation()}><header><div><span>PROFILE</span><h2>{kind === 'user' ? '编辑用户资料' : '编辑 AI 资料'}</h2></div><button className="icon-button" onClick={() => setKind(null)}><X size={19} /></button></header><div className="settings-panel"><label className="setting-field">名称<input value={name} maxLength={50} onChange={(event) => setName(event.target.value)} /></label><label className="setting-field">头像 URL<input value={avatar} placeholder="https://... 或 data:image/..." onChange={(event) => setAvatar(event.target.value)} /></label>{error && <div className="setting-note">{error}</div>}<button className="text-command" onClick={() => void save()}>保存资料</button></div></section></div>;
}

function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const close = useAppStore((state) => state.setSettingsOpen);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const localFileAccess = useAppStore((state) => state.localFileAccess);
  const setLocalFileAccess = useAppStore((state) => state.setLocalFileAccess);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const workspaceOpacity = useAppStore((state) => state.workspaceOpacity);
  const conversationOpacity = useAppStore((state) => state.conversationOpacity);
  const backgroundUrl = useAppStore((state) => state.backgroundUrl);
  const setAppearance = useAppStore((state) => state.setAppearance);
  const providers = useAppStore((state) => state.providers);
  const setProviders = useAppStore((state) => state.setProviders);
  const [tab, setTab] = useState<'general' | 'agent' | 'appearance' | 'advanced'>('general');
  const [workStyle, setWorkStyle] = useState('codex');
  const [workInstructions, setWorkInstructions] = useState(
    '先理解现有代码和任务目标，再进行范围明确的实现。优先复用现有模式；修改后运行相关检查，并简洁说明实际完成内容与验证结果。'
  );
  const [persona, setPersona] = useState('serious');
  const [personaInstructions, setPersonaInstructions] = useState('保持严谨、克制、专业的语气。');
  const [customEditor, setCustomEditor] = useState<'work' | 'persona' | null>(null);
  const [agentStatus, setAgentStatus] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [providerModels, setProviderModels] = useState('');
  const [providerKey, setProviderKey] = useState('');
  const agentPresets: Record<string, { label: string; instructions: string }> = {
    codex: {
      label: 'Codex 开发',
      instructions:
        '先理解现有代码和任务目标，再进行范围明确的实现。优先复用现有模式；修改后运行相关检查，并简洁说明实际完成内容与验证结果。'
    },
    product: {
      label: '产品协作',
      instructions:
        '从用户目标和实际使用流程出发。先指出关键取舍，再给出清晰、可执行的结果；需要改动时保持界面与现有产品一致。'
    },
    research: {
      label: '研究分析',
      instructions:
        '先区分事实、假设和不确定性。需要时使用可靠来源或工具核验，再用结构化、可追溯的方式给出结论。'
    },
    concise: {
      label: '简洁助手',
      instructions:
        '直接给出结论和可执行操作。避免重复背景、冗长解释和不必要的步骤；遇到风险或不确定性时明确说明。'
    },
    custom: { label: '自定义', instructions: '' }
  };
  const personaPresets: Record<string, { label: string; instructions: string }> = {
    serious: { label: '严肃认真', instructions: '保持严谨、克制、专业的语气。先核对事实和约束，再给出有依据的结论。' }, cheerful: { label: '开朗乐观', instructions: '保持明快、友善、积极的语气。清楚说明进展与风险。' }, stern: { label: '冷酷严峻', instructions: '保持冷静、直接、简练的语气。优先陈述事实、约束和决策。' }, refined: { label: '随和儒雅', instructions: '保持温和、从容、有分寸的语气。清晰解释判断与取舍。' }, scoundrel: { label: '斯文败类', instructions: '采用文雅、克制而略带危险感的表达风格，但始终尊重用户，不操纵或贬低他人。' }, contrast: { label: '反差', instructions: '表面表达克制，关键处呈现细致关照与敏锐观察。' }, villain: { label: '恶役', instructions: '采用戏剧化、掌控感较强但尊重用户的表达风格。结果必须准确可验证。' }, tsundere: { label: '傲娇', instructions: '使用轻微嘴硬、克制关心的语气，不攻击或羞辱用户。' }, fiery: { label: '易怒', instructions: '表达可以急切但不辱骂或威胁，聚焦问题和解决办法。' }, motherly: { label: '妈妈型', instructions: '保持耐心、照顾周全、善于提醒风险的语气。' }, sister: { label: '妹妹型', instructions: '使用活泼、亲近、礼貌且有边界感的语气。' }, brother: { label: '哥哥型', instructions: '使用稳重、支持、可靠的语气。' }, uncle: { label: '油腻大叔', instructions: '使用略带夸张但不冒犯的成年人口吻，避免性暗示和骚扰。' }, officer: { label: '军官', instructions: '使用纪律严明、目标清晰的指挥风格，尊重用户决定。' }, brat: { label: '雌小鬼', instructions: '使用俏皮、轻微挑衅但不冒犯的语气；不羞辱、性化或贬低用户。' }, custom: { label: '自定义人格', instructions: '' }
  };
  useEffect(() => {
    const workspaceId = localStorage.getItem('wisadel.workspaceId');
    if (!workspaceId || !open) return;
    void api
      .workspaces()
      .then((items) => {
        const saved = items.find((item) => item.id === workspaceId)?.settings.agentProfile as
          { workStyle?: string; workInstructions?: string; persona?: string; personaInstructions?: string; preset?: string; instructions?: string } | undefined;
        if (saved) {
          setWorkStyle(saved.workStyle ?? saved.preset ?? 'codex'); setWorkInstructions(saved.workInstructions ?? saved.instructions ?? '');
          setPersona(saved.persona ?? 'serious'); setPersonaInstructions(saved.personaInstructions ?? '保持严谨、克制、专业的语气。');
        }
      })
      .catch(() => undefined);
  }, [open]);
  const saveAgentProfile = async () => {
    const workspaceId = localStorage.getItem('wisadel.workspaceId');
    if (!workspaceId) {
      setAgentStatus('请先在标题栏选择并信任一个工作区。');
      return;
    }
    try {
      await api.updateWorkspaceSettings(workspaceId, {
        agentProfile: {
          workStyle, workInstructions: workInstructions.trim().slice(0, 8000), persona, personaInstructions: personaInstructions.trim().slice(0, 4000),
          instructions: `工作方式：${workInstructions.trim()}\n\n沟通人格：${personaInstructions.trim()}`.slice(0, 12000)
        }
      });
      setAgentStatus('已保存。后续对话会对所有模型生效。');
    } catch (error) {
      setAgentStatus(error instanceof Error ? error.message : '保存失败');
    }
  };
  const addProvider = async () => {
    const name = providerName.trim();
    const baseUrl = providerUrl.trim().replace(/\/$/, '');
    const models = providerModels
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!name || !/^https:\/\//i.test(baseUrl) || !models.length) return;
    const id = crypto.randomUUID();
    if (providerKey.trim()) await window.wisadelDesktop?.setProviderSecret(id, providerKey.trim());
    setProviders([
      ...providers,
      { id, name, baseUrl, models, hasKey: Boolean(providerKey.trim()) }
    ]);
    setProviderName('');
    setProviderUrl('');
    setProviderModels('');
    setProviderKey('');
  };
  if (!open) return null;
  const persistBackground = (file: File) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      setAppearance({ backgroundUrl: canvas.toDataURL('image/jpeg', 0.84) });
    };
    image.onerror = () => URL.revokeObjectURL(objectUrl);
    image.src = objectUrl;
  };
  return (
    <div className="modal-backdrop" onMouseDown={() => close(false)}>
      <section className="settings-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>偏好设置</span>
            <h2>Wisadel 设置</h2>
          </div>
          <button className="icon-button" onClick={() => close(false)}>
            <X size={19} />
          </button>
        </header>
        <div className="settings-content">
          <nav>
            <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
              <Settings size={17} />
              常规
            </button>
            <button
              className={tab === 'agent' ? 'active' : ''}
              onClick={() => setTab('agent')}
            >
              <Bot size={17} />
              Agent
            </button>
            <button
              className={tab === 'appearance' ? 'active' : ''}
              onClick={() => setTab('appearance')}
            >
              <CircleUserRound size={17} />
              个性化
            </button>
            <button
              className={tab === 'advanced' ? 'active' : ''}
              onClick={() => setTab('advanced')}
            >
              <SlidersHorizontal size={17} />
              高级
            </button>
          </nav>
          <div className="settings-panel">
            {tab === 'general' && (
              <>
                <h3>常规</h3>
                <div className="setting-row">
                  <div>
                    <strong>界面主题</strong>
                    <span>主题会保存在当前设备。</span>
                  </div>
                  <div className="theme-switch">
                    <button
                      className={theme === 'dark' ? 'active' : ''}
                      onClick={() => setTheme('dark')}
                    >
                      深色
                    </button>
                    <button
                      className={theme === 'light' ? 'active' : ''}
                      onClick={() => setTheme('light')}
                    >
                      浅色
                    </button>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <strong>允许访问本地文件</strong>
                    <span>默认关闭。Agent 每次使用文件、命令或网络工具前都会请求确认。</span>
                  </div>
                  <button
                    className={localFileAccess ? 'toggle on' : 'toggle'}
                    onClick={() => setLocalFileAccess(!localFileAccess)}
                    aria-pressed={localFileAccess}
                  >
                    <i />
                  </button>
                </div>
                <div className="setting-note">
                  访问记录会显示在 Agent 对话中；敏感凭据文件始终被屏蔽。
                </div>
              </>
            )}
            {tab === 'agent' && (
              <>
                <h3>Agent 配置</h3>
                <label className="setting-field">
                  配置
                  <select
                    value={workStyle}
                    onChange={(event) => {
                      const next = event.target.value;
                      setWorkStyle(next); if (next === 'custom') setCustomEditor('work');
                      if (next !== 'custom') setWorkInstructions(agentPresets[next]!.instructions);
                    }}
                  >
                    {Object.entries(agentPresets).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
                  </select>
                </label>
                <button className="text-command" onClick={() => setCustomEditor('work')}>编辑工作方式指令</button>
                <label className="setting-field">沟通人格<select value={persona} onChange={(event) => { const next = event.target.value; setPersona(next); if (next === 'custom') setCustomEditor('persona'); else setPersonaInstructions(personaPresets[next]!.instructions); }}>{Object.entries(personaPresets).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select></label>
                <button className="text-command" onClick={() => setCustomEditor('persona')}>编辑人格指令</button>
                <button className="text-command" onClick={() => void saveAgentProfile()}>保存 Agent 配置</button>
                {agentStatus && <div className="setting-note">{agentStatus}</div>}
                <div className="setting-note">此配置仅作用于当前已信任工作区，并统一传给所有模型。安全规则、敏感文件限制和本地操作确认始终固定。</div>
                {customEditor && <div className="modal-backdrop"><section className="settings-dialog profile-dialog"><header><div><span>CUSTOM</span><h2>{customEditor === 'work' ? '自定义工作方式' : '自定义沟通人格'}</h2></div><button className="icon-button" onClick={() => setCustomEditor(null)}><X size={19} /></button></header><div className="settings-panel"><textarea className="agent-instructions" autoFocus value={customEditor === 'work' ? workInstructions : personaInstructions} maxLength={customEditor === 'work' ? 8000 : 4000} onChange={(event) => customEditor === 'work' ? setWorkInstructions(event.target.value) : setPersonaInstructions(event.target.value)} /> <button className="text-command" onClick={() => { if (customEditor === 'work') setWorkStyle('custom'); else setPersona('custom'); setCustomEditor(null); }}>保存自定义内容</button></div></section></div>}
              </>
            )}
            {tab === 'appearance' && (
              <>
                <h3>个性化</h3>
                <label className="setting-field">
                  本地背景图
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) persistBackground(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                <button
                  className="text-command"
                  onClick={() => setAppearance({ backgroundUrl: null })}
                  disabled={!backgroundUrl}
                >
                  移除背景
                </button>
                <label className="setting-field">
                  工作区透明度 <b>{workspaceOpacity}%</b>
                  <input
                    type="range"
                    min="35"
                    max="100"
                    value={workspaceOpacity}
                    onChange={(event) =>
                      setAppearance({ workspaceOpacity: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="setting-field">
                  对话区透明度 <b>{conversationOpacity}%</b>
                  <input
                    type="range"
                    min="35"
                    max="100"
                    value={conversationOpacity}
                    onChange={(event) =>
                      setAppearance({ conversationOpacity: Number(event.target.value) })
                    }
                  />
                </label>
              </>
            )}
            {tab === 'advanced' && (
              <>
                <h3>高级</h3>
                <label className="setting-field">
                  界面语言
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as typeof language)}
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="zh-TW">繁體中文</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <div className="provider-form">
                  <strong>OpenAI 兼容 API</strong>
                  <input
                    value={providerName}
                    onChange={(event) => setProviderName(event.target.value)}
                    placeholder="提供商名称"
                  />
                  <input
                    value={providerUrl}
                    onChange={(event) => setProviderUrl(event.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                  <input
                    value={providerModels}
                    onChange={(event) => setProviderModels(event.target.value)}
                    placeholder="模型 ID，使用逗号分隔"
                  />
                  <input
                    value={providerKey}
                    onChange={(event) => setProviderKey(event.target.value)}
                    type="password"
                    placeholder="API Key（仅保存到本机安全存储）"
                  />
                  <button className="text-command" onClick={() => void addProvider()}>
                    添加提供商
                  </button>
                </div>
                {providers.map((provider) => (
                  <div className="provider-row" key={provider.id}>
                    <div>
                      <strong>{provider.name}</strong>
                      <span>{provider.models.join(' · ')}</span>
                    </div>
                    <button
                      onClick={() =>
                        setProviders(providers.filter((item) => item.id !== provider.id))
                      }
                    >
                      移除
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
