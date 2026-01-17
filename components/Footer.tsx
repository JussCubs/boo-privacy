'use client';

export default function Footer() {
  return (
    <footer className="border-t border-boo-border bg-boo-card/30 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">👻</span>
            <span className="font-bold text-white">Boo Privacy</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <a
              href="https://twitter.com/booprivacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-boo-dim hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://github.com/JussCubs/boo-privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-boo-dim hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://booprivacy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-boo-dim hover:text-white transition-colors"
            >
              Website
            </a>
          </div>

          {/* Powered By */}
          <div className="flex items-center gap-2 text-xs text-boo-dim">
            <span>Powered by</span>
            <a
              href="https://privacycash.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-boo-primary hover:text-red-400 transition-colors"
            >
              Privacy Cash
            </a>
            <span>on</span>
            <span className="text-purple-400">Solana</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 pt-4 border-t border-boo-border">
          <p className="text-xs text-boo-dim text-center">
            Boo Privacy is open source software provided as-is. Always verify transactions and
            keep your seed phrases secure. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
