/**
 * SOL price utilities - fetches and caches SOL/USD price
 */

let cachedPrice: number | null = null;
let lastFetch: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Fetch SOL price from CoinGecko API
 */
export async function fetchSolPrice(): Promise<number> {
  const now = Date.now();

  // Return cached price if still valid
  if (cachedPrice !== null && now - lastFetch < CACHE_DURATION) {
    return cachedPrice;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );

    if (!response.ok) {
      throw new Error('Failed to fetch price');
    }

    const data = await response.json();
    cachedPrice = data.solana?.usd || null;
    lastFetch = now;

    return cachedPrice || 0;
  } catch (error) {
    console.error('[SolPrice] Failed to fetch:', error);
    // Return cached price if available, otherwise 0
    return cachedPrice || 0;
  }
}

/**
 * Format USD value
 */
export function formatUsd(solAmount: number, solPrice: number): string {
  if (!solPrice || solAmount === 0) return '';
  const usdValue = solAmount * solPrice;

  if (usdValue < 0.01) {
    return `$${usdValue.toFixed(4)}`;
  } else if (usdValue < 1) {
    return `$${usdValue.toFixed(3)}`;
  } else if (usdValue < 100) {
    return `$${usdValue.toFixed(2)}`;
  } else {
    return `$${usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

/**
 * Get cached price synchronously (may be null if not fetched yet)
 */
export function getCachedSolPrice(): number | null {
  return cachedPrice;
}
