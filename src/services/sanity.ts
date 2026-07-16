import { SanityState, Transaction } from '../types';
import { SanityCosts } from '../utils/constants';

const SANITY_KEY = 'sanity_state';
const INITIAL_BALANCE = 100;

// ===== 理智系统服务（Electron 版，使用 localStorage） =====
export async function getSanityState(): Promise<SanityState> {
  try {
    const raw = localStorage.getItem(SANITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const defaultState: SanityState = {
    balance: INITIAL_BALANCE,
    totalConsumed: 0,
    totalRecharged: INITIAL_BALANCE,
    transactions: [
      {
        id: 'init',
        type: 'recharge',
        amount: INITIAL_BALANCE,
        description: '新用户赠送',
        timestamp: Date.now(),
      },
    ],
  };
  localStorage.setItem(SANITY_KEY, JSON.stringify(defaultState));
  return defaultState;
}

export async function consumeSanity(
  amount: number,
  description: string,
  chatId?: string
): Promise<SanityState> {
  const state = await getSanityState();
  if (state.balance < amount) {
    throw new Error(`理智不足！需要 🧠${amount}，当前余额 🧠${state.balance}`);
  }
  const tx: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'consume',
    amount: -amount,
    description,
    timestamp: Date.now(),
    relatedChatId: chatId,
  };
  state.balance -= amount;
  state.totalConsumed += amount;
  state.transactions.push(tx);
  localStorage.setItem(SANITY_KEY, JSON.stringify(state));
  return state;
}

export async function rechargeSanity(
  amount: number,
  description: string
): Promise<SanityState> {
  const state = await getSanityState();
  const tx: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'recharge',
    amount,
    description,
    timestamp: Date.now(),
  };
  state.balance += amount;
  state.totalRecharged += amount;
  state.transactions.push(tx);
  localStorage.setItem(SANITY_KEY, JSON.stringify(state));
  return state;
}
