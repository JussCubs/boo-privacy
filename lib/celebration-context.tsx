'use client';

/**
 * Celebration Context - Triggers dopamine-blasting animations app-wide
 *
 * Used to celebrate successful transactions, swaps, and private funding
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type CelebrationType = 'shield' | 'unshield' | 'swap' | 'fund' | 'success' | 'epic';

interface CelebrationContextType {
  isAnimating: boolean;
  celebrationType: CelebrationType | null;
  intensity: number; // 1-10 scale
  celebrate: (type: CelebrationType, intensity?: number) => void;
  stopCelebration: () => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebration must be used within a CelebrationProvider');
  }
  return context;
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [celebrationType, setCelebrationType] = useState<CelebrationType | null>(null);
  const [intensity, setIntensity] = useState(5);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const celebrate = useCallback((type: CelebrationType, newIntensity: number = 5) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsAnimating(true);
    setCelebrationType(type);
    setIntensity(Math.min(10, Math.max(1, newIntensity)));

    // Auto-stop after duration based on intensity
    const duration = 2000 + (newIntensity * 300); // 2-5 seconds
    timeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
      setCelebrationType(null);
    }, duration);
  }, []);

  const stopCelebration = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsAnimating(false);
    setCelebrationType(null);
  }, []);

  return (
    <CelebrationContext.Provider value={{
      isAnimating,
      celebrationType,
      intensity,
      celebrate,
      stopCelebration,
    }}>
      {children}
    </CelebrationContext.Provider>
  );
}
