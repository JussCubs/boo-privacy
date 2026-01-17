/**
 * Token Configuration for Boo Privacy
 *
 * Supports SOL, USDC, ORE, and stORE tokens on Solana mainnet
 */

export interface TokenConfig {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  isNative?: boolean;
  logoUrl?: string;
  coingeckoId?: string;
}

// Token mint addresses on Solana mainnet
export const TOKENS: Record<string, TokenConfig> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    isNative: true,
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    coingeckoId: 'solana',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    coingeckoId: 'usd-coin',
  },
  ORE: {
    symbol: 'ORE',
    name: 'ORE',
    mint: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhxyK9jSybcp',
    decimals: 11,
    logoUrl: 'https://ore.supply/icon.png',
    coingeckoId: 'ore',
  },
  stORE: {
    symbol: 'stORE',
    name: 'Staked ORE',
    mint: 'DrSS5RM7zUd9qjUEdDaf31vnDUSbCrMto6mjqTrHFifN',
    decimals: 11,
    logoUrl: 'https://ore.supply/icon.png',
    coingeckoId: 'ore', // Uses same price as ORE
  },
};

// Token symbols for iteration
export const TOKEN_SYMBOLS = ['SOL', 'USDC', 'ORE', 'stORE'] as const;
export type TokenSymbol = typeof TOKEN_SYMBOLS[number];

// Get token by mint address
export function getTokenByMint(mint: string): TokenConfig | undefined {
  return Object.values(TOKENS).find(token => token.mint === mint);
}

// Get token by symbol
export function getToken(symbol: string): TokenConfig | undefined {
  return TOKENS[symbol.toUpperCase()];
}

// Format token amount with proper decimals
export function formatTokenAmount(
  amount: number,
  symbol: TokenSymbol,
  maxDecimals: number = 4
): string {
  const token = TOKENS[symbol];
  if (!token) return amount.toFixed(maxDecimals);

  // For very small amounts, show more decimals
  if (amount > 0 && amount < 0.0001) {
    return amount.toExponential(2);
  }

  // For USDC, always show 2 decimals
  if (symbol === 'USDC') {
    return amount.toFixed(2);
  }

  // For other tokens, use dynamic decimals
  if (amount >= 1000) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  return amount.toFixed(Math.min(maxDecimals, token.decimals));
}

// Format USD value
export function formatUsdValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  if (value < 0.01 && value > 0) {
    return '<$0.01';
  }
  return `$${value.toFixed(2)}`;
}

// Parse raw amount to UI amount
export function parseTokenAmount(rawAmount: bigint | number, decimals: number): number {
  const divisor = Math.pow(10, decimals);
  if (typeof rawAmount === 'bigint') {
    return Number(rawAmount) / divisor;
  }
  return rawAmount / divisor;
}

// Convert UI amount to raw lamports/smallest unit
export function toRawAmount(uiAmount: number, decimals: number): bigint {
  const multiplier = Math.pow(10, decimals);
  return BigInt(Math.floor(uiAmount * multiplier));
}
