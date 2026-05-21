'use client';

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Search,
  Sparkles,
  WalletCards,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';

type Step = {
  id: 'home' | 'dashboard' | 'experiences';
  title: string;
  subtitle: string;
  icon: LucideIcon;
  panel: React.ReactNode;
};

function MockTopbar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
      <p className="font-display text-lg font-semibold text-ink-900">{title}</p>
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <span className="rounded-full bg-cream-100 px-2 py-1">FR</span>
        <span className="rounded-full bg-cream-100 px-2 py-1">Compte</span>
      </div>
    </div>
  );
}

function HomePagePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-cream-50">
      <MockTopbar title="Homepage EnCave" />
      <div className="grid gap-4 p-4 md:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl bg-gradient-to-br from-ink-900 via-burgundy-900 to-gold-700 p-5 text-white">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold-300">Hero</p>
          <h3 className="mt-2 font-display text-2xl">Le vin, chez ceux qui le font.</h3>
          <p className="mt-2 text-sm text-white/85">Recherche par commune, type et date.</p>
          <div className="mt-4 rounded-lg bg-white/95 p-3 text-xs text-ink-700">
            Barre recherche: &quot;Sion&quot; · &quot;Degustation&quot; · &quot;Ce week-end&quot;
          </div>
        </section>
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-burgundy-700">Par envie</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {['Degustation', 'Visite cave', 'Atelier', 'Accords'].map((item) => (
              <span key={item} className="rounded-lg bg-cream-100 px-2 py-2 text-center">{item}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-cream-50">
      <MockTopbar title="Dashboard encaveur" />
      <div className="grid gap-4 p-4 md:grid-cols-[230px_1fr]">
        <aside className="rounded-xl border border-stone-200 bg-white p-3 text-sm">
          {['Vue globale', 'Experiences', 'Calendrier', 'Revenus', 'Bookings'].map((item) => (
            <p key={item} className="mb-2 rounded-md px-2 py-1 last:mb-0 hover:bg-cream-100">{item}</p>
          ))}
        </aside>
        <section>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Depenses', 'CHF 1’240'],
              ['Reservations', '18'],
              ['CA', 'CHF 3’920'],
            ].map(([label, value]) => (
              <article key={label} className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-500">{label}</p>
                <p className="mt-1 font-display text-2xl text-ink-900">{value}</p>
              </article>
            ))}
          </div>
          <article className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-burgundy-700">Reservations 30 jours</p>
            <div className="mt-3 flex h-24 items-end gap-2">
              {[35, 52, 44, 61, 48, 58, 67].map((h) => (
                <div key={h} className="w-full rounded-t bg-burgundy-600/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function ExperiencesListPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-cream-50">
      <MockTopbar title="Liste experiences client" />
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-2 py-1"><Search className="h-3 w-3" />Sion</span>
          <span className="rounded-full bg-cream-100 px-2 py-1">Degustation</span>
          <span className="rounded-full bg-cream-100 px-2 py-1">CHF 40 - 90</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Degustation privee 5 crus', 'Domaine du Soleil', 'CHF 75'],
            ['Visite cave historique', 'Cave des Coteaux', 'CHF 45'],
            ['Atelier accords locaux', 'Clos des Alpes', 'CHF 68'],
          ].map(([title, winery, price]) => (
            <article key={title} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="h-24 bg-gradient-to-r from-burgundy-700 to-gold-700" />
              <div className="p-3">
                <p className="font-display text-base font-semibold text-ink-900">{title}</p>
                <p className="text-xs text-ink-500">{winery}</p>
                <p className="mt-2 text-xs font-semibold text-burgundy-700">{price} / pers.</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeZeroInventoryTour({ isSimulation = false }: { isSimulation?: boolean }) {
  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'home',
        title: 'Exemple homepage complete',
        subtitle: 'Vue complete de la page d\'accueil avec hero, recherche et categories.',
        icon: Compass,
        panel: <HomePagePreview />,
      },
      {
        id: 'dashboard',
        title: 'Exemple dashboard encaveur complet',
        subtitle: 'Menu, KPI business, tendance de reservation et pilotage quotidien.',
        icon: WalletCards,
        panel: <DashboardPreview />,
      },
      {
        id: 'experiences',
        title: 'Exemple liste experiences client complete',
        subtitle: 'Filtres + cartes experiences pour un parcours de recherche realiste.',
        icon: Wine,
        panel: <ExperiencesListPreview />,
      },
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;

  return (
    <section className="bg-cream-50 px-4 py-14 md:px-14 md:py-20">
      <div className="mx-auto max-w-6xl rounded-3xl border border-stone-200 bg-white p-6 shadow-audit-elevated md:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-burgundy-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Visite guidee EnCave
          </span>
          {isSimulation && <Link href="/" className="inline-flex items-center rounded-full border border-stone-300 bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-700">Quitter la simulation</Link>}
        </div>
        <h1 className="mt-4 font-display text-3xl leading-tight tracking-[-0.02em] text-ink-900 md:text-5xl">Demonstration complete en 3 pages.</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-600 md:text-base">Au lieu d&apos;un simple apercu, chaque etape simule une page entiere du produit.</p>

        <div className="mt-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setIndex(i)} className={`h-2.5 rounded-full transition-all ${i === index ? 'w-10 bg-burgundy-700' : 'w-6 bg-stone-300'}`} aria-label={`Aller a l'etape ${i + 1}`} />
          ))}
          <span className="ml-2 font-mono text-xs text-ink-500">{index + 1} / {steps.length}</span>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-cream-50 p-4 md:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-burgundy-700 shadow-sm"><step.icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-600">{step.subtitle}</p>
            </div>
          </div>
          {step.panel}
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <button type="button" onClick={() => setIndex((p) => Math.max(p - 1, 0))} disabled={index === 0} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-ink-800 disabled:opacity-50"><ChevronLeft className="h-4 w-4" />Precedent</button>
            <button type="button" onClick={() => setIndex((p) => Math.min(p + 1, steps.length - 1))} disabled={index === steps.length - 1} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-ink-800 disabled:opacity-50">Suivant<ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Link href="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-semibold text-white">Creer mon compte<ArrowRight className="h-4 w-4" /></Link>
            <Link href={isSimulation ? '/' : '/?simulateTour=1'} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold text-ink-800"><Compass className="h-4 w-4" />{isSimulation ? 'Retour accueil reel' : 'Simuler la visite guidee'}</Link>
            <Link href="/experiences" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold text-ink-800"><MapPin className="h-4 w-4" />Voir les experiences</Link>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-500"><CheckCircle2 className="h-3.5 w-3.5" />Pages de demonstration, contenu exemple.</p>
      </div>
    </section>
  );
}
