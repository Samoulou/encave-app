'use client';

import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { Wine, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AuthPageLayoutProps {
  children: React.ReactNode;
  imageUrl: string;
  imageAlt: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroLocation?: string;
}

export function AuthPageLayout({
  children,
  imageUrl,
  imageAlt,
  heroTitle,
  heroSubtitle,
  heroLocation = 'Valais, Switzerland',
}: AuthPageLayoutProps) {
  const t = useTranslations('auth');

  return (
    <div className="flex min-h-screen flex-col md:flex-row overflow-hidden">
      {/* Left Panel - Image (hidden on mobile, shown as header on mobile) */}
      <div className="relative hidden lg:flex w-1/2 lg:w-[55%] h-screen bg-[#2a1a1f] overflow-hidden">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          className="object-cover transition-transform duration-[20s] ease-out hover:scale-105"
          priority
          sizes="55vw"
          quality={75}
          placeholder="blur"
          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzJhMWExZiIvPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjOTYyYTQ4IiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4="
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />

        {/* Hero content at bottom */}
        <div className="absolute bottom-12 left-12 max-w-md text-white z-10">
          <div className="flex items-center gap-2 mb-4 opacity-80">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">
              {heroLocation}
            </span>
          </div>
          {heroTitle && (
            <h2 className="text-4xl font-bold leading-tight mb-2 font-display">
              {heroTitle}
            </h2>
          )}
          {heroSubtitle && (
            <p className="text-lg opacity-80 font-light">{heroSubtitle}</p>
          )}
        </div>
      </div>

      {/* Mobile Header Image (shown only on small screens) */}
      <div
        className="lg:hidden h-48 w-full bg-cover bg-center relative"
        style={{ backgroundImage: `url("${imageUrl}")` }}
        role="img"
        aria-label={imageAlt}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#f8f6f6]" />
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 lg:w-[45%] min-h-screen lg:h-screen overflow-y-auto flex flex-col relative bg-[#f8f6f6] transition-colors duration-300">
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 py-12">
          <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2 group mb-2">
              <Wine className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-display">
                EnCave
              </span>
            </Link>

            {/* Form content */}
            {children}
          </div>

          {/* Footer legal links */}
          <div className="mt-12 flex justify-center gap-6 text-xs text-slate-400">
            <Link
              href="/privacy"
              className="hover:text-slate-600 transition-colors"
            >
              {t('legal.privacyPolicy')}
            </Link>
            <Link
              href="/terms"
              className="hover:text-slate-600 transition-colors"
            >
              {t('legal.termsOfService')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
