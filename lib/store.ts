/**
 * Boo Privacy Global Store
 *
 * Zustand store for managing app state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DerivedWallet, WalletSet } from './hd-wallet';

export type FundingStatus = 'idle' | 'shielding' | 'distributing' | 'complete' | 'error';

export interface FundingTask {
  id: string;
  walletIndex: number;
  walletAddress: string;
  amount: number; // lamports
  status: 'pending' | 'processing' | 'success' | 'error';
  signature?: string;
  error?: string;
}

export interface BooStore {
  // Wallet set (derived wallets from seed phrase)
  walletSet: WalletSet | null;
  setWalletSet: (walletSet: WalletSet | null) => void;

  // Shielded balance
  shieldedBalance: number; // in SOL
  shieldedBalanceLamports: number;
  setShieldedBalance: (sol: number, lamports: number) => void;

  // Public balance
  publicBalance: number; // in SOL
  publicBalanceLamports: number;
  setPublicBalance: (sol: number, lamports: number) => void;

  // Funding state
  fundingStatus: FundingStatus;
  setFundingStatus: (status: FundingStatus) => void;

  // Funding tasks
  fundingTasks: FundingTask[];
  setFundingTasks: (tasks: FundingTask[]) => void;
  updateFundingTask: (id: string, update: Partial<FundingTask>) => void;

  // Amount per wallet (in SOL)
  amountPerWallet: string;
  setAmountPerWallet: (amount: string) => void;

  // Selected wallet indices for funding
  selectedWallets: number[];
  setSelectedWallets: (indices: number[]) => void;
  toggleWallet: (index: number) => void;
  selectAllWallets: () => void;
  deselectAllWallets: () => void;

  // UI state
  showSeedPhrase: boolean;
  setShowSeedPhrase: (show: boolean) => void;

  // Reset all state
  reset: () => void;
}

const initialState = {
  walletSet: null,
  shieldedBalance: 0,
  shieldedBalanceLamports: 0,
  publicBalance: 0,
  publicBalanceLamports: 0,
  fundingStatus: 'idle' as FundingStatus,
  fundingTasks: [],
  amountPerWallet: '0.01',
  selectedWallets: [],
  showSeedPhrase: false,
};

export const useBooStore = create<BooStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setWalletSet: (walletSet) => {
        set({ walletSet });
        // Auto-select all wallets when set is created
        if (walletSet) {
          set({ selectedWallets: walletSet.wallets.map(w => w.index) });
        } else {
          set({ selectedWallets: [] });
        }
      },

      setShieldedBalance: (sol, lamports) => set({
        shieldedBalance: sol,
        shieldedBalanceLamports: lamports,
      }),

      setPublicBalance: (sol, lamports) => set({
        publicBalance: sol,
        publicBalanceLamports: lamports,
      }),

      setFundingStatus: (fundingStatus) => set({ fundingStatus }),

      setFundingTasks: (fundingTasks) => set({ fundingTasks }),

      updateFundingTask: (id, update) => set((state) => ({
        fundingTasks: state.fundingTasks.map(task =>
          task.id === id ? { ...task, ...update } : task
        ),
      })),

      setAmountPerWallet: (amountPerWallet) => set({ amountPerWallet }),

      setSelectedWallets: (selectedWallets) => set({ selectedWallets }),

      toggleWallet: (index) => set((state) => {
        const isSelected = state.selectedWallets.includes(index);
        if (isSelected) {
          return { selectedWallets: state.selectedWallets.filter(i => i !== index) };
        } else {
          return { selectedWallets: [...state.selectedWallets, index].sort((a, b) => a - b) };
        }
      }),

      selectAllWallets: () => set((state) => {
        if (!state.walletSet) return {};
        return { selectedWallets: state.walletSet.wallets.map(w => w.index) };
      }),

      deselectAllWallets: () => set({ selectedWallets: [] }),

      setShowSeedPhrase: (showSeedPhrase) => set({ showSeedPhrase }),

      reset: () => set(initialState),
    }),
    {
      name: 'boo-privacy-storage',
      partialize: (state) => ({
        // Only persist these fields (NOT seed phrase for security)
        amountPerWallet: state.amountPerWallet,
      }),
    }
  )
);
