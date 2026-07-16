import { useEffect, useState, type FormEvent } from 'react';
import { Activity, Database, Image, LogIn, MessageSquare, Server, ShieldCheck, Users } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

interface Overview { users: number; sessions: number; queuedTasks: number; processingTasks: number; completedTasks: number; services: Record<string,string>; }

function Admin() {
  const [token, setToken] = useState(localStorage.getItem('wisadel.adminToken'));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');

  const load = async (auth = token) => {
    if (!auth) return;
    const response = await fetch(`${API}/admin/overview`, { headers: { Authorization: `Bearer ${auth}` } });
    if (!response.ok) throw new Error('管理员会话无效');
    setOverview(await response.json());
  };
  useEffect(() => { void load().catch(() => setToken(null)); }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      let response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) response = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password, nickname: 'Administrator' }) });
      const result = await response.json();
      if (!response.ok || result.user?.role !== 'admin') throw new Error('该账户没有管理员权限');
      localStorage.setItem('wisadel.adminToken', result.accessToken); setToken(result.accessToken); await load(result.accessToken);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '登录失败'); }
  };

  if (!token || !overview) return <main className="admin-login"><form onSubmit={login}><div className="admin-symbol"><ShieldCheck /></div><span>INTERNAL ACCESS</span><h1>Wisadel 管理控制台</h1><p>使用已配置的管理员邮箱登录。</p><label>邮箱<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></label><label>密码<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></label>{error && <div className="error">{error}</div>}<button><LogIn size={17}/>登录</button></form></main>;

  const cards = [
    ['用户', overview.users, Users], ['会话', overview.sessions, MessageSquare], ['排队任务', overview.queuedTasks, Activity], ['已完成图像', overview.completedTasks, Image]
  ] as const;
  return <main className="admin-shell"><aside><div className="admin-logo"><ShieldCheck/><div><strong>Wisadel</strong><span>管理控制台</span></div></div><nav><button className="active"><Activity/>运行概览</button><button><Users/>用户</button><button><Server/>服务状态</button></nav></aside><section><header><div><span>系统概览</span><h1>运行状态</h1></div><div className="live"><i/>实时</div></header><div className="metric-grid">{cards.map(([label,value,Icon])=><article key={label}><Icon/><span>{label}</span><strong>{value}</strong></article>)}</div><div className="service-table"><div className="table-head"><div><span>基础设施</span><h2>服务健康</h2></div><button onClick={()=>void load()}>刷新</button></div>{Object.entries(overview.services).map(([name,status])=><div className="service-row" key={name}><Database/><div><strong>{name}</strong><span>Wisadel runtime dependency</span></div><span className={`service-status ${status}`}><i/>{status}</span></div>)}</div></section></main>;
}

createRoot(document.getElementById('root')!).render(<Admin/>);
