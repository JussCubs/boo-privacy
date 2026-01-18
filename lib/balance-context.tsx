'use client';

/**
 * Balance Context - Centralized balance and price polling for the app
 *
 * Polls both public (on-chain) and shielded (Privacy Cash) balances
 * for multiple tokens (SOL, USDC, ORE, stORE) at regular intervals.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { useBooStore } from '@/lib/store';
import {
  isInitialized as isPrivacyCashInitialized,
  getStoredEncryptionKey,
  PrivacyCashClient,
} from '@/lib/privacy-cash-client';
import { getSolanaRpcUrl } from '@/lib/rpc-config';
import { TOKENS, TOKEN_SYMBOLS, TokenSymbol, parseTokenAmount } from '@/lib/tokens';
import { fetchTokenPrices, TokenPrices, getCachedPrices, calculateUsdValue } from '@/lib/prices';
import { getActiveWalletAddress } from '@/lib/wallet-signing';

// Polling intervals
const BALANCE_POLL_INTERVAL = 15000; // 15 seconds
const PRICE_POLL_INTERVAL = 60000; // 60 seconds

export interface TokenBalance {
  raw: number;
  ui: number;
  usdValue: number;
}

export type TokenBalances = Record<TokenSymbol, TokenBalance>;

interface BalanceContextType {
  // Primary wallet address
  walletAddress: string;

  // Public (on-chain) token balances
  tokenBalances: TokenBalances;
  totalUsdValue: number;

  // Legacy: Public SOL balance (for backwards compatibility)
  publicBalance: number;
  publicBalanceLamports: number;

  // Shielded balance (Privacy Cash)
  shieldedBalance: number;
  shieldedBalanceLamports: number;

  // Derived wallet balances (only SOL for now)
  walletBalances: Record<string, number>;
  totalWalletBalance: number;

  // Token prices
  prices: TokenPrices;

  // Loading states
  loadingBalances: boolean;
  loadingPrices: boolean;
  loadingShielded: boolean;
  loadingWallets: boolean;

  // Last update timestamps
  lastBalancesUpdate: number | null;
  lastPricesUpdate: number | null;
  lastShieldedUpdate: number | null;
  lastWalletsUpdate: number | null;

  // Manual refresh functions
  refreshBalances: () => Promise<void>;
  refreshPrices: () => Promise<void>;
  refreshShieldedBalance: () => Promise<void>;
  refreshWalletBalances: () => Promise<void>;
  refreshAllBalances: () => Promise<void>;

  // Polling control
  isPaused: boolean;
  pausePolling: () => void;
  resumePolling: () => void;
}

const defaultTokenBalance: TokenBalance = { raw: 0, ui: 0, usdValue: 0 };
const defaultTokenBalances: TokenBalances = {
  SOL: { ...defaultTokenBalance },
  USDC: { ...defaultTokenBalance },
  ORE: { ...defaultTokenBalance },
  stORE: { ...defaultTokenBalance },
};

const BalanceContext = createContext<BalanceContextType | null>(null);

export function useBalances() {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error('useBalances must be used within a BalanceProvider');
  }
  return context;
}

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { user, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();

  const {
    walletSet,
    setPublicBalance: setStorePublicBalance,
    setShieldedBalance: setStoreShieldedBalance,
  } = useBooStore();

  // Get the active wallet address (prefers connected external wallet like Phantom)
  const walletAddress = getActiveWalletAddress(solanaWallets, user);

  // Token balances state
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>(defaultTokenBalances);
  const [prices, setPrices] = useState<TokenPrices>(getCachedPrices());

  // Shielded balance
  const [shieldedBalance, setShieldedBalance] = useState(0);
  const [shieldedBalanceLamports, setShieldedBalanceLamports] = useState(0);

  // Derived wallet balances
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});

  // Loading states
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingShielded, setLoadingShielded] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(false);

  // Timestamps
  const [lastBalancesUpdate, setLastBalancesUpdate] = useState<number | null>(null);
  const [lastPricesUpdate, setLastPricesUpdate] = useState<number | null>(null);
  const [lastShieldedUpdate, setLastShieldedUpdate] = useState<number | null>(null);
  const [lastWalletsUpdate, setLastWalletsUpdate] = useState<number | null>(null);

  const [isPaused, setIsPaused] = useState(false);

  // Refs
  const clientRef = useRef<PrivacyCashClient | null>(null);
  const connectionRef = useRef<Connection | null>(null);

  // Invalidate cached client when wallet address changes
  useEffect(() => {
    clientRef.current = null;
  }, [walletAddress]);

  // Get or create connection
  const getConnection = useCallback(() => {
    if (!connectionRef.current) {
      const rpcUrl = getSolanaRpcUrl();
      connectionRef.current = new Connection(rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 30000,
      });
    }
    return connectionRef.current;
  }, []);

  // Get or create Privacy Cash client
  const getPrivacyCashClient = useCallback(() => {
    if (!walletAddress) return null;
    if (clientRef.current) return clientRef.current;

    const encryptionKey = getStoredEncryptionKey(walletAddress);
    if (!encryptionKey) return null;

    clientRef.current = new PrivacyCashClient({
      rpcUrl: getSolanaRpcUrl(),
      walletAddress,
      encryptionKey,
    });

    return clientRef.current;
  }, [walletAddress]);

  // Refresh token balances (all tokens)
  const refreshBalances = useCallback(async () => {
    if (!walletAddress) return;

    setLoadingBalances(true);
    try {
      const connection = getConnection();
      const pubkey = new PublicKey(walletAddress);

      // Fetch SOL balance
      const solBalance = await connection.getBalance(pubkey);
      const solUi = solBalance / LAMPORTS_PER_SOL;

      // Fetch token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      // Initialize new balances
      const newBalances: TokenBalances = { ...defaultTokenBalances };
      const currentPrices = getCachedPrices();

      // Set SOL balance
      newBalances.SOL = {
        raw: solBalance,
        ui: solUi,
        usdValue: calculateUsdValue(solUi, 'SOL'),
      };

      // Process token accounts
      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed?.info;
        if (!parsedInfo) continue;

        const mint = parsedInfo.mint as string;
        const uiAmount = parsedInfo.tokenAmount?.uiAmount ?? 0;
        const rawAmount = parseInt(parsedInfo.tokenAmount?.amount ?? '0', 10);

        // Match to known tokens
        for (const symbol of TOKEN_SYMBOLS) {
          if (symbol === 'SOL') continue;
          if (TOKENS[symbol].mint === mint) {
            newBalances[symbol] = {
              raw: rawAmount,
              ui: uiAmount,
              usdValue: calculateUsdValue(uiAmount, symbol),
            };
            break;
          }
        }
      }

      setTokenBalances(newBalances);
      setStorePublicBalance(newBalances.SOL.ui, newBalances.SOL.raw);
      setLastBalancesUpdate(Date.now());

      console.log('[BalanceContext] Token balances updated:', {
        SOL: newBalances.SOL.ui,
        USDC: newBalances.USDC.ui,
        ORE: newBalances.ORE.ui,
        stORE: newBalances.stORE.ui,
      });
    } catch (error) {
      console.error('[BalanceContext] Failed to fetch balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  }, [walletAddress, getConnection, setStorePublicBalance]);

  // Refresh prices
  const refreshPrices = useCallback(async () => {
    setLoadingPrices(true);
    try {
      const newPrices = await fetchTokenPrices();
      setPrices(newPrices);
      setLastPricesUpdate(Date.now());

      // Update token USD values with new prices
      setTokenBalances(prev => {
        const updated = { ...prev };
        for (const symbol of TOKEN_SYMBOLS) {
          updated[symbol] = {
            ...prev[symbol],
            usdValue: calculateUsdValue(prev[symbol].ui, symbol),
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('[BalanceContext] Failed to fetch prices:', error);
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  // Refresh shielded balance
  const refreshShieldedBalance = useCallback(async () => {
    if (!walletAddress) return;
    if (!isPrivacyCashInitialized(walletAddress)) {
      setShieldedBalance(0);
      setShieldedBalanceLamports(0);
      setStoreShieldedBalance(0, 0);
      return;
    }

    setLoadingShielded(true);
    try {
      const client = getPrivacyCashClient();
      if (!client) {
        console.log('[BalanceContext] No Privacy Cash client available');
        return;
      }

      const { sol, lamports } = await client.getBalance();
      setShieldedBalance(sol);
      setShieldedBalanceLamports(lamports);
      setStoreShieldedBalance(sol, lamports);
      setLastShieldedUpdate(Date.now());

      console.log('[BalanceContext] Shielded balance updated:', sol, 'SOL');
    } catch (error) {
      console.error('[BalanceContext] Failed to fetch shielded balance:', error);
    } finally {
      setLoadingShielded(false);
    }
  }, [walletAddress, getPrivacyCashClient, setStoreShieldedBalance]);

  // Refresh wallet balances (derived wallets)
  const refreshWalletBalances = useCallback(async () => {
    if (!walletSet || walletSet.wallets.length === 0) {
      setWalletBalances({});
      return;
    }

    setLoadingWallets(true);
    try {
      const connection = getConnection();
      const addresses = walletSet.wallets.map(w => new PublicKey(w.publicKey));

      // Batch fetch balances
      const balanceResults = await Promise.all(
        addresses.map(addr => connection.getBalance(addr).catch(() => 0))
      );

      const newBalances: Record<string, number> = {};
      walletSet.wallets.forEach((wallet, i) => {
        newBalances[wallet.publicKey] = balanceResults[i] / LAMPORTS_PER_SOL;
      });

      setWalletBalances(newBalances);
      setLastWalletsUpdate(Date.now());

      const total = Object.values(newBalances).reduce((sum, bal) => sum + bal, 0);
      console.log('[BalanceContext] Wallet balances updated, total:', total, 'SOL');
    } catch (error) {
      console.error('[BalanceContext] Failed to fetch wallet balances:', error);
    } finally {
      setLoadingWallets(false);
    }
  }, [walletSet, getConnection]);

  // Refresh all balances
  const refreshAllBalances = useCallback(async () => {
    await Promise.all([
      refreshBalances(),
      refreshPrices(),
      refreshShieldedBalance(),
      refreshWalletBalances(),
    ]);
  }, [refreshBalances, refreshPrices, refreshShieldedBalance, refreshWalletBalances]);

  // Computed values
  const publicBalance = tokenBalances.SOL.ui;
  const publicBalanceLamports = tokenBalances.SOL.raw;
  const totalWalletBalance = Object.values(walletBalances).reduce((sum, bal) => sum + bal, 0);
  const totalUsdValue = TOKEN_SYMBOLS.reduce((sum, symbol) => sum + tokenBalances[symbol].usdValue, 0);

  // Polling control
  const pausePolling = useCallback(() => setIsPaused(true), []);
  const resumePolling = useCallback(() => setIsPaused(false), []);

  // Initial fetch when authenticated
  useEffect(() => {
    if (authenticated && walletAddress) {
      refreshAllBalances();
    }
  }, [authenticated, walletAddress, refreshAllBalances]);

  // Refresh shielded balance when initialization state changes
  useEffect(() => {
    if (walletAddress && isPrivacyCashInitialized(walletAddress)) {
      clientRef.current = null;
      refreshShieldedBalance();
    }
  }, [walletAddress, refreshShieldedBalance]);

  // Refresh wallet balances when walletSet changes
  useEffect(() => {
    if (walletSet) {
      refreshWalletBalances();
    }
  }, [walletSet?.wallets.length, refreshWalletBalances]);

  // Balance polling interval
  useEffect(() => {
    if (!authenticated || !walletAddress || isPaused) return;

    const intervalId = setInterval(() => {
      console.log('[BalanceContext] Polling balances...');
      refreshBalances();
      refreshShieldedBalance();
      refreshWalletBalances();
    }, BALANCE_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [authenticated, walletAddress, isPaused, refreshBalances, refreshShieldedBalance, refreshWalletBalances]);

  // Price polling interval (less frequent)
  useEffect(() => {
    if (!authenticated || isPaused) return;

    const intervalId = setInterval(() => {
      console.log('[BalanceContext] Polling prices...');
      refreshPrices();
    }, PRICE_POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [authenticated, isPaused, refreshPrices]);

  const value: BalanceContextType = {
    walletAddress,
    tokenBalances,
    totalUsdValue,
    publicBalance,
    publicBalanceLamports,
    shieldedBalance,
    shieldedBalanceLamports,
    walletBalances,
    totalWalletBalance,
    prices,
    loadingBalances,
    loadingPrices,
    loadingShielded,
    loadingWallets,
    lastBalancesUpdate,
    lastPricesUpdate,
    lastShieldedUpdate,
    lastWalletsUpdate,
    refreshBalances,
    refreshPrices,
    refreshShieldedBalance,
    refreshWalletBalances,
    refreshAllBalances,
    isPaused,
    pausePolling,
    resumePolling,
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}
