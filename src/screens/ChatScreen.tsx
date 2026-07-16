import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import { useSanityStore } from '../stores/sanityStore';
import { useTheme } from '../stores/themeStore';
import { MessageBubble } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import { SanityBar } from '../components/SanityBar';

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '0.5px solid',
    gap: 8,
    flexShrink: 0,
  },
  menuBtn: {
    padding: 4,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
  },
  menuIcon: {
    fontSize: 22,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  thinkingIndicator: {
    fontSize: 11,
    marginTop: 2,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  messageContent: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
    padding: '0 32px',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  emptyHints: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  hintText: {
    fontSize: 13,
    lineHeight: '20px',
  },
  sidebarOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 320,
    borderRight: '0.5px solid',
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '0.5px solid',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  newChatBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
  },
  newChatText: {
    fontSize: 13,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  chatList: {
    flex: 1,
    overflowY: 'auto',
  },
  chatItem: {
    padding: '12px 16px',
    borderBottom: '0.5px solid',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  chatItemContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatItemTitle: {
    fontSize: 14,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chatItemTime: {
    fontSize: 11,
    marginLeft: 8,
    flexShrink: 0,
  },
  emptyList: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  renameOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
    zIndex: 200,
  },
  renameDialog: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 14,
    padding: 20,
    border: '1px solid',
  },
  renameTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 16,
    textAlign: 'center',
  },
  renameInput: {
    width: '100%',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 15,
    border: '0.5px solid',
    marginBottom: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
  renameBtns: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  renameCancel: {
    padding: '8px 16px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
  },
  renameCancelText: {
    fontSize: 14,
  },
  renameConfirm: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
  },
  renameConfirmText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#FFFFFF',
  },
};

