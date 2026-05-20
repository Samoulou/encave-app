import {
  Calendar,
  Globe,
  Heart,
  Menu,
  Search,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

const categories = [
  ['Degustation', '🍷', 'bg-[#f6e9ec]'],
  ['Visite cave', '🏛', 'bg-[#efe7da]'],
  ['Vendanges', '🍇', 'bg-[#e7ecdb]'],
  ['Accords', '🧀', 'bg-[#f5e9d6]'],
  ['Vigne', '🌿', 'bg-[#dde6cf]'],
];

const nearby = [
  {
    estate: 'Cornulus',
    title: '5 crus',
    price: 'CHF 35',
    tone: 'from-[#3a4424] to-[#7a8a3a]',
  },
  {
    estate: 'La Madeleine',
    title: 'Cepages',
    price: 'CHF 48',
    tone: 'from-[#3a2438] to-[#8a4a72]',
  },
  {
    estate: 'Cave du Tunnel',
    title: 'Accords',
    price: 'CHF 65',
    tone: 'from-[#5a3328] to-[#a45a3a]',
  },
];

function DotVisual({
  className = '',
  tone = 'from-[#2a0e16] to-burgundy-700',
}: {
  className?: string;
  tone?: string;
}) {
  return (
    <div
      className={`relative h-full overflow-hidden bg-gradient-to-br ${tone} ${className}`}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,.5) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_24%,rgba(255,255,255,.24),transparent_46%)]" />
    </div>
  );
}

function PriceTag({ amount, size = 20 }: { amount: string; size?: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className="font-display font-bold tracking-[-0.01em] text-ink-900"
        style={{ fontSize: size }}
      >
        {amount}
      </span>
      <span className="font-mono text-[11px] tracking-[0.02em] text-ink-500">
        / pers.
      </span>
    </div>
  );
}

export function HomeMobileEditorial() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-cream-50 pb-6 font-sans text-ink-900">
      <section className="relative h-[460px]">
        <DotVisual />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/65" />

        <div className="absolute left-3.5 right-3.5 top-3 flex items-center justify-between text-white">
          <span className="font-display text-[22px] font-bold tracking-[-0.01em]">
            EnCave
          </span>
          <div className="flex gap-2">
            <button
              className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/20 text-white backdrop-blur-md"
              aria-label="Changer de langue"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/20 text-white backdrop-blur-md"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-[108px] left-[18px] right-[18px] text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/45 bg-gold-400/20 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400">
            <Sparkles className="h-[11px] w-[11px]" aria-hidden="true" />
            Valais · 142 domaines verifies
          </span>
          <h1 className="mt-3 font-display text-[38px] font-normal leading-[1.04] tracking-[-0.015em]">
            Le vin,{' '}
            <em className="font-normal italic text-gold-400">
              chez ceux qui le font
            </em>
            .
          </h1>
          <p className="mt-1.5 max-w-[280px] text-sm text-white/85">
            Degustations, ateliers et vendanges reserves directement avec le
            vigneron.
          </p>
        </div>

        <div className="absolute -bottom-[26px] left-3.5 right-3.5 grid grid-cols-2 overflow-hidden rounded-[18px] bg-white shadow-[0_12px_30px_rgba(60,15,25,.18),0_2px_6px_rgba(60,15,25,.06)]">
          <div className="border-r border-[#efe4e6] px-3.5 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500">
              Ou
            </div>
            <div className="mt-0.5 text-sm font-semibold text-ink-900">
              Tout le Valais
            </div>
          </div>
          <div className="px-3.5 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500">
              Quand
            </div>
            <div className="mt-0.5 text-sm font-semibold text-ink-900">
              Ce week-end
            </div>
          </div>
          <Link
            href="/experiences?location=valais&date=weekend"
            className="col-span-2 inline-flex h-12 items-center justify-center gap-2 border-t border-[#efe4e6] bg-burgundy-600 text-sm font-bold text-white"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Explorer 142 experiences
          </Link>
        </div>
      </section>

      <section className="pt-10">
        <div className="mb-2.5 flex items-baseline justify-between px-3.5">
          <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
            Par envie
          </h2>
          <Link
            href="/experiences"
            className="text-xs font-semibold text-burgundy-600"
          >
            Voir tout →
          </Link>
        </div>
        <div className="flex gap-2.5 overflow-x-auto px-3.5 pb-1">
          {categories.map(([name, icon, color]) => (
            <Link
              href="/experiences"
              key={name}
              className={`flex min-w-24 flex-col gap-2 rounded-[14px] border border-black/5 p-3 ${color}`}
            >
              <span className="text-[22px]">{icon}</span>
              <span className="text-xs font-semibold text-ink-700">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-3.5 py-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
          A l&apos;affiche cette semaine
        </h2>
        <p className="mb-3.5 mt-1 text-[13px] text-ink-500">
          Choisies par notre equipe oeno.
        </p>

        <article className="overflow-hidden rounded-[18px] bg-white shadow-audit-elevated">
          <div className="relative aspect-[4/3]">
            <DotVisual tone="from-[#5a1e2c] to-[#a83a58]" />
            <button
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-burgundy-700"
              aria-label="Ajouter aux favoris"
            >
              <Heart className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700">
              • Dispo demain
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="m-0 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-burgundy-600">
                  Domaine de Provins · Sion
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold leading-[1.2] tracking-[-0.01em]">
                  Heida & Petite Arvine au coucher
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-900">
                <Star
                  className="h-[13px] w-[13px] fill-current"
                  aria-hidden="true"
                />
                4.9
                <span className="text-[11px] font-normal text-ink-500">
                  (38)
                </span>
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {['1h 30', '8 max', 'des 14h', 'francais'].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-cream-200 px-2.5 py-1 font-mono text-[11px] text-ink-700"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-3.5 flex items-center justify-between">
              <PriceTag amount="CHF 45" />
              <Link
                href="/experiences"
                className="inline-flex h-9 items-center rounded-full bg-ink-900 px-3.5 text-[13px] font-semibold text-white"
              >
                Reserver →
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="pb-6">
        <h2 className="mx-3.5 mb-3 font-display text-xl font-semibold tracking-[-0.01em]">
          Pres de vous
        </h2>
        <div className="flex gap-3 overflow-x-auto px-3.5 pb-1.5">
          {nearby.map((item) => (
            <article
              key={item.estate}
              className="min-w-[188px] overflow-hidden rounded-[14px] bg-white shadow-audit-card"
            >
              <div className="aspect-[4/3]">
                <DotVisual tone={item.tone} />
              </div>
              <div className="p-3">
                <p className="m-0 font-mono text-[11px] font-semibold text-burgundy-600">
                  {item.estate}
                </p>
                <h3 className="mt-0.5 font-display text-[15px] font-semibold">
                  {item.title}
                </h3>
                <div className="mt-1.5 flex items-center justify-between">
                  <PriceTag amount={item.price} size={14} />
                  <span className="text-[11px] text-ink-500">·· 4.8</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <nav className="sticky bottom-0 grid h-16 grid-cols-4 border-t border-stone-200/60 bg-cream-50/95 backdrop-blur-xl">
        {[
          [Search, 'Explorer', true],
          [Heart, 'Favoris', false],
          [Calendar, 'Reservations', false],
          [Users, 'Compte', false],
        ].map(([Icon, label, active]) => {
          const NavIcon = Icon as typeof Search;
          return (
            <Link
              href="/experiences"
              key={label as string}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                active ? 'text-burgundy-700' : 'text-ink-500'
              }`}
            >
              <NavIcon className="h-4 w-4" aria-hidden="true" />
              {label as string}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
