import { Search } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminRoleControls } from '@/components/features/admin/AdminRoleControls';
import { AdminAnonymizeControls } from '@/components/features/admin/AdminAnonymizeControls';
import { AdminSuspensionControls } from '@/components/features/admin/AdminSuspensionControls';
import { AdminActionHistory } from '@/components/features/admin/AdminActionHistory';
import {
  getUsersForAdmin,
  getUserHistories,
} from '@/server/queries/admin-users.queries';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.admin',
    noIndex: true,
  });
}

interface AdminUsersPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; role?: UserRole | 'ALL' }>;
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: AdminUsersPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const filters = await searchParams;
  const q = filters.q?.trim() ?? '';
  const role =
    filters.role && filters.role !== 'ALL' ? filters.role : undefined;

  const [t, users] = await Promise.all([
    getTranslations('admin'),
    getUsersForAdmin({ q, role }),
  ]);
  const histories = await getUserHistories(users.map((user) => user.id));

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          {t('users.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('users.subtitle')}</p>
      </div>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle>{t('wineriesList.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder={t('users.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <select
              name="role"
              defaultValue={role ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">{t('users.allRoles')}</option>
              {Object.values(UserRole).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Button type="submit">{t('wineriesList.filter')}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-warm">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {t('users.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-4">{t('users.user')}</th>
                    <th className="px-6 py-4">{t('users.role')}</th>
                    <th className="px-6 py-4">{t('users.status')}</th>
                    <th className="px-6 py-4">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((user) => {
                    const history = histories[user.id] ?? [];
                    return (
                      <tr key={user.id} className="align-top">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">
                            {user.name ?? '—'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {user.anonymized ? (
                            <span className="text-sm text-muted-foreground">
                              {user.role}
                            </span>
                          ) : (
                            <AdminRoleControls
                              targetId={user.id}
                              currentRole={user.role}
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {user.anonymized && (
                              <Badge variant="destructive">
                                {t('users.anonymizedBadge')}
                              </Badge>
                            )}
                            {user.suspended && (
                              <Badge variant="warning">
                                {t('users.suspendedBadge')}
                              </Badge>
                            )}
                            {!user.anonymized && !user.suspended && (
                              <Badge variant="success">
                                {t('users.active')}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="min-w-[300px] px-6 py-4">
                          {user.anonymized ? (
                            <p className="text-sm text-muted-foreground">
                              {t('users.anonymizedNote')}
                            </p>
                          ) : (
                            <div className="space-y-3">
                              <AdminSuspensionControls
                                targetId={user.id}
                                targetType="user"
                                mode={user.suspended ? 'reinstate' : 'suspend'}
                                label={
                                  user.suspended
                                    ? t('users.reinstateAccount')
                                    : t('users.suspendAccount')
                                }
                              />
                              <AdminAnonymizeControls
                                targetId={user.id}
                                alreadyAnonymized={user.anonymized}
                              />
                            </div>
                          )}
                          {history.length > 0 && (
                            <div className="mt-3">
                              <AdminActionHistory entries={history} />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
