import { Check, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/shared/FadeIn';
import { cn } from '@/lib/utils';

interface Plan {
  name: string;
  tagline: string;
  priceLabel: string;
  founderPrice?: string;
  standardPrice?: string;
  featuresIntro?: string;
  features: string[];
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Essai gratuit',
    tagline: 'Pour découvrir EnCave, sans engagement',
    priceLabel: '30 jours · 0 CHF',
    features: [
      'Accès complet aux fonctionnalités Pro',
      'Sans carte bancaire',
      'Onboarding accompagné : import de vos événements existants',
      'Démo des fonctions Domaine sur demande',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    tagline: 'Pour la cave qui digitalise ses événements',
    priceLabel: 'CHF/mois',
    founderPrice: '39.50',
    standardPrice: '79',
    features: [
      'Dégustations : créneaux, capacité, tarifs, durée',
      'Événements sur mesure : demandes, devis, validation',
      'Groupes : tailles min/max, tarifs dégressifs',
      'Calendrier centralisé des disponibilités',
      'Page cave publique avec réservation en ligne',
      'Paiement en ligne via Stripe (acompte ou total)',
      'Annulations & remboursements automatisés',
      'Emails transactionnels (confirmation, rappel)',
      'Catalogue vins, accords aux événements & historique',
      'KPI : réservations, revenus, remplissage, annulations',
    ],
    highlighted: true,
  },
  {
    name: 'Domaine',
    tagline: 'Pour la cave multi-canaux, œnotourisme complet',
    priceLabel: 'CHF/mois',
    founderPrice: '99.50',
    standardPrice: '199',
    featuresIntro: 'Tout Pro, plus :',
    features: [
      'Synchro multi-canaux : vos disponibilités diffusées sur les canaux prévus — valais.ch, GetYourGuide, Winaliste, Swiss Wine Tour',
      'Fermeture automatique des créneaux sur tous les canaux à chaque réservation',
      'Widget de réservation embarquable (WordPress, Shopify, Wix)',
      'Chambre d’hôte : nuitées & packages (nuit + dégustation)',
      'Club premium : abonnements clients récurrents',
      'KPI avancés : performance par canal, clients récurrents, panier moyen',
      'Support prioritaire & accompagnement à la configuration',
    ],
    highlighted: false,
  },
];

export function ComingSoonPricing() {
  return (
    <section className="bg-cream-50 py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
            • Tarifs
          </div>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink-900 md:text-4xl">
            Un tarif simple, sans{' '}
            <em className="font-display-italic font-normal italic text-burgundy-700">
              surprise
            </em>
            .
          </h2>
        </div>

        {/* Offre fondatrice */}
        <div className="mx-auto mb-12 max-w-3xl rounded-2xl border border-gold-200 bg-gradient-to-br from-gold-50 to-cream-100 p-6 shadow-gold sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Badge variant="gold" className="px-3 py-1">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Offre fondateur
            </Badge>
            <p className="font-display text-xl font-semibold text-ink-900 sm:text-2xl">
              −50 % à vie pour les 10 premières caves inscrites.
            </p>
            <p className="text-sm text-ink-700">
              Pro à 39.50 CHF/mois au lieu de 79 · Domaine à 99.50 CHF/mois au
              lieu de 199 — tant que vous restez abonné.
            </p>
          </div>
        </div>

        {/* Grille des plans */}
        <div className="grid items-start gap-6 md:grid-cols-3">
          {PLANS.map((plan, index) => (
            <FadeIn key={plan.name} delay={index * 100}>
              <div
                className={cn(
                  'flex flex-col rounded-2xl p-8',
                  plan.highlighted
                    ? 'border border-gold-200 bg-gradient-to-br from-gold-50 to-cream-100 shadow-gold'
                    : 'border border-stone-200 bg-white shadow-card'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-semibold text-ink-900">
                    {plan.name}
                  </h3>
                  {plan.founderPrice && (
                    <Badge variant="gold">−50 % fondateur</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p>

                <div className="mt-5 flex flex-wrap items-baseline gap-x-2">
                  {plan.founderPrice ? (
                    <>
                      <span className="font-display text-4xl font-semibold text-ink-900">
                        {plan.founderPrice}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500">
                        {plan.priceLabel}
                      </span>
                      <s className="text-base text-ink-300">
                        <span className="sr-only">au lieu de </span>
                        {plan.standardPrice} CHF
                      </s>
                    </>
                  ) : (
                    <span className="font-display text-2xl font-semibold text-ink-900">
                      {plan.priceLabel}
                    </span>
                  )}
                </div>

                {plan.featuresIntro && (
                  <p className="mt-5 text-sm font-semibold text-ink-700">
                    {plan.featuresIntro}
                  </p>
                )}
                <ul
                  className={cn(
                    'space-y-3',
                    plan.featuresIntro ? 'mt-3' : 'mt-5'
                  )}
                >
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-burgundy-600"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-ink-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.highlighted ? 'default' : 'outline'}
                  className="mt-8 w-full"
                >
                  <a href="#waitlist-encaveur">Rejoindre la liste d’attente</a>
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Notes transverses */}
        <div className="mx-auto mt-10 max-w-2xl space-y-2 text-center">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-700">
              Frais de service client :
            </span>{' '}
            2.50 CHF par réservation, quel que soit le plan.
          </p>
          <p className="text-sm text-ink-500">
            À venir en 2027 : la marketplace vin EnCave — vendez vos bouteilles
            en ligne, 20 % de commission sur les ventes, sans abonnement
            supplémentaire.
          </p>
        </div>
      </div>
    </section>
  );
}
