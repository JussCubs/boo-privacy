/**
 * HD Wallet Generator
 *
 * Generates deterministic Solana wallets from a BIP39 seed phrase.
 * All operations happen client-side - seed phrases never leave the browser.
 */

import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

export interface DerivedWallet {
  index: number;
  publicKey: string;
  keypair: Keypair;
}

export interface WalletSet {
  seedPhrase: string;
  wallets: DerivedWallet[];
}

/**
 * Generate a new random BIP39 mnemonic (seed phrase)
 */
export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(256); // 24 words for maximum security
}

/**
 * Validate a BIP39 mnemonic
 */
export function validateSeedPhrase(seedPhrase: string): boolean {
  return bip39.validateMnemonic(seedPhrase.trim().toLowerCase());
}

/**
 * Derive a single Solana keypair from a seed phrase at a given index
 * Uses the standard Solana derivation path: m/44'/501'/index'/0'
 */
export function deriveKeypair(seedPhrase: string, index: number): Keypair {
  const seed = bip39.mnemonicToSeedSync(seedPhrase.trim().toLowerCase());
  const path = `m/44'/501'/${index}'/0'`;
  const derivedSeed = derivePath(path, seed.toString('hex')).key;
  return Keypair.fromSeed(derivedSeed);
}

/**
 * Derive multiple wallets from a seed phrase
 */
export function deriveWallets(seedPhrase: string, count: number, startIndex: number = 0): DerivedWallet[] {
  const wallets: DerivedWallet[] = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const keypair = deriveKeypair(seedPhrase, index);
    wallets.push({
      index,
      publicKey: keypair.publicKey.toBase58(),
      keypair,
    });
  }

  return wallets;
}

/**
 * Export a wallet's private key as base58
 */
export function exportPrivateKey(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

/**
 * Create a new wallet set with generated seed phrase
 */
export function createWalletSet(walletCount: number = 10): WalletSet {
  const seedPhrase = generateSeedPhrase();
  const wallets = deriveWallets(seedPhrase, walletCount);

  return {
    seedPhrase,
    wallets,
  };
}

/**
 * Restore wallets from an existing seed phrase
 */
export function restoreWalletSet(seedPhrase: string, walletCount: number = 10): WalletSet | null {
  if (!validateSeedPhrase(seedPhrase)) {
    return null;
  }

  const wallets = deriveWallets(seedPhrase, walletCount);

  return {
    seedPhrase: seedPhrase.trim().toLowerCase(),
    wallets,
  };
}

/**
 * Format public key for display (truncated)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
