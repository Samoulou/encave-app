'use client';

import { Link } from '@/i18n/navigation';
import Image, { type StaticImageData } from 'next/image';
import { Wine, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AuthPageLayoutProps {
  children: React.ReactNode;
  imageUrl: string | StaticImageData;
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
    <div className="flex min-h-screen flex-col overflow-hidden md:flex-row">
      {/* Left Panel - Image (hidden on mobile, shown as header on mobile) */}
      <div className="relative hidden h-screen w-1/2 overflow-hidden bg-[#2a1a1f] lg:flex lg:w-[55%]">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          className="duration-[20s] object-cover transition-transform ease-out hover:scale-105"
          priority
          sizes="55vw"
          quality={75}
          placeholder="blur"
          blurDataURL={
            typeof imageUrl === 'string'
              ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzJhMWExZiIvPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjOTYyYTQ4IiBvcGFjaXR5PSIwLjMiLz48L3N2Zz4='
              : undefined
          }
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />

        {/* Hero content at bottom */}
        <div className="absolute bottom-12 left-12 z-10 max-w-md text-white">
          <div className="mb-4 flex items-center gap-2 opacity-80">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wide">
              {heroLocation}
            </span>
          </div>
          {heroTitle && (
            <h2 className="mb-2 font-display text-4xl font-bold leading-tight">
              {heroTitle}
            </h2>
          )}
          {heroSubtitle && (
            <p className="text-lg font-light opacity-80">{heroSubtitle}</p>
          )}
        </div>
      </div>

      {/* Mobile Header Image (shown only on small screens) */}
      <div className="relative h-48 w-full overflow-hidden lg:hidden">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          className="object-cover object-center"
          sizes="100vw"
          quality={60}
          {...(typeof imageUrl !== 'string' ? { placeholder: 'blur' } : {})}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#f8f6f6]" />
      </div>

      {/* Right Panel - Form */}
      <div className="relative flex min-h-screen w-full flex-col overflow-y-auto bg-[#f8f6f6] transition-colors duration-300 lg:h-screen lg:w-1/2 lg:w-[45%]">
        <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-24">
          <div className="mx-auto flex w-full max-w-[420px] flex-col gap-8">
            {/* Logo */}
            <Link
              href="/"
              className="group mb-2 inline-flex items-center gap-2"
            >
              <Wine className="h-8 w-8 text-primary" />
              <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                EnCave
              </span>
            </Link>

            {/* Form content */}
            {children}
          </div>

          {/* Footer legal links */}
          <div className="mt-12 flex justify-center gap-6 text-xs text-slate-400">
            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-slate-600"
            >
              {t('legal.privacyPolicy')}
            </Link>
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-slate-600"
            >
              {t('legal.termsOfService')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
