import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'EnCave - Wine Experiences in Valais',
    template: '%s | EnCave',
  },
  description:
    'Book unique wine tasting experiences directly with Swiss winemakers. Discover tastings, cellar visits, and workshops in Valais.',
  keywords: ['wine', 'wine tasting', 'Valais', 'Switzerland', 'winery', 'experience', 'booking'],
  authors: [{ name: 'EnCave' }],
  creator: 'EnCave',
  metadataBase: new URL('https://encave.ch'),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EnCave',
  },
  formatDetection: {
    telephone: true,
    date: true,
    address: true,
    email: true,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CH',
    alternateLocale: ['de_CH', 'en_CH'],
    url: 'https://encave.ch',
    siteName: 'EnCave',
    title: 'EnCave - Wine Experiences in Valais',
    description: 'Book unique wine tasting experiences directly with Swiss winemakers.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'EnCave - Wine Experiences',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EnCave - Wine Experiences in Valais',
    description: 'Book unique wine tasting experiences directly with Swiss winemakers.',
    images: ['/og-image.jpg'],
    creator: '@encave',
  },
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ab2046' },
    { media: '(prefers-color-scheme: dark)', color: '#ab2046' },
  ],
};

// Root layout is minimal - the actual layout is in [locale]/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
