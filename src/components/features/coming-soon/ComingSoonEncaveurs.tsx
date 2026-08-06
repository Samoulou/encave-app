import {
  BarChart3,
  CalendarClock,
  Check,
  CreditCard,
  Globe,
  Share2,
  Users,
  Wine,
} from 'lucide-react';
import { FadeIn } from '@/components/shared/FadeIn';
import { NewsletterSignupForm } from './NewsletterSignupForm';

const VALUE_PROPS = [
  'Réservations en ligne 24h/24, 7j/7',
  'Paiement Stripe intégré, acompte ou total',
  'Zéro double réservation',
];

const FEATURES = [
  {
    icon: CalendarClock,
    title: 'Créneaux & capacité',
    description:
      'Dégustations avec créneaux, capacité, tarifs et durée — le calendrier centralise toutes vos disponibilités.',
  },
  {
    icon: Users,
    title: 'Sur mesure & groupes',
    description:
      'Demandes, devis et validation pour les événements sur mesure ; tailles min/max et tarifs dégressifs pour les groupes.',
  },
  {
    icon: Globe,
    title: 'Page cave publique',
    description:
      'Votre vitrine en ligne avec réservation directe — vos clients réservent sans vous appeler.',
  },
  {
    icon: CreditCard,
    title: 'Paiements automatisés',
    description:
      'Paiement en ligne via Stripe, annulations et remboursements automatisés, emails de confirmation et de rappel.',
  },
  {
    icon: Wine,
    title: 'Catalogue vins',
    description:
      'Vos vins associés à chaque événement, avec l’historique des dégustations de vos visiteurs.',
  },
  {
    icon: Share2,
    title: 'Synchro multi-canaux',
    description:
      'Diffusion de vos disponibilités sur les canaux prévus et fermeture automatique des créneaux à chaque réservation.',
  },
];

/** Bande pitch burgundy + grille de fonctionnalités B2B (`id="encaveurs"`). */
export function ComingSoonEncaveurs() {
  return (
    <>
      <section
        id="encaveurs"
        className="scroll-mt-16 bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-20 lg:py-28"
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold-400">
            • Pour les encaveurs
          </div>
          <h2 className="mt-4 font-display text-3xl font-light text-white md:text-5xl">
            La gestion de vos dégustations, enfin{' '}
            <em className="font-display-italic font-normal italic text-gold-400">
              simple
            </em>
            .
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
            Créneaux, paiements, demandes de groupes, canaux de vente : EnCave
            centralise tout ce qui fait tourner votre cave — pour que vous
            restiez au pressoir, pas derrière un agenda.
          </p>
          <ul className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8">
            {VALUE_PROPS.map((prop) => (
              <li
                key={prop}
                className="flex items-center gap-2 text-sm font-medium text-white"
              >
                <Check
                  className="h-4 w-4 shrink-0 text-gold-400"
                  aria-hidden="true"
                />
                {prop}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
              • Fonctionnalités
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">
              Un seul outil pour toute la cave.
            </h2>
          </div>

          <FadeIn>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-stone-200 bg-white p-6 shadow-card transition-all duration-300 ease-premium hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 font-display text-xl font-semibold text-ink-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-ink-500">{feature.description}</p>
                </div>
              ))}
            </div>
          </FadeIn>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-ink-500">
            <BarChart3
              className="h-4 w-4 shrink-0 text-burgundy-600"
              aria-hidden="true"
            />
            Et un tableau de bord complet : réservations, revenus, taux de
            remplissage, annulations — par type d’événement et par période.
          </p>
        </div>
      </section>
    </>
  );
}

/** Bande CTA waitlist encaveur (`id="waitlist-encaveur"`). */
export function ComingSoonEncaveurCta() {
  return (
    <section
      id="waitlist-encaveur"
      className="relative scroll-mt-16 overflow-hidden bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-20"
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <h2 className="font-display text-3xl font-light text-white md:text-4xl">
          Devenez l’une des 10 caves{' '}
          <em className="font-display-italic font-normal italic text-gold-400">
            fondatrices
          </em>
          .
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
          Laissez votre email : nous vous contactons en priorité avant
          l’ouverture, et l’offre fondateur vous est réservée.
        </p>
        <NewsletterSignupForm
          source="encaveur"
          tone="dark"
          ctaLabel="Rejoindre la liste d’attente"
          successMessage="Bienvenue ! Nous vous recontactons très vite."
          className="mx-auto mt-8 max-w-md"
        />
      </div>
    </section>
  );
}
