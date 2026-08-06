import type { Metadata } from 'next';
import {
  Nunito,
  Averia_Serif_Libre,
  Mukta_Vaani,
  JetBrains_Mono,
} from 'next/font/google';
import '../globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const averia = Averia_Serif_Libre({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

// Accent italique des titres (hero <em>) — même pattern L-206 que [locale]/layout.
const averiaItalic = Averia_Serif_Libre({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-display-italic',
  display: 'swap',
});

const mukta = Mukta_Vaani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title:
    'EnCave — Les expériences des caves valaisannes | Lancement novembre 2026',
  description:
    'EnCave ouvre en novembre 2026 : réservez dégustations, visites de cave et ateliers directement auprès des encaveurs du Valais. Encaveurs : découvrez l’offre fondateur (−50 % à vie pour les 10 premières caves).',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'EnCave — Lancement novembre 2026',
    description:
      'Réservez dégustations, visites de cave et ateliers directement auprès des encaveurs du Valais.',
    images: ['/images/herobanner-image-v2.jpg'],
  },
};

export default function ComingSoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body
        className={`${nunito.variable} ${averia.variable} ${averiaItalic.variable} ${mukta.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
