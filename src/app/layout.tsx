import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://booprivacy.com'),
  title: 'Boo Privacy',
  description: 'Something is watching over you. Coming soon.',
  keywords: ['boo privacy', 'privacy', 'security'],
  authors: [{ name: 'Boo Privacy' }],
  creator: 'Boo Privacy',
  publisher: 'Boo Privacy',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://booprivacy.com',
    siteName: 'Boo Privacy',
    title: 'Boo Privacy',
    description: 'Something is watching over you. Coming soon.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Boo Privacy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boo Privacy',
    description: 'Something is watching over you. Coming soon.',
    images: ['/og-image.png'],
    creator: '@booprivacy',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
