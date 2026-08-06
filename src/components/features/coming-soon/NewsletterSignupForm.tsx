'use client';

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NewsletterSignupFormProps {
  /** Persisted on NewsletterSubscription.source to segment B2C vs B2B leads */
  source: 'coming-soon' | 'encaveur';
  /** dark = rendered on a burgundy band */
  tone?: 'light' | 'dark';
  ctaLabel: string;
  successMessage: string;
  hint?: string;
  className?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function NewsletterSignupForm({
  source,
  tone = 'light',
  ctaLabel,
  successMessage,
  hint,
  className,
}: NewsletterSignupFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isDark = tone === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMessage('Veuillez entrer une adresse email valide.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });

      if (response.status === 429) {
        throw new Error(
          'Trop de tentatives. Merci de réessayer dans quelques minutes.'
        );
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(
          data.error || 'Une erreur est survenue. Veuillez réessayer.'
        );
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue. Veuillez réessayer.'
      );
    }
  };

  if (status === 'success') {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-3 rounded-xl border p-4',
          isDark
            ? 'border-white/20 bg-white/10 text-white backdrop-blur-sm'
            : 'border-success/25 bg-success/10 text-success',
          className
        )}
      >
        <Check
          className={cn('h-5 w-5 shrink-0', isDark && 'text-gold-400')}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{successMessage}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          required
          aria-label="Adresse email"
          placeholder="Votre adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'loading'}
          className={cn(
            'h-12 flex-1',
            isDark &&
              'border-white/20 bg-white/10 text-white placeholder:text-white/60 focus:border-white/50'
          )}
        />
        <Button
          type="submit"
          size="lg"
          isLoading={status === 'loading'}
          loadingText="Inscription…"
          className={cn(
            'whitespace-nowrap',
            isDark &&
              'bg-white text-burgundy-700 shadow-none hover:bg-cream-100'
          )}
        >
          {ctaLabel}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {status === 'error' && errorMessage && (
        <p
          role="alert"
          className={cn(
            'text-center text-sm',
            isDark ? 'text-red-200' : 'text-error'
          )}
        >
          {errorMessage}
        </p>
      )}
      {hint && (
        <p
          className={cn(
            'text-center text-xs',
            isDark ? 'text-white/60' : 'text-ink-500'
          )}
        >
          {hint}
        </p>
      )}
    </form>
  );
}
