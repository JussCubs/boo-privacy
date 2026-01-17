'use client';

import { useState } from 'react';

const STORAGE_KEY = 'boo-risk-warning-dismissed';

interface RiskWarningModalProps {
  onAccept: () => void;
}

export default function RiskWarningModal({ onAccept }: RiskWarningModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
      <div className="bg-boo-card border border-boo-border rounded-xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-boo-border">
          <span className="text-xl text-yellow-500">&#9888;</span>
          <h3 className="text-base font-semibold text-white">Risk Warning</h3>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-boo-dim leading-relaxed">
            This is <span className="text-white font-medium">experimental crypto software</span>.
            Your private keys are stored only in your browser cache and will be
            lost if cleared.
          </p>

          <p className="text-sm text-boo-dim leading-relaxed">
            <span className="text-yellow-500">&#8226;</span> Always backup your private keys<br/>
            <span className="text-yellow-500">&#8226;</span> Never interrupt transactions<br/>
            <span className="text-yellow-500">&#8226;</span> We cannot recover lost funds
          </p>

          {/* Don't Show Again */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-boo-border bg-boo-bg text-boo-primary focus:ring-boo-primary accent-boo-primary"
            />
            <span className="text-xs text-boo-dim">Don&apos;t show this again</span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 pt-0">
          <button
            onClick={handleAccept}
            className="w-full py-2.5 px-4 rounded-lg font-medium text-sm bg-boo-primary hover:bg-boo-primary/90 text-white transition-colors"
          >
            I Understand, Continue
          </button>
          <p className="text-[10px] text-boo-dim text-center mt-2">
            By continuing, you accept all risks and responsibility for your funds.
          </p>
        </div>
      </div>
    </div>
  );
}
