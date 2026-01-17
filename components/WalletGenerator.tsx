'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { useBooStore } from '@/lib/store';
import { createWalletSet, restoreWalletSet, formatAddress, exportPrivateKey } from '@/lib/hd-wallet';
import { useBalances } from '@/lib/balance-context';
import { getSolanaRpcUrl } from '@/lib/rpc-config';
import {
  saveWalletToCache,
  loadWalletFromCache,
  getAllCachedWallets,
  deleteWalletFromCache,
  updateCachedWalletLabel,
} from '@/lib/wallet-persistence';
import toast from 'react-hot-toast';

export default function WalletGenerator() {
  const { user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();

  const {
    walletSet,
    setWalletSet,
    selectedWallets,
    setSelectedWallets,
    toggleWallet,
    selectAllWallets,
    deselectAllWallets,
    showSeedPhrase,
    setShowSeedPhrase,
  } = useBooStore();

  const {
    walletBalances: balances,
    refreshAllBalances,
    totalWalletBalance,
  } = useBalances();

  const mainWalletAddress = user?.wallet?.address || solanaWallets[0]?.address || '';

  const [walletCount, setWalletCount] = useState('10');
  const [groupName, setGroupName] = useState('');
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [cachedWallets, setCachedWallets] = useState<ReturnType<typeof getAllCachedWallets>>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [currentCacheKey, setCurrentCacheKey] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importPhrase, setImportPhrase] = useState('');

  useEffect(() => {
    setCachedWallets(getAllCachedWallets());
  }, []);

  useEffect(() => {
    if (walletSet?.seedPhrase) {
      const cacheKey = saveWalletToCache(walletSet.seedPhrase, walletSet.wallets.length, groupName || undefined);
      setCurrentCacheKey(cacheKey);
    }
  }, [walletSet?.seedPhrase, walletSet?.wallets.length, groupName]);

  const handleGenerate = () => {
    const count = parseInt(walletCount) || 10;
    const newWalletSet = createWalletSet(Math.min(count, 100));
    setWalletSet(newWalletSet);
    selectAllWallets();
    setCachedWallets(getAllCachedWallets());
    toast.success(`Generated ${newWalletSet.wallets.length} wallets`);
  };

  const handleImport = () => {
    const words = importPhrase.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      toast.error('Seed phrase must be 12 or 24 words');
      return;
    }
    const count = parseInt(walletCount) || 10;
    const restored = restoreWalletSet(importPhrase.trim(), Math.min(count, 100));
    if (restored) {
      setWalletSet(restored);
      selectAllWallets();
      setShowImport(false);
      setImportPhrase('');
      setCachedWallets(getAllCachedWallets());
      toast.success('Wallets imported');
    } else {
      toast.error('Invalid seed phrase');
    }
  };

  const handleRestoreFromCache = (cacheKey: string) => {
    const data = loadWalletFromCache(cacheKey);
    if (data) {
      const restored = restoreWalletSet(data.seedPhrase, data.walletCount);
      if (restored) {
        setWalletSet(restored);
        selectAllWallets();
        setCurrentCacheKey(cacheKey);
        setGroupName(data.label || '');
        toast.success('Wallets restored');
      }
    }
  };

  const handleUpdateLabel = (cacheKey: string) => {
    if (updateCachedWalletLabel(cacheKey, editLabelValue)) {
      setCachedWallets(getAllCachedWallets());
      if (cacheKey === currentCacheKey) {
        setGroupName(editLabelValue);
      }
      toast.success('Name updated');
    }
    setEditingLabel(null);
    setEditLabelValue('');
  };

  const handleDeleteCached = (cacheKey: string) => {
    if (deleteWalletFromCache(cacheKey)) {
      setCachedWallets(getAllCachedWallets());
      toast.success('Deleted from cache');
    }
  };

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleCopyKey = async (index: number) => {
    const wallet = walletSet?.wallets.find(w => w.index === index);
    if (wallet) {
      await navigator.clipboard.writeText(exportPrivateKey(wallet.keypair));
      setCopiedIndex(index);
      toast.success('Private key copied');
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleAddMoreWallets = () => {
    if (!walletSet) return;
    const additionalCount = parseInt(walletCount) || 10;
    const newTotal = Math.min(walletSet.wallets.length + additionalCount, 100);
    const restored = restoreWalletSet(walletSet.seedPhrase, newTotal);
    if (restored) {
      setWalletSet(restored);
      // Select the new wallets
      const newIndices = restored.wallets.slice(walletSet.wallets.length).map(w => w.index);
      setSelectedWallets([...selectedWallets, ...newIndices]);
      toast.success(`Added ${newTotal - walletSet.wallets.length} wallets`);
    }
  };

  const handleConsolidate = async () => {
    if (!walletSet || !mainWalletAddress) return;

    const walletsToConsolidate = selectedWallets
      .map(index => {
        const wallet = walletSet.wallets.find(w => w.index === index);
        return wallet ? { wallet, balance: balances[wallet.publicKey] || 0 } : null;
      })
      .filter((w): w is NonNullable<typeof w> => w !== null && w.balance > 0);

    if (walletsToConsolidate.length === 0) {
      toast.error('No balance to consolidate');
      return;
    }

    setIsConsolidating(true);
    const toastId = toast.loading('Consolidating...');

    try {
      const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
      const destinationPubkey = new PublicKey(mainWalletAddress);
      let totalConsolidated = 0;

      for (const { wallet } of walletsToConsolidate) {
        try {
          const lamportBalance = await connection.getBalance(wallet.keypair.publicKey);
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

          const testTx = new Transaction({ feePayer: wallet.keypair.publicKey, blockhash, lastValidBlockHeight })
            .add(SystemProgram.transfer({ fromPubkey: wallet.keypair.publicKey, toPubkey: destinationPubkey, lamports: 1 }));

          const feeResponse = await connection.getFeeForMessage(testTx.compileMessage(), 'confirmed');
          const amountToSend = lamportBalance - (feeResponse.value || 5000);

          if (amountToSend > 0) {
            const tx = new Transaction({ feePayer: wallet.keypair.publicKey, blockhash, lastValidBlockHeight })
              .add(SystemProgram.transfer({ fromPubkey: wallet.keypair.publicKey, toPubkey: destinationPubkey, lamports: amountToSend }));

            await sendAndConfirmTransaction(connection, tx, [wallet.keypair], { commitment: 'confirmed' });
            totalConsolidated += amountToSend / LAMPORTS_PER_SOL;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }

      toast.success(`Consolidated ${totalConsolidated.toFixed(4)} SOL`, { id: toastId });
      await refreshAllBalances();
    } catch (error: any) {
      toast.error(error.message || 'Failed', { id: toastId });
    } finally {
      setIsConsolidating(false);
    }
  };

  const selectedBalance = selectedWallets.reduce((sum, index) => {
    const wallet = walletSet?.wallets.find(w => w.index === index);
    return wallet ? sum + (balances[wallet.publicKey] || 0) : sum;
  }, 0);

  // Empty state - generate wallets
  if (!walletSet) {
    return (
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative bg-gradient-to-br from-boo-card/90 to-boo-bg/90 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <span className="text-3xl">👻</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Wallet Groups</h2>
            <p className="text-white/40 text-sm">Create or restore wallet groups for private funding</p>
          </div>

          {/* Cached wallet groups */}
          {cachedWallets.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-3">Saved Groups</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {cachedWallets.map((cached) => (
                  <div key={cached.cacheKey} className="relative">
                    {editingLabel === cached.cacheKey ? (
                      <div className="flex gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                        <input
                          type="text"
                          value={editLabelValue}
                          onChange={(e) => setEditLabelValue(e.target.value)}
                          placeholder="Group name..."
                          autoFocus
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                        />
                        <button
                          onClick={() => handleUpdateLabel(cached.cacheKey)}
                          className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLabel(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-sm hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRestoreFromCache(cached.cacheKey)}
                        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-left transition-all group/item"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-white">
                            {cached.label || 'Unnamed Group'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLabel(cached.cacheKey);
                                setEditLabelValue(cached.label || '');
                              }}
                              className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 opacity-0 group-hover/item:opacity-100 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCached(cached.cacheKey);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/item:opacity-100 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-mono text-white/40">{cached.preview}</span>
                          <span className="text-white/30">{cached.walletCount} wallets</span>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import section */}
          {showImport ? (
            <div className="space-y-3 mb-4">
              <label className="text-[10px] uppercase tracking-wider text-white/40 block">
                Import Seed Phrase
              </label>
              <textarea
                value={importPhrase}
                onChange={(e) => setImportPhrase(e.target.value)}
                placeholder="Enter 12 or 24 word seed phrase..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 shadow-lg shadow-green-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Import
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportPhrase(''); }}
                  className="px-4 py-3 rounded-xl text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Group name */}
              <div className="mb-3">
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block">
                  Group Name (optional)
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Trading Bots, Airdrop Farm..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                />
              </div>

              {/* Wallet count */}
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-2 block">
                  Number of wallets
                </label>
                <input
                  type="number"
                  value={walletCount}
                  onChange={(e) => setWalletCount(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white text-center focus:outline-none focus:border-white/20"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  className="flex-1 py-4 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                >
                  Generate New
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="px-4 py-4 rounded-xl text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Import
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Wallet list view
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative bg-gradient-to-br from-boo-card/90 to-boo-bg/90 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-lg">👻</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">{groupName || 'Wallet Group'}</h3>
                <p className="text-xs text-white/40">{walletSet.wallets.length} wallets</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllWallets}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                All
              </button>
              <button
                onClick={deselectAllWallets}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                None
              </button>
            </div>
          </div>

          {/* Total balance */}
          {totalWalletBalance > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <span className="text-sm text-white/60">Total Balance</span>
              <span className="text-lg font-bold text-green-400">{totalWalletBalance.toFixed(4)} SOL</span>
            </div>
          )}
        </div>

        {/* Wallet list */}
        <div className="p-4">
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {walletSet.wallets.map((wallet) => {
              const isSelected = selectedWallets.includes(wallet.index);
              const balance = balances[wallet.publicKey] || 0;

              return (
                <div
                  key={wallet.index}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/30'
                      : 'bg-white/5 border border-transparent hover:border-white/10'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleWallet(wallet.index)}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-transparent hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>

                  {/* Index */}
                  <div className="w-8 text-xs font-mono text-white/30">#{wallet.index}</div>

                  {/* Address */}
                  <button
                    onClick={() => handleCopyAddress(wallet.publicKey)}
                    className="flex-1 text-left group/addr"
                  >
                    <span className="text-sm font-mono text-white/60 group-hover/addr:text-white/90 transition-colors">
                      {copiedAddress === wallet.publicKey ? (
                        <span className="text-green-400">Copied!</span>
                      ) : (
                        formatAddress(wallet.publicKey, 8)
                      )}
                    </span>
                  </button>

                  {/* Balance */}
                  <div className="w-24 text-right">
                    {balance > 0 ? (
                      <span className="text-sm font-bold text-green-400">{balance.toFixed(4)}</span>
                    ) : (
                      <span className="text-sm text-white/20">0.0000</span>
                    )}
                  </div>

                  {/* Copy key button */}
                  <button
                    onClick={() => handleCopyKey(wallet.index)}
                    className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                    title="Copy private key"
                  >
                    {copiedIndex === wallet.index ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Selection info */}
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-white/40">{selectedWallets.length} selected</span>
            {selectedBalance > 0 && (
              <span className="text-green-400 font-semibold">{selectedBalance.toFixed(4)} SOL</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-white/5 space-y-3">
          {/* Consolidate button */}
          {selectedBalance > 0 && mainWalletAddress && (
            <button
              onClick={handleConsolidate}
              disabled={isConsolidating}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isConsolidating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Consolidating...
                </span>
              ) : (
                <>Consolidate {selectedBalance.toFixed(4)} SOL to Main</>
              )}
            </button>
          )}

          {/* Add more & Seed phrase row */}
          <div className="flex gap-2">
            <button
              onClick={handleAddMoreWallets}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add {walletCount} More
            </button>
            <button
              onClick={() => setShowSeedPhrase(!showSeedPhrase)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {showSeedPhrase ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                )}
              </svg>
              {showSeedPhrase ? 'Hide' : 'Show'} Seed
            </button>
          </div>

          {/* Seed phrase display */}
          {showSeedPhrase && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-yellow-400/60">Seed Phrase - Keep Secret!</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(walletSet.seedPhrase);
                    toast.success('Seed phrase copied');
                  }}
                  className="text-[10px] text-yellow-400/60 hover:text-yellow-400 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="text-sm font-mono text-yellow-400/80 break-all leading-relaxed">
                {walletSet.seedPhrase}
              </div>
            </div>
          )}

          {/* New group button */}
          <button
            onClick={() => {
              setWalletSet(null);
              deselectAllWallets();
              setGroupName('');
              setCurrentCacheKey(null);
            }}
            className="w-full py-2 rounded-xl text-sm text-white/30 hover:text-white/60 bg-transparent hover:bg-white/5 transition-all"
          >
            Switch to Different Group
          </button>
        </div>
      </div>
    </div>
  );
}
