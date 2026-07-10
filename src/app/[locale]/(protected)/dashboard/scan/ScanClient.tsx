'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  Camera,
  CheckCircle2,
  XCircle,
  RotateCw,
  Wifi,
  WifiOff,
  CloudUpload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BookingStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { checkInBooking } from '@/server/actions/checkInBooking';
import {
  scanQueueKey,
  loadQueue,
  saveQueue,
  enqueueScan,
  flushQueue,
  type QueuedScan,
  type ScanSubmitOutcome,
} from '@/lib/scan/scan-queue';
import type { ScanDayEntryDTO } from '@/server/queries/scan.queries';

interface ScanClientProps {
  expectedSessionId?: string;
  /**
   * Today's guest list, preloaded server-side (day mode). null = session
   * mode or no winery. The server stays authoritative whenever the
   * device is ONLINE; the day list is the offline fallback + counter.
   */
  dayList: ScanDayEntryDTO[] | null;
  /** Storage scope for the offline queue (the authenticated user id). */
  queueScope: string;
}

type ScanState =
  | { type: 'idle'; message: string }
  | { type: 'success'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

const FLUSH_RETRY_MS = 30_000;

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

/** sha256 hex in the browser — mirrors the server's hashToken. */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Definitive server refusals: retrying can never succeed. */
const REJECTED_CODES = new Set([
  'NOT_FOUND',
  'FORBIDDEN',
  'WRONG_SESSION',
  'WRONG_DAY',
  'BOOKING_CANCELLED',
  'MARKED_NO_SHOW',
  'PAYMENT_NOT_CONFIRMED',
  'VALIDATION_ERROR',
]);

export function ScanClient({
  expectedSessionId,
  dayList,
  queueScope,
}: ScanClientProps) {
  const t = useTranslations('scan');
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const flushingRef = useRef(false);
  const storageKey = useMemo(() => scanQueueKey(queueScope), [queueScope]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [locallyScanned, setLocallyScanned] = useState<Set<string>>(
    () => new Set()
  );
  const [state, setState] = useState<ScanState>({
    type: 'idle',
    message: t('freeSubtitle'),
  });

  const entryByHash = useMemo(() => {
    if (!dayList) return null;
    return new Map(dayList.map((entry) => [entry.accessTokenHash, entry]));
  }, [dayList]);

  const counters = useMemo(() => {
    if (!dayList) return null;
    const checkedIn = dayList.filter(
      (entry) =>
        entry.status === BookingStatus.COMPLETED ||
        locallyScanned.has(entry.bookingId)
    ).length;
    return { checkedIn, total: dayList.length };
  }, [dayList, locallyScanned]);

  const markScanned = useCallback((bookingId: string) => {
    setLocallyScanned((prev) => {
      if (prev.has(bookingId)) return prev;
      const next = new Set(prev);
      next.add(bookingId);
      return next;
    });
  }, []);

  // --- offline queue -----------------------------------------------------

  const submitQueuedScan = useCallback(
    async (item: QueuedScan): Promise<ScanSubmitOutcome> => {
      const result = await checkInBooking({
        bookingId: item.bookingId,
        scannedAt: item.scannedAt,
        source: 'scan',
      });
      if (result.success) return 'synced';
      if (result.error.code === 'ALREADY_CHECKED_IN') return 'synced';
      return REJECTED_CODES.has(result.error.code) ? 'rejected' : 'retry';
    },
    []
  );

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const current = loadQueue(window.localStorage, storageKey);
      if (current.length === 0) {
        setQueue([]);
        return;
      }
      const result = await flushQueue(current, submitQueuedScan);
      saveQueue(window.localStorage, storageKey, result.remaining);
      setQueue(result.remaining);
      if (result.rejectedIds.length > 0) {
        // Definitive server refusal after an offline green: undo the
        // local check-in mark so the counter stops lying.
        setLocallyScanned((prev) => {
          const next = new Set(prev);
          for (const id of result.rejectedIds) next.delete(id);
          return next;
        });
        setState({
          type: 'error',
          message: t('syncRejected', { count: result.rejectedIds.length }),
        });
      }
    } finally {
      flushingRef.current = false;
    }
  }, [submitQueuedScan, storageKey, t]);

  useEffect(() => {
    // Crash recovery: adopt whatever a previous session left behind.
    const persisted = loadQueue(window.localStorage, storageKey);
    setQueue(persisted);
    setLocallyScanned((prev) => {
      if (persisted.length === 0) return prev;
      const next = new Set(prev);
      for (const item of persisted) next.add(item.bookingId);
      return next;
    });

    setIsOnline(navigator.onLine);
    const onOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine) void flush();
    // Transient flush failures (5xx, rate limit) while staying online
    // would otherwise wait for the next scan — retry on a timer.
    const retry = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, FLUSH_RETRY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(retry);
    };
  }, [flush, storageKey]);

  // --- scan handling -----------------------------------------------------

  const handleOfflineMatch = useCallback(
    async (token: string) => {
      if (!entryByHash) return;
      const hash = await sha256Hex(token);
      const entry = entryByHash.get(hash);

      if (!entry) {
        setState({ type: 'error', message: t('notToday') });
        return;
      }

      if (
        entry.status === BookingStatus.COMPLETED ||
        locallyScanned.has(entry.bookingId)
      ) {
        setState({
          type: 'warning',
          message: `${t('already')}, ${entry.visitorName}`,
        });
        return;
      }

      markScanned(entry.bookingId);
      const nextQueue = enqueueScan(
        loadQueue(window.localStorage, storageKey),
        entry.bookingId,
        new Date()
      );
      saveQueue(window.localStorage, storageKey, nextQueue);
      setQueue(nextQueue);
      setState({
        type: 'success',
        message: `${t('resultOk')}, ${entry.visitorName} (${entry.guestCount})`,
      });
    },
    [entryByHash, locallyScanned, markScanned, storageKey, t]
  );

  const handleOnlineScan = useCallback(
    (token: string) => {
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
          // Keep the day counter honest even for bookings made after
          // the page-load snapshot (they're simply not in the total).
          markScanned(result.data.booking.id);
        } else {
          setState({
            type: 'error',
            message: result.error.message || t('resultError'),
          });
        }
      });
    },
    [expectedSessionId, markScanned, t]
  );

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

      // Online → the server is authoritative (sees cancellations and
      // bookings made after page load). Offline day mode → local match.
      if (entryByHash && !navigator.onLine) {
        void handleOfflineMatch(token);
      } else {
        handleOnlineScan(token);
      }
    },
    [entryByHash, handleOfflineMatch, handleOnlineScan, t]
  );

  const stop = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => undefined);
      scannerRef.current = null;
    }
    setIsRunning(false);
  }, []);

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

      {/* Network + progress strip (day mode) */}
      {dayList && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
              isOnline
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isOnline ? t('online') : t('offline')}
          </span>
          {counters && (
            <span className="text-muted-foreground">
              {t('counter', {
                checkedIn: counters.checkedIn,
                total: counters.total,
              })}
            </span>
          )}
          {queue.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800">
              <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
              {t('pendingSync', { count: queue.length })}
            </span>
          )}
        </div>
      )}

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
