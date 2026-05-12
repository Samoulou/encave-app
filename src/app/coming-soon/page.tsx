'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Wine,
  GlassWater,
  Building2,
  Grape,
  UtensilsCrossed,
  Map,
  Calendar,
  Users,
  ArrowRight,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const experienceTypes = [
  {
    icon: GlassWater,
    title: 'Dégustations',
    description:
      'Découvrez les cépages valaisans avec des vignerons passionnés',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: Building2,
    title: 'Visites de cave',
    description:
      'Explorez les secrets de vinification dans des caves authentiques',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Grape,
    title: 'Ateliers',
    description: "Apprenez l'art de la dégustation et de l'assemblage",
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Map,
    title: 'Balades vigneronnes',
    description: 'Parcourez les vignobles en terrasses du Valais',
    color: 'bg-amber-100 text-amber-600',
  },
  {
    icon: UtensilsCrossed,
    title: 'Accords mets & vins',
    description: 'Savourez des expériences gastronomiques uniques',
    color: 'bg-red-100 text-red-600',
  },
];

const benefits = [
  {
    title: 'Pour les amateurs de vin',
    items: [
      'Réservez facilement en quelques clics',
      'Découvrez des expériences uniques',
      'Rencontrez des vignerons passionnés',
      'Recevez des recommandations personnalisées',
    ],
  },
  {
    title: 'Pour les vignerons',
    items: [
      'Augmentez votre visibilité',
      'Gérez vos réservations simplement',
      'Concentrez-vous sur votre passion',
      'Développez votre clientèle',
    ],
  },
];

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setIsSubscribed(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-cream-50 via-cream-100 to-burgundy-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          {/* Logo */}
          <div className="mb-12 flex items-center justify-center">
            <Image
              src="/icons/encave-logo.png"
              alt="EnCave"
              width={320}
              height={90}
              className="h-20 w-auto md:h-24"
              priority
            />
          </div>

          {/* Hero Content */}
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-burgundy-100 px-4 py-2 text-sm font-medium text-burgundy-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-burgundy-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-burgundy-500"></span>
              </span>
              Lancement bientôt
            </div>

            <h1 className="font-display text-4xl font-bold leading-tight text-slate-900 md:text-5xl lg:text-6xl">
              Le <span className="text-burgundy-600">Booking.com</span> des
              expériences viticoles
            </h1>

            <p className="mx-auto max-w-2xl text-xl leading-relaxed text-slate-600">
              Réservez des dégustations, visites de caves et expériences
              œnologiques uniques directement auprès des vignerons du Valais.
            </p>
          </div>

          {/* Newsletter Form */}
          <div className="mx-auto mt-12 max-w-md">
            {isSubscribed ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-5 w-5" />
                </div>
                <span className="font-medium">
                  Merci ! Vous serez notifié au lancement.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    placeholder="Votre adresse email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading}
                    className="whitespace-nowrap"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inscription...
                      </>
                    ) : (
                      <>
                        Me notifier
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
                {error && (
                  <p className="text-center text-sm text-red-600">{error}</p>
                )}
                <p className="text-center text-xs text-slate-500">
                  Soyez parmi les premiers informés du lancement. Aucun spam,
                  promis.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Decorative Divider */}
      <div className="flex items-center justify-center gap-2 py-8 text-burgundy-400">
        <span className="h-px w-16 bg-burgundy-200" />
        <Wine className="h-5 w-5" />
        <span className="h-px w-16 bg-burgundy-200" />
      </div>

      {/* Experience Types Section */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-slate-900 md:text-4xl">
            Des expériences pour tous les goûts
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Du novice curieux à l&apos;œnophile averti, trouvez
            l&apos;expérience qui vous correspond
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {experienceTypes.map((type) => (
            <div
              key={type.title}
              className="group relative rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${type.color} mb-4`}
              >
                <type.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">
                {type.title}
              </h3>
              <p className="text-slate-600">{type.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-slate-900 md:text-4xl">
              Une plateforme pensée pour tous
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-600">
              EnCave simplifie la découverte et la réservation
              d&apos;expériences viticoles
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-2xl border border-cream-200 bg-gradient-to-br from-cream-50 to-cream-100 p-8"
              >
                <h3 className="mb-6 font-display text-2xl font-semibold text-slate-900">
                  {benefit.title}
                </h3>
                <ul className="space-y-4">
                  {benefit.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-burgundy-100 text-burgundy-600">
                        <Check className="h-4 w-4" />
                      </div>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-slate-900 md:text-4xl">
            Comment ça marche ?
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Réservez votre prochaine expérience viticole en 3 étapes simples
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              step: '1',
              icon: Map,
              title: 'Explorez',
              description:
                "Parcourez notre sélection d'expériences et trouvez celle qui vous inspire",
            },
            {
              step: '2',
              icon: Calendar,
              title: 'Réservez',
              description:
                'Choisissez votre date et réservez en ligne en quelques clics',
            },
            {
              step: '3',
              icon: Users,
              title: 'Savourez',
              description:
                'Rencontrez le vigneron et vivez une expérience authentique',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="relative mb-6 inline-flex">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy-100">
                  <item.icon className="h-8 w-8 text-burgundy-600" />
                </div>
                <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-burgundy-600 text-sm font-bold text-white">
                  {item.step}
                </span>
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-burgundy-700 to-burgundy-900 py-16">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-white md:text-4xl">
            Prêt à découvrir les trésors du Valais ?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-white/80">
            Inscrivez-vous pour être notifié dès le lancement et bénéficier
            d&apos;offres exclusives.
          </p>

          {isSubscribed ? (
            <div className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-white backdrop-blur-sm">
              <Check className="h-5 w-5 text-emerald-400" />
              <span>Vous êtes inscrit ! À très bientôt.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto max-w-md">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  placeholder="Votre adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/60 focus:bg-white/20"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="whitespace-nowrap bg-white text-burgundy-700 hover:bg-white/90"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "S'inscrire"
                  )}
                </Button>
              </div>
              {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1215] text-cream-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 sm:grid-cols-2">
            {/* Brand */}
            <div>
              <Image
                src="/icons/encave-logo.png"
                alt="EnCave"
                width={160}
                height={46}
                className="h-11 w-auto brightness-0 invert"
              />
              <p className="mt-4 max-w-xs text-sm text-stone-400">
                Réservez des expériences viticoles uniques directement avec les
                vignerons suisses.
              </p>
            </div>

            {/* Découvrir */}
            <div>
              <h3 className="mb-4 font-display text-sm font-semibold text-white">
                Découvrir
              </h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a
                    href="/fr/degustation-vin-valais"
                    className="transition-colors hover:text-white"
                  >
                    Dégustation en Valais
                  </a>
                </li>
                <li>
                  <a
                    href="/fr/cepages-valaisans"
                    className="transition-colors hover:text-white"
                  >
                    Cépages Valaisans
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-burgundy-800 pt-8 sm:flex-row">
            <p className="text-sm text-stone-400">
              © {new Date().getFullYear()} EnCave. Tous droits réservés.
            </p>
            <a
              href="mailto:samuel@encave.ch"
              className="flex items-center gap-2 text-sm text-stone-400 transition-colors hover:text-white"
            >
              samuel@encave.ch
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
