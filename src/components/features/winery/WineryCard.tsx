import Image from 'next/image';
import Link from 'next/link';
import { Wine, MapPin, ArrowRight } from 'lucide-react';
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';

interface WineryCardProps {
  winery: {
    slug: string;
    name: string;
    commune: string;
    description: string;
    coverPhoto: string | null;
    status?: string;
  };
}

export function WineryCard({ winery }: WineryCardProps) {
  const isVerified = winery.status === 'VERIFIED';

  return (
    <Link href={`/wineries/${winery.slug}`} className="group block h-full" data-testid="winery-card">
      <article className="h-full overflow-hidden rounded-xl border border-stone-200/60 bg-white shadow-[0_1px_3px_rgba(122,27,59,0.04),0_4px_12px_rgba(122,27,59,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(122,27,59,0.12)]">
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {winery.coverPhoto ? (
            <>
              <Image
                src={winery.coverPhoto}
                alt={winery.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                placeholder="blur"
                blurDataURL={IMAGE_PLACEHOLDERS.card}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-burgundy-100 to-burgundy-200">
              <Wine className="h-16 w-16 text-burgundy-300" />
            </div>
          )}

          {/* Verified Badge */}
          {isVerified && (
            <div className="absolute right-3 top-3">
              <VerifiedBadge size="sm" showLabel={false} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 transition-colors group-hover:text-burgundy-700">
            {winery.name}
          </h3>

          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            {winery.commune}, Valais
          </p>

          <p className="mt-3 line-clamp-2 text-sm text-slate-600">
            {winery.description}
          </p>

          {/* CTA */}
          <div className="mt-4 flex items-center text-sm font-medium text-burgundy-600 transition-colors group-hover:text-burgundy-700">
            Discover
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </article>
    </Link>
  );
}
