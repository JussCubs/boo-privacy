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
  updateCachedWalletArchivedIndices,
} from '@/lib/wallet-persistence';
import { useSolPrice } from '@/lib/use-sol-price';
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

  const { toUsd } = useSolPrice();

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
  const [showGroups, setShowGroups] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isWalletsCollapsed, setIsWalletsCollapsed] = useState(false);
  const [addWalletsCount, setAddWalletsCount] = useState('10');
  const [archivedWallets, setArchivedWallets] = useState<number[]>([]);

  useEffect(() => {
    const cached = getAllCachedWallets();
    setCachedWallets(cached);
    // Auto-load the first cached wallet group on mount
    if (cached.length > 0 && !walletSet) {
      const firstCached = cached[0];
      const data = loadWalletFromCache(firstCached.cacheKey);
      if (data) {
        const restored = restoreWalletSet(data.seedPhrase, data.walletCount);
        if (restored) {
          setWalletSet(restored);
          setCurrentCacheKey(firstCached.cacheKey);
          setGroupName(data.label || '');
          const archivedIndices = data.archivedIndices || [];
          setArchivedWallets(archivedIndices);
          // Select only non-archived wallets
          const nonArchivedIndices = restored.wallets
            .filter(w => !archivedIndices.includes(w.index))
            .map(w => w.index);
          setSelectedWallets(nonArchivedIndices);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (walletSet?.seedPhrase) {
      const cacheKey = saveWalletToCache(walletSet.seedPhrase, walletSet.wallets.length, groupName || undefined, archivedWallets);
      setCurrentCacheKey(cacheKey);
      // Refresh cached wallets list after saving
      setCachedWallets(getAllCachedWallets());
    }
  }, [walletSet?.seedPhrase, walletSet?.wallets.length, groupName, archivedWallets]);

  const handleGenerate = () => {
    const count = parseInt(walletCount) || 10;
    const newWalletSet = createWalletSet(Math.min(count, 100));
    setWalletSet(newWalletSet);
    selectAllWallets();
    setArchivedWallets([]);
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
      setArchivedWallets([]);
      setShowImport(false);
      setImportPhrase('');
      // useEffect will handle saving to cache and refreshing the list
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
        setCurrentCacheKey(cacheKey);
        setGroupName(data.label || '');
        const archivedIndices = data.archivedIndices || [];
        setArchivedWallets(archivedIndices);
        // Select only non-archived wallets
        const nonArchivedIndices = restored.wallets
          .filter(w => !archivedIndices.includes(w.index))
          .map(w => w.index);
        setSelectedWallets(nonArchivedIndices);
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
      if (cacheKey === currentCacheKey) {
        setWalletSet(null);
        deselectAllWallets();
        setGroupName('');
        setCurrentCacheKey(null);
      }
      toast.success('Wallet group deleted');
    }
    setDeleteConfirm(null);
  };

  const handleCopySeed = async () => {
    if (walletSet?.seedPhrase) {
      await navigator.clipboard.writeText(walletSet.seedPhrase);
      toast.success('Seed phrase copied - store it safely!');
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

  const handleArchiveWallet = (index: number) => {
    if (archivedWallets.includes(index)) {
      // Unarchive
      setArchivedWallets(archivedWallets.filter(i => i !== index));
      toast.success('Wallet restored');
    } else {
      // Archive
      setArchivedWallets([...archivedWallets, index]);
      // Also deselect the wallet
      setSelectedWallets(selectedWallets.filter(i => i !== index));
      toast.success('Wallet archived');
    }
  };

  const handleAddMoreWallets = () => {
    if (!walletSet) return;
    const currentCount = walletSet.wallets.length;
    const maxAllowed = 100 - currentCount;
    if (maxAllowed <= 0) {
      toast.error('Max 100 wallets per group');
      return;
    }
    const additionalCount = Math.min(parseInt(addWalletsCount) || 1, maxAllowed);
    const newTotal = currentCount + additionalCount;
    const restored = restoreWalletSet(walletSet.seedPhrase, newTotal);
    if (restored) {
      setWalletSet(restored);
      // Select the new wallets
      const newIndices = restored.wallets.slice(currentCount).map(w => w.index);
      setSelectedWallets([...selectedWallets, ...newIndices]);
      toast.success(`Added ${additionalCount} wallet${additionalCount > 1 ? 's' : ''}`);
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

      const failedWallets: string[] = [];

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
        } catch (error) {
          console.error(`[Consolidate] Failed for wallet #${wallet.index}:`, error);
          failedWallets.push(`#${wallet.index}`);
        }
        await new Promise(r => setTimeout(r, 200));
      }

      if (failedWallets.length > 0) {
        toast.error(`Failed to consolidate wallets: ${failedWallets.join(', ')}`, { id: toastId });
      } else {
        toast.success(`Consolidated ${totalConsolidated.toFixed(4)} SOL`, { id: toastId });
      }
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

  // Total balance for all non-archived wallets in current group
  const totalGroupBalance = walletSet?.wallets
    .filter(w => !archivedWallets.includes(w.index))
    .reduce((sum, w) => sum + (balances[w.publicKey] || 0), 0) || 0;

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
                          <span className="text-white/30">{cached.walletCount - cached.archivedCount} wallets</span>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-boo-card border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Delete Wallet Group?</h3>
              <p className="text-sm text-white/50">This will remove the group from your saved wallets. Make sure you have backed up your seed phrase.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-white/70 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCached(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative bg-gradient-to-br from-boo-card/90 to-boo-bg/90 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        {/* All Groups Quick Switch */}
        {cachedWallets.length > 1 && (
          <div className="border-b border-white/5">
            <button
              onClick={() => setShowGroups(!showGroups)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                {cachedWallets.length} Wallet Groups
              </span>
              <svg
                className={`w-3.5 h-3.5 text-white/40 transition-transform ${showGroups ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showGroups && (
              <div className="px-3 pb-2 space-y-1 max-h-[140px] overflow-y-auto">
                {cachedWallets.map((cached) => {
                  const isActive = cached.cacheKey === currentCacheKey;
                  return (
                    <div key={cached.cacheKey} className="relative">
                      {editingLabel === cached.cacheKey ? (
                        <div className="flex gap-2 p-2 rounded-lg bg-white/5">
                          <input
                            type="text"
                            value={editLabelValue}
                            onChange={(e) => setEditLabelValue(e.target.value)}
                            placeholder="Group name..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateLabel(cached.cacheKey);
                              if (e.key === 'Escape') setEditingLabel(null);
                            }}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                          />
                          <button
                            onClick={() => handleUpdateLabel(cached.cacheKey)}
                            className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                            isActive
                              ? 'bg-purple-500/20 border border-purple-500/30'
                              : 'bg-white/5 hover:bg-white/10 border border-transparent'
                          }`}
                        >
                          <button
                            onClick={() => !isActive && handleRestoreFromCache(cached.cacheKey)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${isActive ? 'text-purple-300' : 'text-white/70'}`}>
                                {cached.label || 'Unnamed Group'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/30">{cached.walletCount - cached.archivedCount} wallets</span>
                                {isActive && totalGroupBalance > 0 && (
                                  <span className="text-xs font-semibold text-green-400">
                                    {totalGroupBalance.toFixed(4)}
                                    {toUsd(totalGroupBalance) && <span className="text-white/40 ml-1">({toUsd(totalGroupBalance)})</span>}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLabel(cached.cacheKey);
                              setEditLabelValue(cached.label || '');
                            }}
                            className="p-1 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/10 transition-all"
                            title="Rename"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(cached.cacheKey);
                            }}
                            className="p-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    setWalletSet(null);
                    deselectAllWallets();
                    setGroupName('');
                    setCurrentCacheKey(null);
                    setShowGroups(false);
                    setArchivedWallets([]);
                  }}
                  className="w-full py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Group
                </button>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-sm">👻</span>
              </div>
              <div className="flex-1">
                {editingLabel === currentCacheKey ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editLabelValue}
                      onChange={(e) => setEditLabelValue(e.target.value)}
                      placeholder="Group name..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && currentCacheKey) handleUpdateLabel(currentCacheKey);
                        if (e.key === 'Escape') setEditingLabel(null);
                      }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                    />
                    <button
                      onClick={() => currentCacheKey && handleUpdateLabel(currentCacheKey)}
                      className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs hover:bg-green-500/30 transition-colors"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-white">{groupName || 'Wallet Group'}</h3>
                    <button
                      onClick={() => {
                        if (currentCacheKey) {
                          setEditingLabel(currentCacheKey);
                          setEditLabelValue(groupName || '');
                        }
                      }}
                      className="p-0.5 rounded text-white/30 hover:text-white/80 transition-colors"
                      title="Rename group"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <span className="text-[10px] text-white/30">
                      ({walletSet.wallets.length - archivedWallets.length}{archivedWallets.length > 0 ? `/${walletSet.wallets.length}` : ''} wallets)
                    </span>
                    {totalGroupBalance > 0 && (
                      <span className="text-[10px] font-semibold text-green-400">
                        {totalGroupBalance.toFixed(4)} SOL
                        {toUsd(totalGroupBalance) && <span className="text-white/40 ml-1">({toUsd(totalGroupBalance)})</span>}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsWalletsCollapsed(!isWalletsCollapsed)}
                className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                title={isWalletsCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${isWalletsCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={selectAllWallets}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
              >
                All
              </button>
              <button
                onClick={deselectAllWallets}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
              >
                None
              </button>
            </div>
          </div>
        </div>

        {/* Wallet list */}
        {!isWalletsCollapsed && (
          <div className="px-3 py-2">
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {walletSet.wallets
                .filter(wallet => !archivedWallets.includes(wallet.index))
                .map((wallet) => {
                const isSelected = selectedWallets.includes(wallet.index);
                const balance = balances[wallet.publicKey] || 0;

                return (
                  <div
                    key={wallet.index}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 ${
                      isSelected
                        ? 'bg-purple-500/20 border border-purple-500/30'
                        : 'bg-white/5 border border-transparent hover:border-white/10'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleWallet(wallet.index)}
                      className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-transparent hover:bg-white/20'
                      }`}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>

                    {/* Index */}
                    <div className="w-6 text-[10px] font-mono text-white/30">#{wallet.index}</div>

                    {/* Address */}
                    <button
                      onClick={() => handleCopyAddress(wallet.publicKey)}
                      className="flex-1 text-left group/addr"
                    >
                      <span className="text-xs font-mono text-white/60 group-hover/addr:text-white/90 transition-colors">
                        {copiedAddress === wallet.publicKey ? (
                          <span className="text-green-400">Copied!</span>
                        ) : (
                          formatAddress(wallet.publicKey, 8)
                        )}
                      </span>
                    </button>

                    {/* Balance */}
                    <div className="text-right">
                      {balance > 0 ? (
                        <div>
                          <span className="text-xs font-bold text-green-400">{balance.toFixed(4)}</span>
                          {toUsd(balance) && <span className="text-[10px] text-white/40 ml-1">({toUsd(balance)})</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-white/20">0.0000</span>
                      )}
                    </div>

                    {/* Copy key button */}
                    <button
                      onClick={() => handleCopyKey(wallet.index)}
                      className="p-1 rounded-lg bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                      title="Copy private key"
                    >
                      {copiedIndex === wallet.index ? (
                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      )}
                    </button>

                    {/* Archive button */}
                    <button
                      onClick={() => handleArchiveWallet(wallet.index)}
                      className="p-1 rounded-lg bg-white/5 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Archive wallet"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Selection info */}
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-white/40">{selectedWallets.length} selected</span>
                {archivedWallets.length > 0 && (
                  <span className="text-white/30">({archivedWallets.length} archived)</span>
                )}
              </div>
              {selectedBalance > 0 && (
                <span className="text-green-400 font-semibold">
                  {selectedBalance.toFixed(4)} SOL
                  {toUsd(selectedBalance) && <span className="text-white/40 ml-1">({toUsd(selectedBalance)})</span>}
                </span>
              )}
            </div>

            {/* Archived wallets section */}
            {archivedWallets.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/5">
                <div className="text-[10px] text-white/30 mb-1">Archived ({archivedWallets.length})</div>
                <div className="flex flex-wrap gap-1">
                  {archivedWallets.map((index) => (
                    <button
                      key={index}
                      onClick={() => handleArchiveWallet(index)}
                      className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/40 hover:text-white/80 hover:bg-white/10 transition-all flex items-center gap-1"
                      title="Restore wallet"
                    >
                      #{index}
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsed state summary */}
        {isWalletsCollapsed && (
          <div className="px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-white/40">
                  {selectedWallets.length} of {walletSet.wallets.length - archivedWallets.length} selected
                </span>
                {archivedWallets.length > 0 && (
                  <span className="text-white/30 text-[10px]">({archivedWallets.length} archived)</span>
                )}
              </div>
              {totalGroupBalance > 0 && (
                <span className="text-green-400 font-semibold">
                  {totalGroupBalance.toFixed(4)} SOL
                  {toUsd(totalGroupBalance) && <span className="text-white/40 ml-1">({toUsd(totalGroupBalance)})</span>}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-3 py-2 border-t border-white/5 space-y-2">
          {/* Consolidate button */}
          {selectedBalance > 0 && mainWalletAddress && (
            <button
              onClick={handleConsolidate}
              disabled={isConsolidating}
              className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-all disabled:opacity-50"
            >
              {isConsolidating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Consolidating...
                </span>
              ) : (
                <>Consolidate {selectedBalance.toFixed(4)} SOL</>
              )}
            </button>
          )}

          {/* Add more wallets */}
          {walletSet.wallets.length < 100 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">Add</span>
              <input
                type="number"
                value={addWalletsCount}
                onChange={(e) => setAddWalletsCount(e.target.value)}
                min="1"
                max={100 - walletSet.wallets.length}
                className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-white/20"
              />
              <button
                onClick={handleAddMoreWallets}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white/70 bg-white/5 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Wallets
              </button>
              <span className="text-[10px] text-white/30">({100 - walletSet.wallets.length} left)</span>
            </div>
          )}

          {/* Seed Phrase Backup - Compact single row */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <span className="text-sm">🔐</span>
            <span className="text-[10px] uppercase tracking-wider text-yellow-400/80 font-medium">Backup</span>
            <div className="flex-1" />
            <button
              onClick={handleCopySeed}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-black bg-yellow-400 hover:bg-yellow-300 transition-all flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Seed
            </button>
            <button
              onClick={() => setShowSeedPhrase(!showSeedPhrase)}
              className="px-2 py-1 rounded-lg text-[10px] font-medium text-yellow-400 bg-yellow-500/20 hover:bg-yellow-500/30 transition-all"
            >
              {showSeedPhrase ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Seed phrase display */}
          {showSeedPhrase && (
            <div className="p-2 rounded-lg bg-black/30 border border-yellow-500/20">
              <div className="text-[10px] font-mono text-yellow-400/80 break-all leading-relaxed select-all">
                {walletSet.seedPhrase}
              </div>
            </div>
          )}

          {/* New group button - only show if there's only one group */}
          {cachedWallets.length <= 1 && (
            <button
              onClick={() => {
                setWalletSet(null);
                deselectAllWallets();
                setGroupName('');
                setCurrentCacheKey(null);
                setArchivedWallets([]);
              }}
              className="w-full py-1.5 rounded-lg text-[10px] text-white/30 hover:text-white/60 bg-transparent hover:bg-white/5 transition-all"
            >
              + New Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
