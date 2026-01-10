import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EnCave - Wine Experiences',
  description:
    'Book unique wine tasting experiences directly with Swiss winemakers',
};

// Root layout is minimal - the actual layout is in [locale]/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
