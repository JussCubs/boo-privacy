'use client';

import { useState, useRef, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignTransaction } from '@privy-io/react-auth/solana';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from '@solana/web3.js';
import { getSolanaRpcUrl } from '@/lib/rpc-config';
import { useBalances } from '@/lib/balance-context';
import {
  isEmbeddedWallet,
  getSigningOptions,
  parseSignedLegacyTransaction,
} from '@/lib/wallet-signing';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function Header() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();
  const { publicBalance, refreshAllBalances } = useBalances();

  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sending, setSending] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const walletAddress = user?.wallet?.address || solanaWallets[0]?.address || '';
  const solanaWallet = solanaWallets[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowSend(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuth = () => {
    if (authenticated) {
      logout();
    } else {
      login();
    }
  };

  const handleCopy = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!sendAddress || !sendAmount || !solanaWallet) return;

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    if (amount > publicBalance) {
      toast.error('Insufficient balance');
      return;
    }

    // Validate address
    try {
      new PublicKey(sendAddress);
    } catch {
      toast.error('Invalid address');
      return;
    }

    setSending(true);
    const toastId = toast.loading('Sending SOL...');

    try {
      const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      const tx = new Transaction({
        feePayer: new PublicKey(walletAddress),
        blockhash,
        lastValidBlockHeight,
      }).add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(sendAddress),
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      // Sign transaction
      const serialized = tx.serialize({ requireAllSignatures: false });
      const embedded = isEmbeddedWallet(solanaWallet);

      let signedTx: Transaction;

      // Try external wallet first (for non-embedded wallets)
      if (!embedded && typeof window !== 'undefined') {
        const providers = [
          (window as any).phantom?.solana,
          (window as any).backpack,
          (window as any).solflare,
          (window as any).solana,
        ].filter(Boolean);

        let signed = false;
        for (const provider of providers) {
          if (typeof provider.signTransaction === 'function') {
            try {
              if (!provider.isConnected && provider.connect) await provider.connect();
              signedTx = await provider.signTransaction(tx);
              signed = true;
              break;
            } catch {}
          }
        }

        if (!signed) {
          const signedResult = await signTransaction({
            transaction: serialized,
            wallet: solanaWallet,
            options: getSigningOptions(solanaWallet),
          });
          signedTx = parseSignedLegacyTransaction(signedResult);
        }
      } else {
        // Embedded wallet - sign silently via Privy
        const signedResult = await signTransaction({
          transaction: serialized,
          wallet: solanaWallet,
          options: getSigningOptions(solanaWallet),
        });
        signedTx = parseSignedLegacyTransaction(signedResult);
      }

      const signature = await connection.sendRawTransaction(signedTx!.serialize());
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      toast.success(`Sent ${amount} SOL!`, { id: toastId });
      setSendAddress('');
      setSendAmount('');
      setShowSend(false);
      setShowDropdown(false);
      refreshAllBalances();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send', { id: toastId });
    } finally {
      setSending(false);
    }
  };

  return (
    <header className="border-b border-boo-border bg-boo-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 ghost-eyes-glow">
            <Image
              src="/boo-privacy.png"
              alt="Boo"
              width={40}
              height={40}
              className="rounded-lg"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Boo</h1>
            <p className="text-xs text-boo-dim">Private Multi-Wallet Funding</p>
          </div>
        </div>

        {/* Auth Button */}
        <div className="flex items-center gap-4">
          {authenticated && walletAddress && (
            <div className="relative" ref={dropdownRef}>
              {/* Wallet Button */}
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 bg-boo-bg px-3 py-1.5 rounded-lg border border-boo-border hover:border-white/20 transition-colors"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-mono text-white/80">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </span>
                <svg
                  className={`w-4 h-4 text-white/40 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-boo-card border border-boo-border rounded-xl shadow-2xl overflow-hidden animate-slide-up">
                  {/* Balance */}
                  <div className="p-4 border-b border-white/5 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Balance</div>
                    <div className="text-2xl font-bold text-white">{publicBalance.toFixed(4)} <span className="text-white/40 text-base">SOL</span></div>
                  </div>

                  {!showSend ? (
                    <>
                      {/* Address & Copy */}
                      <div className="p-4 border-b border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Your Address</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 p-2 bg-white/5 rounded-lg font-mono text-xs text-white/60 break-all">
                            {walletAddress}
                          </div>
                          <button
                            onClick={handleCopy}
                            className={`p-2 rounded-lg transition-all ${
                              copied
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {copied ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-4 flex gap-2">
                        <button
                          onClick={handleCopy}
                          className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Receive
                        </button>
                        <button
                          onClick={() => setShowSend(true)}
                          className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Send
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Send Form */
                    <div className="p-4">
                      <button
                        onClick={() => setShowSend(false)}
                        className="flex items-center gap-1 text-white/40 hover:text-white/80 text-sm mb-3 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                      </button>

                      <div className="space-y-3">
                        {/* Recipient */}
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                            Recipient Address
                          </label>
                          <input
                            type="text"
                            value={sendAddress}
                            onChange={(e) => setSendAddress(e.target.value)}
                            placeholder="Enter Solana address"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                          />
                        </div>

                        {/* Amount */}
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1 block">
                            Amount (SOL)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={sendAmount}
                              onChange={(e) => setSendAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                            />
                            <button
                              onClick={() => setSendAmount(Math.max(0, publicBalance - 0.001).toString())}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 px-2 py-0.5 rounded bg-white/5"
                            >
                              Max
                            </button>
                          </div>
                          <div className="text-[10px] text-white/30 mt-1">
                            Available: {publicBalance.toFixed(4)} SOL
                          </div>
                        </div>

                        {/* Send Button */}
                        <button
                          onClick={handleSend}
                          disabled={sending || !sendAddress || !sendAmount}
                          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                        >
                          {sending ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Sending...
                            </span>
                          ) : (
                            'Send SOL'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleAuth}
            disabled={!ready}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              authenticated
                ? 'bg-boo-secondary hover:bg-gray-600 text-white'
                : 'bg-boo-primary hover:bg-red-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {!ready ? 'Loading...' : authenticated ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>
    </header>
  );
}
