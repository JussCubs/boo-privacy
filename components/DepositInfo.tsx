'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import toast from 'react-hot-toast';

export default function DepositInfo() {
  const { user, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [copied, setCopied] = useState(false);

  const walletAddress = user?.wallet?.address || solanaWallets[0]?.address || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!authenticated || !walletAddress) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">💳</span>
        <h2 className="text-lg font-semibold">Deposit SOL</h2>
      </div>

      <p className="text-boo-dim text-sm mb-4">
        Send SOL to your wallet address below. Then shield it to fund wallets privately.
      </p>

      {/* Deposit Address */}
      <div className="bg-boo-bg rounded-lg p-3 border border-boo-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-boo-dim">Your Deposit Address</span>
          <button
            onClick={handleCopy}
            className="text-xs text-boo-primary hover:text-red-400 transition-colors"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
        <div
          className="font-mono text-sm text-white break-all cursor-pointer hover:text-boo-primary transition-colors"
          onClick={handleCopy}
        >
          {walletAddress}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-2 text-xs">
          <span className="text-green-400">✓</span>
          <span className="text-boo-dim">Send SOL from any exchange or wallet</span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <span className="text-green-400">✓</span>
          <span className="text-boo-dim">Works with Coinbase, Phantom, Solflare, etc.</span>
        </div>
        <div className="flex items-start gap-2 text-xs">
          <span className="text-yellow-400">⚡</span>
          <span className="text-boo-dim">Keep ~0.01 SOL for transaction fees</span>
        </div>
      </div>
    </div>
  );
}
