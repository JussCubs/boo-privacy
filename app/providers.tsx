'use client';

import { useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { Toaster } from 'react-hot-toast';
import { getSolanaRpcUrl, getSolanaWebSocketUrl } from '@/lib/rpc-config';
import { patchFetchForPrivacyCash } from '@/lib/fetch-interceptor';
import { BalanceProvider } from '@/lib/balance-context';
import { CelebrationProvider } from '@/lib/celebration-context';

// Initialize Solana wallet connectors (Phantom, Solflare, etc.)
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is required');
  }

  // Enable Privacy Cash API proxy to avoid CORS issues
  useEffect(() => {
    patchFetchForPrivacyCash();
  }, []);

  // Suppress MetaMask errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message && (event.message.includes('MetaMask') || event.message.includes('ethereum'))) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason && typeof reason === 'object') {
        const message = reason.message || reason.toString();
        if (message && (message.includes('MetaMask') || message.includes('ethereum'))) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleRejection, true);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleRejection, true);
    };
  }, []);

  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: {
          solana: {
            createOnLogin: 'all-users',
          },
        },
        appearance: {
          theme: 'dark',
          accentColor: '#ef4444', // Boo red
          walletChainType: 'solana-only',
          showWalletLoginFirst: true,
        },
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: createSolanaRpc(getSolanaRpcUrl()),
              rpcSubscriptions: createSolanaRpcSubscriptions(getSolanaWebSocketUrl()),
            },
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        loginMethods: ['wallet', 'email'],
      }}
    >
      <CelebrationProvider>
        <BalanceProvider>
          {children}
        </BalanceProvider>
      </CelebrationProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-boo-card text-white border border-boo-border font-sans text-sm',
          duration: 4000,
          style: {
            background: '#111111',
            color: '#ffffff',
            border: '1px solid #1f1f1f',
          },
        }}
      />
    </PrivyProvider>
  );
}
