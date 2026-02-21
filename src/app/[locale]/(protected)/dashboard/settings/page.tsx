import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Bell, User, Languages, ChevronRight, LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.settings',
    noIndex: true,
  });
}

interface SettingsSection {
  key: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

const settingsSections: SettingsSection[] = [
  {
    key: 'notifications',
    href: '/dashboard/settings/notifications',
    icon: Bell,
  },
  {
    key: 'profile',
    href: '/dashboard/winery/profile',
    icon: User,
  },
  {
    key: 'language',
    href: '#language',
    icon: Languages,
    comingSoon: true,
  },
];

export default async function SettingsPage() {
  const session = await auth();
  const t = await getTranslations('settings');
  const tCommon = await getTranslations('common');

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const title = t(`sections.${section.key}.title`);
          const description = t(`sections.${section.key}.description`);

          if (section.comingSoon) {
            return (
              <Card key={section.key} className="opacity-60">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                    <Icon className="h-6 w-6 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t('comingSoon')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Link key={section.key} href={section.href}>
              <Card className="group transition-all hover:border-burgundy-200 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-50 transition-colors group-hover:bg-burgundy-100">
                    <Icon className="h-6 w-6 text-burgundy-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900 group-hover:text-burgundy-700">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-burgundy-500" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Account Info */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium text-slate-900">{t('accountInfo')}</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{tCommon('labels.email')}</span>
              <span className="font-medium text-slate-900">{session.user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{tCommon('labels.name')}</span>
              <span className="font-medium text-slate-900">{session.user.name || t('notSet')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t('role')}</span>
              <span className="font-medium text-slate-900 capitalize">
                {session.user.role?.toLowerCase().replace('_', ' ') || t('roleUser')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
