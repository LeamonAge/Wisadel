import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../stores/themeStore';

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
    alignItems: 'center',
    padding: '12px 16px',
    gap: 12,
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 20,
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    border: '1px solid',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  themeRow: {
    display: 'flex',
    gap: 12,
  },
  themeBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 0',
    borderRadius: 10,
    border: '1.5px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  themeBtnActive: {},
  themeIcon: {
    fontSize: 16,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: 600,
  },
  themeCheck: {
    fontSize: 14,
    fontWeight: 700,
  },
  // 更新
  updateRow: {
    display: 'flex',
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
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    minWidth: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkUpdateText: {
    fontSize: 13,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  // 更新弹窗
  overlay: {
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
  dialog: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    border: '1px solid',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
  },
  dialogVersion: {
    fontSize: 24,
    fontWeight: 800,
    textAlign: 'center',
    marginTop: 8,
  },
  dialogSize: {
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
    overflowY: 'auto',
  },
  updateNotesText: {
    fontSize: 13,
    lineHeight: '20px',
  },
  updateBtns: {
    display: 'flex',
    gap: 10,
  },
  updateLaterBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 10,
    border: '1px solid rgba(128,128,128,0.2)',
    cursor: 'pointer',
    background: 'none',
    textAlign: 'center',
  },
  updateLaterText: {
    fontSize: 14,
    fontWeight: 600,
  },
  updateDownloadBtn: {
    flex: 2,
    padding: '12px 0',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'center',
  },
  updateDownloadText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  // 关于
  footer: {
    marginTop: 20,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    border: '1px solid',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    lineHeight: '20px',
  },
};

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { colors, mode, setMode } = useTheme();

  const [appVersion, setAppVersion] = useState<string>('0.0.0');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes: string; size: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState('');

  useEffect(() => {
    if ((window as any).electronAPI?.getAppVersion) {
      (window as any).electronAPI.getAppVersion().then(setAppVersion);
    } else {
      setAppVersion('0.1.10');
    }
  }, []);

  const handleCheckUpdate = async () => {
    if (!(window as any).electronAPI?.checkForUpdate) {
      alert('检查更新功能仅限桌面版使用');
      return;
    }
    setCheckingUpdate(true);
    try {
      const info = await (window as any).electronAPI.checkForUpdate();
      setLastCheckTime(new Date().toLocaleTimeString('zh-CN'));
      if (info) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else {
        alert(`已是最新版本 (v${appVersion})`);
      }
    } catch (err: any) {
      alert('检查更新失败: ' + (err.message || '网络错误'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDownload = async () => {
    if (!(window as any).electronAPI) return;
    setDownloading(true);
    setDownloadProgress(0);
    try {
      (window as any).electronAPI.onUpdateProgress((progress: number) => {
        setDownloadProgress(progress);
      });
      await (window as any).electronAPI.downloadUpdate();
      (window as any).electronAPI.removeUpdateProgressListener();
      setDownloading(false);
      if (window.confirm('更新已下载完成，是否立即重启安装？')) {
        await (window as any).electronAPI.installUpdate();
      }
      setShowUpdateModal(false);
    } catch (err: any) {
      setDownloading(false);
      alert('下载失败: ' + (err.message || '请检查网络后重试'));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ ...styles.container, backgroundColor: colors.bg }}>
      <div style={styles.header}>
        <button onClick={() => navigate('/chat')} style={{ ...styles.backBtn, color: colors.textPrimary }}>
          ←
        </button>
        <div style={{ ...styles.headerTitle, color: colors.textPrimary }}>设置</div>
      </div>

      <div style={styles.content}>
        {/* 主题切换 */}
        <div style={{ ...styles.card, backgroundColor: colors.card, borderColor: colors.border }}>
          <div style={{ ...styles.sectionTitle, color: colors.textPrimary }}>主题</div>
          <div style={styles.themeRow}>
            <button
              onClick={() => setMode('dark')}
              style={{
                ...styles.themeBtn,
                backgroundColor: mode === 'dark' ? 'rgba(192, 0, 0, 0.06)' : 'rgba(128, 128, 128, 0.08)',
                borderColor: mode === 'dark' ? colors.accent : 'transparent',
              }}
            >
              <span style={styles.themeIcon}>🌙</span>
              <span style={{ ...styles.themeLabel, color: colors.textPrimary }}>暗色</span>
              {mode === 'dark' && <span style={{ ...styles.themeCheck, color: colors.accent }}>✓</span>}
            </button>
            <button
              onClick={() => setMode('light')}
              style={{
                ...styles.themeBtn,
                backgroundColor: mode === 'light' ? 'rgba(192, 0, 0, 0.06)' : 'rgba(128, 128, 128, 0.08)',
                borderColor: mode === 'light' ? colors.accent : 'transparent',
              }}
            >
              <span style={styles.themeIcon}>☀️</span>
              <span style={{ ...styles.themeLabel, color: colors.textPrimary }}>亮色</span>
              {mode === 'light' && <span style={{ ...styles.themeCheck, color: colors.accent }}>✓</span>}
            </button>
          </div>
        </div>

        {/* 更新检查 */}
        <div style={{ ...styles.card, backgroundColor: colors.card, borderColor: colors.border }}>
          <div style={styles.updateRow}>
            <div style={styles.updateInfo}>
              <div style={{ ...styles.sectionTitle, color: colors.textPrimary }}>版本更新</div>
              <div style={{ ...styles.updateVersion, color: colors.textSecondary }}>
                当前版本 v{appVersion}
              </div>
              {lastCheckTime ? (
                <div style={{ ...styles.updateTime, color: colors.textSecondary }}>
                  上次检查: {lastCheckTime}
                </div>
              ) : null}
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              style={{ ...styles.checkUpdateBtn, backgroundColor: colors.accent }}
            >
              {checkingUpdate ? (
                <span style={{ width: 16, height: 16, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spinSettings 0.8s linear infinite' }} />
              ) : (
                <span style={styles.checkUpdateText}>检查更新</span>
              )}
            </button>
          </div>
        </div>

        {/* 关于 */}
        <div style={{ ...styles.footer, backgroundColor: colors.card, borderColor: colors.border }}>
          <div style={{ ...styles.footerTitle, color: colors.textPrimary }}>关于理智</div>
          <div style={{ ...styles.footerText, color: colors.textSecondary }}>
            理智 (Wisadel) v{appVersion}{'\n'}
            桌面 AI Agent 应用{'\n'}
            基于 Electron + React 构建
          </div>
        </div>

        {/* 更新弹窗 */}
        {showUpdateModal && (
          <div style={styles.overlay} onClick={() => setShowUpdateModal(false)}>
            <div
              style={{ ...styles.dialog, backgroundColor: colors.card, borderColor: colors.border }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ ...styles.dialogTitle, color: colors.textPrimary }}>
                🎉 发现新版本
              </div>
              <div style={{ ...styles.dialogVersion, color: colors.accent }}>
                v{updateInfo?.version}
              </div>
              {updateInfo?.size ? (
                <div style={{ ...styles.dialogSize, color: colors.textSecondary }}>
                  大小: {formatFileSize(updateInfo.size)}
                </div>
              ) : null}
              <div style={styles.updateNotes}>
                <div style={{ ...styles.updateNotesText, color: colors.textSecondary }}>
                  {updateInfo?.releaseNotes || '暂无更新说明'}
                </div>
              </div>

              {downloading ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.accent }}>
                    下载中 {Math.round(downloadProgress * 100)}%
                  </div>
                  <div style={{
                    width: '100%', height: 4, backgroundColor: 'rgba(128,128,128,0.15)',
                    borderRadius: 2, marginTop: 8, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', backgroundColor: colors.accent,
                      width: `${Math.round(downloadProgress * 100)}%`,
                      borderRadius: 2, transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              ) : (
                <div style={styles.updateBtns}>
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    style={{ ...styles.updateLaterBtn, borderColor: 'rgba(128,128,128,0.2)' }}
                  >
                    <span style={{ ...styles.updateLaterText, color: colors.textSecondary }}>稍后</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    style={{ ...styles.updateDownloadBtn, backgroundColor: colors.accent }}
                  >
                    <span style={styles.updateDownloadText}>立即更新</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes spinSettings {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
