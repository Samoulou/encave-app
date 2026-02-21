import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.previewExperience',
    noIndex: true,
  });
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
