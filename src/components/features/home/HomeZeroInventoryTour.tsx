'use client';

import { ArrowRight, Building2, CheckCircle2, ChevronLeft, ChevronRight, Compass, MapPin, Sparkles, WalletCards, Wine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';

type Step = {
  id: 'dashboard' | 'experience' | 'encaveurs';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  panel: React.ReactNode;
};

function DashboardPreview() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-cream-50 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-500">Depenses</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">CHF 1’240</p>
          <p className="text-xs text-emerald-700">-8% vs mois precedent</p>
        </div>
        <div className="rounded-xl bg-cream-50 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-500">Reservations</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">18</p>
          <p className="text-xs text-ink-500">sur 30 jours</p>
        </div>
        <div className="rounded-xl bg-cream-50 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-500">Panier moyen</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900">CHF 68</p>
          <p className="text-xs text-ink-500">par reservation</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-stone-200 bg-gradient-to-r from-burgundy-50 to-gold-50 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-burgundy-700">Suivi mensuel</p>
        <div className="mt-3 flex h-20 items-end gap-2">
          {[35, 52, 44, 61, 48, 58, 67].map((h) => (
            <div key={h} className="w-full rounded-t bg-burgundy-600/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExperiencePreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="h-32 bg-gradient-to-r from-ink-900 via-burgundy-800 to-gold-700" />
      <div className="p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-burgundy-700">Domaine du Soleil · Sion</p>
        <h3 className="mt-1 font-display text-xl font-semibold text-ink-900">Degustation privee 5 crus</h3>
        <p className="mt-2 text-sm text-ink-600">Decouverte guidee avec accords locaux, visite cave et echange avec le vigneron.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-cream-100 px-2.5 py-1">2h30</span>
          <span className="rounded-full bg-cream-100 px-2.5 py-1">max 10 pers.</span>
          <span className="rounded-full bg-cream-100 px-2.5 py-1">CHF 75 / pers.</span>
        </div>
        <div className="mt-3 rounded-lg border border-dashed border-stone-300 p-2.5 text-xs text-ink-600">
          Prochains creneaux: Sam 14:00 · Dim 11:00 · Mer 18:30
        </div>
      </div>
    </div>
  );
}

function EncaveursPreview() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-burgundy-100 px-2.5 py-1 text-burgundy-700">Valais central</span>
        <span className="rounded-full bg-cream-100 px-2.5 py-1">Degustation</span>
        <span className="rounded-full bg-cream-100 px-2.5 py-1">CHF 40 - 90</span>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        {[
          ['Cave des Coteaux', 'Sierre', '4 experiences'],
          ['Domaine Lune Rouge', 'Martigny', '3 experiences'],
          ['Clos des Alpes', 'Sion', '6 experiences'],
          ['Maison du Cep', 'Fully', '2 experiences'],
        ].map(([name, city, count]) => (
          <article key={name} className="rounded-xl border border-stone-200 p-3">
            <p className="font-display text-base font-semibold text-ink-900">{name}</p>
            <p className="text-xs text-ink-500">{city}</p>
            <p className="mt-1 text-xs font-semibold text-burgundy-700">{count}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function HomeZeroInventoryTour({ isSimulation = false }: { isSimulation?: boolean }) {
  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'dashboard',
        title: 'Exemple dashboard · suivi des depenses',
        subtitle: 'Visualisez les indicateurs clefs et la tendance de reservation en un coup d\'oeil.',
        icon: WalletCards,
        panel: <DashboardPreview />,
      },
      {
        id: 'experience',
        title: 'Exemple detail d\'experience',
        subtitle: 'Consultez la fiche complete avant de reserver : prix, duree, capacite et creneaux.',
        icon: Wine,
        panel: <ExperiencePreview />,
      },
      {
        id: 'encaveurs',
        title: 'Exemple page encaveurs',
        subtitle: 'Parcourez les domaines, filtrez selon vos envies et trouvez la bonne adresse.',
        icon: Building2,
        panel: <EncaveursPreview />,
      },
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return (
    <section className="bg-cream-50 px-4 py-14 md:px-14 md:py-20">
      <div className="mx-auto max-w-5xl rounded-3xl border border-stone-200 bg-white p-6 shadow-audit-elevated md:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-burgundy-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Visite guidee EnCave
          </span>
          {isSimulation && (
            <Link href="/" className="inline-flex items-center rounded-full border border-stone-300 bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-700">
              Quitter la simulation
            </Link>
          )}
        </div>

        <h1 className="mt-4 font-display text-3xl leading-tight tracking-[-0.02em] text-ink-900 md:text-5xl">
          Decouvrez le produit en 3 ecrans.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-600 md:text-base">
          Si aucune experience n&apos;est encore publiee, cette visite presente un exemple realiste de ce que propose EnCave.
        </p>

        <div className="mt-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all ${i === index ? 'w-10 bg-burgundy-700' : 'w-6 bg-stone-300'}`}
              aria-label={`Aller a l'etape ${i + 1}`}
            />
          ))}
          <span className="ml-2 font-mono text-xs text-ink-500">{index + 1} / {steps.length}</span>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-cream-50 p-4 md:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-burgundy-700 shadow-sm">
              <step.icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-600">{step.subtitle}</p>
            </div>
          </div>
          {step.panel}
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
              disabled={isFirst}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Precedent
            </button>
            <button
              type="button"
              onClick={() => setIndex((prev) => Math.min(prev + 1, steps.length - 1))}
              disabled={isLast}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Link href="/register" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-semibold text-white">
              Creer mon compte
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={isSimulation ? '/' : '/?simulateTour=1'} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold text-ink-800">
              <Compass className="h-4 w-4" aria-hidden="true" />
              {isSimulation ? 'Retour accueil reel' : 'Simuler la visite guidee'}
            </Link>
            <Link href="/experiences" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold text-ink-800">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Voir les experiences
            </Link>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-500">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Apercu demonstratif, non contractuel (contenu exemple).
        </p>
      </div>
    </section>
  );
}
