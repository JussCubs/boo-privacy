/**
 * Wallet signing utilities for Privy integration
 * Handles both embedded (email) wallets and external wallets (Phantom, Backpack, etc.)
 */

import { VersionedTransaction, Transaction } from '@solana/web3.js';

/**
 * Detect if the connected wallet is a Privy embedded wallet (email login)
 * vs an external wallet (Phantom, Backpack, Solflare, etc.)
 */
export function isEmbeddedWallet(wallet: any): boolean {
  if (!wallet) return false;

  // Check various Privy embedded wallet indicators
  const walletClientType = wallet.walletClientType || wallet.walletClient?.type || '';
  const connectorType = wallet.connectorType || wallet.connector?.type || '';
  const walletType = wallet.type || '';

  // Privy embedded wallets have walletClientType === 'privy'
  if (walletClientType === 'privy') return true;

  // Or connectorType === 'embedded'
  if (connectorType === 'embedded') return true;

  // Check if it's NOT an external wallet
  // External wallets have specific types
  const externalTypes = ['phantom', 'backpack', 'solflare', 'glow', 'slope', 'sollet', 'coinbase_wallet', 'wallet_connect'];
  const isExternal = externalTypes.some(t =>
    walletClientType?.toLowerCase().includes(t) ||
    connectorType?.toLowerCase().includes(t) ||
    walletType?.toLowerCase().includes(t)
  );

  if (isExternal) return false;

  // If wallet address exists and no external indicators, assume embedded
  return !!wallet.address;
}

/**
 * Get the UI options for Privy signing based on wallet type
 * - Embedded wallets: sign silently (no popups)
 * - External wallets: show wallet UI for user confirmation
 */
export function getSigningOptions(wallet: any): { uiOptions: { showWalletUIs: boolean } } {
  const embedded = isEmbeddedWallet(wallet);
  return {
    uiOptions: {
      showWalletUIs: !embedded, // Show UI only for external wallets
    },
  };
}

/**
 * Try to sign with an external wallet provider directly (Phantom, Backpack, etc.)
 * Returns the signed transaction if successful, null otherwise
 */
export async function tryExternalWalletSign(
  tx: VersionedTransaction
): Promise<VersionedTransaction | null> {
  if (typeof window === 'undefined') return null;

  const walletProviders = [
    { name: 'Phantom', provider: (window as any).phantom?.solana, check: (p: any) => p?.isPhantom },
    { name: 'Backpack', provider: (window as any).backpack, check: (p: any) => p?.isBackpack },
    { name: 'Solflare', provider: (window as any).solflare, check: (p: any) => p?.isSolflare },
    { name: 'Glow', provider: (window as any).glow, check: (p: any) => p?.isGlow },
    { name: 'Solana', provider: (window as any).solana, check: () => true },
  ];

  for (const { provider, check } of walletProviders) {
    if (provider && check(provider) && typeof provider.signTransaction === 'function') {
      try {
        // Ensure connected
        if (!provider.isConnected && typeof provider.connect === 'function') {
          await provider.connect();
        }

        const signedTx = await provider.signTransaction(tx);

        // Verify signature is not empty
        if (signedTx && signedTx.signatures?.[0] &&
            !signedTx.signatures[0].every((b: number) => b === 0)) {
          return signedTx;
        }
      } catch (error) {
        // Try next provider
        console.log(`[WalletSigning] ${provider} failed, trying next`);
      }
    }
  }

  return null;
}

/**
 * Parse the result from Privy's signTransaction into a VersionedTransaction
 */
export function parseSignedTransaction(signedResult: any): VersionedTransaction {
  // Already a VersionedTransaction
  if (signedResult && typeof signedResult.serialize === 'function') {
    return signedResult as VersionedTransaction;
  }

  // Raw Uint8Array
  if (signedResult instanceof Uint8Array) {
    return VersionedTransaction.deserialize(signedResult);
  }

  // Privy wrapper object
  if (signedResult && (signedResult as any).signedTransaction) {
    const signed = (signedResult as any).signedTransaction;
    if (typeof signed === 'string') {
      return VersionedTransaction.deserialize(Buffer.from(signed, 'base64'));
    } else if (signed instanceof Uint8Array) {
      return VersionedTransaction.deserialize(signed);
    } else if (typeof signed.serialize === 'function') {
      return signed as VersionedTransaction;
    }
  }

  throw new Error('Failed to parse signed transaction');
}

/**
 * Parse the result from Privy's signTransaction for legacy Transaction
 */
export function parseSignedLegacyTransaction(signedResult: any): Transaction {
  if (signedResult instanceof Uint8Array) {
    return Transaction.from(signedResult);
  }

  if (signedResult && (signedResult as any).signedTransaction) {
    const signed = (signedResult as any).signedTransaction;
    if (typeof signed === 'string') {
      return Transaction.from(Buffer.from(signed, 'base64'));
    } else if (signed instanceof Uint8Array) {
      return Transaction.from(signed);
    }
  }

  throw new Error('Failed to parse signed legacy transaction');
}
