import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { getApiSources, saveApiSources, saveApiKey } from '../services/api';
import { ApiSource } from '../types';
import { useTheme } from '../stores/themeStore';
import { checkForUpdate, downloadUpdate, installApk, formatFileSize, getCurrentVersion, UpdateInfo } from '../services/updater';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [loading, setLoading] = useState(true);

  // 更新状态
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    const s = await getApiSources();
    setSources(s);
    setLoading(false);
  };

  const handleSaveApiKey = async (sourceId: string, key: string) => {
    await saveApiKey(sourceId, key);
    Alert.alert('成功', 'API Key 已保存（加密存储）');
    loadSources();
  };

  const handleToggleApi = async (sourceId: string) => {
    const updated = sources.map((s) => ({
      ...s,
      enabled: s.id === sourceId ? !s.enabled : false,
    }));
    await saveApiSources(updated);
    setSources(updated);
  };

  // ===== 更新检查 =====
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await checkForUpdate();
      setLastCheckTime(new Date().toLocaleTimeString('zh-CN'));
      if (info) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else {
        Alert.alert('已是最新版本', `当前版本 v${getCurrentVersion()}`);
      }
    } catch (err: any) {
      Alert.alert('检查失败', err.message || '网络错误');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDownload = async () => {
    if (!updateInfo) return;
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const fileUri = await downloadUpdate(updateInfo, (progress) => {
        setDownloadProgress(progress);
      });
      setDownloading(false);
      Alert.alert('下载完成', '是否立即安装更新？', [
        { text: '稍后', style: 'cancel' },
        { text: '安装', onPress: () => installApk(fileUri) },
      ]);
      setShowUpdateModal(false);
    } catch (err: any) {
      setDownloading(false);
      Alert.alert('下载失败', err.message || '请检查网络后重试');
    }
  };

  const renderSource = (source: ApiSource) => {
    const [key, setKey] = useState('');

    return (
      <View key={source.id} style={[styles.apiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.apiHeader}>
          <View>
            <Text style={[styles.apiName, { color: colors.textPrimary }]}>{source.name}</Text>
            <Text style={[styles.apiType, { color: colors.accentLight }]}>
              {source.type === 'builtin' ? '内置' : '自定义'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleBtn, source.enabled && { backgroundColor: colors.accent }]}
            onPress={() => handleToggleApi(source.id)}
          >
            <Text style={[styles.toggleText, { color: colors.textPrimary }]}>
              {source.enabled ? '✓ 启用' : '启用'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.apiEndpoint, { color: colors.textSecondary }]} numberOfLines={1}>
          {source.endpoint}
        </Text>

        <View style={styles.apiModels}>
          {source.models.map((m) => (
            <View key={m} style={[styles.modelTag, { backgroundColor: 'rgba(192, 0, 0, 0.08)' }]}>
              <Text style={[styles.modelTagText, { color: colors.accentLight }]}>{m}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.keyStatus, { color: colors.textSecondary }]}>
          🔑 {source.apiKey ? '已配置 (••••••••)' : '未配置 API Key'}
        </Text>

        <View style={styles.keyInputRow}>
          <TextInput
            style={[styles.keyInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
            value={key}
            onChangeText={setKey}
            placeholder="输入新的 API Key..."
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
            onPress={() => handleSaveApiKey(source.id, key)}
            disabled={!key.trim()}
          >
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>设置</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 主题切换 */}
        <View style={[styles.themeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>主题</Text>
          <View style={styles.themeRow}>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                mode === 'dark' && [styles.themeBtnActive, { borderColor: colors.accent }],
              ]}
              onPress={() => setMode('dark')}
            >
              <Text style={[styles.themeIcon]}>🌙</Text>
              <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>暗色</Text>
              {mode === 'dark' && <Text style={[styles.themeCheck, { color: colors.accent }]}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                mode === 'light' && [styles.themeBtnActive, { borderColor: colors.accent }],
              ]}
              onPress={() => setMode('light')}
            >
              <Text style={styles.themeIcon}>☀️</Text>
              <Text style={[styles.themeLabel, { color: colors.textPrimary }]}>亮色</Text>
              {mode === 'light' && <Text style={[styles.themeCheck, { color: colors.accent }]}>✓</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* 更新检查 */}
        <View style={[styles.updateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.updateRow}>
            <View style={styles.updateInfo}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>版本更新</Text>
              <Text style={[styles.updateVersion, { color: colors.textSecondary }]}>
                当前版本 v{getCurrentVersion()}
              </Text>
              {lastCheckTime ? (
                <Text style={[styles.updateTime, { color: colors.textSecondary }]}>
                  上次检查: {lastCheckTime}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.checkUpdateBtn, { backgroundColor: colors.accent }]}
              onPress={handleCheckUpdate}
              disabled={checkingUpdate}
            >
              {checkingUpdate ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.checkUpdateText}>检查更新</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* API 设置 */}
        <Text style={[styles.apiTitle, { color: colors.textPrimary }]}>API 源</Text>
        <Text style={[styles.apiSub, { color: colors.textSecondary }]}>
          API Key 加密存储在设备本地，仅用于直连 API 提供商
        </Text>

        {loading ? (
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>加载中...</Text>
        ) : (
          sources.map(renderSource)
        )}

        <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.footerTitle, { color: colors.textPrimary }]}>关于理智</Text>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            理智 (Sanity) v1.0.0{'\n'}
            手机 AI Agent 应用{'\n'}
            支持 DeepSeek API（更多 API 源即将推出）
          </Text>
        </View>

        {/* 更新弹窗 */}
        <Modal
          visible={showUpdateModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUpdateModal(false)}
        >
          <Pressable style={styles.updateOverlay} onPress={() => setShowUpdateModal(false)}>
            <Pressable
              style={[styles.updateDialog, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.updateDialogTitle, { color: colors.textPrimary }]}>
                🎉 发现新版本
              </Text>
              <Text style={[styles.updateDialogVersion, { color: colors.accent }]}>
                v{updateInfo?.version}
              </Text>
              {updateInfo?.size ? (
                <Text style={[styles.updateDialogSize, { color: colors.textSecondary }]}>
                  大小: {formatFileSize(updateInfo.size)}
                </Text>
              ) : null}
              <ScrollView style={styles.updateNotes}>
                <Text style={[styles.updateNotesText, { color: colors.textSecondary }]}>
                  {updateInfo?.releaseNotes || '暂无更新说明'}
                </Text>
              </ScrollView>

              {downloading ? (
                <View style={styles.downloadStatus}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.downloadProgress, { color: colors.accent }]}>
                    下载中 {Math.round(downloadProgress * 100)}%
                  </Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.round(downloadProgress * 100)}%`,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.updateBtns}>
                  <TouchableOpacity
                    style={styles.updateLaterBtn}
                    onPress={() => setShowUpdateModal(false)}
                  >
                    <Text style={[styles.updateLaterText, { color: colors.textSecondary }]}>
                      稍后
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.updateDownloadBtn, { backgroundColor: colors.accent }]}
                    onPress={handleDownload}
                  >
                    <Text style={styles.updateDownloadText}>立即更新</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  // Theme
  themeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  themeBtnActive: {
    backgroundColor: 'rgba(192, 0, 0, 0.06)',
  },
  themeIcon: {
    fontSize: 16,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  themeCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
  // API
  apiTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  apiSub: {
    fontSize: 11,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  apiCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  apiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  apiName: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  apiType: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  toggleText: {
    fontSize: 12,
  },
  apiEndpoint: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  apiModels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  modelTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modelTagText: {
    fontSize: 11,
  },
  keyStatus: {
    fontSize: 12,
    marginBottom: 8,
  },
  keyInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keyInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 0.5,
  },
  saveBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  footer: {
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 20,
  },
  // Update
  updateCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  updateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateInfo: {
    flex: 1,
  },
  updateVersion: {
    fontSize: 13,
    marginTop: 2,
  },
  updateTime: {
    fontSize: 11,
    marginTop: 2,
  },
  checkUpdateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  checkUpdateText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  updateOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  updateDialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  updateDialogTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  updateDialogVersion: {
    fontSize: 24,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginTop: 8,
  },
  updateDialogSize: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  updateNotes: {
    maxHeight: 150,
    marginTop: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(128,128,128,0.06)',
    borderRadius: 8,
  },
  updateNotesText: {
    fontSize: 13,
    lineHeight: 20,
  },
  updateBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  updateLaterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
    alignItems: 'center',
  },
  updateLaterText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  updateDownloadBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  updateDownloadText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  downloadStatus: {
    alignItems: 'center',
    gap: 8,
  },
  downloadProgress: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(128,128,128,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
