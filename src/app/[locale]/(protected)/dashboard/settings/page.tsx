import type { Metadata } from 'next';
import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell, User, Languages, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Settings | EnCave Dashboard',
  robots: { index: false, follow: false },
};

const settingsSections = [
  {
    title: 'Notifications',
    description: 'Manage your email notification preferences',
    href: '/dashboard/settings/notifications',
    icon: Bell,
  },
  {
    title: 'Profile',
    description: 'Update your personal information',
    href: '/dashboard/winery/profile',
    icon: User,
  },
  {
    title: 'Language',
    description: 'Change your preferred language',
    href: '#language',
    icon: Languages,
    comingSoon: true,
  },
];

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;

          if (section.comingSoon) {
            return (
              <Card key={section.title} className="opacity-60">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                    <Icon className="h-6 w-6 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{section.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Coming soon
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Link key={section.title} href={section.href}>
              <Card className="group transition-all hover:border-burgundy-200 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-50 transition-colors group-hover:bg-burgundy-100">
                    <Icon className="h-6 w-6 text-burgundy-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900 group-hover:text-burgundy-700">
                      {section.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
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
          <h3 className="font-medium text-slate-900">Account Information</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-900">{session.user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="font-medium text-slate-900">{session.user.name || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role</span>
              <span className="font-medium text-slate-900 capitalize">
                {session.user.role?.toLowerCase().replace('_', ' ') || 'User'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
