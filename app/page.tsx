'use client';

import { usePrivy } from '@privy-io/react-auth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WalletGenerator from '@/components/WalletGenerator';
import ShieldPanel from '@/components/ShieldPanel';
import FundingPanel from '@/components/FundingPanel';
import BooMascot from '@/components/BooMascot';
import Image from 'next/image';

export default function Home() {
  const { ready, authenticated } = usePrivy();

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-[150px]" />
      </div>

      <Header />

      <main className="flex-1 relative z-10 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Hero Section - Show when not authenticated */}
        {!authenticated && (
          <div className="text-center py-16 animate-fadeIn">
            {/* Large Boo Logo */}
            <div className="relative w-48 h-48 md:w-64 md:h-64 mx-auto mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 rounded-full blur-3xl animate-pulse" />
              <Image
                src="/boo-privacy.png"
                alt="Boo Privacy"
                fill
                className="object-contain animate-float relative z-10"
                priority
              />
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                Private
              </span>{' '}
              Funding
            </h1>
            <p className="text-white/40 text-lg max-w-md mx-auto mb-8">
              Shield your SOL with ZK proofs. Fund wallets privately.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
              {['ZK Proofs', 'No KYC', 'Non-Custodial', 'Instant'].map((feature) => (
                <span
                  key={feature}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* App Section - Show when authenticated */}
        {authenticated && (
          <div className="space-y-6 animate-fadeIn">
            {/* Boo Mascot Header */}
            <div className="flex flex-col items-center justify-center py-4">
              <BooMascot size="medium" />
            </div>

            {/* Main Content - Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Column - Shield (smaller) */}
              <div className="lg:col-span-1">
                <ShieldPanel />
              </div>

              {/* Right Column - Wallets & Funding */}
              <div className="lg:col-span-2 space-y-4">
                <WalletGenerator />
                <FundingPanel />
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
