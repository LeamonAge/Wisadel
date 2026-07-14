import { create } from 'zustand';
import { SanityState, Transaction } from '../types';
import { getSanityState, consumeSanity, rechargeSanity } from '../services/sanity';

interface SanityStore {
  state: SanityState | null;
  loading: boolean;

  load: () => Promise<void>;
  consume: (amount: number, desc: string, chatId?: string) => Promise<void>;
  recharge: (amount: number, desc: string) => Promise<void>;
}

export const useSanityStore = create<SanityStore>((set) => ({
  state: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const state = await getSanityState();
      set({ state, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  consume: async (amount: number, desc: string, chatId?: string) => {
    const state = await consumeSanity(amount, desc, chatId);
    set({ state });
  },

  recharge: async (amount: number, desc: string) => {
    const state = await rechargeSanity(amount, desc);
    set({ state });
  },
}));
