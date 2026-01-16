import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://booprivacy.com'),
  title: 'Boo Privacy | Your Digital Guardian is Coming',
  description: 'Boo Privacy is building the next generation of privacy-first tools. A powerful web app to protect your digital identity, secure your data, and keep prying eyes away. Coming soon.',
  keywords: ['privacy', 'security', 'data protection', 'digital privacy', 'online security', 'privacy tools', 'secure browsing', 'data encryption', 'privacy app', 'cybersecurity'],
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
    title: 'Boo Privacy | Your Digital Guardian is Coming',
    description: 'The next generation of privacy-first tools. Protect your digital identity, secure your data, and keep prying eyes away.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Boo Privacy - Your Digital Guardian',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boo Privacy | Your Digital Guardian is Coming',
    description: 'The next generation of privacy-first tools. Protect your digital identity and secure your data.',
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
      <body className="bg-boo-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
