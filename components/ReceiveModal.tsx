'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface ReceiveModalProps {
  address: string;
  onClose: () => void;
}

export default function ReceiveModal({ address, onClose }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-boo-card border border-boo-border rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-boo-border">
          <h3 className="text-lg font-semibold text-white">Receive</h3>
          <button
            onClick={onClose}
            className="text-boo-dim hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-boo-dim">
            Send SOL or tokens to this address
          </p>

          {/* Address Display */}
          <div className="bg-boo-bg rounded-lg p-4">
            <p className="font-mono text-sm text-white break-all">
              {address}
            </p>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="btn-primary w-full"
          >
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
        </div>
      </div>
    </div>
  );
}
