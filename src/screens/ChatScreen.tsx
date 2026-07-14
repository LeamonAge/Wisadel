import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useChatStore } from '../stores/chatStore';
import { useSanityStore } from '../stores/sanityStore';
import { useTheme } from '../stores/themeStore';
import { MessageBubble } from '../components/MessageBubble';
import { ChatInput } from '../components/ChatInput';
import { SanityBar } from '../components/SanityBar';

export default function ChatScreen() {
  const { colors } = useTheme();
  const [inputText, setInputText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const activeChatId = useChatStore((s) => s.activeChatId);
  const chats = useChatStore((s) => s.chats);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingContent = useChatStore((s) => s.thinkingContent);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const createChat = useChatStore((s) => s.createChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const loadChats = useChatStore((s) => s.loadChats);
  const loadSanity = useSanityStore((s) => s.load);

  const activeChat = chats.find((c) => c.id === activeChatId);

  useEffect(() => {
    loadSanity();
    loadChats();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [activeChat?.messages.length, streamingContent, thinkingContent]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    await sendMessage(text);
  };

  const handleNewChat = () => {
    createChat('deepseek', 'deepseek-v4-pro');
    setSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (id: string) => {
    Alert.alert('删除对话', '确定要删除这个对话吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => deleteChat(id),
      },
    ]);
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
  // 为流式内容创建临时消息
  const displayMessages = isStreaming && streamingContent
    ? [
        ...messages,
        {
          id: 'streaming',
          role: 'assistant' as const,
          type: 'text' as const,
          content: streamingContent,
          timestamp: Date.now(),
          thinkingContent: thinkingContent || undefined,
        },
      ]
    : messages;

  const renderMessage = ({ item }: any) => <MessageBubble message={item} />;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🧠</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>理智</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>有理智的 AI 助手</Text>
      <View style={styles.emptyHints}>
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          💬 与 AI 对话，获取智能回复
        </Text>
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          📁 管理手机文件，读写随心
        </Text>
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          ⚙️ 修改系统配置，一键搞定
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* 顶部栏 */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuBtn}>
          <Text style={[styles.menuIcon, { color: colors.textPrimary }]}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeChat?.title || '新对话'}
          </Text>
          {isStreaming && (
            <Text style={[styles.thinkingIndicator, { color: colors.accent }]}>AI 思考中...</Text>
          )}
        </View>
        <SanityBar />
      </View>

      {/* 侧边栏 */}
      <Modal
        visible={sidebarOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSidebarOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setSidebarOpen(false)}>
          <View />
        </Pressable>
        <View style={[styles.sidebar, { backgroundColor: colors.bg }]}>
          <SafeAreaView style={styles.sidebarInner}>
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: colors.textPrimary }]}>对话列表</Text>
              <TouchableOpacity onPress={handleNewChat} style={[styles.newChatBtn, { backgroundColor: colors.accent }]}>
                <Text style={styles.newChatText}>+ 新对话</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={chats}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.chatItem,
                    { borderBottomColor: colors.border },
                    item.id === activeChatId && { backgroundColor: colors.card },
                  ]}
                  onPress={() => handleSelectChat(item.id)}
                  onLongPress={() => {
                    Alert.alert(item.title, '选择操作', [
                      { text: '取消', style: 'cancel' },
                      { text: '重命名', onPress: () => handleStartRename(item.id, item.title) },
                      { text: '删除', style: 'destructive', onPress: () => handleDeleteChat(item.id) },
                    ]);
                  }}
                >
                  <View style={styles.chatItemContent}>
                    <Text
                      style={[
                        styles.chatItemTitle,
                        { color: colors.textPrimary },
                        item.id === activeChatId && { color: colors.accentLight },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.chatItemTime, { color: colors.textSecondary }]}>
                      {new Date(item.updated).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyList, { color: colors.textSecondary }]}>暂无对话</Text>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        visible={!!editingChatId}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingChatId(null)}
      >
        <View style={styles.renameOverlay}>
          <View style={[styles.renameDialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.renameTitle, { color: colors.textPrimary }]}>重命名对话</Text>
            <TextInput
              style={[styles.renameInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="输入新标题..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              maxLength={30}
            />
            <View style={styles.renameBtns}>
              <TouchableOpacity onPress={() => setEditingChatId(null)} style={styles.renameCancel}>
                <Text style={[styles.renameCancelText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRename}
                style={[styles.renameConfirm, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.renameConfirmText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmpty}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
      />

      {/* 输入框 */}
      <ChatInput
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        disabled={isStreaming}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  menuBtn: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 22,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  thinkingIndicator: {
    fontSize: 11,
    marginTop: 2,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  emptyHints: {
    gap: 8,
    alignItems: 'flex-start',
  },
  hintText: {
    fontSize: 13,
    lineHeight: 20,
  },
  // Sidebar
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 320,
    borderRightWidth: 0.5,
  },
  sidebarInner: {
    flex: 1,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  newChatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newChatText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  chatItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatItemTitle: {
    fontSize: 14,
    flex: 1,
  },
  chatItemTime: {
    fontSize: 11,
    marginLeft: 8,
  },
  emptyList: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  // Rename
  renameOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  renameDialog: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
  },
  renameTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  renameInput: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 0.5,
    marginBottom: 16,
  },
  renameBtns: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  renameCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  renameCancelText: {
    fontSize: 14,
  },
  renameConfirm: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  renameConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
