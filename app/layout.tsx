import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

const siteUrl = 'https://booprivacy.com';
const siteName = 'Boo Privacy';
const siteDescription = 'Fund many wallets privately with ZK proofs on Solana. Shield your funds and distribute to multiple wallets anonymously.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Boo Privacy - Private Multi-Wallet Funding on Solana',
    template: '%s | Boo Privacy'
  },
  description: siteDescription,
  keywords: [
    'Solana',
    'Privacy',
    'ZK',
    'Zero Knowledge',
    'Multi-wallet',
    'Anonymous',
    'Crypto',
    'DeFi',
    'Boo',
    'Shield',
    'Private Transfers',
  ],
  authors: [{ name: 'Boo Privacy' }],
  creator: 'Boo Privacy',
  publisher: 'Boo Privacy',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteName,
    title: 'Boo Privacy - Private Multi-Wallet Funding on Solana',
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Boo Privacy - Private Multi-Wallet Funding',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boo Privacy - Private Multi-Wallet Funding on Solana',
    description: siteDescription,
    images: [`${siteUrl}/og-image.png`],
    creator: '@booprivacy',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Block Ethereum detection - Solana only */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  try {
                    Object.defineProperty(window, 'ethereum', {
                      value: undefined,
                      writable: false,
                      configurable: false,
                    });
                  } catch (e) {}
                }
              })();
            `,
          }}
        />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-boo-bg text-boo-text min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
