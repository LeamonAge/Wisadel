import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAccountStore } from './src/stores/accountStore';
import { useChatStore } from './src/stores/chatStore';
import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ThemeProvider } from './src/stores/themeStore';
import { dsColors } from './src/utils/theme';

// 全局样式注入
const globalStyles = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: ${dsColors.bg};
  color: ${dsColors.textPrimary};
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
`;

function AppContent() {
  const account = useAccountStore((s) => s.account);
  const loading = useAccountStore((s) => s.loading);
  const loadAccount = useAccountStore((s) => s.load);
  const loadChats = useChatStore((s) => s.load);

  useEffect(() => {
    loadAccount();
    loadChats();
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dsColors.bg,
      }}>
        <div style={{ fontSize: 48 }}>🧠</div>
      </div>
    );
  }

  return (
    <Routes>
      {account ? (
        <>
          <Route path="/chat" element={<ChatScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </>
  );
}
