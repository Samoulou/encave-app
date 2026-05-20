import { Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export function HeaderSearchPill() {
  return (
    <Link
      href="/experiences?location=valais&date=weekend&guests=2"
      className="hidden h-11 min-w-0 flex-1 items-center rounded-full border border-stone-200 bg-cream-100 py-1 pl-[18px] pr-1.5 text-[13px] font-medium text-ink-700 transition-colors hover:border-burgundy-200 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:flex"
      aria-label="Rechercher des experiences dans le Valais ce week-end pour 2 personnes"
    >
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="ml-2.5 truncate">Tout le Valais</span>
      <span
        className="mx-3 h-[18px] w-px shrink-0 bg-stone-200"
        aria-hidden="true"
      />
      <span className="truncate">Ce week-end</span>
      <span
        className="mx-3 hidden h-[18px] w-px shrink-0 bg-stone-200 xl:block"
        aria-hidden="true"
      />
      <span className="hidden truncate text-ink-500 xl:inline">2 pers.</span>
      <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy-600 text-white transition-colors duration-150 hover:bg-burgundy-700">
        <Search className="h-[13px] w-[13px]" aria-hidden="true" />
      </span>
    </Link>
  );
}
