import {
  Building2,
  CalendarCheck,
  Compass,
  GlassWater,
  Grape,
  Map,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import { FadeIn } from '@/components/shared/FadeIn';

const EXPERIENCE_TYPES = [
  {
    icon: GlassWater,
    title: 'Dégustations',
    description:
      'Découvrez les cépages valaisans avec des encaveurs passionnés',
  },
  {
    icon: Building2,
    title: 'Visites de cave',
    description:
      'Explorez les secrets de vinification dans des caves authentiques',
  },
  {
    icon: Grape,
    title: 'Ateliers',
    description: 'Apprenez l’art de la dégustation et de l’assemblage',
  },
  {
    icon: Map,
    title: 'Balades vigneronnes',
    description: 'Parcourez les vignobles en terrasses du Valais',
  },
  {
    icon: UtensilsCrossed,
    title: 'Accords mets & vins',
    description: 'Savourez des expériences gastronomiques uniques',
  },
];

const STEPS = [
  {
    icon: Compass,
    title: 'Explorez',
    description:
      'Parcourez la sélection d’expériences et trouvez celle qui vous inspire',
  },
  {
    icon: CalendarCheck,
    title: 'Réservez',
    description: 'Choisissez votre date et réservez en ligne en quelques clics',
  },
  {
    icon: Wine,
    title: 'Savourez',
    description: 'Rencontrez l’encaveur et vivez une expérience authentique',
  },
];

export function ComingSoonDiscover() {
  return (
    <div className="pattern-dots bg-cream-50">
      {/* Types d'expériences */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
            • Ce qui vous attend
          </div>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">
            Des expériences pour tous les goûts.
          </h2>
          <p className="mt-3 text-lg text-ink-500">
            Du novice curieux à l’œnophile averti, trouvez l’expérience qui vous
            correspond.
          </p>
        </div>

        <FadeIn>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {EXPERIENCE_TYPES.map((type) => (
              <div
                key={type.title}
                className="rounded-xl border border-stone-200 bg-white p-6 shadow-card transition-all duration-300 ease-premium hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
                  <type.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold text-ink-900">
                  {type.title}
                </h3>
                <p className="text-ink-500">{type.description}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto max-w-6xl px-6 pb-16 lg:pb-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-ink-900 md:text-4xl">
            Comment ça marche ?
          </h2>
          <p className="mt-3 text-lg text-ink-500">
            Réservez votre prochaine expérience en 3 étapes simples.
          </p>
        </div>

        <FadeIn>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="relative mx-auto mb-5 inline-flex">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-burgundy-100">
                    <step.icon
                      className="h-7 w-7 text-burgundy-600"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-burgundy-600 font-mono text-sm font-bold text-white">
                    {index + 1}
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold text-ink-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-ink-500">{step.description}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
