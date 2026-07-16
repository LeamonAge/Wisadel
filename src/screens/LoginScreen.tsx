import React, { useState } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { dsColors as c, dsFontSize as f, dsSpacing as s } from '../utils/theme';

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bg,
    padding: '0 32px',
  },
  top: {
    textAlign: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: f.xxl,
    fontWeight: 700,
    color: c.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: f.md,
    color: c.textSecondary,
  },
  form: {
    width: '100%',
    maxWidth: 360,
  },
  input: {
    width: '100%',
    backgroundColor: c.inputBg,
    color: c.textPrimary,
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: f.md,
    marginBottom: 12,
    border: `1px solid ${c.border}`,
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputPlaceholder: {
    color: c.textTertiary,
  },
  error: {
    color: c.error,
    fontSize: f.sm,
    textAlign: 'center',
    marginBottom: 12,
  },
  btn: {
    width: '100%',
    backgroundColor: c.accent,
    color: c.white,
    borderRadius: 12,
    padding: '14px 0',
    fontSize: f.md,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  btnText: {
    color: c.white,
    fontSize: f.md,
    fontWeight: 600,
  },
  switch: {
    color: c.accent,
    fontSize: f.sm,
    textAlign: 'center',
    marginTop: 20,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    display: 'block',
    width: '100%',
  },
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, loading, error, clearError } = useAccountStore();

  const handleSubmit = async () => {
    clearError();
    try {
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
    } catch {}
  };

  return (
    <div style={styles.container}>
      <div style={styles.top}>
        <div style={styles.logo}>🧠</div>
        <div style={styles.title}>理智</div>
        <div style={styles.subtitle}>你的手机 AI 助手</div>
      </div>

      <div style={styles.form}>
        <input
          style={styles.input}
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
        />
        <input
          style={styles.input}
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        {error ? <div style={styles.error}>{error}</div> : null}

        <button
          style={{
            ...styles.btn,
            ...(loading || !email || !password ? styles.btnDisabled : {}),
          }}
          onClick={handleSubmit}
          disabled={loading || !email || !password}
        >
          {loading ? (
            <span style={{ width: 20, height: 20, border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <span style={styles.btnText}>{isSignUp ? '注册' : '登录'}</span>
          )}
        </button>

        <button
          style={styles.switch}
          onClick={() => { setIsSignUp(!isSignUp); clearError(); }}
        >
          {isSignUp ? '已有账户？登录' : '没有账户？注册'}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
