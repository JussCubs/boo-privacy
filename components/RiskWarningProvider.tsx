'use client';

import { useState, useEffect, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import RiskWarningModal from './RiskWarningModal';

const STORAGE_KEY = 'boo-risk-warning-dismissed';

interface RiskWarningProviderProps {
  children: ReactNode;
}

export default function RiskWarningProvider({ children }: RiskWarningProviderProps) {
  const { ready, authenticated } = usePrivy();
  const [showWarning, setShowWarning] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Only check/show warning after Privy is ready and user is authenticated
    if (ready && authenticated && !hasChecked) {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      setShowWarning(!dismissed);
      setHasChecked(true);
    }
  }, [ready, authenticated, hasChecked]);

  const handleAccept = () => {
    setShowWarning(false);
  };

  return (
    <>
      {showWarning && <RiskWarningModal onAccept={handleAccept} />}
      {children}
    </>
  );
}
