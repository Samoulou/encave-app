'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { refundBookingManually } from '@/server/actions/admin';
import { formatCHF } from '@/lib/utils/currency';

interface AdminRefundControlsProps {
  bookingId: string;
  totalPrice: number;
  refundedAmount: number;
}

/**
 * Support refund trigger (L-008) — wires the pre-existing
 * refundBookingManually action (partial/full, reason journaled as
 * AdminAction) into the admin bookings table.
 */
export function AdminRefundControls({
  bookingId,
  totalPrice,
  refundedAmount,
}: AdminRefundControlsProps) {
  const router = useRouter();
  const remaining = totalPrice - refundedAmount;
  const [open, setOpen] = useState(false);
  const [amountChf, setAmountChf] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  if (remaining <= 0) {
    return <p className="text-sm text-slate-500">Fully refunded.</p>;
  }

  function submit() {
    const amountCents = Math.round(Number(amountChf) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (amountCents > remaining) {
      toast.error(`Amount exceeds the refundable ${formatCHF(remaining)}.`);
      return;
    }
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters.');
      return;
    }

    startTransition(async () => {
      const result = await refundBookingManually({
        bookingId,
        amountCents,
        reason: reason.trim(),
      });
      if (result.success) {
        toast.success(
          `Refunded ${formatCHF(result.data.refundedAmount)} (${result.data.refundId}).`
        );
        setOpen(false);
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Refund…
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-medium text-slate-600">
        Refundable: {formatCHF(remaining)}
      </p>
      <Input
        type="number"
        inputMode="decimal"
        min="0.01"
        step="0.01"
        max={(remaining / 100).toFixed(2)}
        value={amountChf}
        onChange={(event) => setAmountChf(event.target.value)}
        aria-label="Refund amount (CHF)"
      />
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (min 10 characters, journaled)"
        rows={2}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
          {isPending ? 'Refunding…' : 'Confirm refund'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
