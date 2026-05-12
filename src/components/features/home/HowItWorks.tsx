import { Compass, CalendarPlus, Wine } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { FadeIn } from '@/components/shared/FadeIn';

export async function HowItWorks() {
  const t = await getTranslations('home');

  const steps = [
    {
      icon: Compass,
      title: t('howItWorks.step1.title'),
      description: t('howItWorks.step1.description'),
    },
    {
      icon: CalendarPlus,
      title: t('howItWorks.step2.title'),
      description: t('howItWorks.step2.description'),
    },
    {
      icon: Wine,
      title: t('howItWorks.step3.title'),
      description: t('howItWorks.step3.description'),
    },
  ];

  return (
    <section className="rounded-3xl bg-primary/5 p-6 dark:bg-white/5 sm:p-8 md:p-12 lg:p-16">
      <div className="mb-16 text-center">
        <h2 className="mb-4 font-display text-3xl font-extrabold text-foreground md:text-4xl">
          {t('howItWorks.title')}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {t('howItWorks.subtitle')}
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-8 text-center md:grid-cols-3 md:gap-12">
        {/* Connector Line (Desktop only) */}
        <div
          className="absolute left-0 top-12 -z-10 hidden h-0.5 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block"
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <FadeIn key={index} delay={index * 150}>
              <div className="group relative flex flex-col items-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/20 bg-white shadow-lg transition-transform duration-300 ease-premium group-hover:scale-110 dark:bg-[#2a1a1f]">
                  <Icon className="h-12 w-12 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-foreground">
                  {index + 1}. {step.title}
                </h3>
                <p className="px-4 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </section>
  );
}
