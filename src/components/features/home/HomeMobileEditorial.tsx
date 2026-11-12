import {
  Building2,
  Calendar,
  Clock,
  FlaskConical,
  Footprints,
  Heart,
  Search,
  Sparkles,
  Utensils,
  Users,
  Wine,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { HomeSearchPanel } from '@/components/features/home/HomeSearchPanel';
import { HomeSearchShortcuts } from '@/components/features/home/HomeSearchShortcuts';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { MobileNav } from '@/components/layout/MobileNav';
import { formatCHF } from '@/lib/utils/currency';
import type { ExperienceCardData } from '@/components/features/experience/ExperienceCard';

// Labels come from `home.editorial.categories.{type}.short`.
const categoryLinks = [
  ['TASTING', Wine, 'bg-[#f6e9ec]'],
  ['CELLAR_VISIT', Building2, 'bg-[#efe7da]'],
  ['VINEYARD_TOUR', Footprints, 'bg-[#e7ecdb]'],
  ['WORKSHOP', FlaskConical, 'bg-[#dde6cf]'],
  ['FOOD_PAIRING', Utensils, 'bg-[#f5e9d6]'],
] as const;

// Bottom tab bar: translation key (`home.editorial.nav.*`), icon, target.
const bottomNav = [
  ['explore', Search, '/experiences', true],
  ['favorites', Heart, '/login?callbackUrl=/dashboard/profile', false],
  ['bookings', Calendar, '/dashboard/my-bookings', false],
  ['account', Users, '/dashboard/profile', false],
] as const;

const HERO_BANNER_IMAGE = '/images/herobanner-image-v2.jpg';

function formatDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining ? `${hours}h ${remaining}` : `${hours}h`;
  }

  return `${minutes} min`;
}