export default function ChatScreen() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [inputText, setInputText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);

  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingContent = useChatStore((s) => s.thinkingContent);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelMessage = useChatStore((s) => s.abortMessage);
  const createChat = useChatStore((s) => s.createChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const setActiveChat = useChatStore((s) => s.setActive);
  const loadChats = useChatStore((s) => s.load);
  const loadSanity = useSanityStore((s) => s.load);

  const activeChat = chats.find((c) => c.id === activeChatId);

  useEffect(() => {
    loadSanity();
    loadChats();
    if (!activeChatId && chats.length > 0) {
      setActiveChat(chats[0].id);
    }
  }, []);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [activeChat?.messages.length, streamingContent, thinkingContent]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    await sendMessage(text);
  };

  const handleNewChat = () => {
    createChat('deepseek-v4-pro');
    setSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (id: string) => {
    if (window.confirm('确定要删除这个对话吗？')) {
      deleteChat(id);
    }
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingChatId(id);
    setEditTitle(currentTitle);
  };

  const handleConfirmRename = () => {
    if (editingChatId && editTitle.trim()) {
      renameChat(editingChatId, editTitle.trim());
    }
    setEditingChatId(null);
    setEditTitle('');
  };

  const messages = activeChat?.messages || [];
  const displayMessages = isStreaming && streamingContent
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          content: streamingContent,
          timestamp: Date.now(),
          thinkingContent: thinkingContent || undefined,
        },
      ]
    : messages;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('zh-CN');

  const renderMessages = () => {
    if (displayMessages.length === 0) {
      return (
        <div style={styles.emptyContainer}>
          <div style={styles.emptyEmoji}>🧠</div>
          <div style={{ ...styles.emptyTitle, color: colors.textPrimary }}>理智</div>
          <div style={{ ...styles.emptySubtitle, color: colors.textSecondary }}>有理智的 AI 助手</div>
          <div style={styles.emptyHints}>
            <div style={{ ...styles.hintText, color: colors.textSecondary }}>
              💬 与 AI 对话，获取智能回复
            </div>
            <div style={{ ...styles.hintText, color: colors.textSecondary }}>
              📁 管理手机文件，读写随心
            </div>
            <div style={{ ...styles.hintText, color: colors.textSecondary }}>
              ⚙️ 修改系统配置，一键搞定
            </div>
          </div>
        </div>
      );
    }
    return displayMessages.map((msg) => (
      <MessageBubble key={msg.id} message={msg} />
    ));
  };

  return (
    <div style={{ ...styles.container, backgroundColor: colors.bg }}>
      {/* 顶部栏 */}
      <div style={{ ...styles.header, backgroundColor: colors.bg, borderBottomColor: colors.border }}>
        <button
          style={{ ...styles.menuBtn, color: colors.textPrimary }}
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <div style={styles.headerCenter}>
          <div style={{ ...styles.headerTitle, color: colors.textPrimary }}>
            {activeChat?.title || '新对话'}
          </div>
          {isStreaming && (
            <div style={{ ...styles.thinkingIndicator, color: colors.accent }}>
              AI 思考中...
            </div>
          )}
        </div>
        {/* 导航按钮 */}
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, padding: '4px 8px', color: colors.textPrimary,
          }}
          title="个人中心"
        >
          👤
        </button>
        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, padding: '4px 8px', color: colors.textPrimary,
          }}
          title="设置"
        >
          ⚙️
        </button>
        <SanityBar />
      </div>

      {/* 侧边栏 */}
      {sidebarOpen && (
        <>
          <div style={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
          <div style={{ ...styles.sidebar, backgroundColor: colors.bg, borderRightColor: colors.border }}>
            <div style={{ ...styles.sidebarHeader, borderBottomColor: colors.border }}>
              <div style={{ ...styles.sidebarTitle, color: colors.textPrimary }}>对话列表</div>
              <button
                onClick={handleNewChat}
                style={{ ...styles.newChatBtn, backgroundColor: colors.accent }}
              >
                + 新对话
              </button>
            </div>
            <div style={styles.chatList}>
              {chats.length === 0 ? (
                <div style={{ ...styles.emptyList, color: colors.textSecondary }}>暂无对话</div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    style={{
                      ...styles.chatItem,
                      borderBottomColor: colors.border,
                      ...(chat.id === activeChatId ? { backgroundColor: colors.card } : {}),
                    }}
                    onClick={() => handleSelectChat(chat.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const action = window.prompt('选择操作: rename / delete');
                      if (action === 'rename') handleStartRename(chat.id, chat.title);
                      else if (action === 'delete') handleDeleteChat(chat.id);
                    }}
                  >
                    <div style={styles.chatItemContent}>
                      <div
                        style={{
                          ...styles.chatItemTitle,
                          color: colors.textPrimary,
                          ...(chat.id === activeChatId ? { color: colors.accentLight } : {}),
                        }}
                      >
                        {chat.title}
                      </div>
                      <div style={{ ...styles.chatItemTime, color: colors.textSecondary }}>
                        {formatDate(chat.updated)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* 重命名弹窗 */}
      {editingChatId && (
        <div style={styles.renameOverlay}>
          <div style={{ ...styles.renameDialog, backgroundColor: colors.card, borderColor: colors.border }}>
            <div style={{ ...styles.renameTitle, color: colors.textPrimary }}>重命名对话</div>
            <input
              style={{ ...styles.renameInput, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="输入新标题..."
              autoFocus
              maxLength={30}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); }}
            />
            <div style={styles.renameBtns}>
              <button
                onClick={() => setEditingChatId(null)}
                style={{ ...styles.renameCancel, color: colors.textSecondary }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmRename}
                style={{ ...styles.renameConfirm, backgroundColor: colors.accent }}
              >
                <span style={styles.renameConfirmText}>确认</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div
        ref={messageListRef}
        style={styles.messageList}
      >
        <div style={styles.messageContent}>
          {renderMessages()}
        </div>
      </div>

      {/* 输入框 */}
      <ChatInput
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        onCancel={cancelMessage}
        disabled={isStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
