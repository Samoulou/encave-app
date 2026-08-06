import { ComingSoonDiscover } from '@/components/features/coming-soon/ComingSoonDiscover';
import {
  ComingSoonEncaveurCta,
  ComingSoonEncaveurs,
} from '@/components/features/coming-soon/ComingSoonEncaveurs';
import { ComingSoonFooter } from '@/components/features/coming-soon/ComingSoonFooter';
import { ComingSoonHero } from '@/components/features/coming-soon/ComingSoonHero';
import { ComingSoonPricing } from '@/components/features/coming-soon/ComingSoonPricing';

/**
 * Landing pré-launch servie sur encave.ch tant que COMING_SOON !== 'false'
 * (gate middleware). Double audience : teaser B2C + recrutement des caves
 * fondatrices (business modèle du 06.08.2026). FR hardcodé volontairement —
 * la page vit hors [locale] et disparaît au launch (L-189).
 */
export default function ComingSoonPage() {
  return (
    <main className="bg-cream-50">
      <ComingSoonHero />
      <ComingSoonDiscover />
      <div className="mx-auto max-w-4xl px-6" aria-hidden="true">
        <div className="ornament-vine h-px" />
      </div>
      <ComingSoonEncaveurs />
      <ComingSoonPricing />
      <ComingSoonEncaveurCta />
      <ComingSoonFooter />
    </main>
  );
}
