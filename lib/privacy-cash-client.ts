/**
 * Privacy Cash Client for Privy Integration
 *
 * Wraps the Privacy Cash SDK for use with Privy embedded wallets.
 */

import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { keccak256 } from '@ethersproject/keccak256';

// Dynamic imports for SDK (avoid SSR issues)
type DepositFn = typeof import('privacycash/utils').deposit;
type WithdrawFn = typeof import('privacycash/utils').withdraw;
type GetUtxosFn = typeof import('privacycash/utils').getUtxos;
type GetBalanceFromUtxosFn = typeof import('privacycash/utils').getBalanceFromUtxos;
type EncryptionServiceClass = typeof import('privacycash/utils').EncryptionService;

export interface SupportedToken {
  name: string;
  symbol: string;
  mint: string;
  decimals: number;
  unitsPerToken: number;
  icon: string;
}

export const SUPPORTED_TOKENS: SupportedToken[] = [
  {
    name: 'SOL',
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    unitsPerToken: 1_000_000_000,
    icon: '◎',
  },
  {
    name: 'USDC',
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    unitsPerToken: 1_000_000,
    icon: '$',
  },
];

export function isNativeSOL(token: SupportedToken): boolean {
  return token.symbol === 'SOL';
}

// Constants
export const PRIVACY_CASH_SIGN_MESSAGE = 'Privacy Money account sign in';
export const RELAYER_API_URL = 'https://api3.privacycash.org';

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// Transaction signer type
export type TransactionSigner = (tx: VersionedTransaction) => Promise<VersionedTransaction>;

// Signature storage
const SIGNATURE_STORAGE_KEY = 'boo_privacy_sig_';

export function storeSignature(walletAddress: string, signature: Uint8Array): void {
  if (!isBrowser) return;
  try {
    const sigHex = Buffer.from(signature).toString('hex');
    localStorage.setItem(SIGNATURE_STORAGE_KEY + walletAddress, sigHex);
  } catch {
    // Ignore storage errors
  }
}

export function getStoredSignature(walletAddress: string): Uint8Array | null {
  if (!isBrowser) return null;
  try {
    const sigHex = localStorage.getItem(SIGNATURE_STORAGE_KEY + walletAddress);
    if (!sigHex) return null;
    return Buffer.from(sigHex, 'hex');
  } catch {
    return null;
  }
}

export function clearStoredSignature(walletAddress: string): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(SIGNATURE_STORAGE_KEY + walletAddress);
  } catch {
    // Ignore
  }
}

export function isInitialized(walletAddress: string): boolean {
  if (!isBrowser) return false;
  return getStoredSignature(walletAddress) !== null;
}

// Legacy aliases
export const storeEncryptionKey = storeSignature;
export const getStoredEncryptionKey = getStoredSignature;
export const clearStoredEncryptionKey = clearStoredSignature;

/**
 * Privacy Cash Client
 */
export class PrivacyCashClient {
  private connection: Connection;
  private publicKey: PublicKey;
  private signature: Uint8Array;
  private transactionSigner: TransactionSigner;

  // Cached SDK modules
  private sdkLoaded = false;
  private depositFn: DepositFn | null = null;
  private withdrawFn: WithdrawFn | null = null;
  private getUtxosFn: GetUtxosFn | null = null;
  private getBalanceFromUtxosFn: GetBalanceFromUtxosFn | null = null;
  private EncryptionService: EncryptionServiceClass | null = null;
  private lightWasm: any = null;
  private encryptionServiceInstance: any = null;

  constructor(params: {
    rpcUrl: string;
    walletAddress: string;
    encryptionKey: Uint8Array;
    transactionSigner: TransactionSigner;
  }) {
    this.connection = new Connection(params.rpcUrl, 'confirmed');
    this.publicKey = new PublicKey(params.walletAddress);
    this.signature = params.encryptionKey;
    this.transactionSigner = params.transactionSigner;
  }

