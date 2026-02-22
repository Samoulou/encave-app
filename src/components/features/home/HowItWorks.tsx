import { Compass, CalendarPlus, Wine } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

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
    <section className="bg-primary/5 dark:bg-white/5 rounded-3xl p-6 sm:p-8 md:p-12 lg:p-16">
      <div className="text-center mb-16">
        <h2 className="font-display text-3xl md:text-4xl font-extrabold text-foreground mb-4">
          {t('howItWorks.title')}
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t('howItWorks.subtitle')}
        </p>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center">
        {/* Connector Line (Desktop only) */}
        <div
          className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10"
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="relative flex flex-col items-center group">
              <div className="w-24 h-24 bg-white dark:bg-[#2a1a1f] rounded-full shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border-2 border-primary/20">
                <Icon className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {index + 1}. {step.title}
              </h3>
              <p className="text-muted-foreground text-sm px-4">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
