'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Wine } from 'lucide-react';

interface AuthPageLayoutProps {
  children: React.ReactNode;
  imageUrl: string;
  imageAlt: string;
  quote: string;
  quoteAuthor?: string;
}

export function AuthPageLayout({
  children,
  imageUrl,
  imageAlt,
  quote,
  quoteAuthor = 'EnCave',
}: AuthPageLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Image (hidden on mobile) */}
      <div className="relative hidden w-1/2 md:block">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          className="object-cover"
          priority
        />
        {/* Burgundy gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-burgundy-950/70 to-burgundy-900/40" />

        {/* Quote at bottom */}
        <div className="absolute bottom-12 left-8 right-8 text-white">
          <blockquote className="font-display text-2xl font-medium leading-relaxed">
            &ldquo;{quote}&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-white/80">— {quoteAuthor}</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full flex-col justify-center bg-cream-50 px-6 py-12 md:w-1/2 md:px-12 lg:px-16">
        {/* Logo */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-burgundy-600 text-white transition-colors group-hover:bg-burgundy-700">
              <Wine className="h-5 w-5" />
            </div>
            <span className="font-display text-2xl font-semibold text-burgundy-800">
              EnCave
            </span>
          </Link>
        </div>

        {/* Form content */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
