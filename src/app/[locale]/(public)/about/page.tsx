import { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MapPin, Grape, Heart, User } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  };
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');

  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-20 lg:py-28">
        <div className="absolute inset-0 bg-[url('/images/wine-texture.png')] opacity-5" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <Grape className="mx-auto mb-6 h-12 w-12 text-gold-400" aria-hidden="true" />
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            {t('hero.title')}
          </h1>
        </div>
      </section>

      {/* Content Sections */}
      <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
        <div className="space-y-12">
          {/* Valais Heritage Section */}
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-burgundy-100">
                  <MapPin className="h-6 w-6 text-burgundy-600" aria-hidden="true" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {t('valais.title')}
                </h2>
              </div>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>{t('valais.paragraph1')}</p>
                <p>{t('valais.paragraph2')}</p>
                <p className="font-medium text-burgundy-700 italic">
                  {t('valais.highlight')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mission Section */}
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-burgundy-100">
                  <Heart className="h-6 w-6 text-burgundy-600" aria-hidden="true" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {t('mission.title')}
                </h2>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {t('mission.content')}
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-burgundy-100">
                  <User className="h-6 w-6 text-burgundy-600" aria-hidden="true" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {t('contact.title')}
                </h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-6">
                {t('contact.content')}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4 border-t border-stone-200">
                <p className="font-display text-xl font-semibold text-slate-900">
                  {t('contact.name')}
                </p>
                <a
                  href={`mailto:${t('contact.email')}`}
                  className="inline-flex items-center gap-2 text-burgundy-600 hover:text-burgundy-700 transition-colors font-medium"
                >
                  <Mail className="h-5 w-5" aria-hidden="true" />
                  {t('contact.email')}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Tagline */}
        <div className="mt-16 text-center">
          <p className="font-display text-xl text-burgundy-700 italic">
            {t('footer')}
          </p>
        </div>
      </div>
    </div>
  );
}
