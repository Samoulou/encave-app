'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { createFounderInvitation } from '@/server/actions/invitation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Admin form to generate a founder-invitation link (P-14 / L-154). The
 * plaintext link is shown once and copied — the admin sends it to the cave.
 */
export function InvitationGenerator() {
  const t = useTranslations('admin.invitations');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [wineryName, setWineryName] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setUrl(null);
    startTransition(async () => {
      const result = await createFounderInvitation({
        email: email.trim(),
        wineryName: wineryName.trim(),
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setUrl(result.data.url);
      setEmail('');
      setWineryName('');
    });
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-xl space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-stone-200 bg-white p-5"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="inv-email" className="text-sm font-medium">
            {tCommon('labels.email')}
          </label>
          <Input
            id="inv-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="inv-winery" className="text-sm font-medium">
            {t('wineryName')}
          </label>
          <Input
            id="inv-winery"
            required
            value={wineryName}
            onChange={(e) => setWineryName(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" isLoading={isPending}>
          {t('generate')}
        </Button>
      </form>

      {url && (
        <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">{t('linkReady')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-xs">
              {url}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('linkHint')}</p>
        </div>
      )}
    </div>
  );
}
