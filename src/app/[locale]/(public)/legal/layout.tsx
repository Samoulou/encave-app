import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('legal');

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('backToHome')}
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="prose prose-slate prose-headings:font-display prose-headings:text-slate-900 prose-p:text-slate-600 prose-a:text-burgundy-600 prose-a:no-underline hover:prose-a:underline max-w-none">
          {children}
        </article>
      </main>

      {/* Footer Navigation */}
      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              href="/legal/privacy"
              className="text-slate-600 hover:text-burgundy-600"
            >
              {t('privacy.title')}
            </Link>
            <Link
              href="/legal/terms"
              className="text-slate-600 hover:text-burgundy-600"
            >
              {t('terms.title')}
            </Link>
            <Link
              href="/legal/cancellation"
              className="text-slate-600 hover:text-burgundy-600"
            >
              {t('cancellation.title')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
