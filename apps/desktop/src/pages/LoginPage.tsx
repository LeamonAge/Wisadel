import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import type { AuthResponse } from '@wisadel/contracts';
import { api } from '../api';

export function LoginPage({ onAuthenticated }: { onAuthenticated: (result: AuthResponse) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [nickname, setNickname] = useState('Leamon');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = mode === 'login' ? await api.login(email, password) : await api.register(email, password, nickname);
      onAuthenticated(result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '操作失败';
      if (mode === 'login' && message.includes('邮箱或密码错误')) {
        try {
          onAuthenticated(await api.register(email, password, nickname));
          return;
        } catch {
          setError(message);
        }
      } else setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="brand-mark"><Sparkles size={22} /></div>
        <div><strong>Wisadel</strong><span>AI 创作工作台</span></div>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-heading">
          <span>{mode === 'login' ? '欢迎回来' : '创建内测账户'}</span>
          <h1>{mode === 'login' ? '继续你的创作' : '开始使用 Wisadel'}</h1>
          <p>对话、构思与图像生成，在一个安静的工作区里完成。</p>
        </div>
        {mode === 'register' && <label>昵称<input value={nickname} onChange={(event) => setNickname(event.target.value)} required /></label>}
        <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>密码<div className="password-field"><input type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><button type="button" onClick={() => setVisible(!visible)} aria-label="切换密码可见性">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-command" disabled={busy}>{busy ? '连接中...' : mode === 'login' ? '登录' : '注册'}<ArrowRight size={18} /></button>
        <button className="text-command" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '没有账号？创建内测账户' : '已有账号？返回登录'}</button>
      </form>
      <footer className="auth-footer">Wisadel Preview · Windows 10/11</footer>
    </main>
  );
}
