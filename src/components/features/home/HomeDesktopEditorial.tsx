import {
  ArrowRight,
  Check,
  Lock,
  MapPin,
  Search,
  Star,
  Wine,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

const availabilityCards = [
  {
    title: 'Degustation Heida',
    estate: 'Mounir, Visperterminen',
    availability: 'DEMAIN 17H30 · 4 PLACES',
    price: 'CHF 65',
    rating: '4.9',
    tone: 'from-burgundy-700 to-gold-400',
  },
  {
    title: 'Initiation Petite Arvine',
    estate: 'Provins, Sion',
    availability: 'SAM 14H · 8 PLACES',
    price: 'CHF 45',
    rating: '4.8',
    tone: 'from-[#2f472b] to-gold-400',
  },
  {
    title: 'Balade en altitude',
    estate: 'Maye, St-Pierre',
    availability: 'DIM 10H · 3 PLACES',
    price: 'CHF 80',
    rating: '4.9',
    tone: 'from-[#6a3822] to-burgundy-600',
  },
  {
    title: 'Verticale de Cornalin',
    estate: 'Cornulus, Saviese',
    availability: 'VEN 19H · 2 PLACES',
    price: 'CHF 95',
    rating: '5.0',
    tone: 'from-burgundy-900 to-burgundy-600',
  },
];

const categories = [
  ['Degustations', '62 experiences', '🍷'],
  ['Visites de cave', '38', '🏛'],
  ['Vendanges', '12 saisonnier', '🍇'],
  ['Repas vignerons', '24', '🥖'],
  ['Balades', '18', '🥾'],
  ['Ateliers', '14', '🔬'],
];

function DotVisual({
  className = '',
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`relative h-full overflow-hidden bg-gradient-to-br from-burgundy-900 via-burgundy-600 to-gold-400 ${className}`}
    >
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,.52) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(255,255,255,.24),transparent_44%)]" />
      {label && (
        <span className="absolute bottom-2 right-2 rounded bg-black/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white/70">
          {label}
        </span>
      )}
    </div>
  );
}

