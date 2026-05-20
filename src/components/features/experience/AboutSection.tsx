'use client';

import { useTranslations } from 'next-intl';

interface AboutSectionProps {
  description: string;
}

export function AboutSection({ description }: AboutSectionProps) {
  const t = useTranslations('experience');

  // Split description into paragraphs if it contains newlines
  const paragraphs = description.split('\n\n').filter(Boolean);

  return (
    <section data-testid="experience-description">
      <h3 className="mb-4 text-2xl font-bold text-foreground">
        {t('aboutTitle')}
      </h3>
      <div className="prose prose-lg leading-relaxed text-gray-600">
        {paragraphs.length > 1 ? (
          paragraphs.map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="whitespace-pre-wrap">{description}</p>
        )}
      </div>
    </section>
  );
}
