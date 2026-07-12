import {
  GiftCardStatus,
  GiftCardTransactionType,
  Prisma,
} from '@prisma/client';
import { db } from '@/server/db';

/**
 * Gift-card redemption (P-09 / L-084, PR2). The concurrency-critical
 * heart of the feature: the balance is materialized on `gift_cards`, so a
 * redemption MUST hold a row lock while it reads the balance and writes
 * the movement, or two simultaneous redemptions of the same code could
 * both pass and drive the balance negative.
 *
 * The lock is a `SELECT … FOR UPDATE` (Prisma has no first-class pessimistic
 * lock) inside the caller's transaction; the DB `CHECK (balance >= 0)` is
 * the last rampart, and the append-only ledger records every movement.
 *
 * Expiry policy (decision 2026-07-12 « le solde reste exigible ») : a card
 * past its `expiresAt` is NOT auto-refused — only an explicit EXPIRED or
 * DISABLED status blocks. Nothing sets EXPIRED automatically today; this
 * softens the "5-year validity" line and is pending accounting sign-off.
 */

export type RedemptionError =
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'EXPIRED'
  | 'DEPLETED'
  | 'WRONG_EXPERIENCE';

export interface RedemptionResult {
  giftCardId: string;
  code: string;
  appliedCents: number;
  remainingBalance: number;
}

export function normalizeGiftCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

interface LockedGiftCardRow {
  id: string;
  code: string;
  balance: number;
  status: GiftCardStatus;
  experienceId: string | null;
}

/**
 * Redeem `dueCents` (at most the balance) against `code`, inside an
 * EXISTING transaction. Locks the row FOR UPDATE, validates eligibility,
 * writes a negative REDEMPTION movement and decrements the balance —
 * atomically with whatever booking work the caller does in the same tx.
 * A nominatif (EXPERIENCE) card is redeemable only on its experience.
 */
export async function redeemGiftCardInTx(
  tx: Prisma.TransactionClient,
  input: {
    code: string;
    dueCents: number;
    experienceId: string;
    bookingId: string;
  }
): Promise<
  { ok: true; result: RedemptionResult } | { ok: false; error: RedemptionError }
> {
  const normalized = normalizeGiftCode(input.code);
  const rows = await tx.$queryRaw<LockedGiftCardRow[]>`
    SELECT id, code, balance, status, "experienceId"
    FROM gift_cards
    WHERE code = ${normalized}
    FOR UPDATE
  `;
  const card = rows[0];
  if (!card) return { ok: false, error: 'NOT_FOUND' };
  if (card.status === GiftCardStatus.DISABLED) {
    return { ok: false, error: 'DISABLED' };
  }
  if (card.status === GiftCardStatus.EXPIRED) {
    return { ok: false, error: 'EXPIRED' };
  }
  if (card.experienceId && card.experienceId !== input.experienceId) {
    return { ok: false, error: 'WRONG_EXPERIENCE' };
  }
  if (card.balance <= 0) return { ok: false, error: 'DEPLETED' };

  const applied = Math.min(card.balance, input.dueCents);
  if (applied <= 0) return { ok: false, error: 'DEPLETED' };
  const remainingBalance = card.balance - applied;

  await tx.giftCard.update({
    where: { id: card.id },
    data: { balance: remainingBalance },
  });
  await tx.giftCardTransaction.create({
    data: {
      giftCardId: card.id,
      type: GiftCardTransactionType.REDEMPTION,
      amount: -applied,
      bookingId: input.bookingId,
      note: 'checkout_redemption',
    },
  });

  return {
    ok: true,
    result: {
      giftCardId: card.id,
      code: card.code,
      appliedCents: applied,
      remainingBalance,
    },
  };
}

/**
 * Standalone redemption (opens its own transaction). Convenience wrapper
 * for callers that redeem outside a larger booking transaction.
 */
export async function redeemGiftCard(input: {
  code: string;
  dueCents: number;
  experienceId: string;
  bookingId: string;
}) {
  return db.$transaction((tx) => redeemGiftCardInTx(tx, input));
}

export interface GiftPreview {
  code: string;
  balance: number;
  applicableCents: number;
  remainingDueCents: number;
}

/**
 * Read-only preview for the checkout gift-code field (no lock — the
 * authoritative redemption re-locks at submit). Returns the amount the
 * card would cover of `dueCents` for `experienceId`, or an error.
 */
export async function previewGiftRedemption(input: {
  code: string;
  dueCents: number;
  experienceId: string;
}): Promise<
  { ok: true; preview: GiftPreview } | { ok: false; error: RedemptionError }
> {
  const normalized = normalizeGiftCode(input.code);
  const card = await db.giftCard.findUnique({
    where: { code: normalized },
    select: { code: true, balance: true, status: true, experienceId: true },
  });
  if (!card) return { ok: false, error: 'NOT_FOUND' };
  if (card.status === GiftCardStatus.DISABLED) {
    return { ok: false, error: 'DISABLED' };
  }
  if (card.status === GiftCardStatus.EXPIRED) {
    return { ok: false, error: 'EXPIRED' };
  }
  if (card.experienceId && card.experienceId !== input.experienceId) {
    return { ok: false, error: 'WRONG_EXPERIENCE' };
  }
  if (card.balance <= 0) return { ok: false, error: 'DEPLETED' };

  const applicableCents = Math.min(card.balance, input.dueCents);
  return {
    ok: true,
    preview: {
      code: card.code,
      balance: card.balance,
      applicableCents,
      remainingDueCents: input.dueCents - applicableCents,
    },
  };
}
