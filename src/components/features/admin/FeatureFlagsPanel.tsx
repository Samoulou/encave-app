'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { FLAG_KEYS, type FlagKey } from '@/lib/flags';
import { setFeatureFlag } from '@/server/actions/featureFlags';

interface FeatureFlagsPanelProps {
  /** Current flag state, read server-side via getFeatureFlags(). */
  flags: Record<FlagKey, boolean>;
}

/**
 * Admin kill-switch panel (P-03 / L-040): one Switch per registered flag.
 * Toggling calls setFeatureFlag, which revalidates the flag cache tag —
 * effective on the next request, no deploy.
 */
export function FeatureFlagsPanel({ flags }: FeatureFlagsPanelProps) {
  const t = useTranslations('admin.featureFlags');
  const [state, setState] = useState<Record<FlagKey, boolean>>(flags);
  const [pendingKey, setPendingKey] = useState<FlagKey | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: FlagKey, enabled: boolean) {
    setPendingKey(key);
    startTransition(async () => {
      const result = await setFeatureFlag(key, enabled);
      if (result.success) {
        setState((prev) => ({ ...prev, [key]: result.data.enabled }));
        toast.success(
          result.data.enabled
            ? t('enabledToast', { flag: t(`flags.${key}`) })
            : t('disabledToast', { flag: t(`flags.${key}`) })
        );
      } else {
        toast.error(result.error.message);
      }
      setPendingKey(null);
    });
  }

  return (
    <div className="space-y-3">
      {FLAG_KEYS.map((key) => (
        <div
          key={key}
          className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4"
        >
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{t(`flags.${key}`)}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{key}</p>
          </div>
          <Switch
            checked={state[key]}
            disabled={isPending && pendingKey === key}
            onCheckedChange={(checked) => handleToggle(key, checked)}
            aria-label={t(`flags.${key}`)}
          />
        </div>
      ))}
    </div>
  );
}
