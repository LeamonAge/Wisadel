import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserAccount } from '../types';

const ACCOUNT_KEY = 'user_account';

// 简易哈希（SHA-256 不可用时的降级方案）
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function register(email: string, password: string): Promise<UserAccount> {
  const existing = await getAccount();
  if (existing) throw new Error('已注册账户');

  if (!email.includes('@') || password.length < 4) {
    throw new Error('邮箱格式不正确或密码太短（至少4位）');
  }

  const account: UserAccount = {
    email: email.trim().toLowerCase(),
    passwordHash: simpleHash(password),
    createdAt: Date.now(),
  };

  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  return account;
}

export async function login(email: string, password: string): Promise<UserAccount> {
  const account = await getAccount();
  if (!account) throw new Error('账户不存在，请先注册');
  if (account.passwordHash !== simpleHash(password)) throw new Error('密码错误');
  return account;
}

export async function getAccount(): Promise<UserAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function isLoggedIn(): Promise<boolean> {
  return (await getAccount()) !== null;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(ACCOUNT_KEY);
}