function SearchField({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex-1 px-[18px] py-3 ${last ? '' : 'border-r border-stone-200'}`}
    >
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}

export function HomeDesktopEditorial() {
  return (
    <div className="bg-cream-50 text-ink-900">
      <section className="grid min-h-[600px] grid-cols-[1.15fr_1fr] border-b border-stone-200">
        <div className="flex flex-col justify-between px-14 py-[72px]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
              • Saison 2026 · ouverture des vendanges
            </div>
            <h1 className="mt-[18px] max-w-[560px] font-display text-[80px] font-light leading-[0.98] tracking-[-0.025em] text-ink-900">
              Le Valais,
              <br />
              une <em className="font-normal italic text-burgundy-700">cave</em>
              <br />a ciel ouvert.
            </h1>
            <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.55] text-ink-700">
              142 domaines partenaires, des degustations privees aux vendanges
              en altitude. Reservez en deux minutes, payez a la cave.
            </p>
          </div>

          <form className="flex max-w-[620px] items-center rounded-[18px] bg-white p-1.5 shadow-[0_18px_50px_-12px_rgba(58,14,31,.25),0_0_0_1px_rgba(154,42,72,.08)]">
            <SearchField label="Ou" value="Tout le Valais" />
            <SearchField label="Quand" value="Ce week-end" />
            <SearchField label="Combien" value="2 personnes" last />
            <Link
              href="/experiences?location=valais&date=weekend&guests=2"
              className="ml-1.5 inline-flex h-[62px] items-center gap-2 rounded-[14px] bg-burgundy-600 px-7 text-sm font-semibold text-white transition-colors hover:bg-burgundy-700"
            >
              <Search className="h-[15px] w-[15px]" aria-hidden="true" />
              38 dispo
            </Link>
          </form>
        </div>

        <div className="relative">
          <DotVisual label="DOMAINE MOUNIR · Visperterminen 17:30" />
          <div className="absolute bottom-8 left-8 right-8 rounded-[14px] bg-ink-900/80 p-[18px] text-white shadow-audit-elevated backdrop-blur-xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-400">
              • En vedette · demain 17h30
            </div>
            <div className="mt-1.5 font-display text-[22px] font-semibold">
              Heida au coucher du soleil
            </div>
            <div className="mt-1 flex justify-between text-[13px] text-white/80">
              <span>Domaine Mounir · 4 places restantes</span>
              <span className="font-mono text-gold-400">CHF 65</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-14 pb-4 pt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-700">
              • 38 disponibles cette semaine
            </div>
            <h2 className="mt-2 font-display text-[34px] font-medium tracking-[-0.01em]">
              Reservez maintenant, partez ce week-end.
            </h2>
          </div>
          <Link
            href="/experiences"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-burgundy-700"
          >
            Voir la carte interactive
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-[18px]">
          {availabilityCards.map((card) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-[14px] border border-stone-200 bg-white"
            >
              <div
                className={`relative h-[200px] bg-gradient-to-br ${card.tone}`}
              >
                <DotVisual className="absolute inset-0" />
                <span className="absolute left-3 top-3 rounded bg-white/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-burgundy-700">
                  {card.availability}
                </span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink-900/85 px-2 py-1 text-[11px] font-bold text-white">
                  <Star
                    className="h-2.5 w-2.5 fill-current"
                    aria-hidden="true"
                  />
                  {card.rating}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-[17px] font-semibold leading-[1.2]">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-ink-500">{card.estate}</p>
                <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-stone-200 pt-2.5">
                  <span className="font-mono text-[11px] text-ink-500">
                    {card.price}
                  </span>
                  <Link
                    href="/experiences"
                    className="text-xs font-bold text-burgundy-700"
                  >
                    Reserver →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-[1.2fr_1fr] gap-8 px-14 py-12">
        <div className="relative h-[340px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#d8dfc6] to-[#a7b08b]">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(120deg,transparent_35%,rgba(122,138,58,.28)_35%,rgba(122,138,58,.28)_55%,transparent_55%)]" />
          {[
            ['18%', '42%', '65'],
            ['34%', '58%', '45'],
            ['48%', '34%', '80'],
            ['62%', '52%', '95'],
            ['74%', '40%', '55'],
            ['86%', '60%', '120'],
          ].map(([left, top, price]) => (
            <div
              key={`${left}-${top}`}
              className="absolute rounded-full border-2 border-burgundy-700 bg-white px-2.5 py-1 font-mono text-[11px] font-bold shadow-md"
              style={{ left, top, transform: 'translate(-50%, -50%)' }}
            >
              {price}
            </div>
          ))}
          <div className="absolute left-[18px] top-[18px] rounded-lg bg-white/95 px-3.5 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-burgundy-700">
              • Valais
            </div>
            <div className="mt-0.5 font-display text-lg font-semibold">
              142 domaines
            </div>
          </div>
          <Link
            href="/experiences"
            className="absolute bottom-[18px] right-[18px] inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-900 px-[18px] text-[13px] font-semibold text-white"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Explorer la carte
          </Link>
        </div>

        <div>
          <h2 className="mb-3.5 font-display text-2xl font-semibold">
            Par envie
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {categories.map(([title, count, icon]) => (
              <Link
                href="/experiences"
                key={title}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 transition-colors hover:bg-cream-100"
              >
                <span className="text-[22px] grayscale-[.3]">{icon}</span>
                <span>
                  <span className="block font-display text-[15px] font-semibold">
                    {title}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-500">
                    {count}
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
          Annulation gratuite 24h
        </span>
        <span className="inline-flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Paiement securise Stripe
        </span>
        <span className="inline-flex items-center gap-2">
          <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          4.8/5 · 1247 avis verifies
        </span>
        <span className="inline-flex items-center gap-2">
          <Wine className="h-3.5 w-3.5" aria-hidden="true" />
          Partenaire Valais Wallis Promotion
        </span>
      </section>
    </div>
  );
}
