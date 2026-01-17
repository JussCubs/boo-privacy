'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import toast from 'react-hot-toast';

interface ExportKeyModalProps {
  onClose: () => void;
}

export default function ExportKeyModal({ onClose }: ExportKeyModalProps) {
  const { exportWallet } = usePrivy();
  const [isExporting, setIsExporting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleExport = async () => {
    if (!confirmed) {
      toast.error('Please confirm you understand the risks');
      return;
    }

    setIsExporting(true);

    try {
      // Privy's exportWallet opens a secure modal to show the private key
      await exportWallet();
      toast.success('Wallet exported successfully');
      onClose();
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error?.message || 'Failed to export wallet');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-boo-card border border-boo-border rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-boo-border">
          <h3 className="text-lg font-semibold text-white">Export Private Key</h3>
          <button
            onClick={onClose}
            className="text-boo-dim hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-500 text-xl">&#9888;</span>
              <div>
                <h4 className="font-semibold text-yellow-500 mb-1">Security Warning</h4>
                <p className="text-sm text-yellow-500/80">
                  Your private key grants full access to your wallet. Never share it with anyone.
                  Store it securely and offline.
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-sm text-boo-dim space-y-2">
            <p>Exporting your private key allows you to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Import your wallet into other apps (Phantom, Solflare, etc.)</li>
              <li>Back up your wallet for recovery</li>
              <li>Have full control over your funds</li>
            </ul>
          </div>

          {/* Confirmation */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-boo-border bg-boo-bg text-boo-primary focus:ring-boo-primary"
            />
            <span className="text-sm text-boo-dim">
              I understand that anyone with my private key can access my wallet and funds.
              I will store it securely.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-boo-border flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!confirmed || isExporting}
            className="btn-primary flex-1"
          >
            {isExporting ? 'Exporting...' : 'Export Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
