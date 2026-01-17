/**
 * Price fetching for tokens using Helius DAS API
 *
 * Fetches prices for SOL, USDC, ORE, and stORE tokens
 */

import { TOKENS, TOKEN_SYMBOLS, TokenSymbol } from './tokens';
import { getSolanaRpcUrl } from './rpc-config';

export interface TokenPrices {
  SOL: number;
  USDC: number;
  ORE: number;
  stORE: number;
}

// Default fallback prices
const DEFAULT_PRICES: TokenPrices = {
  SOL: 100,
  USDC: 1,
  ORE: 0.10,
  stORE: 0.10,
};

// Price cache
let cachedPrices: TokenPrices = { ...DEFAULT_PRICES };
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 60 seconds

/**
 * Get Helius API URL for DAS API calls
 * Supports both API key format and dedicated endpoint format
 */
function getHeliusUrl(): string | null {
  // Try dedicated API key env var first
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  if (apiKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  }

  // Try to get RPC URL
  const rpcUrl = getSolanaRpcUrl();

  // Check if it's a Helius URL with api-key parameter
  const apiKeyMatch = rpcUrl.match(/helius-rpc\.com\/?\?api-key=([^&]+)/i);
  if (apiKeyMatch) {
    return `https://mainnet.helius-rpc.com/?api-key=${apiKeyMatch[1]}`;
  }

  // Check if it's a dedicated Helius endpoint (e.g., pierrette-xxx-fast-mainnet.helius-rpc.com)
  // These dedicated endpoints support DAS API directly
  if (rpcUrl.includes('helius-rpc.com')) {
    return rpcUrl;
  }

  return null;
}

/**
 * Fetch token price from Helius DAS API
 * Uses getAsset with displayOptions.showFungible for price info
 */
async function fetchTokenPrice(mint: string): Promise<number | null> {
  const heliusUrl = getHeliusUrl();
  if (!heliusUrl) {
    console.warn('[Prices] No Helius API URL available. Set NEXT_PUBLIC_HELIUS_API_KEY or use a Helius RPC URL.');
    return null;
  }

  try {
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'price-fetch',
        method: 'getAsset',
        params: {
          id: mint,
          displayOptions: {
            showFungible: true,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error('[Prices] Helius API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.error('[Prices] Helius API error response:', data.error);
      return null;
    }

    const price = data?.result?.token_info?.price_info?.price_per_token;

    if (typeof price === 'number' && price > 0) {
      return price;
    }

    console.warn('[Prices] No price info in response for mint:', mint);
    return null;
  } catch (error) {
    console.error('[Prices] Failed to fetch price for', mint, error);
    return null;
  }
}

/**
 * Fetch all token prices
 */
export async function fetchTokenPrices(): Promise<TokenPrices> {
  // Return cached prices if still valid
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION && lastFetchTime > 0) {
    return cachedPrices;
  }

  console.log('[Prices] Fetching token prices from Helius DAS API...');

  // Fetch prices in parallel
  const [solPrice, orePrice] = await Promise.all([
    fetchTokenPrice(TOKENS.SOL.mint),
    fetchTokenPrice(TOKENS.ORE.mint),
  ]);

  // Update cache
  if (solPrice !== null) {
    cachedPrices.SOL = solPrice;
    console.log('[Prices] SOL price: $' + solPrice.toFixed(2));
  } else {
    console.warn('[Prices] Could not fetch SOL price, using default: $' + cachedPrices.SOL);
  }

  if (orePrice !== null) {
    cachedPrices.ORE = orePrice;
    cachedPrices.stORE = orePrice; // stORE uses same price as ORE
    console.log('[Prices] ORE price: $' + orePrice.toFixed(4));
  } else {
    console.warn('[Prices] Could not fetch ORE price, using default: $' + cachedPrices.ORE);
  }

  cachedPrices.USDC = 1; // USDC is always $1

  lastFetchTime = now;

  console.log('[Prices] Updated prices:', cachedPrices);
  return cachedPrices;
}

/**
 * Get cached prices (without fetching)
 */
export function getCachedPrices(): TokenPrices {
  return cachedPrices;
}

/**
 * Get price for a specific token
 */
export function getTokenPrice(symbol: TokenSymbol): number {
  return cachedPrices[symbol] ?? 0;
}

/**
 * Calculate USD value for a token amount
 */
export function calculateUsdValue(amount: number, symbol: TokenSymbol): number {
  const price = getTokenPrice(symbol);
  return amount * price;
}

/**
 * Calculate total portfolio value in USD
 */
export function calculatePortfolioValue(balances: Partial<Record<TokenSymbol, number>>): number {
  let total = 0;
  for (const symbol of TOKEN_SYMBOLS) {
    const balance = balances[symbol] ?? 0;
    total += calculateUsdValue(balance, symbol);
  }
  return total;
}
