import { useEffect, useLayoutEffect, useState } from 'react';
import type { AuthResponse } from '@wisadel/contracts';
import { api, AUTH_EXPIRED_EVENT } from './api';
import { LoginPage } from './pages/LoginPage';
import { Workspace } from './pages/Workspace';
import { useAppStore } from './store';

export function App() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const loadSessions = useAppStore((state) => state.loadSessions);
  const setPage = useAppStore((state) => state.setPage);
  const theme = useAppStore((state) => state.theme);
  const appearanceMode = useAppStore((state) => state.appearanceMode);
  const workspaceOpacity = useAppStore((state) => state.workspaceOpacity);
  const conversationOpacity = useAppStore((state) => state.conversationOpacity);
  const backgroundUrl = useAppStore((state) => state.backgroundUrl);
  const imageStudio = new URLSearchParams(window.location.search).get('workspace') === 'image';
  const [restoring, setRestoring] = useState(true);
  const [update, setUpdate] = useState<{ type: string; version?: string; notes?: string; percent?: number; message?: string } | null>(null);

  useLayoutEffect(() => {
    let mounted = true;
    const expire = () => {
      localStorage.removeItem('wisadel.user');
      setUser(null);
      if (mounted) setRestoring(false);
    };
    const restore = async () => {
      const savedUser = localStorage.getItem('wisadel.user');
      const accessToken = localStorage.getItem('wisadel.accessToken');
      if (!savedUser || !accessToken) {
        expire();
        return;
      }
      try {
        setUser(JSON.parse(savedUser));
        await (imageStudio ? setPage('image') : loadSessions('chat'));
      } catch {
        expire();
      } finally {
        if (mounted) setRestoring(false);
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    void restore();
    return () => {
      mounted = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
    };
  }, [imageStudio, loadSessions, setPage, setUser]);

  useEffect(() => {
    const effectiveTheme = appearanceMode === 'custom' ? theme : appearanceMode;
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.setProperty('--workspace-opacity', String(workspaceOpacity / 100));
    document.documentElement.style.setProperty('--conversation-opacity', String(conversationOpacity / 100));
    const activeBackground = appearanceMode === 'custom' ? backgroundUrl : null;
    document.documentElement.style.setProperty('--custom-background', activeBackground ? `url("${activeBackground}")` : 'none');
    void applyBackgroundPalette(activeBackground, effectiveTheme);
  }, [theme, appearanceMode, workspaceOpacity, conversationOpacity, backgroundUrl]);

  useEffect(() => window.wisadelUpdater?.onEvent(setUpdate), []);

  const authenticate = (result: AuthResponse) => {
    api.setTokens(result.accessToken, result.refreshToken);
    localStorage.setItem('wisadel.user', JSON.stringify(result.user));
    setUser(result.user);
    void (imageStudio ? setPage('image') : loadSessions('chat'));
  };

  const logout = () => {
    void api.logout();
    localStorage.removeItem('wisadel.user');
    setUser(null);
  };

  const content = restoring ? <div className="splash">Wisadel</div> : !user ? <LoginPage onAuthenticated={authenticate} /> : <Workspace onLogout={logout} standaloneImage={imageStudio} />;
  return <>{content}{update && <UpdateDialog update={update} onClose={() => setUpdate(null)} />}</>;
}

async function applyBackgroundPalette(source: string | null, theme: 'dark' | 'light') {
  const root = document.documentElement;
  if (!source) {
    root.dataset.customBackground = 'false';
    window.wisadelDesktop?.setTheme(theme);
    return;
  }
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    let red = 0; let green = 0; let blue = 0; let count = 0; let accent: [number, number, number] = [192, 65, 50]; let accentScore = -1;
    for (let index = 0; index < pixels.length; index += 4) {
      if ((pixels[index + 3] ?? 0) < 80) continue;
      const pixel: [number, number, number] = [pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0];
      red += pixel[0]; green += pixel[1]; blue += pixel[2]; count += 1;
      const highest = Math.max(...pixel); const lowest = Math.min(...pixel); const score = (highest - lowest) * (highest > 35 && lowest < 235 ? 1 : .25);
      if (score > accentScore) { accent = pixel; accentScore = score; }
    }
    const color = count ? [Math.round(red / count), Math.round(green / count), Math.round(blue / count)] : theme === 'light' ? [255, 255, 255] : [18, 16, 16];
    const luminance = ((color[0] ?? 0) * 0.2126 + (color[1] ?? 0) * 0.7152 + (color[2] ?? 0) * 0.0722) / 255;
    const ink = '#211c1b';
    root.dataset.customBackground = 'true';
    root.style.setProperty('--background-rgb', color.join(' '));
    root.style.setProperty('--background-accent-rgb', accent.join(' '));
    root.style.setProperty('--background-ink', ink);
    root.style.setProperty('--background-muted', '#625b58');
    window.wisadelDesktop?.setTheme(luminance > .58 ? 'light' : 'dark', `#${color.map((value) => value.toString(16).padStart(2, '0')).join('')}`);
  } catch {
    root.dataset.customBackground = 'false';
    window.wisadelDesktop?.setTheme(theme);
  }
}

function UpdateDialog({ update, onClose }: { update: { type: string; version?: string; notes?: string; percent?: number; message?: string }; onClose: () => void }) {
  const downloading = update.type === 'progress';
  const downloaded = update.type === 'downloaded';
  const failed = update.type === 'error';
  const title = downloaded ? '更新已准备就绪' : downloading ? '正在下载更新' : update.type === 'error' ? '更新下载失败' : '发现 Wisadel 新版本';
  const notes = String(update.notes || '本次更新包含稳定性优化、功能改进与体验修复。').replace(/<[^>]*>/g, '').slice(0, 800);
  return <div className="update-backdrop"><section className="update-dialog"><div className="update-mark">W</div><span className="update-kicker">WISADEL UPDATE</span><h2>{title}</h2><p>{downloaded ? `v${update.version ?? ''} 已下载完成，重启后将进入品牌化安装流程。` : downloading ? `正在下载 v${update.version ?? ''}，请保持应用开启。` : failed ? (update.message ?? '下载未完成，请重试。') : `v${update.version ?? ''} 已发布。`}</p>{(downloading || downloaded) && <div className="update-progress"><i style={{ width: `${downloaded ? 100 : Math.max(1, update.percent ?? 0)}%` }} /><span>{Math.round(downloaded ? 100 : update.percent ?? 0)}%</span></div>}<div className="update-notes"><strong>本次更新</strong><div>{notes}</div></div><footer>{downloaded ? <button className="update-primary" onClick={() => void window.wisadelUpdater?.install()}>重启并安装</button> : downloading ? <button className="update-muted" disabled>下载中</button> : <><button className="update-muted" onClick={onClose}>{failed ? '关闭' : '稍后提醒'}</button><button className="update-primary" onClick={() => void window.wisadelUpdater?.download()}>{failed ? '清除缓存后重试' : '立即下载'}</button></>}</footer></section></div>;
}
