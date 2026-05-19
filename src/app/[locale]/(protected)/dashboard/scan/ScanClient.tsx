'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Camera, CheckCircle2, XCircle, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { checkInBooking } from '@/server/actions/checkInBooking';

interface ScanClientProps {
  expectedSessionId?: string;
}

type ScanState =
  | { type: 'idle'; message: string }
  | { type: 'success'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

function extractToken(value: string): string | null {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] === 'b'
      ? (parts[1] ?? null)
      : parts[0] === 'api' && parts[1] === 'checkin'
        ? (parts[2] ?? null)
        : url.searchParams.get('token');
  } catch {
    return trimmed.length >= 32 ? trimmed : null;
  }
}

export function ScanClient({ expectedSessionId }: ScanClientProps) {
  const t = useTranslations('scan');
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ScanState>({
    type: 'idle',
    message: t('freeSubtitle'),
  });

  const stop = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => undefined);
      scannerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const handleDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (
        lastScanRef.current?.value === decodedText &&
        now - lastScanRef.current.at < 1500
      ) {
        return;
      }
      lastScanRef.current = { value: decodedText, at: now };

      const token = extractToken(decodedText);
      if (!token) {
        setState({ type: 'error', message: t('unknown') });
        return;
      }

      startTransition(async () => {
        const result = await checkInBooking({
          token,
          expectedSessionId,
          source: 'scan',
        });

        if (result.success) {
          const prefix =
            result.data.code === 'ALREADY_CHECKED_IN'
              ? t('already')
              : t('resultOk');
          setState({
            type:
              result.data.code === 'ALREADY_CHECKED_IN' ? 'warning' : 'success',
            message: `${prefix}, ${result.data.booking.visitorName}`,
          });
        } else {
          setState({
            type: 'error',
            message: result.error.message || t('resultError'),
          });
        }
      });
    },
    [expectedSessionId, t]
  );

  const start = useCallback(async () => {
    if (scannerRef.current) return;
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;
    setState({ type: 'idle', message: t('freeSubtitle') });
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      handleDecoded,
      () => undefined
    );
    setIsRunning(true);
  }, [handleDecoded, t]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  const tone =
    state.type === 'success'
      ? 'border-green-200 bg-green-50 text-green-900'
      : state.type === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : state.type === 'error'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-border bg-white text-foreground';

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('freeSubtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/bookings">{t('manual')}</Link>
        </Button>
      </header>

      <div className="overflow-hidden rounded-lg border bg-black">
        <div id="qr-reader" className="min-h-[360px] w-full" />
      </div>

      <div className={`rounded-lg border p-4 ${tone}`}>
        <div className="flex items-center gap-2 font-semibold">
          {state.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : state.type === 'error' ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
          <span>{state.message}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={start} disabled={isRunning || isPending}>
          <Camera className="mr-2 h-4 w-4" />
          {t('start')}
        </Button>
        <Button variant="outline" onClick={stop} disabled={!isRunning}>
          <RotateCw className="mr-2 h-4 w-4" />
          {t('stop')}
        </Button>
      </div>
    </div>
  );
}
