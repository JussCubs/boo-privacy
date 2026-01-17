'use client';

import { useState, useEffect } from 'react';
import { fetchSolPrice, formatUsd } from './sol-price';

/**
 * Hook to get SOL price and format USD values
 */
export function useSolPrice() {
  const [solPrice, setSolPrice] = useState<number>(0);

  useEffect(() => {
    // Initial fetch
    fetchSolPrice().then(setSolPrice);

    // Refresh every minute
    const interval = setInterval(() => {
      fetchSolPrice().then(setSolPrice);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const toUsd = (solAmount: number): string => {
    return formatUsd(solAmount, solPrice);
  };

  return { solPrice, toUsd };
}
