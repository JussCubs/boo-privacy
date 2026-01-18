/**
 * Wallet signing utilities for Privy integration
 * Handles both embedded (email) wallets and external wallets (Phantom, Backpack, etc.)
 */

import { VersionedTransaction, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Find the wallet that matches the connected external provider (Phantom, etc.)
 * This is needed because Privy creates an embedded wallet for all users,
 * but we want to use the external wallet when one is connected.
 *
 * @param wallets Array of wallets from useSolanaWallets()
 * @returns The wallet that matches the connected external provider, or wallets[0]
 */
export function findExternalWallet(wallets: any[]): any | null {
  if (!wallets || wallets.length === 0) return null;

  // Get connected external provider address
  const provider = getConnectedExternalProvider();
  const externalAddress = provider?.publicKey?.toString();

  if (externalAddress) {
    console.log('[WalletSigning] Looking for wallet matching external address:', externalAddress?.slice(0, 8) + '...');

    // Find wallet that matches external provider address
    const matchingWallet = wallets.find(w => w.address === externalAddress);
    if (matchingWallet) {
      console.log('[WalletSigning] Found matching wallet in Privy wallets array');
      return matchingWallet;
    }

    // If no matching wallet in Privy array, we need to use external signing directly
    // Return the first wallet but mark it so we know to use external signing
    console.log('[WalletSigning] No matching wallet in Privy array - will use external signing');
  }

  return wallets[0];
}

/**
 * Get the address to use for transactions
 * Prioritizes the connected external wallet address over Privy embedded wallet
 */
export function getActiveWalletAddress(wallets: any[], user: any): string {
  // Check for connected external provider first
  const provider = getConnectedExternalProvider();
  const externalAddress = provider?.publicKey?.toString();

  if (externalAddress && provider?.isConnected) {
    console.log('[WalletSigning] Using connected external wallet address:', externalAddress?.slice(0, 8) + '...');
    return externalAddress;
  }

  // Fall back to Privy wallet
  const privyAddress = user?.wallet?.address || wallets[0]?.address || '';
  console.log('[WalletSigning] Using Privy wallet address:', privyAddress?.slice(0, 8) + '...');
  return privyAddress;
}

/**
 * List of known external wallet types
 */
const EXTERNAL_WALLET_TYPES = [
  'phantom',
  'backpack',
  'solflare',
  'glow',
  'slope',
  'sollet',
  'coinbase_wallet',
  'wallet_connect',
  'trust',
  'exodus',
  'brave',
  'coin98',
  'math_wallet',
];

/**
 * Get the connected external wallet provider from window object
 * First checks for connected providers, then falls back to available providers
 */
export function getConnectedExternalProvider(): any | null {
  if (typeof window === 'undefined') return null;

  const walletProviders = [
    { name: 'Phantom', provider: (window as any).phantom?.solana, isType: (p: any) => p?.isPhantom },
    { name: 'Backpack', provider: (window as any).backpack, isType: (p: any) => p?.isBackpack },
    { name: 'Solflare', provider: (window as any).solflare, isType: (p: any) => p?.isSolflare },
    { name: 'Glow', provider: (window as any).glow, isType: (p: any) => p?.isGlow },
    { name: 'Solana', provider: (window as any).solana, isType: () => true },
  ];

  // First, try to find a connected provider
  for (const { name, provider, isType } of walletProviders) {
    if (provider && isType(provider) && provider.isConnected) {
      console.log(`[WalletSigning] Found connected provider: ${name}`);
      return provider;
    }
  }

  // If no connected provider, return the first available one that has signTransaction
  // This allows us to call connect() on it later
  for (const { name, provider, isType } of walletProviders) {
    if (provider && isType(provider) && typeof provider.signTransaction === 'function') {
      console.log(`[WalletSigning] Found available (not connected) provider: ${name}`);
      return provider;
    }
  }

  console.log('[WalletSigning] No external provider found');
  return null;
}

/**
 * Detect if the connected wallet is a Privy embedded wallet (email login)
 * vs an external wallet (Phantom, Backpack, Solflare, etc.)
 */
export function isEmbeddedWallet(wallet: any): boolean {
  if (!wallet) return false;

  // Check various Privy embedded wallet indicators
  const walletClientType = (wallet.walletClientType || wallet.walletClient?.type || '').toLowerCase();
  const connectorType = (wallet.connectorType || wallet.connector?.type || '').toLowerCase();
  const walletType = (wallet.type || '').toLowerCase();
  const meta = wallet.meta || {};
  const metaName = (meta.name || '').toLowerCase();

  // Debug logging - include all available wallet properties
  console.log('[WalletSigning] Checking wallet type:', {
    walletClientType,
    connectorType,
    walletType,
    metaName,
    address: wallet.address?.slice(0, 8) + '...',
    // Additional debug info
    rawWalletClientType: wallet.walletClientType,
    rawConnectorType: wallet.connectorType,
    imported: wallet.imported,
    delegated: wallet.delegated,
    walletKeys: Object.keys(wallet || {}),
  });

  // IMPORTANT: Check if an external wallet provider is connected FIRST
  // This must come before the walletClientType === 'privy' check because
  // when Privy creates a separate embedded wallet while an external wallet (like Phantom)
  // is connected, we need to use external signing even though the Privy wallet
  // has walletClientType === 'privy'
  const externalProvider = getConnectedExternalProvider();
  if (externalProvider && externalProvider.isConnected) {
    const providerAddress = externalProvider.publicKey?.toString();
    console.log('[WalletSigning] Found connected external provider:', {
      providerAddress: providerAddress?.slice(0, 8) + '...',
      walletAddress: wallet.address?.slice(0, 8) + '...',
      addressesMatch: providerAddress === wallet.address,
    });

    // If external provider is connected, use external signing
    // The addresses might not match if Privy created a separate embedded wallet
    // but we should still use the external wallet for signing
    console.log('[WalletSigning] External provider connected - treating as external wallet');
    return false;
  }

  // Privy embedded wallets have walletClientType === 'privy'
  if (walletClientType === 'privy') {
    console.log('[WalletSigning] Detected embedded wallet (privy)');
    return true;
  }

  // Or connectorType === 'embedded'
  if (connectorType === 'embedded') {
    console.log('[WalletSigning] Detected embedded wallet (embedded connector)');
    return true;
  }

  // Check if it's an external wallet based on type indicators
  const allTypeIndicators = [walletClientType, connectorType, walletType, metaName].filter(Boolean);
  const isExternal = EXTERNAL_WALLET_TYPES.some(t =>
    allTypeIndicators.some(indicator => indicator.includes(t))
  );

  if (isExternal) {
    console.log('[WalletSigning] Detected external wallet from type indicators');
    return false;
  }

  // Default: if wallet has address but no external indicators, assume embedded
  // This case applies when user logged in via email (no external wallet connected)
  console.log('[WalletSigning] Defaulting to embedded wallet (no external provider connected)');
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
  // Use the unified connected provider detection
  const provider = getConnectedExternalProvider();
  if (!provider || typeof provider.signTransaction !== 'function') {
    console.log('[WalletSigning] No connected external provider found for VersionedTransaction signing');
    return null;
  }

  try {
    console.log('[WalletSigning] Signing VersionedTransaction with external wallet...');

    // Ensure connected (should already be, but just in case)
    if (!provider.isConnected && typeof provider.connect === 'function') {
      await provider.connect();
    }

    const signedTx = await provider.signTransaction(tx);

    // Verify signature is not empty
    if (signedTx && signedTx.signatures?.[0]) {
      const sig = signedTx.signatures[0];
      const isEmpty = sig.every((b: number) => b === 0);
      if (!isEmpty) {
        console.log('[WalletSigning] VersionedTransaction signed successfully');
        return signedTx;
      } else {
        console.log('[WalletSigning] VersionedTransaction signature is empty');
      }
    } else {
      console.log('[WalletSigning] VersionedTransaction has no signatures');
    }
  } catch (error) {
    console.log('[WalletSigning] External wallet signTransaction (versioned) failed:', error);
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

/**
 * Try to sign a message with an external wallet provider directly (Phantom, Backpack, etc.)
 * Returns the signature as base58 string if successful, null otherwise
 */
export async function tryExternalWalletSignMessage(
  message: Uint8Array
): Promise<string | null> {
  const provider = getConnectedExternalProvider();
  if (!provider || typeof provider.signMessage !== 'function') {
    return null;
  }

  try {
    // Ensure connected
    if (!provider.isConnected && typeof provider.connect === 'function') {
      await provider.connect();
    }

    const result = await provider.signMessage(message, 'utf8');

    // Handle different return formats
    let signatureBytes: Uint8Array;
    if (result.signature) {
      signatureBytes = result.signature;
    } else if (result instanceof Uint8Array) {
      signatureBytes = result;
    } else {
      return null;
    }

    // Return as base58 string
    return bs58.encode(signatureBytes);
  } catch (error) {
    console.log('[WalletSigning] External wallet signMessage failed:', error);
    return null;
  }
}

/**
 * Try to sign a legacy Transaction with an external wallet provider
 * Returns the signed Transaction if successful, null otherwise
 */
export async function tryExternalWalletSignLegacyTransaction(
  tx: Transaction
): Promise<Transaction | null> {
  const provider = getConnectedExternalProvider();
  if (!provider || typeof provider.signTransaction !== 'function') {
    console.log('[WalletSigning] No connected external provider found for legacy Transaction signing');
    return null;
  }

  try {
    console.log('[WalletSigning] Signing legacy Transaction with external wallet...');

    // Ensure connected
    if (!provider.isConnected && typeof provider.connect === 'function') {
      await provider.connect();
    }

    const signedTx = await provider.signTransaction(tx);

    // Verify signature exists and is not empty
    // Legacy Transaction has signatures as array of { publicKey, signature } objects
    if (signedTx && signedTx.signatures?.length > 0) {
      const firstSig = signedTx.signatures[0];
      // Check both old format (signature property) and new format (direct buffer)
      const sigBuffer = firstSig.signature || firstSig;
      if (sigBuffer && sigBuffer.length > 0 && !Array.from(sigBuffer).every((b: number) => b === 0)) {
        console.log('[WalletSigning] Legacy Transaction signed successfully');
        return signedTx;
      } else {
        console.log('[WalletSigning] Legacy Transaction signature is empty');
      }
    } else {
      console.log('[WalletSigning] Legacy Transaction has no signatures');
    }

    return null;
  } catch (error) {
    console.log('[WalletSigning] External wallet signTransaction (legacy) failed:', error);
    return null;
  }
}
