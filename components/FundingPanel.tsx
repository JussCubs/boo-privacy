'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignTransaction, useSignMessage } from '@privy-io/react-auth/solana';
import {
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { useBooStore } from '@/lib/store';
import {
  PRIVACY_CASH_SIGN_MESSAGE,
  isInitialized as isPrivacyCashInitialized,
  storeEncryptionKey,
  getStoredEncryptionKey,
  PrivacyCashClient,
} from '@/lib/privacy-cash-client';
import { getSolanaRpcUrl } from '@/lib/rpc-config';
import { formatAddress } from '@/lib/hd-wallet';
import { useBalances } from '@/lib/balance-context';
import { useCelebration } from '@/lib/celebration-context';
import {
  isEmbeddedWallet,
  getSigningOptions,
  getActiveWalletAddress,
  tryExternalWalletSign,
  tryExternalWalletSignMessage,
  tryExternalWalletSignLegacyTransaction,
  parseSignedTransaction,
  parseSignedLegacyTransaction,
} from '@/lib/wallet-signing';
import { useSolPrice } from '@/lib/use-sol-price';
import toast from 'react-hot-toast';

// Protocol fee
const PROTOCOL_FEE_RATE = 0.005;
const PROTOCOL_TREASURY = 'BatAUJL6iFaBPiExBPxKH7XBGDVo4Bih6vUE7cGfHNEq';

export default function FundingPanel() {
  const { user, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();
  const { signMessage } = useSignMessage();

  const { publicBalance, shieldedBalance, refreshAllBalances, pausePolling, resumePolling } = useBalances();
  const { celebrate } = useCelebration();
  const { toUsd } = useSolPrice();

  const {
    walletSet,
    selectedWallets,
    setShieldedBalance,
    amountPerWallet,
    setAmountPerWallet,
    fundingStatus,
    setFundingStatus,
    fundingTasks,
    setFundingTasks,
    updateFundingTask,
  } = useBooStore();

  // Get the active wallet address (prefers connected external wallet like Phantom)
  const walletAddress = getActiveWalletAddress(solanaWallets, user);
  const solanaWallet = solanaWallets[0];

  const [isShielding, setIsShielding] = useState(false);
  const [progress, setProgress] = useState(0);

  const clientRef = useRef<PrivacyCashClient | null>(null);
  const signTransactionRef = useRef(signTransaction);
  const signMessageRef = useRef(signMessage);
  const solanaWalletRef = useRef(solanaWallet);
  const abortRef = useRef(false);

  useEffect(() => {
    signTransactionRef.current = signTransaction;
    signMessageRef.current = signMessage;
    solanaWalletRef.current = solanaWallet;
  });

  // Invalidate cached client when wallet address changes
  useEffect(() => {
    clientRef.current = null;
  }, [walletAddress]);

  // Calculate amounts
  const amountNum = parseFloat(amountPerWallet) || 0;
  const walletCount = selectedWallets.length;

  // Fee calculations (Privacy Cash withdrawal fees)
  const WITHDRAWAL_FEE_RATE = 0.0035; // 0.35% per withdrawal
  const WITHDRAWAL_RENT = 0.006; // 0.006 SOL rent per withdrawal

  const baseAmount = amountNum * walletCount;
  const withdrawalFeePercent = baseAmount * WITHDRAWAL_FEE_RATE;
  const withdrawalRent = WITHDRAWAL_RENT * walletCount;
  const totalWithdrawalFees = withdrawalFeePercent + withdrawalRent;
  const totalWithFees = baseAmount + totalWithdrawalFees;

  const needsShielding = shieldedBalance < totalWithFees;
  const amountToShield = Math.max(0, totalWithFees - shieldedBalance);
  const protocolFee = amountToShield * PROTOCOL_FEE_RATE; // 0.5% on new shielded amount

  const totalFromPublic = amountToShield + protocolFee; // What comes from public balance

  const canFund = walletCount > 0 && amountNum > 0 && (shieldedBalance >= totalWithFees || publicBalance >= totalFromPublic);

  // Transaction signer
  const createTransactionSigner = useCallback(() => {
    return async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      const wallet = solanaWalletRef.current;
      if (!wallet) throw new Error('No wallet connected');

      const embedded = isEmbeddedWallet(wallet);
      console.log('[FundingPanel] Signing transaction, embedded:', embedded);

      // For external wallets, try direct provider signing first
      if (!embedded) {
        console.log('[FundingPanel] Trying external wallet signing...');
        const externalSigned = await tryExternalWalletSign(tx);
        if (externalSigned) {
          console.log('[FundingPanel] External wallet signing succeeded');
          return externalSigned;
        }
        console.log('[FundingPanel] External wallet signing failed, trying Privy fallback...');
      }

      // Use Privy signing (silent for embedded, with UI for external)
      console.log('[FundingPanel] Using Privy signTransaction...');
      const signedResult = await signTransactionRef.current({
        transaction: tx.serialize(),
        wallet,
        options: getSigningOptions(wallet),
      });

      console.log('[FundingPanel] Privy signTransaction returned:', typeof signedResult);
      const parsed = parseSignedTransaction(signedResult);
      console.log('[FundingPanel] Parsed transaction, signatures count:', parsed.signatures?.length);
      return parsed;
    };
  }, []);

  const getClient = useCallback(async (): Promise<PrivacyCashClient> => {
    if (clientRef.current) return clientRef.current;
    const encryptionKey = getStoredEncryptionKey(walletAddress);
    if (!encryptionKey) throw new Error('Not initialized');

    const client = new PrivacyCashClient({
      rpcUrl: getSolanaRpcUrl(),
      walletAddress,
      encryptionKey,
      transactionSigner: createTransactionSigner(),
    });
    clientRef.current = client;
    return client;
  }, [walletAddress, createTransactionSigner]);

  const ensureInitialized = async () => {
    if (isPrivacyCashInitialized(walletAddress)) return true;
    if (!solanaWallet) return false;

    try {
      const messageBytes = new TextEncoder().encode(PRIVACY_CASH_SIGN_MESSAGE);
      const embedded = isEmbeddedWallet(solanaWallet);
      let signature: string;

      // For external wallets, try direct provider signing first
      if (!embedded) {
        const externalSig = await tryExternalWalletSignMessage(messageBytes);
        if (externalSig) {
          signature = externalSig;
        } else {
          // Fallback to Privy signing with UI
          const { signature: privySig } = await signMessageRef.current({
            message: messageBytes,
            wallet: solanaWallet,
            options: getSigningOptions(solanaWallet),
          });
          signature = privySig;
        }
      } else {
        // Embedded wallet - sign silently via Privy
        const { signature: privySig } = await signMessageRef.current({
          message: messageBytes,
          wallet: solanaWallet,
          options: getSigningOptions(solanaWallet),
        });
        signature = privySig;
      }

      storeEncryptionKey(walletAddress, signature);
      clientRef.current = null;
      return true;
    } catch {
      return false;
    }
  };

  const handleFund = async () => {
    if (!walletSet || !canFund) return;

    pausePolling();
    const initialized = await ensureInitialized();
    if (!initialized) {
      resumePolling();
      toast.error('Failed to initialize');
      return;
    }

    setIsShielding(needsShielding);
    setProgress(0);
    abortRef.current = false;

    try {
      const client = await getClient();

      // Shield if needed
      if (needsShielding) {
        // Send protocol fee
        if (protocolFee > 0) {
          const connection = new Connection(getSolanaRpcUrl());
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          const feeTx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: new PublicKey(walletAddress),
              toPubkey: new PublicKey(PROTOCOL_TREASURY),
              lamports: Math.floor(protocolFee * LAMPORTS_PER_SOL),
            })
          );
          feeTx.recentBlockhash = blockhash;
          feeTx.feePayer = new PublicKey(walletAddress);

          const embedded = isEmbeddedWallet(solanaWallet);
          let signedFeeTx: Transaction;

          // For external wallets, try direct provider signing first
          if (!embedded) {
            const externalSigned = await tryExternalWalletSignLegacyTransaction(feeTx);
            if (externalSigned) {
              signedFeeTx = externalSigned;
            } else {
              // Fallback to Privy signing with UI
              const serializedFee = feeTx.serialize({ requireAllSignatures: false });
              const signedFeeResult = await signTransactionRef.current({
                transaction: serializedFee,
                wallet: solanaWallet,
                options: getSigningOptions(solanaWallet),
              });
              signedFeeTx = parseSignedLegacyTransaction(signedFeeResult);
            }
          } else {
            // Embedded wallet - sign silently via Privy
            const serializedFee = feeTx.serialize({ requireAllSignatures: false });
            const signedFeeResult = await signTransactionRef.current({
              transaction: serializedFee,
              wallet: solanaWallet,
              options: getSigningOptions(solanaWallet),
            });
            signedFeeTx = parseSignedLegacyTransaction(signedFeeResult);
          }

          const sig = await connection.sendRawTransaction(signedFeeTx.serialize());
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
        }

        await client.deposit(Math.floor(amountToShield * LAMPORTS_PER_SOL));
        const { sol, lamports } = await client.getBalance();
        setShieldedBalance(sol, lamports);
        await new Promise(r => setTimeout(r, 1000));
      }

      setIsShielding(false);
      setFundingStatus('distributing');

      // Create and process tasks
      // Privacy Cash SDK deducts fees FROM the withdrawal amount, so we need to
      // add fees to ensure recipient gets the full intended amount
      const perWalletFees = (amountNum * WITHDRAWAL_FEE_RATE) + WITHDRAWAL_RENT;
      const withdrawAmountPerWallet = amountNum + perWalletFees;

      const tasks = selectedWallets.map((index) => {
        const wallet = walletSet.wallets.find(w => w.index === index);
        return {
          id: `task-${index}`,
          walletIndex: index,
          walletAddress: wallet?.publicKey || '',
          amount: Math.floor(withdrawAmountPerWallet * LAMPORTS_PER_SOL), // Amount + fees so recipient gets full amount
          status: 'pending' as const,
        };
      });
      setFundingTasks(tasks);

      let completed = 0;
      for (const task of tasks) {
        if (abortRef.current) break;

        updateFundingTask(task.id, { status: 'processing' });

        try {
          const result = await client.withdraw(task.amount, task.walletAddress);
          updateFundingTask(task.id, { status: 'success', signature: result.signature });
          completed++;
          setProgress((completed / tasks.length) * 100);

          const { sol, lamports } = await client.getBalance();
          setShieldedBalance(sol, lamports);
        } catch (error: any) {
          updateFundingTask(task.id, { status: 'error', error: error.message });
        }

        await new Promise(r => setTimeout(r, 300));
      }

      setFundingStatus('complete');
      toast.success(`Funded ${completed} wallets!`);
      celebrate('fund', Math.min(10, 5 + completed));

    } catch (error: any) {
      toast.error(error.message || 'Failed');
      setFundingStatus('error');
    } finally {
      setIsShielding(false);
      resumePolling();
      refreshAllBalances();
    }
  };

  const resetFunding = () => {
    setFundingTasks([]);
    setFundingStatus('idle');
    setProgress(0);
    abortRef.current = false;
  };

  if (!authenticated || !walletSet) return null;

  const isProcessing = fundingStatus === 'distributing' || isShielding;
  const isComplete = fundingStatus === 'complete' || fundingStatus === 'error';
  const successCount = fundingTasks.filter(t => t.status === 'success').length;

  return (
    <div className="relative group">
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative bg-gradient-to-br from-boo-card/90 to-boo-bg/90 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <span className="text-sm">💸</span>
              </div>
              <span className="font-semibold text-white/90">Fund Wallets</span>
            </div>
            {walletCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                {walletCount} selected
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {!isProcessing && !isComplete && (
            <>
              {/* Amount input */}
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block">
                  SOL per wallet
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountPerWallet}
                    onChange={(e) => setAmountPerWallet(e.target.value)}
                    placeholder="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              </div>

              {/* Fee breakdown */}
              {walletCount > 0 && amountNum > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-white/5 space-y-2">
                  {/* Base amount */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40">Amount ({walletCount} × {amountNum})</span>
                    <span className="text-white/60">
                      {baseAmount.toFixed(4)} SOL
                      {toUsd(baseAmount) && <span className="text-white/30 ml-1">({toUsd(baseAmount)})</span>}
                    </span>
                  </div>

                  {/* Total fees with info tooltip */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 relative group/tooltip">
                      <span className="text-white/40">Total fees</span>
                      <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center cursor-help text-[10px] text-white/40 hover:bg-white/20 hover:text-white/60 transition-colors">
                        i
                      </div>
                      {/* Tooltip */}
                      <div className="absolute left-0 bottom-full mb-2 w-56 p-3 rounded-lg bg-boo-card border border-white/10 shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
                        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Fee Breakdown</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-white/50">Privacy Cash (0.35%)</span>
                            <span className="text-white/70">{withdrawalFeePercent.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Rent ({walletCount} × 0.006)</span>
                            <span className="text-white/70">{withdrawalRent.toFixed(4)}</span>
                          </div>
                          {needsShielding && protocolFee > 0 && (
                            <div className="flex justify-between">
                              <span className="text-white/50">Protocol (0.5% shield)</span>
                              <span className="text-white/70">{protocolFee.toFixed(4)}</span>
                            </div>
                          )}
                        </div>
                        {/* Arrow */}
                        <div className="absolute left-3 -bottom-1.5 w-3 h-3 bg-boo-card border-r border-b border-white/10 transform rotate-45" />
                      </div>
                    </div>
                    <span className="text-white/60">
                      {(totalWithdrawalFees + (needsShielding ? protocolFee : 0)).toFixed(4)} SOL
                      {toUsd(totalWithdrawalFees + (needsShielding ? protocolFee : 0)) && (
                        <span className="text-white/30 ml-1">({toUsd(totalWithdrawalFees + (needsShielding ? protocolFee : 0))})</span>
                      )}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-2 mt-2">
                    {/* From shielded balance */}
                    {shieldedBalance > 0 && (
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-white/40">From shielded</span>
                        <span className="text-red-400/80">
                          -{Math.min(shieldedBalance, totalWithFees).toFixed(4)} SOL
                          {toUsd(Math.min(shieldedBalance, totalWithFees)) && (
                            <span className="text-white/30 ml-1">({toUsd(Math.min(shieldedBalance, totalWithFees))})</span>
                          )}
                        </span>
                      </div>
                    )}

                    {/* Amount to shield */}
                    {needsShielding && (
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-white/40">Need to shield</span>
                        <span className="text-yellow-400/80">
                          {amountToShield.toFixed(4)} SOL
                          {toUsd(amountToShield) && <span className="text-white/30 ml-1">({toUsd(amountToShield)})</span>}
                        </span>
                      </div>
                    )}

                    {/* Total from public */}
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="text-white/60">Total from public</span>
                      <span className="text-white">
                        {needsShielding ? totalFromPublic.toFixed(4) : '0.0000'} SOL
                        {needsShielding && toUsd(totalFromPublic) && (
                          <span className="text-white/40 font-normal ml-1">({toUsd(totalFromPublic)})</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action button */}
              <button
                onClick={handleFund}
                disabled={!canFund}
                className={`w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 ${
                  !canFund
                    ? 'bg-white/10 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {needsShielding ? (
                  <>Shield & Fund {walletCount} Wallets</>
                ) : (
                  <>Fund {walletCount} Wallets</>
                )}
              </button>

              {!canFund && walletCount > 0 && amountNum > 0 && (
                <p className="text-[10px] text-red-400/60 text-center mt-2">
                  Insufficient balance
                </p>
              )}
            </>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="text-center py-6">
              {/* Animated progress ring */}
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 2.83} 283`}
                    className="transition-all duration-500"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
                </div>
              </div>

              <p className="text-white/60 text-sm">
                {isShielding ? 'Shielding funds...' : `Funding wallets...`}
              </p>
              <p className="text-white/30 text-xs mt-1">
                {isShielding ? 'Generating ZK proof' : `${successCount}/${walletCount} complete`}
              </p>
            </div>
          )}

          {/* Complete state */}
          {isComplete && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <span className="text-3xl">{fundingStatus === 'complete' ? '✓' : '!'}</span>
              </div>
              <p className="text-white font-semibold mb-1">
                {fundingStatus === 'complete' ? 'Complete!' : 'Finished with errors'}
              </p>
              <p className="text-white/40 text-sm mb-4">
                {successCount}/{walletCount} wallets funded
              </p>
              <button
                onClick={resetFunding}
                className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
              >
                Fund More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
