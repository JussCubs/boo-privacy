'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignTransaction, useSignMessage } from '@privy-io/react-auth/solana';
import {
  Connection,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import bs58 from 'bs58';

// Protocol fee configuration
const PROTOCOL_FEE_RATE = 0.005; // 0.5%
const PROTOCOL_TREASURY = 'BatAUJL6iFaBPiExBPxKH7XBGDVo4Bih6vUE7cGfHNEq';

import { useBooStore } from '@/lib/store';
import {
  PRIVACY_CASH_SIGN_MESSAGE,
  isInitialized as isPrivacyCashInitialized,
  storeEncryptionKey,
  getStoredEncryptionKey,
  PrivacyCashClient,
} from '@/lib/privacy-cash-client';
import { getSolanaRpcUrl } from '@/lib/rpc-config';
import { useBalances } from '@/lib/balance-context';
import { useCelebration } from '@/lib/celebration-context';
import {
  isEmbeddedWallet,
  getSigningOptions,
  tryExternalWalletSign,
  parseSignedTransaction,
  parseSignedLegacyTransaction,
} from '@/lib/wallet-signing';
import { useSolPrice } from '@/lib/use-sol-price';
import toast from 'react-hot-toast';

export default function ShieldPanel() {
  const { user, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signTransaction } = useSignTransaction();
  const { signMessage } = useSignMessage();

  const {
    publicBalance,
    shieldedBalance,
    loadingPublic,
    loadingShielded,
    refreshAllBalances,
    pausePolling,
    resumePolling,
  } = useBalances();

  const { setShieldedBalance } = useBooStore();
  const { celebrate } = useCelebration();
  const { toUsd } = useSolPrice();

  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [initializing, setInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'shield' | 'unshield'>('shield');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadingBalance = loadingPublic || loadingShielded;

  const walletAddress = user?.wallet?.address || solanaWallets[0]?.address || '';
  const solanaWallet = solanaWallets[0];

  const clientRef = useRef<PrivacyCashClient | null>(null);
  const walletAddressRef = useRef(walletAddress);
  const signTransactionRef = useRef(signTransaction);
  const signMessageRef = useRef(signMessage);
  const solanaWalletRef = useRef(solanaWallet);

  useEffect(() => {
    signTransactionRef.current = signTransaction;
    signMessageRef.current = signMessage;
    solanaWalletRef.current = solanaWallet;
    walletAddressRef.current = walletAddress;
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (mounted && walletAddress) {
      setIsInitialized(isPrivacyCashInitialized(walletAddress));
    }
  }, [mounted, walletAddress]);

  // Calculate fee
  const amountNum = parseFloat(amount) || 0;

  // Privacy Cash withdrawal fees (for unshield)
  const WITHDRAWAL_FEE_RATE = 0.0035; // 0.35%
  const WITHDRAWAL_RENT = 0.006; // 0.006 SOL rent

  // Shield mode: protocol fee on deposit
  // Unshield mode: withdrawal fees from shielded balance
  const protocolFee = mode === 'shield' ? amountNum * PROTOCOL_FEE_RATE : 0;
  const withdrawalFees = mode === 'unshield' ? (amountNum * WITHDRAWAL_FEE_RATE) + WITHDRAWAL_RENT : 0;

  const totalCost = mode === 'shield'
    ? amountNum + protocolFee // Shield: amount + 0.5% protocol fee from public
    : amountNum + withdrawalFees; // Unshield: amount + fees from shielded balance

  const availableBalance = mode === 'shield' ? publicBalance : shieldedBalance;
  const canExecute = amountNum > 0 && totalCost <= availableBalance;

  // Create transaction signer
  const createTransactionSigner = useCallback(() => {
    return async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      const wallet = solanaWalletRef.current;
      if (!wallet) throw new Error('No wallet connected');

      const embedded = isEmbeddedWallet(wallet);

      // For external wallets, try direct provider signing first
      if (!embedded) {
        const externalSigned = await tryExternalWalletSign(tx);
        if (externalSigned) return externalSigned;
      }

      // Use Privy signing (silent for embedded, with UI for external)
      const signedResult = await signTransactionRef.current({
        transaction: tx.serialize(),
        wallet,
        options: getSigningOptions(wallet),
      });

      return parseSignedTransaction(signedResult);
    };
  }, []);

  const getClientAsync = useCallback(async (): Promise<PrivacyCashClient> => {
    if (clientRef.current) return clientRef.current;

    const encryptionKey = getStoredEncryptionKey(walletAddressRef.current);
    if (!encryptionKey) throw new Error('Shield not initialized');

    const client = new PrivacyCashClient({
      rpcUrl: getSolanaRpcUrl(),
      walletAddress: walletAddressRef.current,
      encryptionKey,
      transactionSigner: createTransactionSigner(),
    });

    clientRef.current = client;
    return client;
  }, [createTransactionSigner]);

  const initializePrivacyCash = async () => {
    const wallet = solanaWalletRef.current;
    if (!wallet) {
      toast.error('No wallet connected');
      return false;
    }

    setInitializing(true);
    try {
      const messageBytes = new TextEncoder().encode(PRIVACY_CASH_SIGN_MESSAGE);
      const { signature } = await signMessageRef.current({
        message: messageBytes,
        wallet: wallet,
        options: getSigningOptions(wallet),
      });

      storeEncryptionKey(walletAddressRef.current, signature);
      clientRef.current = null;
      setIsInitialized(true);
      refreshAllBalances();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize');
      return false;
    } finally {
      setInitializing(false);
    }
  };

  const handleAction = async () => {
    if (!canExecute) return;

    if (!isInitialized) {
      const success = await initializePrivacyCash();
      if (!success) return;
    }

    pausePolling();
    setProcessing(true);

    try {
      const wallet = solanaWalletRef.current;
      if (!wallet) throw new Error('No wallet connected');

      if (mode === 'shield') {
        // Send protocol fee
        if (protocolFee > 0) {
          setProcessingStatus('Sending fee...');
          const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          const feeTx = new Transaction({
            feePayer: new PublicKey(walletAddressRef.current),
            blockhash,
            lastValidBlockHeight,
          }).add(
            SystemProgram.transfer({
              fromPubkey: new PublicKey(walletAddressRef.current),
              toPubkey: new PublicKey(PROTOCOL_TREASURY),
              lamports: Math.floor(protocolFee * LAMPORTS_PER_SOL),
            })
          );

          const serializedFee = feeTx.serialize({ requireAllSignatures: false });
          const signedFeeResult = await signTransactionRef.current({
            transaction: serializedFee,
            wallet: wallet,
            options: getSigningOptions(wallet),
          });

          const signedFeeTx = parseSignedLegacyTransaction(signedFeeResult);
          const feeSignature = await connection.sendRawTransaction(signedFeeTx.serialize());
          await connection.confirmTransaction({ signature: feeSignature, blockhash, lastValidBlockHeight }, 'confirmed');
        }

        setProcessingStatus('Generating ZK proof...');
        const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
        const client = await getClientAsync();
        await client.deposit(lamports);

        toast.success(`Shielded ${amount} SOL!`);
        celebrate('shield', 8);
      } else {
        setProcessingStatus('Generating ZK proof...');
        // Add withdrawal fees so recipient receives the full intended amount
        // (Privacy Cash SDK deducts fees from the withdrawal amount)
        const lamports = Math.floor((amountNum + withdrawalFees) * LAMPORTS_PER_SOL);
        const client = await getClientAsync();
        await client.withdraw(lamports, walletAddressRef.current);

        toast.success(`Unshielded ${amount} SOL!`);
        celebrate('unshield', 6);
      }

      setAmount('');
    } catch (error: any) {
      toast.error(error.message || 'Transaction failed');
    } finally {
      setProcessing(false);
      setProcessingStatus('');
      resumePolling();
      refreshAllBalances();
    }
  };

  if (!authenticated) return null;

  const isDisabled = processing || initializing || !canExecute;

  return (
    <div className="relative group">
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative bg-gradient-to-br from-boo-card/90 to-boo-bg/90 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        {/* Header with balance */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <span className="text-sm">🛡️</span>
              </div>
              <span className="font-semibold text-white/90">Shield</span>
            </div>
            <button
              onClick={() => refreshAllBalances()}
              disabled={loadingBalance}
              className="text-white/40 hover:text-white/80 transition-colors text-xs"
            >
              {loadingBalance ? '...' : '↻'}
            </button>
          </div>

          {/* Balance display */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('shield')}
              className={`flex-1 p-3 rounded-xl transition-all duration-300 ${
                mode === 'shield'
                  ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30'
                  : 'bg-white/5 border border-transparent hover:border-white/10'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Public</div>
              <div className={`text-lg font-bold tabular-nums ${mode === 'shield' ? 'text-yellow-400' : 'text-white/60'}`}>
                {publicBalance.toFixed(4)}
              </div>
              {publicBalance > 0 && toUsd(publicBalance) && (
                <div className="text-[10px] text-white/30 mt-0.5">{toUsd(publicBalance)}</div>
              )}
            </button>
            <button
              onClick={() => setMode('unshield')}
              className={`flex-1 p-3 rounded-xl transition-all duration-300 ${
                mode === 'unshield'
                  ? 'bg-gradient-to-br from-red-500/20 to-pink-500/10 border border-red-500/30'
                  : 'bg-white/5 border border-transparent hover:border-white/10'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Shielded</div>
              <div className={`text-lg font-bold tabular-nums ${mode === 'unshield' ? 'text-red-400' : 'text-white/60'}`}>
                {shieldedBalance.toFixed(4)}
              </div>
              {shieldedBalance > 0 && toUsd(shieldedBalance) && (
                <div className="text-[10px] text-white/30 mt-0.5">{toUsd(shieldedBalance)}</div>
              )}
            </button>
          </div>
        </div>

        {/* Action area */}
        <div className="p-4">
          {/* Amount input */}
          <div className="relative mb-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={processing}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
            />
            <button
              onClick={() => {
                // Calculate max amount that satisfies totalCost <= availableBalance
                // Shield: totalCost = amount * 1.005, so amount = balance / 1.005
                // Unshield: totalCost = amount * 1.0035 + 0.006, so amount = (balance - 0.006) / 1.0035
                const maxAmount = mode === 'shield'
                  ? availableBalance / (1 + PROTOCOL_FEE_RATE)
                  : (availableBalance - WITHDRAWAL_RENT) / (1 + WITHDRAWAL_FEE_RATE);
                setAmount(Math.max(0, maxAmount).toFixed(6));
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors px-2 py-1 rounded bg-white/5"
            >
              Max
            </button>
          </div>

          {/* Fee info (subtle) */}
          {mode === 'shield' && amountNum > 0 && (
            <div className="flex justify-between text-[11px] text-white/30 mb-3 px-1">
              <span>+ 0.5% fee</span>
              <span>{protocolFee.toFixed(6)} SOL</span>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleAction}
            disabled={isDisabled}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-300 relative overflow-hidden ${
              isDisabled
                ? 'bg-white/10 cursor-not-allowed'
                : mode === 'shield'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {processingStatus || 'Processing...'}
              </span>
            ) : initializing ? (
              'Initializing...'
            ) : (
              mode === 'shield' ? `Shield ${amountNum > 0 ? amount : ''} SOL` : `Unshield ${amountNum > 0 ? amount : ''} SOL`
            )}
          </button>

          {processing && (
            <p className="text-[10px] text-white/30 text-center mt-2">
              ZK proof generation takes 30-60 seconds
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
