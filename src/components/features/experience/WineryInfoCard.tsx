import Image from 'next/image';
import Link from 'next/link';
import { MapPin, ArrowRight, Wine } from 'lucide-react';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';

interface WineryInfoCardProps {
  name: string;
  slug: string;
  commune: string;
  coverPhoto: string | null;
}

export function WineryInfoCard({
  name,
  slug,
  commune,
  coverPhoto,
}: WineryInfoCardProps) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-warm">
      {/* Cover Image */}
      <div className="relative h-32 w-full">
        {coverPhoto ? (
          <Image
            src={coverPhoto}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 33vw"
            placeholder="blur"
            blurDataURL={IMAGE_PLACEHOLDERS.card}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-burgundy-100 to-burgundy-200">
            <Wine className="h-12 w-12 text-burgundy-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          {name}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="h-4 w-4" />
          {commune}, Valais
        </p>

        <Link
          href={`/wineries/${slug}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-burgundy-600 transition-colors hover:text-burgundy-800"
        >
          View winery profile
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
