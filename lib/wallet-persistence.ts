/**
 * Wallet Persistence System
 *
 * Securely persists wallet data (seed phrase, derived wallets) to localStorage
 * with encryption and proper cache management.
 */

const WALLET_CACHE_PREFIX = 'boo_wallet_cache_';
const WALLET_CACHE_META_KEY = 'boo_wallet_cache_meta';

export interface CachedWalletSet {
  seedPhrase: string;
  walletCount: number;
  createdAt: number;
  lastAccessedAt: number;
  label?: string;
}

export interface WalletCacheMeta {
  cacheKeys: string[];
  lastUpdated: number;
}

// Simple XOR-based obfuscation (not cryptographically secure, but prevents casual viewing)
// For production, consider using Web Crypto API with a user-derived key
function obfuscate(data: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const dataBytes = new TextEncoder().encode(data);
  const result = new Uint8Array(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i++) {
    result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return btoa(String.fromCharCode(...result));
}

function deobfuscate(encoded: string, key: string): string {
  try {
    const keyBytes = new TextEncoder().encode(key);
    const decoded = atob(encoded);
    const dataBytes = new Uint8Array(decoded.length);

    for (let i = 0; i < decoded.length; i++) {
      dataBytes[i] = decoded.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(dataBytes);
  } catch {
    return '';
  }
}

// Generate a cache key from seed phrase (first few words hash)
function generateCacheKey(seedPhrase: string): string {
  const words = seedPhrase.trim().split(/\s+/);
  // Use first 3 and last 2 words to create a semi-unique identifier
  const identifier = `${words.slice(0, 3).join('')}${words.slice(-2).join('')}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${WALLET_CACHE_PREFIX}${Math.abs(hash).toString(36)}`;
}

// Get obfuscation key (based on browser fingerprint + static salt)
function getObfuscationKey(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'default';
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return `boo_${ua.slice(0, 20)}_${lang}_privacy`;
}

/**
 * Save a wallet set to cache
 */
export function saveWalletToCache(
  seedPhrase: string,
  walletCount: number,
  label?: string
): string {
  if (typeof window === 'undefined') return '';

  const cacheKey = generateCacheKey(seedPhrase);
  const obfKey = getObfuscationKey();

  const cacheData: CachedWalletSet = {
    seedPhrase: obfuscate(seedPhrase, obfKey),
    walletCount,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    label,
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    // Update meta
    const meta = getWalletCacheMeta();
    if (!meta.cacheKeys.includes(cacheKey)) {
      meta.cacheKeys.push(cacheKey);
    }
    meta.lastUpdated = Date.now();
    localStorage.setItem(WALLET_CACHE_META_KEY, JSON.stringify(meta));

    console.log('[WalletCache] Saved wallet set to cache');
    return cacheKey;
  } catch (error) {
    console.error('[WalletCache] Failed to save:', error);
    return '';
  }
}

/**
 * Load a wallet set from cache by key
 */
export function loadWalletFromCache(cacheKey: string): CachedWalletSet | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(cacheKey);
    if (!data) return null;

    const cached: CachedWalletSet = JSON.parse(data);
    const obfKey = getObfuscationKey();

    // Deobfuscate seed phrase
    const seedPhrase = deobfuscate(cached.seedPhrase, obfKey);
    if (!seedPhrase || seedPhrase.split(/\s+/).length < 12) {
      console.error('[WalletCache] Failed to deobfuscate or invalid seed phrase');
      return null;
    }

    // Update last accessed
    cached.lastAccessedAt = Date.now();
    cached.seedPhrase = obfuscate(seedPhrase, obfKey); // Re-obfuscate for storage
    localStorage.setItem(cacheKey, JSON.stringify(cached));

    return {
      ...cached,
      seedPhrase, // Return deobfuscated
    };
  } catch (error) {
    console.error('[WalletCache] Failed to load:', error);
    return null;
  }
}

/**
 * Get cache metadata
 */
