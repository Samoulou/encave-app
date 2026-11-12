import { describe, it, expect } from 'vitest';
import {
  computeGiftApplication,
  MIN_CARD_CHARGE_CENTS,
} from '@/lib/business-rules/gift-redemption';

describe('computeGiftApplication', () => {
  it('applies the whole due when the balance covers it (card = 0)', () => {
    expect(computeGiftApplication(10000, 9500)).toEqual({
      appliedCents: 9500,
      cardCents: 0,
    });
    expect(computeGiftApplication(9500, 9500)).toEqual({
      appliedCents: 9500,
      cardCents: 0,
    });
  });

  it('applies the whole balance when the card remainder is chargeable (≥ 0.50)', () => {
    expect(computeGiftApplication(5000, 9500)).toEqual({
      appliedCents: 5000,
      cardCents: 4500,
    });
    // Exactly the minimum is fine.
    expect(computeGiftApplication(9450, 9500)).toEqual({
      appliedCents: 9450,
      cardCents: 50,
    });
  });

  it.each([
    [9499, 9500], // 1 centime short
    [9480, 9500], // 20 centimes short
    [9451, 9500], // 49 centimes short
  ])(
    'never leaves a 1–49 centime card remainder (balance %i, due %i): the card pays exactly the minimum',
    (balance, due) => {
      const result = computeGiftApplication(balance, due);

      expect(result.cardCents).toBe(MIN_CARD_CHARGE_CENTS);
      expect(result.appliedCents).toBe(due - MIN_CARD_CHARGE_CENTS);
      // The ledger stays exact: nothing is waived, the centimes not applied
      // simply stay on the gift card.
      expect(result.appliedCents).toBeLessThanOrEqual(balance);
      expect(result.appliedCents + result.cardCents).toBe(due);
      expect(balance - result.appliedCents).toBeGreaterThan(0);
    }
  );

  it('applies nothing from an empty card or to nothing due', () => {
    expect(computeGiftApplication(0, 9500)).toEqual({
      appliedCents: 0,
      cardCents: 9500,
    });
    expect(computeGiftApplication(5000, 0)).toEqual({
      appliedCents: 0,
      cardCents: 0,
    });
  });
});
