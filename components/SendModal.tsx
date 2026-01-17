'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import toast from 'react-hot-toast';
import { useBalances } from '@/lib/balance-context';
import { TOKEN_SYMBOLS, TokenSymbol, TOKENS, formatTokenAmount, toRawAmount } from '@/lib/tokens';
import { getSolanaRpcUrl } from '@/lib/rpc-config';

interface SendModalProps {
  defaultToken: TokenSymbol;
  onClose: () => void;
}

export default function SendModal({ defaultToken, onClose }: SendModalProps) {
  const { user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { tokenBalances, refreshBalances } = useBalances();

  const [selectedToken, setSelectedToken] = useState<TokenSymbol>(defaultToken);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);

  const balance = tokenBalances[selectedToken];
  const token = TOKENS[selectedToken];

  const isValidAddress = recipient.length >= 32 && recipient.length <= 44;
  const parsedAmount = parseFloat(amount) || 0;
  const hasEnoughBalance = parsedAmount > 0 && parsedAmount <= balance.ui;
  const canSend = isValidAddress && hasEnoughBalance && !isSending;

  const handleMaxAmount = () => {
    // For SOL, leave some for fees
    if (selectedToken === 'SOL') {
      const maxSol = Math.max(0, balance.ui - 0.01);
      setAmount(maxSol.toString());
    } else {
      setAmount(balance.ui.toString());
    }
  };

  const handleSend = async () => {
    if (!canSend) return;

    const wallet = solanaWallets[0];
    if (!wallet) {
      toast.error('No wallet connected');
      return;
    }

    setIsSending(true);
    const loadingToast = toast.loading(`Sending ${amount} ${selectedToken}...`);

    try {
      const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
      const fromPubkey = new PublicKey(wallet.address);
      const toPubkey = new PublicKey(recipient);

      let transaction: Transaction;

      if (selectedToken === 'SOL') {
        // Native SOL transfer
        const lamports = Math.floor(parsedAmount * LAMPORTS_PER_SOL);
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          })
        );
      } else {
        // SPL Token transfer
        const mintPubkey = new PublicKey(token.mint);
        const rawAmount = toRawAmount(parsedAmount, token.decimals);

        // Get token accounts
        const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
        const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);

        transaction = new Transaction();

        // Check if recipient has token account, create if not
        const toAtaInfo = await connection.getAccountInfo(toAta);
        if (!toAtaInfo) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey,
              toAta,
              toPubkey,
              mintPubkey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            fromAta,
            toAta,
            fromPubkey,
            rawAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Sign and send
      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      toast.dismiss(loadingToast);
      toast.success(`Sent ${amount} ${selectedToken}!`);

      // Refresh balances
      await refreshBalances();
      onClose();
    } catch (error: any) {
      console.error('Send failed:', error);
      toast.dismiss(loadingToast);
      toast.error(error?.message || 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-boo-card border border-boo-border rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-boo-border">
          <h3 className="text-lg font-semibold text-white">Send</h3>
          <button
            onClick={onClose}
            className="text-boo-dim hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Token Selection */}
          <div>
            <label className="block text-sm text-boo-dim mb-2">Token</label>
            <div className="grid grid-cols-4 gap-2">
              {TOKEN_SYMBOLS.map(symbol => (
                <button
                  key={symbol}
                  onClick={() => setSelectedToken(symbol)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedToken === symbol
                      ? 'bg-boo-primary text-white'
                      : 'bg-boo-secondary text-boo-dim hover:text-white'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-sm text-boo-dim mb-2">Recipient</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              placeholder="Wallet address..."
              className="input w-full"
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-boo-dim">Amount</label>
              <button
                onClick={handleMaxAmount}
                className="text-xs text-boo-primary hover:underline"
              >
                Max: {formatTokenAmount(balance.ui, selectedToken)}
              </button>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="input w-full"
            />
          </div>

          {/* Error Messages */}
          {recipient && !isValidAddress && (
            <p className="text-sm text-boo-primary">Invalid wallet address</p>
          )}
          {parsedAmount > balance.ui && (
            <p className="text-sm text-boo-primary">Insufficient balance</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-boo-border">
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="btn-primary w-full"
          >
            {isSending ? 'Sending...' : `Send ${selectedToken}`}
          </button>
        </div>
      </div>
    </div>
  );
}
