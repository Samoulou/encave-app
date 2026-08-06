'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { RequestForm } from './RequestForm';

interface SurMesureBlockProps {
  wineryId: string;
  wineryName: string;
}

/**
 * Compact sur-mesure block for the winery fiche (P-10 / L-090). The winery
 * is prefilled and hidden — a pure client island so it never breaks the
 * ISR of the public winery page (no auth/headers/cookies in this tree).
 */
export function SurMesureBlock({ wineryId, wineryName }: SurMesureBlockProps) {
  const t = useTranslations('surMesure');

  return (
    <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50">
          <Sparkles className="h-5 w-5 text-burgundy-600" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {t('blockTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t('blockSubtitle', { winery: wineryName })}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <RequestForm
          fixedWinery={{ id: wineryId, name: wineryName }}
          variant="compact"
        />
      </div>
    </section>
  );
}
