import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  FlaskConical,
  Footprints,
  Lock,
  MapPin,
  Utensils,
  Users,
  Wine,
} from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import { DesktopOnly } from '@/components/shared/DesktopOnly';
import { HomeSearchPanel } from '@/components/features/home/HomeSearchPanel';
import { HomeSearchShortcuts } from '@/components/features/home/HomeSearchShortcuts';
import { formatCHF } from '@/lib/utils/currency';
import type { ExperienceCardData } from '@/components/features/experience/ExperienceCard';
import type { MapWinery } from '@/components/features/map/types';

// Labels come from `home.editorial.categories.{type}` (title + description).
const categoryLinks = [
  ['TASTING', Wine],
  ['CELLAR_VISIT', Building2],
  ['VINEYARD_TOUR', Footprints],
  ['WORKSHOP', FlaskConical],
  ['FOOD_PAIRING', Utensils],
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
  label,
  priority = false,
  fallbackAlt,
}: {
  experience?: ExperienceCardData;
  className?: string;
  label?: string;
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
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      ) : (
        <ImageWithFallback
          src={HERO_BANNER_IMAGE}
          alt={fallbackAlt}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-burgundy-900/45 via-burgundy-600/20 to-gold-400/20" />
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,.52) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      {label && (
        <span className="absolute bottom-2 right-2 rounded bg-black/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white/80">
          {label}
        </span>
      )}
    </div>
  );
}

export async function HomeDesktopEditorial({
  experiences,
}: {
  experiences: ExperienceCardData[];
}) {
  // Server component on an ISR page: the page calls setRequestLocale first,
  // so this resolves statically (no headers() fallback).
  const t = await getTranslations('home.editorial');
  const cards = experiences.slice(0, 4);
  const mapWineries = buildMapWineries(experiences);

  return (
    <div className="bg-cream-50 text-ink-900">
      <section className="relative min-h-[600px] overflow-visible border-b border-stone-200 bg-ink-900">
        {/* L-200: optimized hero via next/image instead of a raw 4.8 MB CSS background */}
        <Image
          src={HERO_BANNER_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-burgundy-950/55 to-black/25" />

        <div className="relative z-30 flex min-h-[600px] max-w-[880px] flex-col justify-between px-14 py-[72px]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
              • {t('desktopEyebrow')}
            </div>
            <h1 className="mt-[18px] max-w-[560px] font-display text-[80px] font-light leading-[0.98] tracking-[-0.025em] text-white">
              {t.rich('desktopHeroTitle', {
                br: () => <br />,
                em: (chunks) => (
                  <em className="font-display-italic font-normal italic text-gold-400">
                    {chunks}
                  </em>
                ),
              })}
            </h1>
            <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.55] text-white/85">
              {t('desktopHeroSubtitle')}
            </p>
          </div>

          <div className="space-y-3.5">
            <HomeSearchPanel />
            <HomeSearchShortcuts tone="onDark" />
          </div>
        </div>
      </section>

      <section className="px-14 pb-4 pt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-700">
              • {t('sectionEyebrow')}
            </div>
            <h2 className="mt-2 font-display text-[34px] font-medium tracking-[-0.01em]">
              {t('sectionTitle')}
            </h2>
          </div>
          <Link
            href="/experiences"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-burgundy-700"
          >
            {t('viewExperiences')}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-[18px]">
          {cards.map((experience) => (
            <Link
              href={`/experiences/${experience.slug}`}
              key={experience.id}
              className="group overflow-hidden rounded-[14px] border border-stone-200 bg-white transition-all hover:-translate-y-0.5 hover:border-burgundy-200 hover:shadow-audit-card"
            >
              <div className="relative h-[200px]">
                {/* P-06: no priority — this tree is CSS-hidden on
                    mobile; its preload was competing with the LCP hero. */}
                <ExperienceVisual
                  experience={experience}
                  fallbackAlt={t('heroImageAlt')}
                />
                <span className="absolute left-3 top-3 rounded bg-white/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-burgundy-700">
                  {formatDuration(experience.duration)}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-[17px] font-semibold leading-[1.2]">
                  {experience.title}
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  {experience.winery.name} · {experience.winery.commune}
                </p>
                <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-stone-200 pt-2.5">
                  <span className="font-mono text-[11px] text-ink-500">
                    {formatCHF(experience.price)}
                  </span>
                  <span className="text-xs font-bold text-burgundy-700">
                    {t('book')} →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-[1.2fr_1fr] gap-8 px-14 py-12">
        <div className="relative h-[340px] overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
          <DesktopOnly>
            <DynamicMap
              wineries={mapWineries}
              className="h-full w-full rounded-[18px]"
            />
          </DesktopOnly>
          <div className="absolute left-[18px] top-[18px] rounded-lg bg-white/95 px-3.5 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-burgundy-700">
              • {t('region')}
            </div>
            <div className="mt-0.5 font-display text-lg font-semibold">
              {t('wineriesCount', { count: mapWineries.length })}
            </div>
          </div>
          <Link
            href="/experiences"
            className="absolute bottom-[18px] right-[18px] inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-900 px-[18px] text-[13px] font-semibold text-white"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {t('viewMap')}
          </Link>
        </div>

        <div>
          <h2 className="mb-3.5 font-display text-2xl font-semibold">
            {t('byMood')}
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {categoryLinks.map(([type, Icon]) => (
              <Link
                href={`/experiences?type=${type}`}
                key={type}
                prefetch={false}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 transition-colors hover:bg-cream-100"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-burgundy-50 text-burgundy-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-display text-[15px] font-semibold">
                    {t(`categories.${type}.title`)}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-500">
                    {t(`categories.${type}.description`)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-14 mt-8 flex items-center justify-between border-t border-stone-200 py-6 text-[13px] text-ink-500">
        <span className="inline-flex items-center gap-2">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {t('trust.cancellation')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {t('trust.payment')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {t('trust.duration')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {t('trust.capacity')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Wine className="h-3.5 w-3.5" aria-hidden="true" />
          {t('trust.region')}
        </span>
      </section>
    </div>
  );
}

function buildMapWineries(experiences: ExperienceCardData[]): MapWinery[] {
  const bySlug = new Map<string, MapWinery>();

  experiences.forEach((experience) => {
    const winery = experience.winery as ExperienceCardData['winery'] & {
      id?: string;
      coverPhoto?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };

    if (winery.latitude == null || winery.longitude == null) return;

    const existing = bySlug.get(winery.slug);
    bySlug.set(winery.slug, {
      id: winery.id ?? winery.slug,
      name: winery.name,
      slug: winery.slug,
      commune: winery.commune,
      coverPhoto: winery.coverPhoto ?? experience.coverPhoto ?? null,
      latitude: winery.latitude,
      longitude: winery.longitude,
      _count: { experiences: (existing?._count.experiences ?? 0) + 1 },
    });
  });

  return Array.from(bySlug.values());
}
