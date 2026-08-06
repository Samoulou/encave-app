'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, Loader2, Minus, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCHF } from '@/lib/utils/currency';
import { WINE_ORDER_MAX_QUANTITY } from '@/lib/constants/wine';
import { submitWineOrderRequest } from '@/server/actions/tasting-sheet';

interface OrderableWine {
  id: string;
  name: string;
  grapeVariety: string;
  vintage: number | null;
  price: number; // cents
}

interface WineOrderFormProps {
  bookingId: string;
  token: string;
  wines: OrderableWine[];
  alreadyRequested: boolean;
  wineryName: string;
}

/**
 * 1-tap order request (P-07 / D3): served wines pre-checked with
 * adjustable quantities → one confirmation tap → the winery receives the
 * request with the client's contact details. Idempotent per booking
 * (CONFLICT → "already sent" state).
 */
export function WineOrderForm({
  bookingId,
  token,
  wines,
  alreadyRequested,
  wineryName,
}: WineOrderFormProps) {
  const t = useTranslations('wineOrder');
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<'form' | 'sent' | 'already'>(
    alreadyRequested ? 'already' : 'form'
  );
  const [hasError, setHasError] = useState(false);
  // All served wines pre-checked, quantity 1 (the "1-tap" default).
  const [selection, setSelection] = useState<Map<string, number>>(
    () => new Map(wines.map((wine) => [wine.id, 1]))
  );

  const toggle = (wineId: string) => {
    setSelection((current) => {
      const next = new Map(current);
      if (next.has(wineId)) {
        next.delete(wineId);
      } else {
        next.set(wineId, 1);
      }
      return next;
    });
  };

  const adjust = (wineId: string, delta: number) => {
    setSelection((current) => {
      const quantity = current.get(wineId);
      if (quantity === undefined) return current;
      const next = new Map(current);
      next.set(
        wineId,
        Math.min(WINE_ORDER_MAX_QUANTITY, Math.max(1, quantity + delta))
      );
      return next;
    });
  };

  const totalCents = wines.reduce(
    (sum, wine) => sum + (selection.get(wine.id) ?? 0) * wine.price,
    0
  );

  const handleSubmit = () => {
    setHasError(false);
    startTransition(async () => {
      const result = await submitWineOrderRequest({
        bookingId,
        token,
        items: Array.from(selection.entries()).map(([wineId, quantity]) => ({
          wineId,
          quantity,
        })),
      });
      if (result.success) {
        setState('sent');
      } else if (result.error.code === 'CONFLICT') {
        setState('already');
      } else {
        setHasError(true);
      }
    });
  };

  if (state === 'sent' || state === 'already') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle
          className="mx-auto h-10 w-10 text-emerald-600"
          aria-hidden="true"
        />
        <h2 className="mt-3 font-display text-lg font-semibold text-emerald-900">
          {state === 'sent' ? t('sentTitle') : t('alreadyTitle')}
        </h2>
        <p className="mt-2 text-sm text-emerald-800">
          {t(state === 'sent' ? 'sentDescription' : 'alreadyDescription', {
            wineryName,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-stone-100 rounded-xl border border-border bg-white">
        {wines.map((wine) => {
          const quantity = selection.get(wine.id);
          const isChecked = quantity !== undefined;
          return (
            <li key={wine.id} className="flex items-center gap-3 p-4">
              <Checkbox
                id={`wine-${wine.id}`}
                checked={isChecked}
                onCheckedChange={() => toggle(wine.id)}
                aria-label={t('toggleWine', { name: wine.name })}
              />
              <label
                htmlFor={`wine-${wine.id}`}
                className="min-w-0 flex-1 cursor-pointer"
              >
                <p className="truncate text-sm font-medium text-foreground">
                  {wine.name}
                  {wine.vintage != null && (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {wine.vintage}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {wine.grapeVariety} · {formatCHF(wine.price)}
                </p>
              </label>
              {isChecked && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => adjust(wine.id, -1)}
                    disabled={isPending || quantity <= 1}
                    aria-label={t('decreaseQuantity', { name: wine.name })}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span
                    className="w-7 text-center text-sm font-semibold"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => adjust(wine.id, 1)}
                    disabled={isPending || quantity >= WINE_ORDER_MAX_QUANTITY}
                    aria-label={t('increaseQuantity', { name: wine.name })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
        <span className="text-sm text-muted-foreground">{t('total')}</span>
        <span className="font-display text-lg font-semibold text-foreground">
          {formatCHF(totalCents)}
        </span>
      </div>

      {hasError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {t('errorGeneric')}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="min-h-[48px] w-full gap-2"
        onClick={handleSubmit}
        disabled={isPending || selection.size === 0}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {t('submit')}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t('note', { wineryName })}
      </p>
    </div>
  );
}
