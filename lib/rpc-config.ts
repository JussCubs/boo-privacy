/**
 * Get the Solana RPC URL for client-side operations
 */
export function getSolanaRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOLANA_SECURE_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL_PROTECTED ||
    'https://api.mainnet-beta.solana.com'
  );
}

/**
 * Get the WebSocket RPC URL for subscriptions
 */
export function getSolanaWebSocketUrl(): string {
  const rpcUrl = getSolanaRpcUrl();

  if (rpcUrl.startsWith('wss://')) {
    return rpcUrl;
  }

  if (rpcUrl.startsWith('https://')) {
    return rpcUrl.replace(/^https:/, 'wss:');
  }

  return 'wss://api.mainnet-beta.solana.com';
}
