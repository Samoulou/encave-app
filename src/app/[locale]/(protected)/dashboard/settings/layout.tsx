import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-display-md text-slate-900">Settings</h1>
          <p className="text-slate-600">
            Manage your account and notification preferences
          </p>
        </div>
        {children}
      </div>
    </WineryAccessGuard>
  );
}
