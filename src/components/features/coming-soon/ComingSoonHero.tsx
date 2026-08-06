import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NewsletterSignupForm } from './NewsletterSignupForm';

const HERO_BANNER_IMAGE = '/images/herobanner-image-v2.jpg';

export function ComingSoonHero() {
  return (
    <section className="relative overflow-hidden bg-ink-900">
      <Image
        src={HERO_BANNER_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-burgundy-950/55 to-black/25" />

      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-6xl flex-col items-center justify-center px-6 py-16 text-center md:py-24">
        <Image
          src="/icons/encave-logo.png"
          alt="EnCave"
          width={320}
          height={90}
          className="h-14 w-auto brightness-0 invert md:h-16"
          priority
        />

        <Badge variant="gold" className="mt-8 px-4 py-1.5 text-sm">
          Lancement novembre 2026
        </Badge>

        <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-gold-400">
          • Expériences œnotouristiques · Valais
        </div>

        <h1 className="mt-4 max-w-3xl font-display text-4xl font-light leading-[1.05] tracking-[-0.025em] text-white md:text-6xl lg:text-7xl">
          Le Valais, une{' '}
          <em className="font-display-italic font-normal italic text-gold-400">
            cave
          </em>{' '}
          à ciel ouvert.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
          Dégustations, visites de cave et ateliers — réservés en ligne,
          directement auprès des encaveurs valaisans.
        </p>

        <NewsletterSignupForm
          source="coming-soon"
          tone="dark"
          ctaLabel="Me prévenir au lancement"
          successMessage="Merci ! Vous serez averti dès l’ouverture."
          hint="Une adresse email, rien d’autre. Aucun spam, promis."
          className="mt-10 w-full max-w-md"
        />

        <a
          href="#encaveurs"
          className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors duration-200 hover:text-white"
        >
          Vous êtes encaveur ? Découvrez l’offre de lancement
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
