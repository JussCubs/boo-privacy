'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { useBalances } from '@/lib/balance-context';
import { TOKEN_SYMBOLS, TokenSymbol, TOKENS, formatTokenAmount, formatUsdValue } from '@/lib/tokens';
import { getSolanaRpcUrl } from '@/lib/rpc-config';

interface SwapModalProps {
  onClose: () => void;
}

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// Boo Privacy fee: 0.75% (75 basis points)
const PLATFORM_FEE_BPS = 75;

// Jupiter referral fee account (set up at https://referral.jup.ag)
// Without this, swaps work but fees won't be collected
const JUP_FEE_ACCOUNT = process.env.NEXT_PUBLIC_JUP_FEE_ACCOUNT || '';
const HAS_FEE_ACCOUNT = !!JUP_FEE_ACCOUNT;

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

export default function SwapModal({ onClose }: SwapModalProps) {
  const { wallets: solanaWallets } = useSolanaWallets();
  const { tokenBalances, refreshBalances } = useBalances();

  const [fromToken, setFromToken] = useState<TokenSymbol>('SOL');
  const [toToken, setToToken] = useState<TokenSymbol>('USDC');
  const [inputAmount, setInputAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromBalance = tokenBalances[fromToken];
  const toBalance = tokenBalances[toToken];
  const fromTokenConfig = TOKENS[fromToken];
  const toTokenConfig = TOKENS[toToken];

  const parsedAmount = parseFloat(inputAmount) || 0;
  const hasEnoughBalance = parsedAmount > 0 && parsedAmount <= fromBalance.ui;

  // Calculate output amount from quote
  const outputAmount = quote
    ? parseFloat(quote.outAmount) / Math.pow(10, toTokenConfig.decimals)
    : 0;

  // Calculate fee amount (0.75% of input)
  const feeAmount = parsedAmount * (PLATFORM_FEE_BPS / 10000);
  const feeUsd = feeAmount * (tokenBalances[fromToken].usdValue / (fromBalance.ui || 1));

  // Fetch quote from Jupiter
  const fetchQuote = useCallback(async () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    setError(null);

    try {
      const inputMint = fromTokenConfig.mint;
      const outputMint = toTokenConfig.mint;
      const amount = Math.floor(parsedAmount * Math.pow(10, fromTokenConfig.decimals));

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: '50', // 0.5% slippage
      });

      // Only add platformFeeBps if we have a fee account configured
      if (HAS_FEE_ACCOUNT) {
        params.append('platformFeeBps', PLATFORM_FEE_BPS.toString());
      }

      const response = await fetch(`${JUPITER_QUOTE_API}?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get quote');
      }

      const data: QuoteResponse = await response.json();
      setQuote(data);
    } catch (err: any) {
      console.error('Quote error:', err);
      setError(err.message || 'Failed to get quote');
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [parsedAmount, fromTokenConfig, toTokenConfig]);

  // Debounce quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (parsedAmount > 0 && hasEnoughBalance) {
        fetchQuote();
      } else {
        setQuote(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [parsedAmount, hasEnoughBalance, fetchQuote]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setInputAmount('');
    setQuote(null);
  };

  const handleMaxAmount = () => {
    // For SOL, leave some for fees
    if (fromToken === 'SOL') {
      const maxSol = Math.max(0, fromBalance.ui - 0.01);
      setInputAmount(maxSol.toString());
    } else {
      setInputAmount(fromBalance.ui.toString());
    }
  };

  const handleSwap = async () => {
    if (!quote || !hasEnoughBalance) return;

    const wallet = solanaWallets[0];
    if (!wallet) {
      toast.error('No wallet connected');
      return;
    }

    setIsSwapping(true);
    const loadingToast = toast.loading('Swapping...');

    try {
      // Build swap request body
      const swapRequestBody: Record<string, any> = {
        quoteResponse: quote,
        userPublicKey: wallet.address,
        wrapAndUnwrapSol: true,
      };

      // Add fee account if configured (required to collect referral fees)
      if (HAS_FEE_ACCOUNT) {
        swapRequestBody.feeAccount = JUP_FEE_ACCOUNT;
      }

      // Get swap transaction from Jupiter
      const swapResponse = await fetch(JUPITER_SWAP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapRequestBody),
      });

      if (!swapResponse.ok) {
        const errorData = await swapResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();

      // Deserialize transaction
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign and send
      const signedTx = await wallet.signTransaction(transaction);
      const connection = new Connection(getSolanaRpcUrl(), 'confirmed');

      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      toast.dismiss(loadingToast);
      toast.success(`Swapped ${formatTokenAmount(parsedAmount, fromToken)} ${fromToken} for ${formatTokenAmount(outputAmount, toToken)} ${toToken}!`);

      // Refresh balances
      await refreshBalances();
      onClose();
    } catch (err: any) {
      console.error('Swap error:', err);
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const canSwap = quote && hasEnoughBalance && !isSwapping && !isLoadingQuote;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-boo-card border border-boo-border rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-boo-border">
          <h3 className="text-lg font-semibold text-white">Swap</h3>
          <button
            onClick={onClose}
            className="text-boo-dim hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* From Token */}
          <div className="bg-boo-bg rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-boo-dim">From</label>
              <button
                onClick={handleMaxAmount}
                className="text-xs text-boo-primary hover:underline"
              >
                Max: {formatTokenAmount(fromBalance.ui, fromToken)}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={fromToken}
                onChange={(e) => {
                  setFromToken(e.target.value as TokenSymbol);
                  setQuote(null);
                }}
                className="bg-boo-secondary text-white rounded-lg px-3 py-2 outline-none"
              >
                {TOKEN_SYMBOLS.filter(s => s !== toToken).map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
                className="flex-1 bg-transparent text-right text-xl text-white outline-none"
              />
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleSwapTokens}
              className="w-10 h-10 rounded-full bg-boo-secondary border-4 border-boo-card flex items-center justify-center text-boo-dim hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Token */}
          <div className="bg-boo-bg rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-boo-dim">To</label>
              <span className="text-xs text-boo-dim">
                Balance: {formatTokenAmount(toBalance.ui, toToken)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={toToken}
                onChange={(e) => {
                  setToToken(e.target.value as TokenSymbol);
                  setQuote(null);
                }}
                className="bg-boo-secondary text-white rounded-lg px-3 py-2 outline-none"
              >
                {TOKEN_SYMBOLS.filter(s => s !== fromToken).map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
              <div className="flex-1 text-right text-xl text-white">
                {isLoadingQuote ? (
                  <span className="text-boo-dim">Loading...</span>
                ) : outputAmount > 0 ? (
                  formatTokenAmount(outputAmount, toToken)
                ) : (
                  <span className="text-boo-dim">0.00</span>
                )}
              </div>
            </div>
          </div>

          {/* Fee Info */}
          {parsedAmount > 0 && (
            <div className="bg-boo-bg/50 rounded-lg p-3 text-sm">
              {HAS_FEE_ACCOUNT && (
                <div className="flex justify-between text-boo-dim">
                  <span>Platform Fee (0.75%)</span>
                  <span>
                    {formatTokenAmount(feeAmount, fromToken)} {fromToken} (~{formatUsdValue(feeUsd)})
                  </span>
                </div>
              )}
              {quote && (
                <div className="flex justify-between text-boo-dim mt-1">
                  <span>Price Impact</span>
                  <span className={parseFloat(quote.priceImpactPct) > 1 ? 'text-yellow-500' : ''}>
                    {parseFloat(quote.priceImpactPct).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-boo-primary">{error}</p>
          )}
          {parsedAmount > fromBalance.ui && (
            <p className="text-sm text-boo-primary">Insufficient balance</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-boo-border">
          <button
            onClick={handleSwap}
            disabled={!canSwap}
            className="btn-primary w-full"
          >
            {isSwapping ? 'Swapping...' : isLoadingQuote ? 'Getting Quote...' : 'Swap'}
          </button>
        </div>
      </div>
    </div>
  );
}
