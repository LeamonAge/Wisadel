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

  if (restoring) return <div className="splash">Wisadel</div>;
  if (!user) return <LoginPage onAuthenticated={authenticate} />;
  return <Workspace onLogout={logout} />;
}
