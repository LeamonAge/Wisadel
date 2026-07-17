import { useEffect, useState } from 'react';
import type { AuthResponse } from '@wisadel/contracts';
import { api, AUTH_EXPIRED_EVENT } from './api';
import { LoginPage } from './pages/LoginPage';
import { Workspace } from './pages/Workspace';
import { useAppStore } from './store';

export function App() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const loadSessions = useAppStore((state) => state.loadSessions);
  const theme = useAppStore((state) => state.theme);
  const [restoring, setRestoring] = useState(true);
  const [update, setUpdate] = useState<{ type: string; version?: string; notes?: string; percent?: number; message?: string } | null>(null);

  useEffect(() => {
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
        await loadSessions('chat');
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
  }, [loadSessions, setUser]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => window.wisadelUpdater?.onEvent(setUpdate), []);

  const authenticate = (result: AuthResponse) => {
    api.setTokens(result.accessToken, result.refreshToken);
    localStorage.setItem('wisadel.user', JSON.stringify(result.user));
    setUser(result.user);
    void loadSessions('chat');
  };

  const logout = () => {
    void api.logout();
    localStorage.removeItem('wisadel.user');
    setUser(null);
  };

  const content = restoring ? <div className="splash">Wisadel</div> : !user ? <LoginPage onAuthenticated={authenticate} /> : <Workspace onLogout={logout} />;
  return <>{content}{update && <UpdateDialog update={update} onClose={() => setUpdate(null)} />}</>;
}

function UpdateDialog({ update, onClose }: { update: { type: string; version?: string; notes?: string; percent?: number; message?: string }; onClose: () => void }) {
  const downloading = update.type === 'progress';
  const downloaded = update.type === 'downloaded';
  const title = downloaded ? '更新已准备就绪' : downloading ? '正在下载更新' : update.type === 'error' ? '更新下载失败' : '发现 Wisadel 新版本';
  const notes = String(update.notes || '本次更新包含稳定性优化、功能改进与体验修复。').replace(/<[^>]*>/g, '').slice(0, 800);
  return <div className="update-backdrop"><section className="update-dialog"><div className="update-mark">W</div><span className="update-kicker">WISADEL UPDATE</span><h2>{title}</h2><p>{downloaded ? `v${update.version ?? ''} 已下载完成，重启后将进入品牌化安装流程。` : downloading ? `正在下载 v${update.version ?? ''}，请保持应用开启。` : update.type === 'error' ? (update.message ?? '请稍后重试。') : `v${update.version ?? ''} 已发布。`}</p>{(downloading || downloaded) && <div className="update-progress"><i style={{ width: `${downloaded ? 100 : Math.max(1, update.percent ?? 0)}%` }} /><span>{Math.round(downloaded ? 100 : update.percent ?? 0)}%</span></div>}<div className="update-notes"><strong>本次更新</strong><div>{notes}</div></div><footer>{downloaded ? <button className="update-primary" onClick={() => void window.wisadelUpdater?.install()}>重启并安装</button> : downloading ? <button className="update-muted" disabled>下载中</button> : <><button className="update-muted" onClick={onClose}>稍后提醒</button><button className="update-primary" onClick={() => void window.wisadelUpdater?.download()}>立即下载</button></>}</footer></section></div>;
}
