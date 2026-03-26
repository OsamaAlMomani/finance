import { create } from 'zustand';

const BALANCE_VISIBLE_STORAGE_KEY = 'ui.balanceVisible';

const readInitialBalanceVisible = () => {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(BALANCE_VISIBLE_STORAGE_KEY);
  if (!raw) return true;
  return raw === '1';
};

const persistBalanceVisible = (value: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BALANCE_VISIBLE_STORAGE_KEY, value ? '1' : '0');
};

interface UiState {
  balanceVisible: boolean;
  setBalanceVisible: (value: boolean) => void;
  toggleBalanceVisible: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  balanceVisible: readInitialBalanceVisible(),
  setBalanceVisible: (value) => {
    persistBalanceVisible(value);
    set({ balanceVisible: value });
  },
  toggleBalanceVisible: () => {
    const next = !get().balanceVisible;
    persistBalanceVisible(next);
    set({ balanceVisible: next });
  }
}));

