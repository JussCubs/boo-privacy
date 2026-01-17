'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useBalances } from '@/lib/balance-context';
import { TOKEN_SYMBOLS, TokenSymbol, formatTokenAmount, formatUsdValue } from '@/lib/tokens';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';
import SwapModal from './SwapModal';
import ExportKeyModal from './ExportKeyModal';

export default function WalletPanel() {
  const { user } = usePrivy();
  const {
    walletAddress,
    tokenBalances,
    totalUsdValue,
    prices,
    loadingBalances,
    refreshBalances,
  } = useBalances();

  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>('SOL');

  // Check if user is email-authenticated (embedded wallet)
  const isEmbeddedWallet = user?.email?.address && !user?.wallet?.walletClientType;

  const handleSend = (token: TokenSymbol) => {
    setSelectedToken(token);
    setShowSendModal(true);
  };

  const handleReceive = () => {
    setShowReceiveModal(true);
  };

  const handleSwap = () => {
    setShowSwapModal(true);
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Wallet</h2>
        <button
          onClick={() => refreshBalances()}
          disabled={loadingBalances}
          className="text-xs text-boo-dim hover:text-white transition-colors"
        >
          {loadingBalances ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Total Value */}
      <div className="mb-4 pb-4 border-b border-boo-border">
        <div className="text-2xl font-bold text-white">
          {formatUsdValue(totalUsdValue)}
        </div>
        <div className="text-xs text-boo-dim">Total Balance</div>
      </div>

      {/* Token List */}
      <div className="space-y-2 mb-4">
        {TOKEN_SYMBOLS.map(symbol => {
          const balance = tokenBalances[symbol];
          const price = prices[symbol];
          const hasBalance = balance.ui > 0;

          return (
            <div
              key={symbol}
              className={`flex items-center justify-between p-2 rounded-lg ${
                hasBalance ? 'bg-boo-bg' : 'opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-boo-secondary flex items-center justify-center text-sm font-bold">
                  {symbol === 'SOL' ? '◎' : symbol.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-white">{symbol}</div>
                  {symbol !== 'USDC' && (
                    <div className="text-xs text-boo-dim">
                      ${price.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-white">
                  {formatTokenAmount(balance.ui, symbol)}
                </div>
                <div className="text-xs text-boo-dim">
                  {formatUsdValue(balance.usdValue)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleSend('SOL')}
          className="btn-secondary py-2 text-sm"
        >
          Send
        </button>
        <button
          onClick={handleReceive}
          className="btn-secondary py-2 text-sm"
        >
          Receive
        </button>
        <button
          onClick={handleSwap}
          className="btn-secondary py-2 text-sm"
        >
          Swap
        </button>
      </div>

      {/* Export Key Button (for embedded wallets only) */}
      {isEmbeddedWallet && (
        <button
          onClick={() => setShowExportModal(true)}
          className="mt-3 w-full text-xs text-boo-dim hover:text-white transition-colors py-2 border border-dashed border-boo-border rounded-lg"
        >
          Export Private Key (Backup)
        </button>
      )}

      {/* Modals */}
      {showSendModal && (
        <SendModal
          defaultToken={selectedToken}
          onClose={() => setShowSendModal(false)}
        />
      )}
      {showReceiveModal && (
        <ReceiveModal
          address={walletAddress}
          onClose={() => setShowReceiveModal(false)}
        />
      )}
      {showSwapModal && (
        <SwapModal
          onClose={() => setShowSwapModal(false)}
        />
      )}
      {showExportModal && (
        <ExportKeyModal
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
