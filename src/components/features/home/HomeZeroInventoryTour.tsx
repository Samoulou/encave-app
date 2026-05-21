import { ArrowRight, CheckCircle2, Compass, Sparkles, Users, Wine } from 'lucide-react';
import { Link } from '@/i18n/navigation';

const steps = [
  {
    title: '1. Decouvrez les domaines valaisans',
    description:
      'Explorez des domaines authentiques et voyez ce qui rend chaque cave unique en quelques secondes.',
    icon: Compass,
  },
  {
    title: '2. Comprenez le parcours de reservation',
    description:
      'Selection du format, choix de la date et validation : tout le flux est pense pour etre simple et transparent.',
    icon: Wine,
  },
  {
    title: '3. Lancez-vous des maintenant',
    description:
      'Creez un compte pour etre informe des premieres experiences publiees et reserver en priorite.',
    icon: Users,
  },
] as const;

export function HomeZeroInventoryTour() {
  return (
    <section className="bg-cream-50 px-4 py-14 md:px-14 md:py-20">
      <div className="mx-auto max-w-5xl rounded-3xl border border-stone-200 bg-white p-6 shadow-audit-elevated md:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-burgundy-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Visite guidee EnCave
        </span>

        <h1 className="mt-4 font-display text-3xl leading-tight tracking-[-0.02em] text-ink-900 md:text-5xl">
          Aucun contenu live pour le moment.
          <br className="hidden md:block" />
          Decouvrez l&apos;application pas a pas.
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-ink-600 md:text-base">
          Nous preparons les premieres experiences. En attendant, lancez une visite
          guidee pour voir le scope produit et le parcours complet cote client.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {steps.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-2xl border border-stone-200 bg-cream-50 p-4 md:p-5"
            >
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-burgundy-700 shadow-sm">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="font-display text-lg font-semibold text-ink-900">{title}</h2>
              <p className="mt-1.5 text-sm text-ink-600">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-semibold text-white"
          >
            Creer mon compte
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/experiences"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-6 text-sm font-semibold text-ink-800"
          >
            Voir la page experiences
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            CTA active meme sans experiences publiees
          </span>
        </div>
      </div>
    </section>
  );
}
