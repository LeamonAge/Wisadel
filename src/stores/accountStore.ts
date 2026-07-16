import { create } from 'zustand';
import { UserAccount } from '../types';
import { getAccount, login, register, logout } from '../services/account';

interface AccountState {
  account: UserAccount | null;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  loading: true,
  error: null,

  load: async () => {
    try {
      const acc = await getAccount();
      set({ account: acc, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ error: null, loading: true });
    try {
      const acc = await login(email, password);
      set({ account: acc, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signUp: async (email, password) => {
    set({ error: null, loading: true });
    try {
      const acc = await register(email, password);
      set({ account: acc, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signOut: async () => {
    await logout();
    set({ account: null });
  },

  clearError: () => set({ error: null }),
}));