function ExperienceVisual({
  experience,
  className = '',
  priority = false,
  fallbackAlt,
}: {
  experience?: ExperienceCardData;
  className?: string;
  priority?: boolean;
  /** Alt text of the stock hero used when the experience has no cover. */
  fallbackAlt: string;
}) {
  return (
    <div
      className={`relative h-full overflow-hidden bg-cream-200 ${className}`}
    >
      {experience?.coverPhoto ? (
        <ImageWithFallback
          src={experience.coverPhoto}
          alt={experience.title}
          fill
          priority={priority}
          className="object-cover"
          sizes="100vw"
        />
      ) : (
        <ImageWithFallback
          src="/images/herobanner-image-v2.jpg"
          alt={fallbackAlt}
          fill
          priority={priority}
          className="object-cover"
          sizes="100vw"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-burgundy-900/15 to-black/65" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,.5) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />
    </div>
  );
}

function HeroBannerVisual({ alt }: { alt: string }) {
  return (
    <div className="relative h-full overflow-hidden bg-ink-900">
      <ImageWithFallback
        src={HERO_BANNER_IMAGE}
        alt={alt}
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-burgundy-950/25 to-black/70" />
    </div>
  );
}

function PriceTag({
  amount,
  unit,
  size = 20,
}: {
  amount: string;
  /** Translated "/ person" suffix. */
  unit: string;
  size?: number;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className="font-display font-bold tracking-[-0.01em] text-ink-900"
        style={{ fontSize: size }}
      >
        {amount}
      </span>
      <span className="font-mono text-[11px] tracking-[0.02em] text-ink-500">
        {unit}
      </span>
    </div>
  );
}

export async function HomeMobileEditorial({
  experiences,
}: {
  experiences: ExperienceCardData[];
}) {
  // Server component on an ISR page: the page calls setRequestLocale first,
  // so this resolves statically (no headers() fallback).
  const t = await getTranslations('home.editorial');
  const featured = experiences[0];
  const nearby = experiences.slice(1, 4);

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream-50 pb-6 font-sans text-ink-900">
      <section className="relative h-[460px]">
        <HeroBannerVisual alt={t('heroImageAlt')} />

        <div className="absolute left-3.5 right-3.5 top-3 text-white">
          <span className="block text-center font-display text-[22px] font-bold tracking-[-0.01em]">
            EnCave
          </span>
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <div className="rounded-full border border-white/25 bg-white/20 text-white backdrop-blur-md">
              <LocaleSwitcher triggerClassName="text-gold-100 hover:text-white" />
            </div>
            <MobileNav triggerClassName="h-9 w-9 rounded-full border border-white/25 bg-white/20 text-white backdrop-blur-md" />
          </div>
        </div>

        <div className="absolute left-[18px] right-[18px] top-1/2 -translate-y-1/2 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/45 bg-gold-400/20 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400">
            <Sparkles className="h-[11px] w-[11px]" aria-hidden="true" />
            {t('mobileBadge')}
          </span>
          <h1 className="mt-3 font-display text-[38px] font-normal leading-[1.04] tracking-[-0.015em]">
            {t.rich('mobileHeroTitle', {
              em: (chunks) => (
                <em className="font-display-italic font-normal italic text-gold-400">
                  {chunks}
                </em>
              ),
            })}
          </h1>
          <p className="mt-1.5 max-w-[280px] text-sm text-white/85">
            {t('mobileHeroSubtitle')}
          </p>
        </div>

        {/* Overhang grew by the "Quand" row (P-05 / L-110): keep the
            panel top anchored where it was, extend it downwards. */}
        <div className="absolute -bottom-[154px] left-3.5 right-3.5 z-20">
          <HomeSearchPanel variant="mobile" />
        </div>
      </section>

      <section className="pt-[176px]">
        {/* Shortcut chips under the overhanging search panel (L-111) */}
        <HomeSearchShortcuts
          tone="onLight"
          className="mb-6 justify-center px-3.5"
        />
        <div className="mb-2.5 flex items-baseline justify-between px-3.5">
          <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
            {t('byMood')}
          </h2>
          <Link
            href="/experiences"
            className="text-xs font-semibold text-burgundy-600"
          >
            {t('viewAll')} →
          </Link>
        </div>
        <div className="flex gap-2.5 overflow-x-auto px-3.5 pb-1">
          {categoryLinks.map(([type, Icon, color]) => (
            <Link
              href={`/experiences?type=${type}`}
              key={type}
              prefetch={false}
              className={`flex min-w-24 flex-col gap-2 rounded-[14px] border border-black/5 p-3 ${color}`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-burgundy-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-ink-700">
                {t(`categories.${type}.short`)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {featured && (
        <section className="px-3.5 py-6">
          <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
            {t('featuredTitle')}
          </h2>
          <p className="mb-3.5 mt-1 text-[13px] text-ink-500">
            {t('featuredSubtitle')}
          </p>

          <article className="overflow-hidden rounded-[18px] bg-white shadow-audit-elevated">
            <div className="relative aspect-[4/3]">
              {/* P-06: no priority — below the fold, and CSS-hidden on
                  desktop where its preload competed with the LCP hero. */}
              <ExperienceVisual
                experience={featured}
                fallbackAlt={t('heroImageAlt')}
              />
              <button
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-burgundy-700"
                aria-label={t('addToFavorites')}
              >
                <Heart className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700">
                {featured.winery.commune}
              </span>
            </div>
            <div className="p-4">
              <p className="m-0 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-burgundy-600">
                {featured.winery.name} · {featured.winery.commune}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold leading-[1.2] tracking-[-0.01em]">
                {featured.title}
              </h3>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-cream-200 px-2.5 py-1 font-mono text-[11px] text-ink-700">
                  <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  {formatDuration(featured.duration)}
                </span>
                {featured.maxCapacity != null && (
                  <span className="rounded-full bg-cream-200 px-2.5 py-1 font-mono text-[11px] text-ink-700">
                    <Users className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    {t('maxCapacity', { count: featured.maxCapacity })}
                  </span>
                )}
              </div>

              <div className="mt-3.5 flex items-center justify-between">
                <PriceTag
                  amount={formatCHF(featured.price)}
                  unit={t('perPersonShort')}
                />
                <Link
                  href={`/experiences/${featured.slug}`}
                  className="inline-flex h-9 items-center rounded-full bg-ink-900 px-3.5 text-[13px] font-semibold text-white"
                >
                  {t('book')} →
                </Link>
              </div>
            </div>
          </article>
        </section>
      )}

      {nearby.length > 0 && (
        <section className="pb-6">
          <h2 className="mx-3.5 mb-3 font-display text-xl font-semibold tracking-[-0.01em]">
            {t('nearYou')}
          </h2>
          <div className="flex gap-3 overflow-x-auto px-3.5 pb-1.5">
            {nearby.map((experience) => (
              <Link
                href={`/experiences/${experience.slug}`}
                key={experience.id}
                className="min-w-[188px] overflow-hidden rounded-[14px] bg-white shadow-audit-card"
              >
                <div className="aspect-[4/3]">
                  <ExperienceVisual
                    experience={experience}
                    fallbackAlt={t('heroImageAlt')}
                  />
                </div>
                <div className="p-3">
                  <p className="m-0 font-mono text-[11px] font-semibold text-burgundy-600">
                    {experience.winery.name}
                  </p>
                  <h3 className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold">
                    {experience.title}
                  </h3>
                  <div className="mt-1.5 flex items-center justify-between">
                    <PriceTag
                      amount={formatCHF(experience.price)}
                      unit={t('perPersonShort')}
                      size={14}
                    />
                    <span className="text-[11px] text-ink-500">
                      {experience.winery.commune}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="sticky bottom-0 grid h-16 grid-cols-4 border-t border-stone-200/60 bg-cream-50/95 backdrop-blur-xl">
        {bottomNav.map(([key, NavIcon, href, active]) => (
          <Link
            href={href}
            key={key}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
              active ? 'text-burgundy-700' : 'text-ink-500'
            }`}
          >
            <NavIcon className="h-4 w-4" aria-hidden="true" />
            {t(`nav.${key}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