export function getWalletCacheMeta(): WalletCacheMeta {
  if (typeof window === 'undefined') {
    return { cacheKeys: [], lastUpdated: 0 };
  }

  try {
    const data = localStorage.getItem(WALLET_CACHE_META_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Ignore parse errors
  }

  return { cacheKeys: [], lastUpdated: 0 };
}

/**
 * Get all cached wallet sets (with metadata only, not seed phrases)
 */
export function getAllCachedWallets(): Array<{
  cacheKey: string;
  walletCount: number;
  createdAt: number;
  lastAccessedAt: number;
  label?: string;
  preview: string; // First few chars of seed for identification
}> {
  if (typeof window === 'undefined') return [];

  const meta = getWalletCacheMeta();
  const results: Array<{
    cacheKey: string;
    walletCount: number;
    createdAt: number;
    lastAccessedAt: number;
    label?: string;
    preview: string;
  }> = [];

  for (const cacheKey of meta.cacheKeys) {
    const cached = loadWalletFromCache(cacheKey);
    if (cached) {
      const words = cached.seedPhrase.split(/\s+/);
      results.push({
        cacheKey,
        walletCount: cached.walletCount,
        createdAt: cached.createdAt,
        lastAccessedAt: cached.lastAccessedAt,
        label: cached.label,
        preview: `${words[0]} ${words[1]} ... ${words[words.length - 1]}`,
      });
    }
  }

  // Sort by last accessed (most recent first)
  results.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

  return results;
}

/**
 * Delete a specific cached wallet
 */
export function deleteWalletFromCache(cacheKey: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.removeItem(cacheKey);

    // Update meta
    const meta = getWalletCacheMeta();
    meta.cacheKeys = meta.cacheKeys.filter(k => k !== cacheKey);
    meta.lastUpdated = Date.now();
    localStorage.setItem(WALLET_CACHE_META_KEY, JSON.stringify(meta));

    console.log('[WalletCache] Deleted wallet from cache');
    return true;
  } catch (error) {
    console.error('[WalletCache] Failed to delete:', error);
    return false;
  }
}

/**
 * Clear all cached wallets
 */
export function clearAllWalletCache(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const meta = getWalletCacheMeta();

    // Delete all cached wallet data
    for (const cacheKey of meta.cacheKeys) {
      localStorage.removeItem(cacheKey);
    }

    // Clear meta
    localStorage.removeItem(WALLET_CACHE_META_KEY);

    console.log('[WalletCache] Cleared all wallet cache');
    return true;
  } catch (error) {
    console.error('[WalletCache] Failed to clear:', error);
    return false;
  }
}

/**
 * Check if there are any cached wallets
 */
export function hasCachedWallets(): boolean {
  if (typeof window === 'undefined') return false;
  const meta = getWalletCacheMeta();
  return meta.cacheKeys.length > 0;
}

/**
 * Get the most recently accessed cached wallet
 */
export function getMostRecentCachedWallet(): CachedWalletSet | null {
  const cached = getAllCachedWallets();
  if (cached.length === 0) return null;

  // Most recent is first after sorting
  return loadWalletFromCache(cached[0].cacheKey);
}

/**
 * Update wallet count for an existing cached wallet
 */
export function updateCachedWalletCount(cacheKey: string, newCount: number): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const data = localStorage.getItem(cacheKey);
    if (!data) return false;

    const cached: CachedWalletSet = JSON.parse(data);
    cached.walletCount = newCount;
    cached.lastAccessedAt = Date.now();

    localStorage.setItem(cacheKey, JSON.stringify(cached));
    return true;
  } catch {
    return false;
  }
}

/**
 * Update the label for an existing cached wallet
 */
export function updateCachedWalletLabel(cacheKey: string, label: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const data = localStorage.getItem(cacheKey);
    if (!data) return false;

    const cached: CachedWalletSet = JSON.parse(data);
    cached.label = label.trim() || undefined; // Remove empty labels
    cached.lastAccessedAt = Date.now();

    localStorage.setItem(cacheKey, JSON.stringify(cached));
    console.log('[WalletCache] Updated label for wallet');
    return true;
  } catch (error) {
    console.error('[WalletCache] Failed to update label:', error);
    return false;
  }
}
