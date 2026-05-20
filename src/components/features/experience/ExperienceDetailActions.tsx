'use client';

import { useState } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

export function ExperienceDetailActions() {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}${pathname}`;
    const title = document.title;

    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="hidden shrink-0 items-center gap-3 lg:flex">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-xs font-semibold text-ink-700 transition-colors hover:border-burgundy-200 hover:text-burgundy-700"
      >
        <Share2 className="h-3.5 w-3.5" />
        {copied ? 'Lien copié' : 'Partager'}
      </button>
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-xs font-semibold text-ink-700 transition-colors hover:border-burgundy-200 hover:text-burgundy-700"
      >
        <Heart className="h-3.5 w-3.5" />
        Enregistrer
      </Link>
    </div>
  );
}
