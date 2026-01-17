import { NextRequest, NextResponse } from 'next/server';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

// Custom deposit handler that submits directly to Solana
// This bypasses the Privacy Cash relayer's 504 timeout issues

const PRIVACY_CASH_API = 'https://api3.privacycash.org';

// Allow up to 2 minutes for transaction processing
export const maxDuration = 120;

// Validate that a signature is a real Solana signature
// Real signatures are 88 characters in base58 (not all 1s or 0s)
function isValidSolanaSignature(sig: string | null | undefined): sig is string {
  if (!sig) {
    console.log('[Deposit] Signature validation: null/undefined');
    return false;
  }
  if (typeof sig !== 'string') {
    console.log('[Deposit] Signature validation: not a string');
    return false;
  }
  if (sig.length < 80) {
    console.log(`[Deposit] Signature validation: too short (${sig.length} chars)`);
    return false;
  }
  if (/^1+$/.test(sig)) {
    console.log('[Deposit] Signature validation: all 1s (placeholder)');
    return false;
  }
  if (/^0+$/.test(sig)) {
    console.log('[Deposit] Signature validation: all 0s (placeholder)');
    return false;
  }
  console.log(`[Deposit] Signature validation: VALID (${sig.substring(0, 20)}...)`);
  return true;
}

function getRpcUrl(): string {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL_PROTECTED ||
    process.env.NEXT_PUBLIC_SOLANA_SECURE_RPC_URL ||
    'https://api.mainnet-beta.solana.com';
  console.log('[Deposit] Using RPC URL:', url.substring(0, 50) + '...');
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signedTransaction, senderAddress, referralWalletAddress } = body;

    if (!signedTransaction || !senderAddress) {
      return NextResponse.json(
        { error: 'signedTransaction and senderAddress required' },
        { status: 400 }
      );
    }

    console.log(`[Deposit] Processing deposit for ${senderAddress}`);
    console.log(`[Deposit] Transaction size: ${signedTransaction.length} chars`);

    // First try the Privacy Cash relayer (with short timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      console.log('[Deposit] Trying Privacy Cash relayer first...');
      const relayerResponse = await fetch(`${PRIVACY_CASH_API}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction,
          senderAddress,
          referralWalletAddress,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (relayerResponse.ok) {
        const result = await relayerResponse.json();
        console.log('[Deposit] Privacy Cash relayer response:', JSON.stringify(result));

        // Validate the signature using our strict validator
        if (isValidSolanaSignature(result.signature)) {
          console.log('[Deposit] Relayer returned valid signature:', result.signature);
          return NextResponse.json({
            success: true,
            signature: result.signature,
            method: 'relayer',
          });
        }

        // Relayer returned placeholder/invalid signature, fall through to direct submission
        console.log('[Deposit] Relayer signature invalid, falling back to direct Solana submission');
      } else {
        const errorText = await relayerResponse.text();
        console.log(`[Deposit] Relayer returned ${relayerResponse.status}: ${errorText.substring(0, 200)}`);
      }
    } catch (relayerError: any) {
      console.log('[Deposit] Relayer failed/timed out:', relayerError.message);
    }

    // Fallback: Submit directly to Solana
    console.log('[Deposit] Submitting transaction directly to Solana...');

    const rpcUrl = getRpcUrl();
    const connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });

    // Test connection first
    try {
      const slot = await connection.getSlot();
      console.log(`[Deposit] RPC connection OK, current slot: ${slot}`);
    } catch (connErr: any) {
      console.error('[Deposit] RPC connection failed:', connErr.message);
      throw new Error(`RPC connection failed: ${connErr.message}`);
    }

    // Deserialize the transaction
    let tx: VersionedTransaction;
    try {
      const txBytes = Buffer.from(signedTransaction, 'base64');
      console.log(`[Deposit] Transaction bytes: ${txBytes.length} bytes`);
      tx = VersionedTransaction.deserialize(txBytes);
      console.log(`[Deposit] Transaction deserialized, signatures: ${tx.signatures.length}`);

      // Log the existing signatures in the transaction (base58 encoded like Solana uses)
      tx.signatures.forEach((sig, i) => {
        const sigBase58 = bs58.encode(sig);
        const isAllZeros = sig.every(b => b === 0);
        const isAllOnes = sig.every(b => b === 0xff);
        console.log(`[Deposit] Tx Signature ${i}: ${sigBase58} (length: ${sigBase58.length}, bytes: ${sig.length}, allZeros: ${isAllZeros}, allOnes: ${isAllOnes})`);
      });
    } catch (deserErr: any) {
      console.error('[Deposit] Failed to deserialize transaction:', deserErr.message);
      throw new Error(`Failed to deserialize transaction: ${deserErr.message}`);
    }

    // Get fresh blockhash for confirmation (the tx already has its blockhash)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    console.log(`[Deposit] Latest blockhash: ${blockhash.substring(0, 20)}..., height: ${lastValidBlockHeight}`);

    // Send with retry
    let signature: string | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Deposit] Attempt ${attempt + 1}/3 - sending transaction...`);

        try {
          signature = await connection.sendTransaction(tx, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
          });
          console.log(`[Deposit] sendTransaction returned: "${signature}" (type: ${typeof signature}, length: ${signature?.length})`);
        } catch (sendErr: any) {
          console.error(`[Deposit] sendTransaction threw error: ${sendErr.message}`);
          console.error(`[Deposit] sendTransaction error details:`, JSON.stringify(sendErr, Object.getOwnPropertyNames(sendErr)));
          throw sendErr;
        }

        // Verify it's a real signature using strict validation
        if (!isValidSolanaSignature(signature)) {
          throw new Error(`sendTransaction returned invalid signature: ${signature}`);
        }

        console.log(`[Deposit] Transaction sent successfully with valid signature`);


        // Wait for confirmation
        console.log('[Deposit] Waiting for confirmation...');
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`[Deposit] Transaction confirmed: ${signature}`);
        break;
      } catch (err: any) {
        lastError = err;
        console.error(`[Deposit] Attempt ${attempt + 1} failed:`, err.message);

        // Check if we got a valid signature but confirmation failed
        if (isValidSolanaSignature(signature)) {
          console.log('[Deposit] Have valid signature, checking if tx landed on-chain...');
          try {
            const status = await connection.getSignatureStatus(signature);
            console.log('[Deposit] Signature status:', JSON.stringify(status.value));
            if (status.value?.confirmationStatus) {
              console.log(`[Deposit] Transaction is on-chain with status: ${status.value.confirmationStatus}`);
              break;
            }
          } catch (statusErr: any) {
            console.log('[Deposit] Status check failed:', statusErr.message);
          }
        } else {
          console.log(`[Deposit] No valid signature to check (current value: ${signature})`);
        }

        signature = null; // Reset for next attempt

        if (attempt < 2) {
          const delay = 2000 * (attempt + 1);
          console.log(`[Deposit] Waiting ${delay}ms before retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // FINAL VALIDATION: Absolutely ensure we have a valid signature
    if (!isValidSolanaSignature(signature)) {
      console.error('[Deposit] CRITICAL: All attempts failed, no valid signature obtained');
      console.error(`[Deposit] Final signature value: ${signature}`);
      throw lastError || new Error('Failed to submit transaction after 3 attempts - no valid signature');
    }

    console.log(`[Deposit] Direct submission succeeded with signature: ${signature}`);

    // Notify Privacy Cash indexer about the transaction (best effort)
    try {
      console.log('[Deposit] Notifying Privacy Cash indexer about direct submission...');
      const notifyResponse = await fetch(`${PRIVACY_CASH_API}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction,
          senderAddress,
          referralWalletAddress,
          alreadySubmitted: true,
          signature,
        }),
      });
      console.log(`[Deposit] Indexer notification response: ${notifyResponse.status}`);
    } catch (notifyErr: any) {
      console.log('[Deposit] Indexer notification failed (non-critical):', notifyErr.message);
    }

    // ABSOLUTE FINAL CHECK: Never return an invalid signature
    if (!isValidSolanaSignature(signature)) {
      console.error(`[Deposit] BUG: About to return invalid signature: ${signature}`);
      return NextResponse.json(
        { error: 'Internal error: invalid signature generated', success: false },
        { status: 500 }
      );
    }

    console.log(`[Deposit] SUCCESS! Returning valid signature: ${signature}`);
    return NextResponse.json({
      success: true,
      signature,
      method: 'direct',
    });
  } catch (error: any) {
    console.error('[Deposit] Fatal error:', error.message);
    console.error('[Deposit] Stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Deposit failed', success: false },
      { status: 500 }
    );
  }
}