  private async loadSDK(): Promise<void> {
    if (this.sdkLoaded) return;

    if (!isBrowser) {
      throw new Error('Privacy Cash SDK can only be loaded in browser environment');
    }

    try {
      const [sdkUtils, hasherModule] = await Promise.all([
        import('privacycash/utils'),
        import('@lightprotocol/hasher.rs'),
      ]);

      this.depositFn = sdkUtils.deposit;
      this.withdrawFn = sdkUtils.withdraw;
      this.getUtxosFn = sdkUtils.getUtxos;
      this.getBalanceFromUtxosFn = sdkUtils.getBalanceFromUtxos;
      this.EncryptionService = sdkUtils.EncryptionService;

      this.lightWasm = await hasherModule.WasmFactory.getInstance();
      this.sdkLoaded = true;
      console.log('Privacy Cash SDK loaded');
    } catch (error) {
      console.error('Failed to load Privacy Cash SDK:', error);
      throw new Error('Failed to load Privacy Cash SDK');
    }
  }

  private createEncryptionService(): any {
    if (this.encryptionServiceInstance) {
      return this.encryptionServiceInstance;
    }

    if (!this.EncryptionService) {
      throw new Error('SDK not loaded');
    }

    const encService = new this.EncryptionService();

    if (typeof encService.deriveEncryptionKeyFromSignature === 'function') {
      encService.deriveEncryptionKeyFromSignature(this.signature);
    } else {
      throw new Error('EncryptionService.deriveEncryptionKeyFromSignature not available');
    }

    this.encryptionServiceInstance = encService;
    return encService;
  }

  /**
   * Get shielded balance
   */
  async getBalance(): Promise<{ sol: number; lamports: number }> {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return { lamports: 0, sol: 0 };
    }

    await this.loadSDK();

    try {
      const encService = this.createEncryptionService();

      const utxos = await this.getUtxosFn!({
        publicKey: this.publicKey,
        connection: this.connection,
        encryptionService: encService,
        storage: window.localStorage,
      } as any);

      if (!utxos || utxos.length === 0) {
        return { lamports: 0, sol: 0 };
      }

      const result = this.getBalanceFromUtxosFn!(utxos);
      const lamports = typeof result === 'object' && result !== null
        ? (result.lamports || 0)
        : (typeof result === 'number' ? result : 0);

      const validLamports = (typeof lamports === 'number' && !isNaN(lamports)) ? lamports : 0;

      return {
        lamports: validLamports,
        sol: validLamports / LAMPORTS_PER_SOL,
      };
    } catch (error) {
      console.error('Failed to get balance:', error);
      return { lamports: 0, sol: 0 };
    }
  }

  /**
   * Deposit SOL into the privacy pool (shield)
   */
  async deposit(lamports: number, referrer?: string): Promise<{ signature: string }> {
    await this.loadSDK();

    const balance = await this.connection.getBalance(this.publicKey);
    if (balance < lamports + 10000) {
      throw new Error(`Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    }

    const encService = this.createEncryptionService();

    console.log(`Shielding ${lamports / LAMPORTS_PER_SOL} SOL...`);

    const result = await this.depositFn!({
      lightWasm: this.lightWasm,
      storage: localStorage,
      keyBasePath: 'shield',
      publicKey: this.publicKey,
      connection: this.connection,
      amount_in_lamports: lamports,
      encryptionService: encService,
      transactionSigner: this.transactionSigner,
      referrer,
    });

    console.log(`Shield successful: ${result.tx}`);
    return { signature: result.tx };
  }

  /**
   * Withdraw SOL from the privacy pool
   */
  async withdraw(lamports: number, recipientAddress?: string): Promise<{ signature: string }> {
    await this.loadSDK();

    const encService = this.createEncryptionService();
    const recipientStr = recipientAddress || this.publicKey.toString();
    const recipient = new PublicKey(recipientStr);

    console.log(`Withdrawing ${lamports / LAMPORTS_PER_SOL} SOL to ${recipient.toString()}...`);

    const result = await this.withdrawFn!({
      lightWasm: this.lightWasm,
      storage: localStorage,
      keyBasePath: 'shield',
      publicKey: this.publicKey,
      connection: this.connection,
      amount_in_lamports: lamports,
      recipient: recipient,
      encryptionService: encService,
      transactionSigner: this.transactionSigner,
    });

    console.log(`Withdrawal successful: ${result.tx}`);
    return { signature: result.tx };
  }

  /**
   * Clear local UTXO cache
   */
  async clearCache(): Promise<void> {
    if (typeof window !== 'undefined') {
      const prefix = `pc_${this.publicKey.toString().slice(0, 8)}_`;
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
      keys.forEach(k => localStorage.removeItem(k));
    }
  }
}
